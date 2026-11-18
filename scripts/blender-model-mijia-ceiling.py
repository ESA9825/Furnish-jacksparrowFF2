"""Model the visible layers of four Xiaomi ceiling lights in metres."""
import bpy
import bmesh
import json
import math
from pathlib import Path
import sys

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0]).resolve()
profile = args[args.index('--profile') + 1]
spec = json.loads((Path(__file__).parent / 'lib/mijia-ceiling-light-specs.json').read_text())[profile]
width, _, depth = spec['size']
radius = width / 2
rectangular = profile in ('mijia-ceiling-l60', 'mijia-ceiling-l90')
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def contour(half, z, corner):
    if not rectangular:
        return [(half * math.cos(i * math.tau / 64), half * math.sin(i * math.tau / 64), z) for i in range(64)]
    half_depth = half - (width - depth) / 2
    points = []
    for quarter, (sx, sy) in enumerate([(1, 1), (-1, 1), (-1, -1), (1, -1)]):
        for i in range(9):
            angle = (quarter + i / 8) * math.pi / 2
            points.append((sx * (half - corner) + corner * math.cos(angle),
                           sy * (half_depth - corner) + corner * math.sin(angle), z))
    return points

def part(name, rings, material, caps=False):
    vertices = [tuple(v / 1000 for v in point) for ring in rings for point in contour(*ring)]
    n = len(vertices) // len(rings)
    bands = len(rings) - int(caps)
    faces = [(j*n+i, j*n+(i+1)%n, ((j+1)%len(rings))*n+(i+1)%n, ((j+1)%len(rings))*n+i)
             for j in range(bands) for i in range(n)]
    if caps:
        faces.extend([tuple(range(n-1, -1, -1)), tuple(range(len(vertices)-n, len(vertices)))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = abs(poly.normal.z) < .98 and not rectangular
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj['furnishStablePart'] = profile + '-v1:' + name
    obj.data.materials.append(material)

def material(name, value, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (value, value, value, 1)
    node.inputs['Roughness'].default_value = rough
    return mat

# White diffuser, narrow rim and recessed ceiling-side mount. Visible proportions
# follow the marketing photos. Interior construction and screw details are unknown.
edge = 6 if rectangular else 4
part('diffuser', [(radius-edge-1,0,16),(radius-edge,2,17),(radius-edge,6,17)],
     material('opal diffuser', .92, .56), caps=True)
part('rim', [(radius-edge,2,17),(radius-1,2,22),(radius,4,23),
             (radius,42,23),(radius-2,45,22),(radius-edge,45,17)],
     material('white shell', .81, .38))
part('base', [(radius-9,44,16),(radius-9,51,16),(radius-18,51,13),(radius-18,60,13)],
     material('ceiling-side mount', .66, .52), caps=True)

sys.path.insert(0, str(Path(__file__).parent / 'lib'))
from blender_asset_preflight import from_args
from_args(scene)
bpy.ops.wm.save_as_mainfile(filepath=str(out / (profile + '-v1.blend')))
bpy.ops.export_scene.gltf(filepath=str(out / (profile + '-v1.glb')), export_format='GLB', export_extras=True)
Path(args[args.index('--result')+1]).write_text(json.dumps({'passed':True,'parts':3,'blender':bpy.app.version_string}))
