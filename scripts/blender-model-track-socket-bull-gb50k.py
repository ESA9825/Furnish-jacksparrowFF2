"""GB50K display model. Furnish (x, y, z) maps to Blender (x, -z, y)."""
import json
import math
import pathlib
import sys

import bpy

PROFILE = 'track-socket-bull-gb50k'
HERE = pathlib.Path(__file__).resolve().parent
SPEC = json.loads((HERE / 'lib' / (PROFILE + '-spec.json')).read_text())
args = sys.argv[sys.argv.index('--') + 1:]
out = pathlib.Path(args[0]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def point(x, y, z):
    return (x / 1000, -z / 1000, y / 1000)


def material(name, color, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    channels = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    node.inputs['Base Color'].default_value = (
        *(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels), 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    return mat


rail = material('graphite-coated-aluminium', '4b4d4f', .39, .48)
cap = material('graphite-end-cap', '3e4042', .46)
seam = material('cap-seam', '424446', .48)
dark = material('shutter-and-recess', '161719', .57)
carrier = material('carrier-polymer', '232527', .46)
rim = material('satin-graphite-ring', '444649', .29, .52)
face = material('matte-graphite-face', '343638', .50)
indicator = material('unlit-indicator-lens', '909497', .34)


def finish(obj, name, mat, bevel):
    obj.name = name
    obj['furnishStablePart'] = PROFILE + '-v1:' + name
    obj['furnishRecolor'] = mat == rail
    obj.data.materials.append(mat)
    if bevel:
        edge = obj.modifiers.new('Edge radius', 'BEVEL')
        edge.width = bevel / 1000
        edge.segments = 3
        bpy.ops.object.modifier_apply(modifier=edge.name)
    return obj


def box(name, width, height, depth, x, y, z, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(x, y, z))
    obj = bpy.context.object
    obj.dimensions = (width / 1000, depth / 1000, height / 1000)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def disk(name, diameter, depth, x, y, z, mat, bevel=0, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=diameter / 2000,
                                      depth=depth / 1000, location=point(x, y, z),
                                      rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return finish(obj, name, mat, bevel)


def cut_hole(obj, tool):
    bpy.context.view_layer.objects.active = obj
    cut = obj.modifiers.new('Socket opening', 'BOOLEAN')
    cut.object = tool
    cut.operation = 'DIFFERENCE'
    bpy.ops.object.modifier_apply(modifier=cut.name)
    bpy.data.objects.remove(tool, do_unlink=True)


width, height, depth = SPEC['size']
rear = -depth / 2
track_front = rear + SPEC['trackDepth']
cy = height / 2
slot = SPEC['slotWidth']
lip = (height - slot) / 2
slot_start, slot_end = -177, 232

box('rail-back', width, height, 9.5, 0, cy, rear + 4.75, cap, .55)
for name, y in [('lower', lip / 2), ('upper', height - lip / 2)]:
    box('rail-' + name, width - 2, lip, 4.7, 0, y, track_front - 2.35, rail, .48)
box('feed-cap', 1.3, height - .5, 4.7, -249.35, cy, track_front - 2.35, cap, .35)
box('end-cap', 1.3, height - .5, 4.7, 249.35, cy, track_front - 2.35, cap, .35)
box('channel-shutter', slot_end - slot_start, slot, .9,
    (slot_start + slot_end) / 2, cy, track_front - 2.9, dark, .22)
box('feed-seam', slot_start + 249, slot, 4.2, (slot_start - 249) / 2, cy, track_front - 2.1, seam, .19)
box('end-seam', 249 - slot_end, slot, 4.2, (slot_end + 249) / 2, cy, track_front - 2.1, seam, .19)

for side, x in zip(('left', 'middle', 'right'), SPEC['moduleCenters'], strict=True):
    disk(side + '-carrier', 62, 10.1, x, cy, track_front + 4.85, carrier, .8)
    disk(side + '-rim', SPEC['moduleDiameter'], 9.8, x, cy, 10.6, rim, .9)
    disk(side + '-recess', 63, 1.2, x, cy, 15.55, dark, .24)
    plate = disk(side + '-face', 65.6, 2.05, x, cy, 16.975, face, .45)
    for dx, dy, angle in [
        (-6.7, 6.6, 0), (0, 6.6, 0), (6.7, 6.6, 0),
        (-6.5, -11.3, -28), (6.5, -11.3, 28)
    ]:
        tool = box('temporary-slot', 2.6, 8.6, 6, x + dx, cy + dy, 16.8, face, .24)
        tool.rotation_euler.y = math.radians(angle)
        cut_hole(plate, tool)
    cut_hole(plate, disk('temporary-indicator-pocket', 1.7, 1.2, x, cy + 27.8, 18.2, face, vertices=24))
    disk(side + '-indicator', 1.4, .22, x, cy + 27.8, 17.8, indicator, .04, 20)

sys.path.insert(0, str(HERE / 'lib'))
from blender_asset_preflight import from_args
from_args(scene)
bpy.ops.wm.save_as_mainfile(filepath=str(out / (PROFILE + '-v1.blend')), compress=True)
bpy.ops.export_scene.gltf(filepath=str(out / (PROFILE + '-v1.glb')), export_format='GLB',
                         export_extras=True, export_cameras=False, export_lights=False)
pathlib.Path(args[args.index('--result') + 1]).write_text(
    json.dumps({'passed': True, 'parts': len(scene.objects), 'blender': bpy.app.version_string}),
    encoding='utf8')
