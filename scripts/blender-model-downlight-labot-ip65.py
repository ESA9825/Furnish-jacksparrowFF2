"""LABOT JD 10087901407535, 7W white: 85x45 labelled, inner details estimated."""
import bpy, bmesh, json, math, pathlib, sys
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
out=pathlib.Path(args[0]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
def material(name,hex,roughness,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF')
 def linear(s):
  v=int(s,16)/255;return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 n.inputs['Base Color'].default_value=(*[linear(hex[i:i+2]) for i in (0,2,4)],1);n.inputs['Roughness'].default_value=roughness;n.inputs['Metallic'].default_value=metal;return m
white=material('white-coated-aluminium','f4f4f0',.4,.15)
cup=material('white-reflector','f3f3ed',.35,.1)
opal=material('opal-light-face','f9f9f2',.55)
steel=material('spring-steel','b6b9bd',.3,.8)
red=material('spring-safety-cover','a91c23',.65)
def finish(o,name,mat):
 o.name=name;o.data.materials.clear();o.data.materials.append(mat);o['furnishStablePart']='downlight-labot-ip65-v1:'+name;o['furnishRecolor']=mat==white
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def lathe(name,profile,mat):
 # Closed revolved bands: no coincident axis vertices or degenerate centre fans.
 n=96;verts=[(r*math.cos(i*math.tau/n)/1000,r*math.sin(i*math.tau/n)/1000,y/1000) for r,y in profile for i in range(n)]
 faces=[(j*n+i,j*n+(i+1)%n,((j+1)%len(profile))*n+(i+1)%n,((j+1)%len(profile))*n+i) for j in range(len(profile)) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 for p in mesh.polygons:p.use_smooth=abs(p.normal.z)<.99
 return finish(o,name,mat)
def cylinder(name,r,h,z,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r/1000,depth=h/1000,location=(0,0,z/1000));o=bpy.context.object
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 return finish(o,name,mat)
def box(name,size,pos,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=[x/1000 for x in pos]);o=bpy.context.object;o.dimensions=[x/1000 for x in size];bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat)
lathe('face-ring',[(34,0),(41.8,0),(42.5,.7),(42.5,1.5),(42,2),(34,2)],white)
lathe('reflector-cup',[(34,1.8),(34,3),(25,30),(24,30),(33,2)],cup)
cylinder('diffuser',24.8,.8,30.4,opal)
lathe('rear-housing',[(35,2),(35,43),(33.7,43),(33.7,3),(34,2)],white)
cylinder('rear-cap',33.7,1,43.5,white)
fins=[]
for i in range(-4,5):
 x=i*6;length=2*math.sqrt(31**2-x*x);fins.append(box('fin-'+str(i),[1.2,length,1],[x,0,44.5],white))
bpy.ops.object.select_all(action='DESELECT')
for o in fins:o.select_set(True)
bpy.context.view_layer.objects.active=fins[0];bpy.ops.object.join();finish(bpy.context.object,'rear-fins',white)
for side,label in [(-1,'left'),(1,'right')]:
 # Folded installed pose; operational spring extension is intentionally not invented.
 curve=bpy.data.curves.new('spring','CURVE');curve.dimensions='3D';curve.bevel_depth=.00045;curve.bevel_resolution=2;s=curve.splines.new('POLY');s.points.add(4)
 for p,co in zip(s.points,[(side*35,0,39),(side*38,0,34),(side*40,0,12),(side*38.5,0,10),(side*35,0,33)]):p.co=(*[v/1000 for v in co],1)
 o=bpy.data.objects.new('spring',curve);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');finish(bpy.context.object,'spring-'+label,steel)
 box('spring-cover-'+label,[2,8,15],[side*39,0,17.5],red)
sys.path.insert(0,str(pathlib.Path(__file__).parent/'lib'))
from blender_asset_preflight import from_args
from_args(scene)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'downlight-labot-ip65-v1.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'downlight-labot-ip65-v1.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False)
pathlib.Path(args[args.index('--result')+1]).write_text(json.dumps({'passed':True,'parts':10,'blender':bpy.app.version_string}),encoding='utf-8')
