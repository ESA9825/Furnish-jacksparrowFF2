"""Refine the three existing 1601 bedding OBJ assets in metres.

Run with Blender --background --python <this file> -- <legacy-items.json> <output>.
The input is the three furniture records (including their original OBJ data).
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

PRODUCTS = {
    'bedsoft_40484425': ('luktjasmin-40484425', '#78939e', .47),
    'soft1601_second_60632458_1': ('angslilja-60632458', '#9eae96', .87),
    'bedsoft_00529096': ('hornmal-00529096', '#dbd4c6', .93),
}


def components(positions):
    """Weld the legacy triangle stream by coordinate, then split loose pieces."""
    vertices = {}
    triangles = []
    neighbors = {}
    for start in range(0, len(positions), 9):
        face = tuple(vertices.setdefault(tuple(positions[i:i + 3]), len(vertices))
                     for i in range(start, start + 9, 3))
        if len(set(face)) != 3:
            continue
        triangles.append(face)
        for v in face:
            neighbors.setdefault(v, set()).update(face)
    pending = set(neighbors)
    points = list(vertices)
    groups = []
    while pending:
        group = {min(pending)}
        pending.difference_update(group)
        queue = list(group)
        while queue:
            connected = neighbors[queue.pop()] & pending
            pending.difference_update(connected)
            group.update(connected)
            queue.extend(connected)
        index = {v: i for i, v in enumerate(sorted(group))}
        groups.append(([Vector(points[v]) for v in index],
                       [tuple(index[v] for v in tri) for tri in triangles if tri[0] in group]))
    return sorted(groups, key=lambda part: (-len(part[1]), min(v.z for v in part[0])))


def bounds(points):
    return [Vector(fn(v[i] for v in points) for i in range(3)) for fn in (min, max)]


def relax(points, faces, rounds, rate=.52):
    """Alternate positive and negative passes to smooth cloth without shrinking it."""
    neighbors = [set() for _ in points]
    for a, b, c in faces:
        neighbors[a].update((b, c))
        neighbors[b].update((a, c))
        neighbors[c].update((a, b))
    for _ in range(rounds):
        for gain in (rate, -rate * 1.045):
            points = [
                v.lerp(sum((points[j] for j in ring), Vector()) / len(ring), gain)
                for v, ring in zip(points, neighbors)
            ]
    return points


def ease(value):
    value = min(1, max(0, value))
    return value * value * (3 - 2 * value)


def refine_duvet(points, faces, green):
    low, high = bounds(points)
    span = high - low
    result = []
    for v in relax(points, faces, 14 if green else 17):
        x, y, z = v
        u, side = (x - low.x) / span.x, z / (span.z / 2)
        top = ease((y - .17) / .11)
        # The crown has broad, asymmetrical folds. The outside hem keeps
        # the existing mattress coverage and hanging depth.
        crease = math.exp(-((u - .31 - .13 * side) / .071) ** 2)
        counter = math.exp(-((u - .55 + .13 * side) / .087) ** 2)
        fan = math.exp(-((side - .33 + .9 * (u - .31)) / .13) ** 2 - ((u - .37) / .19) ** 2)
        roll = math.exp(-((u - .079 - .018 * math.sin(4 * side + .8)) / .031) ** 2)
        edge = ease((abs(side) - .73) / .25)
        clear = .0015 + (0 if green else .0015)
        y += clear * top + top * (1 - edge * .74) * (
            .018 * roll + (.017 if green else .012) * crease
            - .006 * counter + .008 * fan
        )
        result.append(Vector((x, y, z)))
    return result, faces


def pillow(points, phase):
    low, high = bounds(points)
    cx, _, cz = (low + high) / 2
    hx, _, hz = (high - low) / 2
    # The shell tapers to the stitched edge, with more loft on its top face.
    # Three closely spaced rings resolve the narrow folded edge itself.
    rings = [(.16, 1), (.31, 1), (.46, 1), (.59, 1), (.70, 1), (.80, 1),
             (.88, 1), (.94, 1), (.975, 1), (.992, 1), (1, 0),
             (.992, -1), (.975, -1), (.94, -1), (.88, -1), (.80, -1),
             (.70, -1), (.59, -1), (.46, -1), (.31, -1), (.16, -1)]
    count = 64
    center = .314
    def point(ux, uz, fullness):
        bias = 1 + .045 * math.sin(3.2 * uz + phase) - .035 * uz * ux
        x, z = cx + hx * ux * bias, cz + hz * uz
        valley = (.006 * math.exp(-((ux - .20 - .2 * uz) / .16) ** 2)
                  + .005 * math.exp(-((ux + .29 + .3 * uz) / .21) ** 2))
        y = center + .061 * ux - .008 * uz * ux + fullness
        if fullness > 0:
            y -= valley * ease((abs(uz) - .3) / .58)
        return Vector((x, y, z))
    vertices = []
    for radius, side in rings:
        for i in range(count):
            angle = i * 2 * math.pi / count
            c, s = math.cos(angle), math.sin(angle)
            rectangularity = 5.2
            fact = (abs(c)**rectangularity + abs(s)**rectangularity)**(-1 / rectangularity)
            ux, uz = radius * c * fact, radius * s * fact
            arch = max(0, 1 - radius * radius)**.54
            fullness = side * arch * (.154 if side > 0 else .12) * (1 + .16 * ux)
            vertices.append(point(ux, uz, fullness))
    vertices.extend((point(0, 0, .154), point(0, 0, -.12)))
    faces = []
    for row in range(len(rings) - 1):
        for i in range(count):
            j = (i + 1) % count
            a, b = row * count + i, row * count + j
            faces.append((a, b, b + count, a + count))
    for i in range(count):
        j = (i + 1) % count
        offset = (len(rings) - 1) * count
        faces.extend(((len(vertices) - 2, j, i), (len(vertices) - 1, offset + i, offset + j)))
    return vertices, faces


def material(name, hex_color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    def linear(component):
        return ((component + .055) / 1.055)**2.4 if component > .04045 else component / 12.92
    color = [linear(int(hex_color[i:i+2], 16) / 255) for i in (1, 3, 5)]
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    mat.diffuse_color = (*color, 1)
    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Sheen Weight'].default_value = .28 if roughness > .7 else .13
    return mat


def mesh_object(name, points, faces, cloth, collection):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(v.x, -v.z, v.y) for v in points], [], faces)
    mesh.validate(verbose=False)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    assert all(p.area > 1e-10 for p in mesh.polygons), name
    for face in mesh.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(cloth)
    return obj


def create_product(item, master=None):
    name, color, roughness = PRODUCTS[item['id']]
    group = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(group)
    old = components(item['obj']['positions'])
    if name.startswith('hornmal'):
        top, faces = old[0]
        parts = [('woven-body', relax(top, faces, 12), faces)]
        parts += [(f'fringe-{i:02}', relax(v, f, 2, .35), f)
                  for i, (v, f) in enumerate(sorted(old[1:], key=lambda p: min(v.x for v in p[0])), 1)]
    else:
        green = name.startswith('angslilja')
        parts = [('filled-duvet', *refine_duvet(*old[0], green))]
        pillows = sorted((p for p in old[1:] if len(p[1]) > 1000), key=lambda p: min(v.z for v in p[0]))
        assert len(pillows) == (1 if green else 2), name
        parts += [(f'pillow-{i + 1}', *pillow(v, -1.1 + i * 2.25)) for i, (v, _) in enumerate(pillows)]
    old_min, old_max = Vector(item['obj']['min']), Vector(item['obj']['max'])
    actual_min, actual_max = bounds([v for _, points, _ in parts for v in points])

    def rescale(value, axis):
        return old_min[axis] + (value - actual_min[axis]) * (old_max[axis] - old_min[axis]) / (actual_max[axis] - actual_min[axis])

    fitted = []
    old_bottom, old_top = bounds(old[0][0])
    body_min, body_max = bounds(parts[0][1])
    for role, points, faces in parts:
        def position(p):
            y = rescale(p.y, 1)
            if role == 'filled-duvet':
                # Hold the support height and drape while changing pillow loft.
                y = old_bottom.y + (p.y-body_min.y)*(old_top.y-old_bottom.y)/(body_max.y-body_min.y)
            return Vector((rescale(p.x, 0), y, rescale(p.z, 2)))
        fitted.append((role, [position(p) for p in points], faces))

    mount, height = item['mountHeight'], item['h']
    if master is not None:
        deck_item, deck_parts = master
        _, deck_points, deck_faces = deck_parts[0]
        duvet_bvh = BVHTree.FromPolygons(deck_points, deck_faces, all_triangles=True)
        _, runner_points, runner_faces = fitted[0]
        runner_bvh = BVHTree.FromPolygons(runner_points, runner_faces, all_triangles=True)
        dx = (item['cx'] - deck_item['cx']) / 1000
        dz = (item['cy'] - deck_item['cy']) / 1000
        below, above = Vector((0, 1, 0)), Vector((0, -1, 0))

        def settle(point):
            x, y, z = point
            contact = duvet_bvh.ray_cast(Vector((x+dx, 1, z+dz)), above)[0]
            old_underside = runner_bvh.ray_cast(Vector((x, -1, z)), below)[0]
            if old_underside is None:
                sample_x = x * .975
                sample_z = min(.637, max(-.682, z))
                old_underside = runner_bvh.ray_cast(Vector((sample_x, -1, sample_z)), below)[0]
            if contact is not None and old_underside is not None:
                y += contact.y + deck_item['mountHeight']/1000 + .004 - old_underside.y
            else:
                y += item['mountHeight']/1000 + .013
            return Vector((x, y, z))

        fitted = [(role, [settle(p) for p in points], faces) for role, points, faces in fitted]
        bottom, top = bounds([v for _, points, _ in fitted for v in points])
        height, mount = round((top.y-bottom.y)*1000, 3), round(bottom.y*1000, 3)
        for _, points, _ in fitted:
            for point in points:
                point.y -= bottom.y

    cloth = material(name, color, roughness)
    objects = [mesh_object(f'{name}--{role}', points, faces, cloth, group) for role, points, faces in fitted]
    return group, objects, fitted, {'id':item['id'], 'w':item['w'], 'd':item['d'], 'h':height, 'mountHeight':mount}


def main():
    source, dest = map(Path, sys.argv[sys.argv.index('--') + 1:])
    dest.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    items = {item['id']: item for item in json.loads(source.read_text()) if item['id'] in PRODUCTS}
    assert items.keys() == PRODUCTS.keys()
    master_item = items['bedsoft_40484425']
    master = create_product(master_item)
    sets = [
        master,
        create_product(items['soft1601_second_60632458_1']),
        create_product(items['bedsoft_00529096'], (master_item, master[2])),
    ]
    for group, objects, _, _ in sets:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.ops.wm.obj_export(filepath=str(dest / (group.name + '.obj')), export_selected_objects=True,
                              export_triangulated_mesh=True, export_materials=False,
                              forward_axis='NEGATIVE_Z', up_axis='Y')
        bpy.ops.export_scene.gltf(filepath=str(dest / (group.name + '.glb')), use_selection=True)
    bpy.ops.object.select_all(action='DESELECT')
    # Space the editable assets apart in a single source scene. Individual
    # export files above retain each object's registered Furnish bounds.
    for offset, (_, objects, _, _) in zip((0, 2.75, 5.5), sets):
        for obj in objects:
            obj.location.y += offset
    (dest / 'placement.json').write_text(json.dumps(
        {group.name: placement for group, _, _, placement in sets}, indent=2) + '\n')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(dest / 'bedding-1601.blend'))


if __name__ == '__main__':
    main()
