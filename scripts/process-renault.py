"""
NSY — Renault R25 Baccara 1992 wireframe pipeline (v2)
─────────────────────────────────────────────────────
Headless Blender script that takes the raw .blend and produces a clean,
centered, web-optimised wireframe .glb for the Hobbies/Loisirs page.

What this version fixes vs the first pass:
- The raw model's bbox was Z: [-100, +62] → center at Z=-19, off-axis.
  After this pass: bbox is symmetric around (0, 0, 0), so model-viewer's
  orbit pivot lands exactly on the visual center.
- All meshes are joined into a single object so model-viewer sees one
  tight bounding box instead of dozens of empty/offset parent nodes.
- Decimate ratio is tuned for "readable wireframe" (not too dense, not
  too sparse) — target ~50k triangles before Wireframe modifier.

Run with:
  blender --background --python scripts/process-renault.py -- \
      <input.blend> <output.glb>

Author: Cédric Barme / NSY
"""
import bpy
import bmesh
import sys
import os
from mathutils import Vector, Matrix

# ───── Parse CLI args (after `--`) ─────
argv = sys.argv
if "--" in argv:
    user_argv = argv[argv.index("--") + 1:]
else:
    user_argv = []

if len(user_argv) < 2:
    print("Usage: blender --background --python process-renault.py -- <input.blend> <output.glb>")
    sys.exit(1)

INPUT_BLEND = os.path.abspath(user_argv[0])
OUTPUT_GLB = os.path.abspath(user_argv[1])

print(f"[NSY] Input  : {INPUT_BLEND}")
print(f"[NSY] Output : {OUTPUT_GLB}")

# ───── 1. Load the source .blend ─────
bpy.ops.wm.open_mainfile(filepath=INPUT_BLEND)

# ───── 2. Purge non-mesh objects (cameras, lights, empties) ─────
print("[NSY] Purging cameras/lights/empties…")
for obj in list(bpy.data.objects):
    if obj.type != "MESH":
        bpy.data.objects.remove(obj, do_unlink=True)

# ───── 2b. Respect the artist's hidden state ─────
# The source .blend hides display pedestals, light probes, ground planes,
# turntables — anything that is not the car. Un-hiding them (as the first
# version did) pulled in two huge spheres + a bar that overwhelmed the
# bbox and squashed the actual car down to a tiny wireframe.
# Rule: a mesh that is hidden in viewport, render or globally is not car.
all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"[NSY] All meshes in scene: {len(all_meshes)}")

mesh_objects = []
for obj in all_meshes:
    hidden_viewport_eye = obj.hide_get()       # the eye icon
    hidden_disable_view = obj.hide_viewport    # the monitor icon
    hidden_render = obj.hide_render            # the camera icon
    if hidden_viewport_eye or hidden_disable_view or hidden_render:
        print(f"[NSY]   - SKIP (hidden): {obj.name}")
        continue
    # NOTE: we deliberately do NOT filter by name. The source .blend uses
    # generic words like "floor", "plane", "console" for actual car parts
    # (BACK_FLOOR = trunk, BOTTOM_FLOOR = underside, F_CONSOLE_AND_FLOOR =
    # front console + floorboard, etc.) — filtering on these names was
    # eating legitimate body panels. We rely on the size-based outlier
    # filter (below) instead.
    mesh_objects.append(obj)

print(f"[NSY] Mesh objects kept after visibility/name filter: {len(mesh_objects)}")
if not mesh_objects:
    print("[NSY] ERROR: No mesh objects survived filtering")
    sys.exit(1)

# Make sure the kept ones are fully selectable (don't change hide state of the
# ones we already decided to drop — those still need to be removed entirely)
for obj in mesh_objects:
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.hide_select = False
    obj.hide_render = False

# Remove the dropped ones from the scene entirely so they cannot leak into
# downstream operators (join, transform_apply etc.)
for obj in all_meshes:
    if obj not in mesh_objects:
        bpy.data.objects.remove(obj, do_unlink=True)

