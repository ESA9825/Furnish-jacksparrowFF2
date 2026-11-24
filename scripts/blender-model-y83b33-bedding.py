"""Independent furnishings for the Y83B33 styling scene. Metres, front -Y."""
import json
import math
from pathlib import Path
import sys

import bpy

from importlib.util import module_from_spec, spec_from_file_location

spec = spec_from_file_location('bed_frame_author', Path(__file__).with_name('blender-model-bed-yeswood-y83b33.py'))
frame = module_from_spec(spec)
spec.loader.exec_module(frame)


def eased(value):
    t = max(0, min(value, 1))
    return t*t*(3-2*t)


def soft_panel(name, w, d, corner, nx, nz, levels, material):
    """A rounded rectangular grid with separate upper and lower fabric skins."""
    def axis(size, count):
        inner = size/2-corner
        return [-size/2, -size/2+corner/4, -size/2+corner/2,
                *[inner*(2*j/count-1) for j in range(count+1)],
                size/2-corner/2, size/2-corner/4, size/2]
    xs, zs = axis(w, nx), axis(d, nz)
    verts, faces = [], []
    for top in (False, True):
        for z in zs:
            for x in xs:
                ax = max(0, abs(x)-w/2+corner)
                az = max(0, abs(z)-d/2+corner)
                if ax and az:
                    ratio = max(ax, az)/math.hypot(ax, az)
                    xx = math.copysign(w/2-corner+ax*ratio, x)
                    zz = math.copysign(d/2-corner+az*ratio, z)
                else:
                    xx, zz = x, z
                verts.append((xx, -zz, levels(xx, zz, top)))
    cols, rows = len(xs), len(zs)
    layer = cols*rows
    for j in range(rows-1):
        for i in range(cols-1):
            a=j*cols+i
            face=(a, a+cols, a+cols+1, a+1)
            faces.extend((tuple(reversed(face)), tuple(v+layer for v in face)))
    rim=[*range(cols), *[j*cols+cols-1 for j in range(1, rows)],
         *[layer-1-i for i in range(1, cols)], *[j*cols for j in range(rows-2, 0, -1)]]
    for a,b in zip(rim, rim[1:]+rim[:1]):
        faces.append((a,b,b+layer,a+layer))
    return mesh(name, verts, faces, material)


def mesh(name, vertices, faces, material):
    import bmesh
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.validate()
    edit=bmesh.new()
    edit.from_mesh(data)
    bmesh.ops.recalc_face_normals(edit,faces=list(edit.faces))
    edit.to_mesh(data)
    edit.free()
    for face in data.polygons:
        face.use_smooth=True
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def mattress():
    knit=frame.material('Cream knit cover',(.87,.81,.70),.91)
    border=frame.material('Linen edge seam',(.70,.63,.52),.86)
    side=frame.material('Ivory border fabric',(.79,.72,.61),.89)
    frame.box('Cushioned mattress border',(1.800,2.000,.205),(0,0,.1025),side,.020)
    frame.box('Upper seam welt',(1.797,1.997,.012),(0,0,.183),border,.005)
    frame.box('Lower seam welt',(1.797,1.997,.012),(0,0,.023),border,.005)

    def elevation(x,z,top):
        if not top:
            return .181
        chevron=(z+.035*math.cos(4*x))*math.tau/.24
        quilt=1-math.pow(.5+.5*math.cos(chevron),10)
        edge=eased(min(.893-abs(x),.993-abs(z))/.075)
        return .188+edge*(.028+.004*quilt)
    soft_panel('Quilted sleeping surface',1.786,1.986,.05,48,66,elevation,knit)


