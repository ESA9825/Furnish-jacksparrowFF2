"""Y83B33 1800 mm storage bed, closed. Blender axes: front -Y, up +Z."""
import json
import math
import sys
from pathlib import Path

import bpy


def material(name, rgb, roughness=.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = m.diffuse_color
    shader.inputs['Roughness'].default_value = roughness
    return m


def box(name, size, center, mat=None, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        edge = obj.modifiers.new('Eased wood edges', 'BEVEL')
        edge.width, edge.segments = bevel, 3 if bevel < .01 else 8
        bpy.ops.object.modifier_apply(modifier=edge.name)
    if mat:
        obj.data.materials.append(mat)
    return obj


def build():
    oak = material('Red oak / natural', (.53, .345, .190))
    pine = material('Pine / slats and framing', (.61, .405, .219), .64)
    underside = material('Paulownia / floor panels', (.51, .34, .17), .65)
    hardware = material('Dark hardware', (.055, .048, .037), .39)
    diffuser = material('Warm diffuser', (.81, .61, .38), .58)
    #
    # Brand outer width and length: 1840 x 2150. Side rail: 160.
    # Rim ends at y=−1.075. Mattress recess centers at y=−.055.
    box('Oak side rail L', (.025, 2.012, .160), (-.9075, -.065, .160), oak)
    box('Oak side rail R', (.025, 2.012, .160), (.9075, -.065, .160), oak)
    box('Oak footboard', (1.840, .025, .160), (0, -1.0625, .160), oak, .003)
    box('Oak rear frame', (1.800, .034, .152), (0, .922, .159), oak)
    box('Inset recessed plinth L', (.032, 1.83, .084), (-.799, -.052, .042), pine)
    box('Inset recessed plinth R', (.032, 1.83, .084), (.799, -.052, .042), pine)
    box('Inset recessed plinth front', (1.601, .038, .084), (0, -.948, .042), pine)
    box('Inset rear structural stretcher', (1.62, .040, .084), (0, .856, .042), pine)
    for side, x in [('L', -.446), ('R', .446)]:
        box('Paulownia floor '+side, (.879, 1.83, .017), (x, -.062, .044), underside)
        box('Storage partition '+side, (.869, .026, .148), (x, -.07, .119), pine)
        box('Pine slat bearer '+side, (.038, 1.959, .037), (x*1.94, -.059, .191), pine)
    box('Central storage divider', (.028, 1.954, .162), (0, -.057, .119), pine)
    for i in range(35):
        box(f'Pine slat {i+1:02}', (1.784, .038, .020), (0, -.999+i*(1.894/34), .228), pine, .0014)
    for side, x in [('L', -.857), ('R', .857)]:
        post=box('Wood headboard upright '+side, (.077, .108, .669), (x, 1.017, .3345), oak, .004)
        for vertex in post.data.vertices:
            y,z=vertex.co.y,vertex.co.z+post.location.z
            # Front face eases forward at its foot. Back face leaves a shallow
            # recess for the skirting below the headboard.
            front=(.054-y)/.108
            vertex.co.y-=front*(.067*(1-z/.669))
            if z<.07:
                vertex.co.y-=.016*(1-z/.07)
        box('Lift-hinge closed '+side, (.022, .19, .030), (x*.98, .778, .192), hardware)
    # The deep capsule-shaped shelf is cut into the headboard. Its rear panel
    # and diffuser have depth and cast their own shadows.
    head = box('Rounded oak headboard', (1.840, .103, .456), (0, 1.0235, .689), oak, .031)
    cutter = box('Shelf cavity tool', (1.435, .220, .134), (0, .940, .793), bevel=.064)
    modifier = head.modifiers.new('Capsule shelf recess', 'BOOLEAN')
    modifier.object = cutter
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    head.data.materials.clear()
    head.data.materials.append(oak)
    for face in head.data.polygons:
        face.material_index = 0
    shelf_back=box('Recessed shelf rear board', (1.435, .013, .134), (0, 1.043, .793), oak, .002)
    shelf_light=box('Shelf light diffuser', (1.318, .010, .008), (0, .984, .852), diffuser, .002)
    power=box('Integrated power module', (.099, .039, .005), (.396, .986, .730), hardware)
    # Side photo indicates a shallow rearward lean. Approximate the lean
    # while preserving the annotated plan envelope and the true shelf cavity.
    for part in (head,shelf_back,shelf_light,power):
        for vertex in part.data.vertices:
            z=vertex.co.z+part.location.z
            vertex.co.y+=math.tan(math.radians(8))*(z-.886)
    # The chamfered headboard is the rear reference, not the angled face.
    rear=max(v.co.y+head.location.y for v in head.data.vertices)
    for part in (head,shelf_back,shelf_light,power):
        part.location.y+=1.075-rear
    for x in (-.81, .81):
        box('Underbed light diffuser', (.009, 1.822, .004), (x, -.068, .080), diffuser, .001)


def main():
    dest = Path(sys.argv[sys.argv.index('--')+1])
    dest.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    build()
    bpy.context.view_layer.update()
    mesh_objects = list(bpy.context.scene.objects)
    for obj in mesh_objects:
        obj['furnishStablePart'] = 'bed-yeswood-y83b33-v1:' + obj.name
    box_vertices = [o.matrix_world @ v.co for o in mesh_objects for v in o.data.vertices]
    lo = [min(v[k] for v in box_vertices) for k in range(3)]
    hi = [max(v[k] for v in box_vertices) for k in range(3)]
    assert all(abs((b-a)-d)<.0001 for a,b,d in zip(lo,hi,[1.840, 2.150, .917]))
    assert abs(lo[2])<1e-6
    assert all(math.isfinite(c) for v in box_vertices for c in v)
    assert all(p.area>1e-11 for o in mesh_objects for p in o.data.polygons)
    assert len({o.name for o in mesh_objects}) == len(mesh_objects)
    args = sys.argv[sys.argv.index('--')+1:]
    if '--preflight-contract' in args:
        sys.path.insert(0, str(Path(__file__).parent/'lib'))
        from blender_asset_preflight import from_args
        from_args(bpy.context.scene)
    else:
        bpy.ops.wm.obj_export(filepath=str(dest/'y83b33-1800.obj'),
                              forward_axis='NEGATIVE_Z', up_axis='Y',
                              export_materials=False, export_normals=False, export_triangulated_mesh=True)
    bpy.ops.export_scene.gltf(filepath=str(dest/'bed-yeswood-y83b33-v1.glb'), export_extras=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(dest/'bed-yeswood-y83b33-v1.blend'))
    if '--result' in args:
        Path(args[args.index('--result')+1]).write_text(json.dumps({
            'passed': True, 'blender': bpy.app.version_string, 'parts': len(mesh_objects)
        }), encoding='utf8')


if __name__ == '__main__':
    main()