# ───── 3b. Per-object bbox diagnostic + size-based outlier filter ─────
# Compute each kept mesh's world-space bbox max-dim. The median size of
# car parts is a reliable anchor: anything more than 25x the median is an
# outlier (display rig, light probe, environment sphere, etc.).
print("[NSY] Per-object bbox sizes (world-space)…")
obj_sizes = {}
for obj in mesh_objects:
    if not obj.data or not obj.data.vertices:
        obj_sizes[obj.name] = 0.0
        continue
    mn = Vector((float("inf"),) * 3)
    mx = Vector((float("-inf"),) * 3)
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
        mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
    s = mx - mn
    obj_sizes[obj.name] = max(s.x, s.y, s.z)

sizes_sorted = sorted(obj_sizes.values())
median_size = sizes_sorted[len(sizes_sorted) // 2] if sizes_sorted else 0.0
print(f"[NSY] Median object max-dim: {median_size:.3f}")
print(f"[NSY] Largest 5 objects:")
for name, sz in sorted(obj_sizes.items(), key=lambda kv: -kv[1])[:5]:
    print(f"[NSY]   {sz:8.3f}  {name}")

OUTLIER_THRESHOLD = max(median_size * 25.0, 6.0)  # at least 6 units floor
outliers = [name for name, sz in obj_sizes.items() if sz > OUTLIER_THRESHOLD]
if outliers:
    print(f"[NSY] Removing {len(outliers)} outlier object(s) (max-dim > {OUTLIER_THRESHOLD:.2f}):")
    for name in outliers:
        print(f"[NSY]   - DROP outlier: {name} (size={obj_sizes[name]:.2f})")
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    mesh_objects = [o for o in mesh_objects if o.name not in outliers]

print(f"[NSY] Mesh objects after outlier filter: {len(mesh_objects)}")

# ───── 4. Bake world transforms into mesh data, clear parenting ─────
# CRITICAL: bpy.ops.object.transform_apply only applies the LOCAL transform,
# not parent-child hierarchy. The source .blend has many parented objects
# (antenna parented to body, mirror parented to door, etc.), so a plain
# transform_apply leaves children in their PARENT-relative coordinate space.
# After join + scale, the result is parts flying around to weird positions
# (exactly the "complètement flingué" bug).
#
# Fix: directly multiply each mesh's local coords by its world matrix,
# then reset the object's matrix to identity. This guarantees every vertex
# is now in world space, regardless of any parent chain.
print("[NSY] Baking matrix_world into each mesh's vertex data…")
from mathutils import Matrix as _M
for obj in mesh_objects:
    if obj.data and obj.data.vertices:
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = _M.Identity(4)
bpy.context.view_layer.update()

# Now safe to clear parents (everything is already in world space)
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_objects[0]
bpy.ops.object.parent_clear(type="CLEAR")

# ───── 4b. Join all meshes into one object ─────
print("[NSY] Joining meshes…")
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_objects[0]
bpy.ops.object.join()

merged = bpy.context.view_layer.objects.active
merged.name = "Renault_R25_Baccara"
print(f"[NSY] Merged into one object: {merged.name} ({len(merged.data.vertices)} verts)")

# ───── 5. Recenter + scale-normalise — all baked directly into mesh data ─────
# Using mesh.data.transform() is more robust than operators in --background mode:
# it works on the mesh data directly, no selection/active-object dance needed.

def world_bbox(obj):
    mn = Vector((float("inf"),) * 3)
    mx = Vector((float("-inf"),) * 3)
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
        mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
    return mn, mx, (mn + mx) / 2, (mx - mn)

# Reset the object's transform to identity so it doesn't fight us
merged.location = (0.0, 0.0, 0.0)
merged.rotation_euler = (0.0, 0.0, 0.0)
merged.scale = (1.0, 1.0, 1.0)
bpy.context.view_layer.update()

mn, mx, center, size = world_bbox(merged)
print(f"[NSY] Pre-bake bbox  : min={tuple(round(c, 3) for c in mn)} max={tuple(round(c, 3) for c in mx)}")
print(f"[NSY] Pre-bake center: {tuple(round(c, 3) for c in center)}")
print(f"[NSY] Pre-bake size  : {tuple(round(c, 3) for c in size)}")

# Bake "translate to center" + "scale to 2-unit max dim" into the mesh in a single matrix
print("[NSY] Baking recenter + scale into mesh data…")
max_dim = max(size.x, size.y, size.z)
scale_factor = 2.0 / max_dim if max_dim > 0 else 1.0
# Translate by -center, then scale by scale_factor
xform = Matrix.Scale(scale_factor, 4) @ Matrix.Translation(-center)
merged.data.transform(xform)
merged.data.update()

bpy.context.view_layer.update()
mn, mx, center, size = world_bbox(merged)
print(f"[NSY] Post-bake bbox : min={tuple(round(c, 3) for c in mn)} max={tuple(round(c, 3) for c in mx)}")
print(f"[NSY] Post-bake center: {tuple(round(c, 3) for c in center)}  (should be ~0,0,0)")
print(f"[NSY] Post-bake size : {tuple(round(c, 3) for c in size)}  (max should be ~2)")

# ───── 6. Re-orient so the LONGEST axis is along Blender Y ─────
# Blender exports with Y-up convention: Blender Z → glTF Y (height),
# Blender Y → glTF -Z (depth, horizontal). For a normal "car on a turntable"
# look, we want:
#   - shortest axis (width)  → Blender X  (already the case here)
#   - longest  axis (length) → Blender Y  (becomes horizontal in model-viewer)
#   - middle   axis (height) → Blender Z  (becomes vertical in model-viewer)
# The source has length along Z (24.2 = largest), so we swap Y↔Z with a
# 90° rotation around X. Without this, auto-rotate spins the car around
# its own length axis (rotisserie effect) instead of horizontally.
import math
axes = [("X", size.x), ("Y", size.y), ("Z", size.z)]
axes.sort(key=lambda x: -x[1])
longest_axis = axes[0][0]
print(f"[NSY] Longest axis = {longest_axis} (size={axes[0][1]:.3f})")

if longest_axis == "Z":
    # Swap Y↔Z: rotate +90° around X. (Y_new = Z_old, Z_new = -Y_old)
    print("[NSY] Rotating +90° around X to put length on Y…")
    rot = Matrix.Rotation(math.radians(90), 4, "X")
    merged.data.transform(rot)
    merged.data.update()
elif longest_axis == "X":
    # Swap X↔Y: rotate +90° around Z.
    print("[NSY] Rotating +90° around Z to put length on Y…")
    rot = Matrix.Rotation(math.radians(90), 4, "Z")
    merged.data.transform(rot)
    merged.data.update()
# else: already on Y, nothing to do

bpy.context.view_layer.update()
mn, mx, center, size = world_bbox(merged)
print(f"[NSY] After re-orient: bbox size={tuple(round(c, 3) for c in size)}, center={tuple(round(c, 3) for c in center)}")

# ───── 7. Decimate — PLANAR mode (preserves silhouette) ─────
# COLLAPSE mode at ratio 0.10 was destroying the car body (which has many
# large flat panels that collapse easily) while leaving the wheels intact
# (high-curvature topology that resists collapse). Result: the user saw
# only wheels + axle, no body.
#
# PLANAR mode merges coplanar faces (anything below 5° angle) without
# changing the silhouette. The car body's flat panels (doors, roof, hood,
# trunk) become single quads, but every edge defining the car's shape is
# preserved → the wireframe still reads as a car.
print("[NSY] Adding Decimate modifier (PLANAR mode)…")
decimate = merged.modifiers.new(name="Decimate_Planar", type="DECIMATE")
decimate.decimate_type = "DISSOLVE"     # planar / un-subdivide
decimate.angle_limit = 0.0872665        # 5° in radians — merge near-coplanar faces only
decimate.delimit = {'NORMAL', 'MATERIAL'}
bpy.ops.object.modifier_apply(modifier="Decimate_Planar")
bpy.context.view_layer.update()
_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] After planar decimate: {len(merged.data.polygons)} faces, bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")

