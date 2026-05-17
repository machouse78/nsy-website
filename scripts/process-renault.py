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

mesh_objects = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"[NSY] Mesh objects remaining: {len(mesh_objects)}")
if not mesh_objects:
    print("[NSY] ERROR: No mesh objects found")
    sys.exit(1)

# ───── 3. Make everything visible & selectable ─────
for obj in mesh_objects:
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.hide_select = False
    obj.hide_render = False

# ───── 4. Apply all transforms on every mesh, then join into one ─────
print("[NSY] Applying transforms + joining meshes…")
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)

# Activate the first mesh
bpy.context.view_layer.objects.active = mesh_objects[0]

# Apply location, rotation and scale on all selected
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Join everything into the active object
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

# ───── 7. Decimate to ~50k triangles for a readable wireframe ─────
print("[NSY] Adding Decimate modifier…")
decimate = merged.modifiers.new(name="Decimate", type="DECIMATE")
decimate.ratio = 0.10  # tuned: dense enough to read the silhouette, sparse enough for cyber feel
decimate.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="Decimate")
bpy.context.view_layer.update()
_mn, _mx, _c, _s = world_bbox(merged)
print(f"[NSY] After decimate: {len(merged.data.polygons)} faces, bbox size={tuple(round(c, 3) for c in _s)}, center={tuple(round(c, 3) for c in _c)}")

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
wireframe.thickness = 0.004        # in object-space units (we are at 2-unit scale)
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
emission.inputs["Strength"].default_value = 2.5  # nice glow under model-viewer's default exposure

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