def pillow():
    cotton=frame.material('Ivory cotton pillowcase',(.89,.82,.72),.89)
    # Ridges are formed by the change in curvature across the sewn edge.
    rings=(.15,.30,.44,.56,.67,.76,.84,.903,.948,.975,.992,1)
    count=64
    vertices=[]
    for side in (1,-1):
        for radius in rings:
            for i in range(count):
                a=i*math.tau/count
                c,s=math.cos(a),math.sin(a)
                rect=(abs(c)**4.3+abs(s)**4.3)**(-1/4.3)
                x,z=c*rect*radius,s*rect*radius
                crown=math.pow(max(0,1-radius*radius),.50)
                y=.052+.014*z+side*(crown*(.096 if side==1 else .056)+.0012*radius**12)
                if side==1:
                    y-=.009*math.exp(-((z-.2-.25*x)/.21)**2)*eased((abs(x)-.4)/.6)
                vertices.append((x*.395*(1-.035*z),-z*.24,y))
    vertices.extend([(0,0,.148),(0,0,-.004)])
    rows=len(rings)
    faces=[]
    for start in (0,rows*count):
        for row in range(rows-1):
            for i in range(count):
                a=start+row*count+i
                b=start+row*count+(i+1)%count
                faces.append((a,b,b+count,a+count))
    top,bottom=(rows-1)*count,(2*rows-1)*count
    for i in range(count):
        j=(i+1)%count
        faces.extend(((top+i,top+j,bottom+j,bottom+i),(len(vertices)-2,i,j),
                      (len(vertices)-1,rows*count+j,rows*count+i)))
    mesh('Puffed pillowcase',vertices,faces,cotton)


def duvet():
    cloth=frame.material('Warm white duvet cover',(.81,.736,.614),.92)
    hem=frame.material('Folded cotton turn-down',(.87,.796,.692),.90)
    w,d=1.940,1.560

    def surface(x,z):
        u=x/(w/2)
        head=z+d/2
        drop_side=eased((abs(x)-.889)/.081)
        drop_foot=eased((z-.719)/.061)
        drop=1-(1-drop_side)*(1-drop_foot)
        swell=.025*math.exp(-((z+.18-.14*u)/.112)**2)
        crease=-.011*math.exp(-((z+.033+.23*u+.044*math.cos(5*u))/.045)**2)
        diagonal=.028*math.exp(-((z-.24+.30*u)/.082)**2)*eased((.92-abs(u))/.55)
        shoulder=.011*math.exp(-((u+.37+z*.49)/.14)**2)*math.exp(-((z-.28)/.32)**2)
        wave=.009*math.cos(18*z+4*u)*drop_side+.010*math.sin(13*x)*drop_foot
        return .190+.024*math.exp(-((head-.072)/.052)**2)+swell+crease+diagonal+shoulder-drop*.172+wave

    def filled(x,z,top):
        return surface(x,z)-(0 if top else .015)
    soft_panel('Draped filled duvet',w,d,.064,74,62,filled,cloth)

    def turned(x,z,top):
        world_z=z-.655
        rise=.009*math.exp(-((z-.063)/.033)**2)
        return surface(x,world_z)+rise+(.011 if top else .002)
    fold=soft_panel('Folded head hem',1.885,.219,.083,68,10,turned,hem)
    fold.location.y=.655


def main():
    args=sys.argv[sys.argv.index('--')+1:]
    target,profile=Path(args[0]),args[args.index('--profile')+1]
    wanted={
        'mattress-y83b33': (1.800,.220,2.000,mattress),
        'pillow-y83b33': (.790,.140,.480,pillow),
        'duvet-y83b33': (1.940,.245,1.560,duvet),
    }
    w,h,d,build=wanted[profile]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system='METRIC'
    build()
    bpy.context.view_layer.update()
    objects=list(bpy.context.scene.objects)
    all_points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    lower=[min(p[i] for p in all_points) for i in range(3)]
    upper=[max(p[i] for p in all_points) for i in range(3)]
    center=[(lower[0]+upper[0])/2,(lower[1]+upper[1])/2,lower[2]]
    scale=[amount/(b-a) for amount,a,b in zip((w,d,h),lower,upper)]
    for obj in objects:
        transform=obj.matrix_world.copy()
        obj.location=(0,0,0)
        for vert in obj.data.vertices:
            p=transform@vert.co
            vert.co=tuple((p[i]-center[i])*scale[i] for i in range(3))
        obj['furnishStablePart']=profile+'-v1:'+obj.name
        assert all(p.area>1e-10 for p in obj.data.polygons)
    sys.path.insert(0,str(Path(__file__).parent/'lib'))
    from blender_asset_preflight import from_args
    from_args(bpy.context.scene)
    target.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(target/(profile+'-v1.blend')))
    bpy.ops.export_scene.gltf(filepath=str(target/(profile+'-v1.glb')),export_extras=True)
    if '--result' in args:
        Path(args[args.index('--result')+1]).write_text(json.dumps({
            'passed':True,'parts':len(objects),'blender':bpy.app.version_string
        }),encoding='utf8')


if __name__=='__main__':
    main()