# Second pass: moderate Collapse to thin out remaining high-poly areas
# (wheels, headlights, rounded body curves) so they don't appear as
# solid blobs in the wireframe.
print("[NSY] Adding Decimate modifier (COLLAPSE pass, ratio 0.4)…")
decimate2 = merged.modifiers.new(name="Decimate_Collapse", type="DECIMATE")
decimate2.decimate_type = "COLLAPSE"
decimate2.ratio = 0.4                   # keep 40% of the remaining geometry
decimate2.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="Decimate_Collapse")
bpy.context.view_layer.update()
_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] After collapse pass: {len(merged.data.polygons)} faces, bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")

# ───── 8. Clean up the mesh: remove duplicate verts + recalc normals + triangulate ─────
print("[NSY] Cleaning mesh (merge doubles + recalc normals + triangulate)…")
bpy.context.view_layer.objects.active = merged
merged.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
# 1. Merge vertices that are within a small distance (kills duplicates that cause
#    degenerate triangles → wireframe modifier blow-up)
bpy.ops.mesh.remove_doubles(threshold=0.001)
# 2. Recalculate normals consistently outward (wireframe's offset depends on
#    the normal direction; inconsistent normals = vertices flying everywhere)
bpy.ops.mesh.normals_make_consistent(inside=False)
# 3. Triangulate everything for predictable wireframe output
bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()
_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] After cleanup : {len(merged.data.polygons)} faces, bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")

