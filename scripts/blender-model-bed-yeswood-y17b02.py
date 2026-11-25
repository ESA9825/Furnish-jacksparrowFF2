"""Half Summer Y17B02 cherry storage bed, closed, Blender front -Y."""
import json
import math
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

import bpy


PROFILE = 'bed-yeswood-y17b02'
here = Path(__file__).resolve().parent
utils = spec_from_file_location('wood_bed_author', here / 'blender-model-bed-yeswood-y83b33.py')
frame = module_from_spec(utils)
utils.loader.exec_module(frame)


def post(name, x, y, height, wood):
    # Round end caps and a gradual taper below the box instead of conical feet.
    segments = 32
    rings = [
        (0, .011), (.002, .014), (.015, .016), (.045, .020), (.085, .026),
        (.120, .029), (.180, .030), (height-.032, .030), (height-.018, .027),
        (height-.008, .021), (height-.002, .012),
    ]
    vertices = [(x, y, 0)]
    for z, radius in rings:
        vertices.extend((x+radius*math.cos(i*math.tau/segments),
                         y+radius*math.sin(i*math.tau/segments), z)
                        for i in range(segments))
    vertices.append((x, y, height))
    faces = []
    for i in range(segments):
        j = (i+1) % segments
        faces.append((0, 1+j, 1+i))
        for ring in range(len(rings)-1):
            a, b = 1+ring*segments+i, 1+ring*segments+j
            faces.append((a, b, b+segments, a+segments))
        top = 1+(len(rings)-1)*segments
        faces.append((top+i, top+j, len(vertices)-1))
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    for face in data.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(wood)


def build():
    cherry = frame.material('Natural cherry', (.47, .241, .112), .47)
    pine = frame.material('Pine slats and partitions', (.64, .44, .24), .60)
    paulownia = frame.material('Paulownia storage floors', (.54, .36, .20), .63)
    steel = frame.material('Dark lift hardware', (.054, .045, .037), .48)
    # 1260 × 2120 plan envelope is estimated from the mattress well and the
    # annotated 60 mm posts. 120 mm floor gap and 290 mm box height are marked.
    for side, sign in (('L', -1), ('R', 1)):
        post('Cherry head post '+side, sign*.600, 1.030, 1.000, cherry)
        post('Cherry foot post '+side, sign*.600, -1.030, .426, cherry)
        for label, bottom, top, thickness, inset in (
            ('lower rail', .120, .172, .026, 0),
            ('middle board', .173, .357, .024, .0016),
            ('upper rail', .358, .410, .026, 0),
        ):
            frame.box('Cherry side '+side+' '+label, (thickness, 2.054, top-bottom),
                      (sign*(.604-inset), 0, (bottom+top)/2), cherry, .0025)
        frame.box('Pine slat bearer '+side, (.025, 1.997, .035),
                  (sign*.581, 0, .3565), pine, .0014)
        frame.box('Closed lift bracket '+side, (.014, .317, .037),
                  (sign*.585, .755, .327), steel, .0015)
    for label, bottom, top, thickness, inset in (
        ('lower rail', .120, .172, .031, 0),
        ('middle board', .173, .357, .028, .0016),
        ('upper rail', .358, .410, .031, 0),
    ):
        frame.box('Cherry foot '+label, (1.193, thickness, top-bottom),
                  (0, -1.026+inset, (bottom+top)/2), cherry, .0025)
    frame.box('Cherry rear box rail', (1.192, .035, .289), (0, 1.0215, .265), cherry)
    frame.box('Cherry straight headboard', (1.195, .044, .490), (0, 1.024, .731), cherry, .008)
    frame.box('Pine central divider', (.025, 1.982, .273), (0, .002, .2575), pine)
    # The head compartment is deeper than the foot compartment.
    for side, x in (('L', -.301), ('R', .301)):
        frame.box('Pine cross divider '+side, (.583, .024, .262), (x, -.315, .264), pine)
        for label, length, y in (('front', .668, -.662), ('rear', 1.289, .3425)):
            frame.box('Paulownia '+label+' floor '+side, (.583, length, .017),
                      (x, y, .132), paulownia, .0017)
    for i in range(29):
        frame.box(f'Pine lift slat {i+1:02}', (1.193, .043, .022),
                  (0, -.967+i*(1.934/28), .389), pine, .0015)
    for label, x in (('left', -.431), ('centre', 0), ('right', .431)):
        frame.box('Pine lift brace '+label, (.042, 1.976, .029),
                  (x, .001, .3665), pine, .002)


def main():
    args = sys.argv[sys.argv.index('--')+1:]
    output = Path(args[0])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    build()
    for obj in bpy.context.scene.objects:
        obj['furnishStablePart'] = PROFILE+'-v1:'+obj.name
    sys.path.insert(0, str(here / 'lib'))
    from blender_asset_preflight import from_args
    from_args(bpy.context.scene)
    output.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output/(PROFILE+'-v1.blend')))
    bpy.ops.export_scene.gltf(filepath=str(output/(PROFILE+'-v1.glb')), export_extras=True)
    result = Path(args[args.index('--result')+1])
    result.write_text(json.dumps({
        'passed': True, 'parts': len(bpy.context.scene.objects), 'blender': bpy.app.version_string,
    }), encoding='utf8')


if __name__ == '__main__':
    main()
