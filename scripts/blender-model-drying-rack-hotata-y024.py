"""Hotata Y024 layout reference, in the raised position. Dimensions are in mm."""
import bpy
import json
import math
import pathlib
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out = pathlib.Path(args[0])
out.mkdir(parents=True, exist_ok=True)
profile = args[args.index('--profile')+1] if '--profile' in args else 'drying-rack-hotata-y024'
spec = json.loads((pathlib.Path(__file__).parent/'lib'/(profile+'-spec.json')).read_text(encoding='utf-8'))
half_width = spec['size'][0] / 2
hole_count = 25 if profile == 'drying-rack-hotata-y024-2m' else 31
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1


def material(name, srgb, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
              for v in (int(srgb[i:i+2], 16) / 255 for i in (0, 2, 4))]
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


cream = material('Cream coated aluminium', 'e5d6ac', .32, .36)
pink = material('Dusty pink end caps', 'e7a7a7', .44)
steel = material('Steel wire', '646669', .37, .75)


def point(xyz):
    x, y, z = xyz
    return Vector((x / 1000, -z / 1000, y / 1000))


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.material_index = 0
    obj['furnishStablePart'] = profile + '-v1:' + name
    obj['furnishRecolor'] = mat == cream
    return obj


def box(center, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(center))
    obj = bpy.context.object
    obj.dimensions = (size[0] / 1000, size[2] / 1000, size[1] / 1000)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def cylinder(center, radius, length, axis=(0, 1, 0), segments=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius / 1000,
                                       depth=length / 1000, location=point(center))
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(point(axis).normalized())
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return obj


def hang_rail(name, z):
    rail = box((0, 404, z), (2 * (half_width - 8), 42, 16))
    holes = [cylinder(((index - (hole_count - 1) / 2) * 76, 403, z), 10, 24, (0, 0, 1), 12)
             for index in range(hole_count)]
    bpy.ops.object.select_all(action='DESELECT')
    for hole in holes:
        hole.select_set(True)
    bpy.context.view_layer.objects.active = holes[0]
    bpy.ops.object.join()
    cutter = bpy.context.object
    bpy.context.view_layer.objects.active = rail
    modifier = rail.modifiers.new('Through holes', 'BOOLEAN')
    modifier.operation = 'DIFFERENCE'
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    finish(rail, name, cream)


for side, z in [('window', -225), ('room', 225)]:
    moving = 'moving-' + side + '-'
    hang_rail(moving + 'hang-rail', z)
    finish(cylinder((0, 12.5, z), 12.5, 2 * (half_width - 8), (1, 0, 0)), moving + 'quilt-rail', cream)
    for end, sign in [('left', -1), ('right', 1)]:
        finish(box((sign * (half_width - 13), 209, z), (10, 394, 12)), moving + 'link-' + end, cream)
        finish(cylinder((sign * (half_width - 4), 404, z), 22, 8, (1, 0, 0)), moving + 'hang-cap-' + end, pink)
        finish(cylinder((sign * (half_width - 4), 12.5, z), 12.5, 8, (1, 0, 0)), moving + 'quilt-cap-' + end, pink)
        x = sign * 800
        finish(cylinder((x, 453, z), 40, 14), f'ceiling-{side}-{end}', cream)
        # Open hook above the perforated bar.
        curve = bpy.data.curves.new('Open suspension hook', 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = .0028
        curve.bevel_resolution = 1
        spline = curve.splines.new('POLY')
        spline.points.add(16)
        for index, entry in enumerate(spline.points):
            angle = math.radians(45 + index * 17)
            entry.co = (*point((x + 8 * math.cos(angle), 431 + 9 * math.sin(angle), z)), 1)
        obj = bpy.data.objects.new('hook', curve)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        finish(bpy.context.object, moving + 'hanger-' + end, cream)
        finish(cylinder((x, 440, z), 1, 12, segments=8), f'cable-{side}-{end}', steel)

sys.path.insert(0, str(pathlib.Path(__file__).parent / 'lib'))
from blender_asset_preflight import from_args
from_args(scene)
bpy.ops.wm.save_as_mainfile(filepath=str(out / (profile + '-v1.blend')))
bpy.ops.export_scene.gltf(filepath=str(out / (profile + '-v1.glb')), export_format='GLB',
                          export_extras=True, export_cameras=False, export_lights=False)
pathlib.Path(args[args.index('--result') + 1]).write_text(
    json.dumps({'passed': True, 'parts': len(scene.objects), 'blender': bpy.app.version_string}),
    encoding='utf-8')
