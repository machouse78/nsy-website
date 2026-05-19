"""
NSY — Side-by-side comparison render.
Loads either a .glb or a .blend, renders it with Cycles (closest to what
model-viewer shows in the browser), and saves a PNG.

Run:
    blender --background --python scripts/render-comparison.py -- \
        <input.glb-or-blend> <output.png>
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

if len(user_argv) < 2:
    print("Usage: blender --background --python render-comparison.py -- <input> <output.png>")
    sys.exit(1)

INPUT = os.path.abspath(user_argv[0])
OUTPUT = os.path.abspath(user_argv[1])

print(f"[CMP] Input  : {INPUT}")
print(f"[CMP] Output : {OUTPUT}")

# Start from an empty scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Load the input — either GLB or BLEND
if INPUT.lower().endswith(".glb") or INPUT.lower().endswith(".gltf"):
    print("[CMP] Loading as glTF…")
    bpy.ops.import_scene.gltf(filepath=INPUT)
elif INPUT.lower().endswith(".blend"):
    print("[CMP] Loading as .blend…")
    bpy.ops.wm.open_mainfile(filepath=INPUT)
    # Purge non-mesh objects (cameras/lights from the source .blend) so we
    # use our own scene setup.
    for obj in list(bpy.data.objects):
        if obj.type in ("CAMERA", "LIGHT"):
            bpy.data.objects.remove(obj, do_unlink=True)
else:
    print(f"[CMP] ERROR: Unsupported input format: {INPUT}")
    sys.exit(1)

# Compute the scene-wide bounding box of all visible meshes
scene_min = Vector((float("inf"),) * 3)
scene_max = Vector((float("-inf"),) * 3)
for obj in bpy.data.objects:
    if obj.type != "MESH" or not obj.data or not obj.data.vertices:
        continue
    if obj.hide_get() or obj.hide_viewport or obj.hide_render:
        continue
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        scene_min.x, scene_min.y, scene_min.z = min(scene_min.x, w.x), min(scene_min.y, w.y), min(scene_min.z, w.z)
        scene_max.x, scene_max.y, scene_max.z = max(scene_max.x, w.x), max(scene_max.y, w.y), max(scene_max.z, w.z)

scene_size = scene_max - scene_min
scene_center = (scene_min + scene_max) / 2
print(f"[CMP] World bbox: min={tuple(round(c,2) for c in scene_min)} max={tuple(round(c,2) for c in scene_max)}")
print(f"[CMP] World size: {tuple(round(c,2) for c in scene_size)}")

# Camera distance: 1.8× the max dimension
cam_radius = max(scene_size.x, scene_size.y, scene_size.z) * 1.8 + 0.5

# Camera placement — classic 3/4 car shot from the front-right, slightly above
theta = math.radians(35)
phi = math.radians(18)
cam_loc = Vector((
    scene_center.x + cam_radius * math.cos(phi) * math.sin(theta),
    scene_center.y - cam_radius * math.cos(phi) * math.cos(theta),
    scene_center.z + cam_radius * math.sin(phi),
))
bpy.ops.object.camera_add(location=cam_loc)
cam = bpy.context.object
direction = scene_center - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam
print(f"[CMP] Camera at {tuple(round(c,2) for c in cam_loc)} looking at {tuple(round(c,2) for c in scene_center)}")

# Lights: a key + fill + rim, so PBR/emission materials read cleanly
bpy.ops.object.light_add(type="SUN", location=(cam_loc.x + 3, cam_loc.y - 3, cam_loc.z + 5))
bpy.context.object.data.energy = 2.5
bpy.ops.object.light_add(type="SUN", location=(-cam_loc.x - 2, cam_loc.y + 2, cam_loc.z + 3))
bpy.context.object.data.energy = 1.0
bpy.ops.object.light_add(type="SUN", location=(0, scene_center.y + cam_radius, scene_center.z + 2))
bpy.context.object.data.energy = 1.5

# Cycles render — emissive materials show their own color regardless of light
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"  # consistent across machines
scene.render.resolution_x = 1200
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"  # don't crush colors with Filmic
scene.view_settings.exposure = 0.0

# Background — dark navy like model-viewer would have
if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.04, 0.06, 0.10, 1.0)
    bg.inputs["Strength"].default_value = 0.3

scene.render.filepath = OUTPUT
scene.render.image_settings.file_format = "PNG"
print("[CMP] Rendering with Cycles…")
bpy.ops.render.render(write_still=True)
print(f"[CMP] ✅ Saved: {OUTPUT}")
