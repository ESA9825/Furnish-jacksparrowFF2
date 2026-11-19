"""Author the MJZNCL08LM drive enclosure in metres, bottom at Z=0."""
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)
profile = 'curtain-mijia-3-pro-motor'
spec = json.loads((Path(__file__).parent / 'lib' / (profile + '-spec.json')).read_text())
width, height, depth = spec['size']
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, roughness):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    result.diffuse_color = (*color, 1)
    return result

shell = material('Warm white molded shell', (.70, .71, .69), .37)
drive = material('Drive connector', (.64, .65, .65), .43)
seam = material('Lower housing seam', (.63, .64, .64), .55)
status = material('Status window', (.31, .33, .33), .35)

def box(name, size, center, surface, radius):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(v / 1000 for v in center))
    obj = bpy.context.object
    obj.name = name
    obj['furnishStablePart'] = profile + '-v1:' + name
    obj.dimensions = tuple(v / 1000 for v in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    bevel = obj.modifiers.new('Molded edges', 'BEVEL')
    bevel.width = radius / 1000
    bevel.segments = 3
    normals = obj.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True

body_height = height - 15
box('housing', (width, depth, body_height - 2), (0, 0, (body_height + 2) / 2), shell, 3)
box('base-seam', (width - 3.2, depth - 3.2, 2.9), (0, 0, 1.45), seam, .55)
box('drive-neck', (53, 48, 16), (-25, 0, height - 8), drive, 2.5)
box('second-drive-cap', (31, 33, 2.7), (25, 0, body_height + 1), drive, 1.1)
box('indicator', (3.1, .5, 1.8), (43, -depth / 2 + .25, 65), status, .22)

if '--preflight-contract' in args:
    sys.path.insert(0, str(Path(__file__).parent / 'lib'))
    from blender_asset_preflight import from_args
    from_args(bpy.context.scene)

model = out / (profile + '-v1')
bpy.ops.wm.save_as_mainfile(filepath=str(model.with_suffix('.blend')), compress=True)
bpy.ops.export_scene.gltf(filepath=str(model.with_suffix('.glb')), export_extras=True)
if '--result' in args:
    Path(args[args.index('--result') + 1]).write_text(
        json.dumps({'passed': True, 'parts': len(bpy.context.scene.objects), 'blender': bpy.app.version_string}),
        encoding='utf-8')
if '--render' in args:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new('Studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.62, .65, .7, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35

    def aim(obj, target):
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

    for xyz, power, size in [((.11, -.19, .25), 11, .21), ((-.16, -.02, .12), 5, .18)]:
        bpy.ops.object.light_add(type='AREA', location=xyz)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = 'DISK'
        light.data.size = size
        aim(light, (0, 0, .05))
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
    scene.camera.data.type = 'ORTHO'
    scene.camera.data.ortho_scale = .167
    scene.render.resolution_x = scene.render.resolution_y = 650
    scene.render.resolution_percentage = 100
    for name, position in [('front', (0, -.31, .046)), ('angle', (.19, -.26, .18)), ('top', (.04, -.05, .35))]:
        scene.camera.location = position
        aim(scene.camera, (0, 0, .046))
        scene.render.filepath = str(out / (name + '.png'))
        bpy.ops.render.render(write_still=True)