# ───── 9. Wireframe modifier (3D tubes along edges, K2000-style) ─────
print("[NSY] Adding Wireframe modifier…")
wireframe = merged.modifiers.new(name="Wireframe", type="WIREFRAME")
wireframe.thickness = 0.0025       # in object-space units (model is 2-unit max). 0.0025 ≈ 0.12% of model size
wireframe.use_even_offset = False  # stable on cleaned mesh; True can explode bbox
wireframe.use_relative_offset = False
wireframe.use_replace = True       # remove original faces, keep only the wires
wireframe.material_offset = 0
wireframe.offset = 1.0             # offset = 1 means the wires sit on top of the original surface
bpy.ops.object.modifier_apply(modifier="Wireframe")
bpy.context.view_layer.update()
_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] After wireframe: {len(merged.data.polygons)} faces, bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")

# ───── 9b. Re-center after wireframe (in case the modifier shifted the bbox slightly) ─────
print("[NSY] Final recenter…")
center_after = (_mn + _mx) / 2
fix_xform = Matrix.Translation(-center_after)
merged.data.transform(fix_xform)
merged.data.update()
bpy.context.view_layer.update()
_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] After recenter : bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")

# ───── 10. Cyan emissive material (Knight Rider / K2000 aesthetic) ─────
print("[NSY] Creating cyan emissive material…")
# Drop all existing material slots
merged.data.materials.clear()

mat = bpy.data.materials.new(name="NSY_Cyan_Wireframe")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links

# Reset node tree
for node in list(nodes):
    nodes.remove(node)

out = nodes.new(type="ShaderNodeOutputMaterial")
emission = nodes.new(type="ShaderNodeEmission")

# Cyan #00E5FF in linear space (gamma 2.2 → linear ≈ srgb_to_linear)
def srgb_to_linear(c):
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92

cyan_srgb = (0x00 / 255, 0xE5 / 255, 0xFF / 255)
cyan_linear = tuple(srgb_to_linear(c) for c in cyan_srgb) + (1.0,)

emission.inputs["Color"].default_value = cyan_linear
# Strength 1.0 keeps the cyan readable as cyan even after ACES tone-mapping
# at exposure 1.0. Anything ≥2.0 clips green+blue to (1,1) → white wires.
emission.inputs["Strength"].default_value = 1.0

links.new(emission.outputs["Emission"], out.inputs["Surface"])
merged.data.materials.append(mat)

# ───── 11. Export to glTF (binary .glb) ─────
# Force unit settings to neutral so the glTF exporter does not apply
# any extra scale at write time.
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1.0
print(f"[NSY] Unit scale_length={bpy.context.scene.unit_settings.scale_length}")

_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] PRE-EXPORT bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")
print(f"[NSY] PRE-EXPORT obj matrix_world location={tuple(round(c, 3) for c in merged.matrix_world.translation)}")
print(f"[NSY] PRE-EXPORT obj scale={tuple(round(c, 3) for c in merged.scale)}")

print(f"[NSY] Exporting to {OUTPUT_GLB}…")
bpy.ops.object.select_all(action="DESELECT")
merged.select_set(True)
bpy.context.view_layer.objects.active = merged

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,            # glTF convention
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_lights=False,
    export_cameras=False,
    export_extras=False,
    export_normals=True,
    export_texcoords=False,     # we don't have textures in the wireframe pass
    export_materials="EXPORT",
)

print(f"[NSY] ✅ Done. GLB size: {os.path.getsize(OUTPUT_GLB) / 1024 / 1024:.2f} MB")
