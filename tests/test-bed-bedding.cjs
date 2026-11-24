'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Model=require('../src/render/basic-furniture-model.js');
const Products=require('../src/core/product-rules.js');
const {parts}=require('../src/core/furniture-solids.js');
const Export=require('../src/io/blender-export.js');
const Project=require('../src/core/project-core.js');
const Repository=require('../src/core/repository-core.js');
const Primitives=require('../src/render/model-primitives.js');

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const {imports}=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
 const three=imports.three;
 const rounded=Buffer.from(imports['three/addons/geometries/RoundedBoxGeometry.js'].split(',')[1],'base64')
  .toString().replace("from 'three'",'from '+JSON.stringify(three));
 const [T,{RoundedBoxGeometry}]=await Promise.all([import(three),
  import('data:text/javascript;base64,'+Buffer.from(rounded).toString('base64'))]);
 const beds=[1800,1200].map((w,index)=>({type:'bed',id:'bed-'+index,cx:5400,cy:6500,w,d:2000,rot:0,color:'#d8cdbb'}));
 const [wide,narrow]=beds.map(f=>Model.build(T,f,RoundedBoxGeometry));
 const weaves=g=>g.children.filter(o=>o.userData.bedCloth);
 const sheet=g=>weaves(g).find(o=>o.geometry.index);
 assert.equal(sheet(wide).material.map,sheet(narrow).material.map,'Widths share one offline weave map');
 assert.equal(sheet(wide).material.normalMap,sheet(narrow).material.normalMap);
 assert.ok(sheet(wide).material.sheen>0);
 assert.equal(sheet(wide).material.color.getHexString(),'d8cdbb');
 const uvWidth=o=>{
  const {uv}=o.geometry.attributes;
  let span=0;
  for(let i=0;i<uv.count;i++)span=Math.max(span,uv.getX(i));
  return span;
 };
 for(const [index,g] of [wide,narrow].entries()){
  const f=beds[index],bounds=new T.Box3().setFromObject(g),size=bounds.getSize(new T.Vector3());
  assert.ok(Math.abs(bounds.min.y)<1e-6);
  for(const [actual,expected] of [[size.x,(f.w+50)/1000],[size.y,1.08],[size.z,2]])
   assert.ok(Math.abs(actual-expected)<1e-6,'Existing bed envelope includes the overhanging runner');
  assert.ok(Math.abs(uvWidth(sheet(g))-Math.max(f.w+20,(f.d-130)*.66)/9)<2e-5,'Duvet UVs use the same physical weave scale');
  for(const mesh of weaves(g)){
   const {position,normal}=mesh.geometry.attributes;
   assert.ok(position.array.every(Number.isFinite));
   const n=new T.Vector3();
   for(let i=0;i<normal.count;i++){
    n.fromBufferAttribute(normal,i);
    assert.ok(Math.abs(n.length()-1)<1e-4);
   }
  }
  const blanket=sheet(g),ray=(x,z)=>new T.Raycaster(new T.Vector3(x,1,z),new T.Vector3(0,-1,0)).intersectObject(blanket)[0];
  const samples=Array.from({length:12},(_,i)=>ray(.1,-.12+i*.065).point.y);
  assert.ok(Math.max(...samples)-Math.min(...samples)>.012,'Duvet has physical folds and upward-facing triangles');
  const frameOnly={...f,bedLinensVisible:false};
  const frame=Model.build(T,frameOnly,RoundedBoxGeometry);
  assert.ok(weaves(frame).length<weaves(g).length);
  assert.ok(weaves(frame).every(o=>!o.geometry.index));
  assert.equal(Products.value(f,'bedLinensVisible'),true);
  assert.equal(Products.value(frameOnly,'bedLinensVisible'),false);
  assert.ok(Math.abs(new T.Box3().setFromObject(frame).getSize(new T.Vector3()).x-f.w/1000)<1e-6);
  assert.ok(Math.abs(Math.max(...parts(frameOnly).flatMap(p=>p.vertices.map(v=>v[0])))-(f.cx+f.w/2))<.02);
  const f2={...f,mountHeight:75,rot:90,flip:true};
  g.position.set(f2.cx/1000,Products.elevationDelta(f2)/1000,f2.cy/1000);
  g.rotation.y=-Math.PI/2;g.scale.x=-1;
  const b=new T.Box3().setFromObject(g);
  const vertices=parts(f2).flatMap(part=>part.vertices);
  for(const [i,axis] of ['x','y','z'].entries()){
   const measured=vertices.map(v=>v[i]);
   assert.ok(Math.abs(Math.min(...measured)-b.min[axis]*1000)<.02);
   assert.ok(Math.abs(Math.max(...measured)-b.max[axis]*1000)<.02);
  }
  const snapshot=Export.snapshot(T,{groups:[g],camera:new T.PerspectiveCamera()});
  let exported;
  snapshot.scene.traverse(o=>{if(o.isMesh&&o.material?.sheen>0&&o.geometry.index&&!exported)exported=o;});
  assert.ok(exported?.geometry.attributes.uv&&exported.material.normalMap);
  snapshot.dispose();
 }
 const source='v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\n';
 const faces='f 1 2 3\nf 1 4 2\n';
 const flat=Project.parseOBJ(source+faces);
 const smooth=Project.parseOBJ(source+'s 1 # cloth\n'+faces);
 const mixed=Project.parseOBJ(source+'s 1\nf 1 2 3\ns off\nf 1 4 2\n');
 assert.deepEqual(smooth.positions,flat.positions);
 assert.equal(mixed.smooth,undefined);
 assert.equal(Primitives.objGeometry(T,flat).index,null);
 const geometry=Primitives.objGeometry(T,smooth);
 assert.equal(geometry.index.count,6);
 assert.equal(geometry.attributes.position.count,4);
 assert.ok(geometry.attributes.normal.getY(0)>0&&geometry.attributes.normal.getZ(0)>0);
 const fixture={furniture:[{...beds[0],bedLinensVisible:false},
  {id:'cloth',type:'custom',w:1000,d:1000,h:500,rot:0,cx:0,cy:0,mountHeight:120,obj:smooth}]};
 const payload={planId:'room',current:fixture,designs:[{name:'bedding',work:fixture}],catalog:[]};
 const packed=Project.pack(payload);
 assert.equal(packed.version,109);
 assert.deepEqual(Project.unpack(packed),payload);
 const planId=require('../src/data/plans.js')[0].id;
 const workspace={v:109,planId,work:{[planId]:fixture},designs:[]};
 assert.deepEqual(Repository.parse(JSON.parse(Repository.text(workspace))).work[planId].furniture,fixture.furniture);
 assert.throws(()=>Project.validateWork({furniture:[{...fixture.furniture[1],obj:{...smooth,smooth:'yes'}}]}),/平滑标记/);
 console.log('PASS bed production cloth: both widths, physical UVs, upward folds, normalized normals, mirrored/elevated numerical envelopes and export snapshot');
})().catch(error=>{console.error(error);process.exitCode=1;});
