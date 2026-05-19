"""
NSY — Diagnostic: render the raw .blend without ANY modification.
Used to verify whether the source .blend looks like a car BEFORE we
start poking it with our pipeline.

Run:
    blender --background --python scripts/diagnose-renault.py -- \
        <input.blend> <output-preview-dir>
"""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv
if "--" in argv:
    user_argv = argv[argv.index("--") + 1:]
else:
    user_argv = []

INPUT_BLEND = os.path.abspath(user_argv[0])
PREVIEW_DIR = os.path.abspath(user_argv[1])
os.makedirs(PREVIEW_DIR, exist_ok=True)

print(f"[DIAG] Loading: {INPUT_BLEND}")
bpy.ops.wm.open_mainfile(filepath=INPUT_BLEND)

# Print the visibility state and matrix_world of every mesh object
all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"[DIAG] {len(all_meshes)} meshes in scene")

# Compute the world-space bbox WITHOUT touching transforms
scene_min = Vector((float("inf"),) * 3)
scene_max = Vector((float("-inf"),) * 3)
visible_count = 0
hidden_count = 0
for obj in all_meshes:
    if obj.hide_get() or obj.hide_viewport or obj.hide_render:
        hidden_count += 1
        continue
    if not obj.data or not obj.data.vertices:
        continue
    visible_count += 1
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        scene_min.x, scene_min.y, scene_min.z = min(scene_min.x, w.x), min(scene_min.y, w.y), min(scene_min.z, w.z)
        scene_max.x, scene_max.y, scene_max.z = max(scene_max.x, w.x), max(scene_max.y, w.y), max(scene_max.z, w.z)

scene_size = scene_max - scene_min
scene_center = (scene_min + scene_max) / 2
print(f"[DIAG] Visible meshes: {visible_count}, hidden: {hidden_count}")
print(f"[DIAG] World bbox: min={tuple(round(c,2) for c in scene_min)} max={tuple(round(c,2) for c in scene_max)}")
print(f"[DIAG] World center: {tuple(round(c,2) for c in scene_center)}")
print(f"[DIAG] World size  : {tuple(round(c,2) for c in scene_size)}")

# Print each visible object's world center (to spot outliers)
print(f"[DIAG] Per-object world centers (sorted by distance from scene center):")
obj_centers = []
for obj in all_meshes:
    if obj.hide_get() or obj.hide_viewport or obj.hide_render:
        continue
    if not obj.data or not obj.data.vertices:
        continue
    mn = Vector((float("inf"),) * 3)
    mx = Vector((float("-inf"),) * 3)
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
        mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
    center = (mn + mx) / 2
    dist = (center - scene_center).length
    obj_centers.append((dist, obj.name, center, (mx - mn)))

obj_centers.sort(key=lambda x: -x[0])  # furthest first
for dist, name, center, size in obj_centers[:10]:
    c = tuple(round(x, 2) for x in center)
    s = tuple(round(x, 2) for x in size)
    print(f"[DIAG]   dist={dist:7.2f}  center={c}  size={s}  name={name}")

# ───── Render preview of the RAW scene ─────
scene = bpy.context.scene

# Clear existing cameras and lights
for o in list(scene.objects):
    if o.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(o, do_unlink=True)

# Place camera at distance 2.5× the bbox max-dim, looking at the bbox center
cam_radius = max(scene_size.x, scene_size.y, scene_size.z) * 1.5 + 1.0
theta = math.radians(45)
phi = math.radians(20)
cam_x = scene_center.x + cam_radius * math.cos(phi) * math.sin(theta)
cam_y = scene_center.y - cam_radius * math.cos(phi) * math.cos(theta)
cam_z = scene_center.z + cam_radius * math.sin(phi)
bpy.ops.object.camera_add(location=(cam_x, cam_y, cam_z))
cam = bpy.context.object
direction = scene_center - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# Workbench render — fast
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.type = "SOLID"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.light = "STUDIO"
scene.display.shading.background_type = "VIEWPORT"
scene.display.shading.background_color = (0.04, 0.06, 0.10)
scene.render.resolution_x = 1200
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"

# Render from 4 angles to fully understand the layout
angles = [
    ("front",    math.radians(0),   math.radians(10)),
    ("side",     math.radians(90),  math.radians(10)),
    ("3quarter", math.radians(45),  math.radians(20)),
    ("top",      math.radians(0),   math.radians(85)),
]
for label, t, p in angles:
    cam.location = (
        scene_center.x + cam_radius * math.cos(p) * math.sin(t),
        scene_center.y - cam_radius * math.cos(p) * math.cos(t),
        scene_center.z + cam_radius * math.sin(p),
    )
    direction = scene_center - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    out = os.path.join(PREVIEW_DIR, f"raw_{label}.png")
    scene.render.filepath = out
    print(f"[DIAG] Rendering {label} → {out}")
    bpy.ops.render.render(write_still=True)

print("[DIAG] Done.")
