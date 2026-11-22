'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const E=require('../src/io/blender-export.js');
const G=require('../src/core/layout-geometry.js');
const P=require('../src/core/project-core.js');
const specs=require('../scripts/lib/kitchen-countertop-assets.json');
globalThis.FurnishModelPrimitives=require('../src/render/model-primitives.js');
globalThis.FurnishStaticAssetModel=require('../src/render/static-asset-model.js');
require('../src/render/kitchen-countertop-appliance-model.js');
const M=globalThis.FurnishKitchenCountertopApplianceModel;
const sourceFiles=['kettle','air','griddle','rice','wok','pot','insert','micro-pm20m2'];
const near=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const {imports}=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
 const T=await import(imports.three);
 for(const [index,[id,spec]] of Object.entries(specs).entries()){
  const asset=globalThis[spec.global]=require('../src/data/'+id+'-blender-asset.js');
  const glb=fs.readFileSync(require.resolve('../assets/models/kitchen-countertop-appliances/'+sourceFiles[index]+'-refined.glb'));
  assert.equal(crypto.createHash('sha256').update(glb).digest('hex'),asset.sourceSha256);
  assert.deepEqual(asset.parts.map(p=>p.name).sort(),spec.parts);
  assert.equal(new Set(asset.parts.map(p=>p.identity)).size,spec.parts.length);
  const [w,h,d]=spec.size;
  const f={...spec.product,id:'kitchen-product',type:'custom',name:'厨房小家电',cx:0,cy:0,w,d,h,rot:0,mountHeight:310,
   color:'#ff0000',obj:{positions:[0,0,0,.1,.2,0,0,0,.1]}};
  const original=structuredClone(f);
  const body=structuredClone(G.bodyParts(f));
  assert.equal(M.asset(f),asset);
  assert.equal(M.asset({...f,sourceUrl:'https://example.com'}),null);
  assert.equal(M.asset({...f,type:'block'}),null);
  assert.equal(M.asset({...f,obj:undefined}),null);
  const model=M.build(T,asset,f);
  assert.deepEqual(f,original);
  assert.deepEqual(G.bodyParts(f),body);
  const {min,max}=new T.Box3().setFromObject(model,true);
  near(min.y*1000,0);
  for(const [axis,mm] of [['x',w],['y',h],['z',d]])near((max[axis]-min[axis])*1000,mm);
  assert(model.children.every(o=>o.material.color.getHexString()!=='ff0000'));
  const lens=model.children.find(o=>o.name==='Smoked inspection window lens');
  const lid=model.children.find(o=>o.name==='Thin curved smoked glass lid');
  const deck=model.children.find(o=>o.name==='Gloss black lower deck and touch control arc');
  const door=model.children.find(o=>o.name==='Smoked glass across the door aperture');
  if(lens){near(lens.material.transmission,.24);assert(lens.material.isMeshPhysicalMaterial);assert(lens.geometry.attributes.position.array[2]<0);}
  if(lid){near(lid.material.transmission,.52);assert(lid.material.isMeshPhysicalMaterial);}
  if(deck){near(deck.material.specularIntensity,.48);assert(deck.material.isMeshPhysicalMaterial);}
  if(door){
   near(door.material.transmission,.82);
   assert(door.material.isMeshPhysicalMaterial);
   const screen=model.children.find(o=>o.name==='Perforated safety screen behind glass');
   assert(screen&&new T.Box3().setFromObject(screen).min.z>new T.Box3().setFromObject(door).max.z);
   const control=model.children.find(o=>o.name==='Right hand control panel');
   assert(control&&new T.Box3().setFromObject(control).max.x<0,'the right control panel faces the aisle without mirroring its labels');
  }
  const physicalCount=lens||lid||deck||door?1:0;
  assert.equal(model.children.filter(o=>o.material.isMeshPhysicalMaterial).length,physicalCount);
  model.userData.fid=f.id;
  model.position.y=f.mountHeight/1000;
  const snapshot=E.snapshot(T,{groups:[model],camera:new T.PerspectiveCamera()});
  try{
   const meshes=snapshot.scene.children.filter(o=>o.isMesh);
   assert.equal(meshes.length,spec.parts.length);
   assert.equal(new Set(meshes.map(o=>o.userData.furnishPartKey)).size,spec.parts.length);
   assert(meshes.every(o=>o.userData.furnishId===f.id));
   assert.equal(meshes.filter(o=>o.material.isMeshPhysicalMaterial).length,physicalCount);
  }finally{snapshot.dispose();}
  const work={furniture:[f]};
  const project=P.pack({planId:'kitchen-test',current:work,designs:[],catalog:[]});
  assert.deepEqual(P.unpack(project).current.furniture,[original]);
 }
 console.log('PASS eight authored assets, exact product matching, original envelope and project data, physical materials and stable production parts');
})().catch(e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'three-r160'));process.exitCode=1;});
