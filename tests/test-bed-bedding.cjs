'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Model=require('../src/render/basic-furniture-model.js');
const Products=require('../src/core/product-rules.js');
const {parts}=require('../src/core/furniture-solids.js');
const Export=require('../src/io/blender-export.js');

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
 console.log('PASS bed production cloth: both widths, physical UVs, upward folds, normalized normals, mirrored/elevated numerical envelopes and export snapshot');
})().catch(error=>{console.error(error);process.exitCode=1;});
