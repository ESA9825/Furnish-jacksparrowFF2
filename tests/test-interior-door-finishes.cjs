'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../src/core/floorplan-core.js'),S=require('../src/core/style-core.js');
const P=require('../src/core/project-core.js'),R=require('../src/core/repository-core.js');
const L=require('../src/core/layers-core.js'),C=require('../src/io/workspace-cache.js');
const Model=require('../src/render/interior-door-model.js'),G=require('../src/core/layout-geometry.js');
const preset=require('../src/data/plans.js')[0],{doorIndex,doorKey,doorFinish}=S;
const id=doorKey(preset,1),work={furniture:[]},legacy=structuredClone(work);
assert.equal(doorIndex(preset,id),1);
assert.equal(doorIndex(preset,doorKey(preset,preset.doors.findIndex(d=>d.entry))),-1);
assert.equal(doorFinish(legacy,id).casing.profile,undefined);
S.editDoorFinish(work,id,{leaf:'reeded',casing:'stepped-double',leafColor:'#3a3530',casingColor:'#efeadf'});
const finish=doorFinish(work,id);
assert.equal(finish.leaf.glass,'reeded');
assert.equal(finish.casing.profile.length,2);
assert.equal(finish.casingColor,'#efeadf');
for(const invalid of [{leaf:'constructor'},{casing:'single'},{leafColor:'brown'},{unknown:'yes'}]){
 assert.throws(()=>S.editDoorFinish(structuredClone(work),id,invalid),/材质/);
}
assert.throws(()=>S.editDoorFinish(structuredClone(work),'window:1',{leaf:'flush'}),/材质/);
const locked=L.update(legacy,'0',{locked:true});
assert.throws(()=>L.assertEditable(locked,{...locked,styleAppearance:work.styleAppearance}),/锁定/);
const before=P.effectivePlan(preset,legacy),after=P.effectivePlan(preset,work);
assert.deepEqual(before,after);
assert.equal(P.checkFingerprint({kind:'door',id},before,[],800),P.checkFingerprint({kind:'door',id},after,[],800));
const project=P.pack({planId:preset.id,current:legacy,designs:[{name:'新房门',work}],catalog:[]});
assert.equal(project.version,110);
assert.deepEqual(P.unpack(project).designs[0].work.styleAppearance,work.styleAppearance);
const workspace={v:110,planId:preset.id,work:{[preset.id]:work},designs:[]};
assert.deepEqual(R.parse(JSON.parse(R.text(workspace))).work[preset.id].styleAppearance,work.styleAppearance);
assert.equal(C.load({read:k=>k==='huxing-design-v110'?JSON.stringify(workspace):null,key:'huxing-design-v110'}).v,110);
assert.equal(C.load({read:k=>k==='huxing-design-v109'?JSON.stringify({...workspace,v:109}):null,key:'huxing-design-v110'}).v,109);
const copied=D.build(D.fromPlan(preset,'custom_door_finish').draft),copy=structuredClone(work);
S.remapBuiltinDoors(copy,preset,copied);
const customId=doorKey(copied,copied.doorRefs.indexOf('preset_door1'));
assert.deepEqual(doorFinish(copy,customId),finish);
assert.equal(S.materialValue(copy,'doorFinishes',id),undefined);
const moved=D.build(D.editOpening(copied.customDraft,'preset_door1',{side:-1}));
assert.deepEqual(doorFinish(copy,doorKey(moved,doorIndex(moved,customId))),finish);
assert.equal(doorIndex({...moved,doors:[...moved.doors].reverse(),doorRefs:[...moved.doorRefs].reverse()},customId),moved.doors.length-1-doorIndex(moved,customId));
S.editDoorFinish(work,id,{leaf:'original',casing:'auto'});
assert.deepEqual(work,legacy);

async function checkGeometry(){
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const {imports}=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
 const three=await import(imports.three);
 const rounded=Buffer.from(imports['three/addons/geometries/RoundedBoxGeometry.js'].split(',')[1],'base64').toString();
 const {RoundedBoxGeometry}=await import('data:text/javascript;base64,'+Buffer.from(rounded.replace("'three'",JSON.stringify(imports.three))).toString('base64'));
 const mat=(color,options)=>new three.MeshStandardMaterial({color,...options});
 const {box,rbox}=require('../src/render/model-primitives.js').create(three,RoundedBoxGeometry,mat);
 for(const horizontal of [false,true])for(const opposite of [false,true]){
  const c=horizontal?[1,0]:[0,1],o=horizontal?[0,1]:[1,0],h=horizontal?[0,140]:[140,0];
  const d={c,o:opposite?o.map(v=>-v):o,h:opposite?[0,0]:h,rect:horizontal?[0,0,900,140]:[0,0,140,900],len:900,_base:{o}};
  for(const leaf of ['flush','panel','frosted','reeded']){
   const source={};S.editDoorFinish(source,id,{leaf,casing:'narrow-single'});
   const appearance=doorFinish(source,id);
   const panel=Model.buildLeaf(three,{length:900,height:2100,offset:G.doorLeafOffset(d),finish:appearance,box,rbox,mat});
   const casing=Model.buildCasing(three,d,{plan:{},height:2100,top:2800,finish:appearance,wx:v=>v/1000,wz:v=>v/1000,box,mat});
   assert.equal(panel.children.filter(o=>o.name.endsWith('-lever')).length,2);
   assert.equal(panel.children.some(o=>o.name==='recessed-panel'),leaf==='panel');
   assert.equal(panel.children.some(o=>o.name==='slab'),leaf==='flush');
   assert(casing.children.some(o=>o.name==='low-face-head-0'));
   assert(!casing.children.some(o=>o.name.startsWith('high-face')));
   const glass=panel.getObjectByName('glass');
   if(leaf==='reeded'||leaf==='frosted'){
    assert(glass.material.transmission>0&&glass.material.normalMap);
    assert.equal(glass.geometry.parameters.depth,.008);
    assert(glass.geometry.parameters.width<.9);
   }else assert(!glass);
  }
 }
 console.log('PASS door appearance, casing sides, production parts, validation, stable ref remap, v110 project/workspace/cache, spatial fingerprints');
}
checkGeometry().catch(error=>{console.error(error);process.exitCode=1;});
