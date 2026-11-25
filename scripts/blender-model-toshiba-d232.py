"""Author the closed Toshiba D232 in metres, with Blender -Y facing the user."""
import argparse
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from blender_asset_preflight import from_args

PROFILE = 'toshiba-d232'


def finish(name, color, roughness, metal=0, transmission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Transmission Weight'].default_value = transmission
    mat.diffuse_color = (*color, 1)
    mat.use_backface_culling = True
    return mat


def identify(obj, name, mat):
    obj.name = name
    obj['furnishStablePart'] = PROFILE + '-v1:' + name
    obj.data.materials.append(mat)
    return obj


def mesh_part(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v/1000 for v in p) for p in vertices], [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return identify(obj, name, mat)


def rounded_rect(bounds, radius, lower_radius=None):
    x0, x1, z0, z1 = bounds
    points = []
    lower = radius if lower_radius is None else lower_radius
    for x, z, start, r in [(x1-radius, z1-radius, 0, radius), (x0+radius, z1-radius, 90, radius),
                           (x0+lower, z0+lower, 180, lower), (x1-lower, z0+lower, 270, lower)]:
        for i in range(7):
            a = math.radians(start + 15*i)
            points.append((x + r*math.cos(a), z + r*math.sin(a)))
    return points


def extrusion(name, outside, front, back, mat, opening=None):
    loops = [(outside, front), (outside, back)]
    if opening:
        loops.extend([(opening, front), (opening, back)])
    vertices = [(x, y, z) for loop, y in loops for x, z in loop]
    n = len(outside)
    edges = [(0, 1), (0, 2), (1, 3), (2, 3)] if opening else [(0, 1)]
    faces = [(a*n+i, a*n+(i+1)%n, b*n+(i+1)%n, b*n+i)
             for a, b in edges for i in range(n)]
    if not opening:
        faces.extend([tuple(reversed(range(n))), tuple(range(n, n*2))])
    return mesh_part(name, vertices, faces, mat)


def box(name, bounds, mat, bevel=0):
    low, high = bounds
    size = [(b-a)/1000 for a, b in zip(low, high)]
    bpy.ops.mesh.primitive_cube_add(size=1, location=[(a+b)/2000 for a,b in zip(low, high)])
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Rounded edges', 'BEVEL')
        modifier.width = bevel/1000
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        normal = obj.modifiers.new('Face-weighted normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return identify(obj, name, mat)


def dial(name, radius, x, z, front, back, mat):
    circle = [(x+radius*math.cos(a*math.tau/48), z+radius*math.sin(a*math.tau/48)) for a in range(48)]
    return extrusion(name, circle, front, back, mat)


def flat_marks(name, rectangles, y, mat):
    vertices, faces = [], []
    for x, z, width, height in rectangles:
        first = len(vertices)
        vertices.extend([(x,y,z), (x+width,y,z), (x+width,y,z+height), (x,y,z+height)])
        faces.append(tuple(range(first, first+4)))
    return mesh_part(name, vertices, faces, mat)


def add_logo(mat):
    bpy.ops.object.text_add(location=(-.177,-.18535,.096), rotation=(math.pi/2,0,0))
    obj = bpy.context.object
    obj.data.body = 'TOSHIBA'
    obj.data.size = .0115
    obj.data.offset = .00019
    bpy.ops.object.convert(target='MESH')
    identify(obj, 'Toshiba front wordmark', mat)


def make_model():
    white = finish('Porcelain white coated steel', (.82,.817,.802), .33)
    face = finish('Warm white glazed fascia', (.87,.859,.831), .24)
    satin = finish('Satin warm white control plastic', (.73,.718,.683), .37)
    black = finish('Graphite rubber and masking', (.021,.023,.024), .58)
    bezel = finish('Black glazed window surround', (.027,.027,.029), .25)
    glass = finish('Smoked thin glass', (.19,.169,.137), .17, transmission=.86)
    steel = finish('Stainless chamber', (.36,.342,.31), .43, .75)
    vent = finish('Brushed steam outlet', (.34,.319,.283), .36, .65)
    glyph = finish('Subtle printed touch graphics', (.66,.639,.589), .46)

    shell = rounded_rect((-210,210,31,337), 13)
    chamber = rounded_rect((-165,165,104,295), 9)
    extrusion('Wraparound chassis', shell, -156, 197, white, chamber)
    extrusion('White rear cover', rounded_rect((-208,208,33,334), 12), 195, 199.5, white)
    extrusion('Stainless cavity liner', rounded_rect((-166,166,103,296), 9), -156, 144, steel,
              rounded_rect((-162,162,107,292), 7))
    extrusion('Stainless cavity rear', rounded_rect((-163,163,106,293), 7), 143, 147, steel)
    box('Ceramic chamber floor', ((-159,-149,106),(159,140,111)), satin, 1.4)
    dial('Rear circulation grill surround', 55, 0, 200, 136, 143, vent)
    dial('Rear circulation grill dark insert', 46, 0, 200, 135.4, 136.2, bezel)
    for index, span in enumerate((44,67,82,87,82,67,44)):
        z = 200 + (index-3)*11
        box(f'Rear grill louver {index+1}', ((-span/2,134.4,z-2),(span/2,135.7,z+2)), vent, .5)

    cutout = rounded_rect((-158,158,143,278), 2.5)
    extrusion('White front door fascia', rounded_rect((-210,210,55,337), 14, 2.5), -185, -153, face, cutout)
    extrusion('Black window surround', cutout, -184.5, -172, bezel,
              rounded_rect((-146,146,154,267), 2))
    extrusion('Smoked door glass', rounded_rect((-147,147,153,268), 2), -182.5, -179.5, glass)
    box('Shadow gap at lower door seam', ((-208,-181,47),(208,-159,57)), black, .7)
    extrusion('Separate lower white fascia', rounded_rect((-208,208,19,52), 1.5, 8), -185.5, -153, face)
    box('Recessed black base', ((-185,-151,7),(185,177,37)), black, 2)
    for name, x, y in [('front left',-161,-128),('front right',161,-128),('rear left',-161,154),('rear right',161,154)]:
        box('Rubber foot '+name, ((x-15,y-12,0),(x+15,y+12,13)), black, 1.6)
    box('Steam outlet backing', ((-167,-167,8),(170,-147,24)), black, .4)
    box('Steam outlet lower lip', ((-167,-175,4),(170,-150,8)), vent, .5)
    box('Steam outlet blank span', ((-108,-172,7),(170,-151,20)), vent, .6)
    for i in range(6):
        x = -167 + i*10
        box(f'Steam outlet vane {i+1}', ((x,-174,7),(x+2.8,-154,20)), vent, .4)

    dial('Rotary dial trim ring', 23, 135, 97, -193, -185, vent)
    dial('Rotary dial face', 20.5, 135, 97, -199.5, -190, satin)
    dial('Standby key metal rim', 9, 171, 97, -187.2, -184.8, vent)
    dial('Standby key warm insert', 6.6, 171, 97, -188, -187, satin)
    add_logo(black)
    touch_marks = []
    for i, tint in enumerate(((.56,.55,.63),(.49,.56,.62),(.63,.56,.43),(.62,.46,.40))):
        x = -100 + 25*i
        for j, length in enumerate((18,14,18)):
            z = 114-j*4
            touch_marks.append((x-length/2,z,length,1.1))
        mat = finish(f'Touch icon tint {i+1}', tint, .42)
        box(f'Touch mode tint {i+1}', ((x-9,-185.25,88),(x+9,-184.9,103)), mat, .16)
    flat_marks('Touch mode glyphs', touch_marks, -185.3, glyph)
    display_marks = []
    for i in range(2):
        for j in range(4):
            x, z = 32+j*10, 91+i*16
            for dx, dz, w, h in ((0,6,5,1),(0,0,5,1),(0,-6,5,1),
                                 (-3,3,1,4),(-3,-3,1,4),(3,3,1,4),(3,-3,1,4)):
                display_marks.append((x+dx-w/2,z+dz-h/2,w,h))
    flat_marks('Segment display markings', display_marks, -185.21, glyph)


def render_studio(output):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 580
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Studio world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value = (.37,.37,.37,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value = .42
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.001))
    bpy.context.object.data.materials.append(finish('Studio background', (.29,.283,.27), .74))
    lamps = [((-.45,-.62,.85),82,.72), ((.5,-.3,.55),37,.55), ((.3,.45,.68),76,.72)]
    for location, energy, size in lamps:
        bpy.ops.object.light_add(type='AREA', location=location)
        lamp = bpy.context.object
        lamp.rotation_euler = (Vector((0,0,.15))-lamp.location).to_track_quat('-Z','Y').to_euler()
        lamp.data.energy, lamp.data.shape, lamp.data.size = energy, 'DISK', size
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    scene.camera = cam
    gray = finish('Inspection gray', (.39,.39,.39), .51)
    layer = scene.view_layers[0]

    def frame(name, position, target, scale):
        cam.location = position
        cam.rotation_euler = (Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale = scale
        scene.render.filepath = str(output / (name+'.jpg'))
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 91
        bpy.ops.render.render(write_still=True)

    layer.material_override = gray
    frame('01-outline', (.37,-1.22,.39), (0,0,.163), .64)
    lens = bpy.data.objects['Smoked door glass']
    lens.hide_render = True
    frame('02-structure', (.035,-.9,.135), (-.046,-.16,.151), .37)
    lens.hide_render = False
    layer.material_override = None
    frame('03-front', (0,-1.25,.175), (0,0,.17), .51)
    frame('04-perspective', (.37,-1.22,.39), (0,0,.163), .64)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    parser.add_argument('--preflight-contract', type=Path)
    parser.add_argument('--result', type=Path, required=True)
    parser.add_argument('--studio', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    blend, glb = (output / (PROFILE+'-v1.'+ext) for ext in ('blend','glb'))
    if blend.exists() or glb.exists():
        raise FileExistsError('Use a new output directory')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    make_model()
    bpy.ops.object.select_all(action='DESELECT')
    preflight = from_args(scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_extras=True,
                              export_cameras=False, export_lights=False)
    if args.studio:
        render_studio(output)
    args.result.write_text(json.dumps(dict(passed=True, blend=str(blend), glb=str(glb), preflight=preflight)))


if __name__ == '__main__':
    main()
