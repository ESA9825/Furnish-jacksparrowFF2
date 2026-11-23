'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const S=require('../src/core/style-core.js'),P=require('../src/core/project-core.js'),R=require('../src/core/repository-core.js'),L=require('../src/core/layers-core.js'),Products=require('../src/core/product-rules.js');
const {fixture}=require('./helpers/wall-finish-fixture.cjs');
const {plan,work}=fixture({partition:true}),before=structuredClone(work),room=plan.rooms[0].id;
const assetRoot=path.resolve(__dirname,'../assets/materials/floors'),sources=require(path.join(assetRoot,'sources.json'));
for(const sample of Products.styleAppearance.floorSamples){
 const record=sources[sample.id];
 assert.deepEqual(record.dimensions.map(Math.round),[sample.repeatMm,sample.repeatMm]);
 const scope={};vm.runInNewContext(fs.readFileSync(path.join(assetRoot,sample.id,'offline.js'),'utf8'),scope);
 for(const name of ['color.jpg','normal.jpg','roughness.jpg']){
  const source=fs.readFileSync(path.join(assetRoot,sample.id,name));
  assert.equal(source.at(0),255);assert.equal(source.at(1),216);
  assert.equal(createHash('sha256').update(source).digest('hex'),record.maps[name].sha256);
  assert(Buffer.from(scope.FurnishFloorSampleImages[sample.id][name].split(',')[1],'base64').equals(source));
 }
}
const paint=S.wallKey('wallA',-1);
S.editMaterial(work,'floorSamples',room,'oak_wood_planks');
S.editMaterial(work,'wallPaint',paint,'#dcccba');
assert.equal(S.materialValue(work,'wallPaint',S.wallKey('wallA',1)),undefined);
assert.throws(()=>S.editMaterial(work,'floorSamples',room,'https://outside.invalid/texture'));
assert.throws(()=>S.editMaterial(work,'wallPaint','wallA','#aabbcc'));
assert.equal(P.formatVersion([work]),105);
assert.deepEqual(P.effectivePlan(plan,work),P.effectivePlan(plan,before));
const payload={planId:plan.id,current:work,designs:[{name:'外观',work}],catalog:[]};
assert.deepEqual(P.unpack(P.pack(payload)).current.styleAppearance,work.styleAppearance);
assert.deepEqual(P.unpack(P.pack(payload)).designs[0].work.styleAppearance,work.styleAppearance);
const workspace={v:105,planId:plan.id,work:{[plan.id]:work},designs:[]};
if(work.architecture)workspace.customPlans=[work.architecture.draft];
assert.deepEqual(R.parse(JSON.parse(R.text(workspace))).work[plan.id].styleAppearance,work.styleAppearance);
const locked=L.update(before,'0',{locked:true});
assert.throws(()=>L.assertEditable(locked,{...locked,styleAppearance:work.styleAppearance}),/锁定/);
S.editMaterial(work,'floorSamples',room,undefined);S.editMaterial(work,'wallPaint',paint,undefined);
assert.deepEqual(work,before);
console.log('PASS offline floor sources, material IDs, wall-side overrides, locked floor, format v105 and project/workspace round trips');
