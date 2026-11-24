"""亚朵星球深睡枕 Pro 4.0, 岩溪蓝, mounted flat, metres, feet toward -Y."""
import json
from math import cos, exp, pi, sin
from pathlib import Path
import sys

import bpy
import bmesh


PROFILE = 'pillow-atour-pro4'


def outline(width, depth, radius):
    """A rounded rectangle with samples along both the corner arcs and straight edges."""
    quarters = []
    for quadrant, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cz = sx * (width - radius), sz * (depth - radius)
        quarters.append([
            (cx + radius * cos((quadrant + i / 8) * pi / 2),
             cz + radius * sin((quadrant + i / 8) * pi / 2))
            for i in range(9)
        ])
    for i, arc in enumerate(quarters):
        yield from arc
        a, b = arc[-1], quarters[(i + 1) % 4][0]
        for j in range(1, 10):
            yield tuple(start + j / 10 * (end - start) for start, end in zip(a, b))


def seam_wave(z):
    # Across the short faces, the seam rises by the neck roll and drops midway along the depth.
    return .014 * exp(-((z - .142) / .062) ** 2) - .012 * exp(-((z + .012) / .092) ** 2)


def pillowcase():
    # Half-width, half-depth, plan corner radius, height, seam influence, neck contour influence.
    # The paired exterior rings around the stitch line turn inward to form a shallow cloth seam.
    levels = (
        (.120, .073, .017, .000, 0, 0),
        (.254, .143, .027, .000, 0, 0),
        (.306, .169, .033, .001, 0, 0),
        (.325, .185, .035, .005, 0, 0),
        (.338, .200, .038, .013, .10, 0),
        (.346, .207, .040, .024, .30, 0),
        (.349, .209, .040, .038, .73, 0),
        (.350, .210, .040, .045, .97, 0),
        (.3493, .2093, .040, .047, 1, 0),
        (.350, .210, .040, .049, 1, 0),
        (.3495, .209, .040, .056, .89, .06),
        (.346, .206, .040, .068, .59, .25),
        (.339, .199, .040, .080, .25, .50),
        (.328, .187, .041, .090, .07, .80),
        (.311, .166, .039, .098, 0, 1),
        (.290, .145, .038, .100, 0, 1),
        (.252, .110, .033, .098, 0, 1),
        (.187, .075, .025, .097, 0, 1),
        (.104, .041, .016, .097, 0, 1),
        (.048, .019, .008, .097, 0, 1),
    )
    vertices = []
    for w, d, radius, height, flow, surface in levels:
        for x, z in outline(w, d, radius):
            recess = .009 * exp(-((z + .027) / .085) ** 2) * (1 - .45 * (x / .35) ** 2)
            vertices.append((x, -z, height + flow * seam_wave(z) - surface * recess))
    count = len(vertices) // len(levels)
    faces = []
    for first in range(0, len(vertices) - count, count):
        for i in range(count):
            a, b = first + i, first + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    bottom, top = len(vertices), len(vertices) + 1
    vertices.extend(((0, 0, 0), (0, 0, .089)))
    last = (len(levels) - 1) * count
    for i in range(count):
        j = (i + 1) % count
        faces.extend(((bottom, i, j), (top, last + j, last + i)))

    mesh = bpy.data.meshes.new('Pillowcase shell')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    edit = bmesh.new()
    edit.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(edit, faces=list(edit.faces))
    assert all(edge.is_manifold for edge in edit.edges)
    assert all(face.calc_area() > 1e-10 for face in edit.faces)
    edit.to_mesh(mesh)
    edit.free()
    for face in mesh.polygons:
        face.use_smooth = True
    # Keep dimensions independent of the number and placement of the contour samples.
    scale_y = .100 / max(vertex.co.z for vertex in mesh.vertices)
    for vertex in mesh.vertices:
        vertex.co.z *= scale_y
    material = bpy.data.materials.new('Rock Creek Blue knit')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.348, .468, .608, 1)
    shader.inputs['Roughness'].default_value = .85
    material.diffuse_color = shader.inputs['Base Color'].default_value
    obj = bpy.data.objects.new('Contoured blue pillowcase', mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    obj['furnishStablePart'] = PROFILE + '-v1:' + obj.name


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    output = Path(args[0])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    pillowcase()
    sys.path.insert(0, str(Path(__file__).parent / 'lib'))
    from blender_asset_preflight import from_args
    from_args(bpy.context.scene)
    output.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output / (PROFILE + '-v1.blend')))
    bpy.ops.export_scene.gltf(filepath=str(output / (PROFILE + '-v1.glb')), export_extras=True)
    result = Path(args[args.index('--result') + 1])
    result.write_text(json.dumps({'passed': True, 'parts': 1, 'blender': bpy.app.version_string}),
                      encoding='utf-8')


if __name__ == '__main__':
    main()
