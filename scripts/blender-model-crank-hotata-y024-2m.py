"""Wall hand crank from the Y024 2 m reference. Estimated mm dimensions."""
import json
import math
import pathlib
import sys

import bpy
from mathutils import Vector

PROFILE = 'crank-hotata-y024-2m'
args = sys.argv[sys.argv.index('--') + 1:]
out = pathlib.Path(args[0]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def point(x, y, z):
    return Vector((x / 1000, -z / 1000, y / 1000))


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


cream = material('Warm ivory finish', 'e5d6ac', .36, .24)
rim = material('Pale gold collar', 'd7c698', .32, .45)
pink = material('Muted pink handle', 'e7a7a7', .48)
steel = material('Spindle steel', '8e8b83', .33, .65)


def finish(obj, name, mat, bevel=0):
    obj.name = name
    obj['furnishStablePart'] = PROFILE + '-v1:' + name
    obj['furnishRecolor'] = mat == cream
    obj.data.materials.append(mat)
    if bevel:
        edge = obj.modifiers.new('Rounded moulded edge', 'BEVEL')
        edge.width = bevel / 1000
        edge.segments = 3
        normals = obj.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def disk(name, radius, y, z, depth, mat, bevel=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius / 1000,
                                      depth=depth / 1000, location=point(0, y, z),
                                      rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return finish(obj, name, mat, bevel)


def arm(name, y, z, w, h, d, mat, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(0, y, z))
    obj = bpy.context.object
    obj.dimensions = (w / 1000, d / 1000, h / 1000)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


disk('wall-base', 48, 112, -28, 8, rim)
disk('housing', 43, 112, -12, 25, cream, 2.5)
disk('face-ring', 38, 112, 1.5, 6, rim, 1)
disk('hub', 28, 112, 9, 14, cream, 2)
arm('crank-arm', 62, 14, 18, 109, 12, cream, 3)
disk('grip-spindle', 7, 14, 20, 8, steel, 1)
disk('grip', 14, 14, 24.5, 15, pink)
arm('wire-guide', 150, -23, 14, 16, 12, rim, 1)

sys.path.insert(0, str(pathlib.Path(__file__).parent / 'lib'))
from blender_asset_preflight import from_args

from_args(scene)
bpy.ops.wm.save_as_mainfile(filepath=str(out / (PROFILE + '-v1.blend')))
bpy.ops.export_scene.gltf(filepath=str(out / (PROFILE + '-v1.glb')), export_format='GLB',
                          export_extras=True, export_cameras=False, export_lights=False)
pathlib.Path(args[args.index('--result') + 1]).write_text(
    json.dumps({'passed': True, 'parts': len(scene.objects), 'blender': bpy.app.version_string}),
    encoding='utf-8')
