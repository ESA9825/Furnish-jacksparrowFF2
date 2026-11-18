import bpy,sys,json,hashlib
args=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args[0])
rows=[]
for o in bpy.data.objects:
 if o.type!='MESH' or o.get('furnishId')!='style-ui':continue
 mats=[]
 for slot in o.material_slots:
  m=slot.material
  images=[{'name':n.image.name,'size':list(n.image.size),'packed':bool(n.image.packed_file)} for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image] if m and m.use_nodes else []
  mats.append({'name':m.name,'images':images})
 rows.append({'name':o.name,'key':o.get('furnishPartKey'),'uvLayers':len(o.data.uv_layers),'materials':mats})
shell=[r for r in rows if 'component:shell' in r['key']]
assert len(rows)>0 and len(shell)>0
assert all(r['uvLayers'] and any(i['size']==[256,512] for m in r['materials'] for i in m['images']) for r in shell)
assert all(not any(m['images'] for m in r['materials']) for r in rows if r not in shell)
report={'source_sha256':hashlib.sha256(open(args[0],'rb').read()).hexdigest(),'blender':bpy.app.version_string,'source':args[0],'objects':rows,'passed':True}
open(args[1],'w').write(json.dumps(report,ensure_ascii=False,indent=2))
print('PASS Blender actual object material slots / packed 256x512 walnut / UV:',len(rows))
