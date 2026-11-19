'use strict';
const assert=require('node:assert/strict');
const P=require('../src/core/product-rules.js');
const D=require('../src/core/design-core.js');
const J=require('../src/core/project-core.js');
const G=require('../src/core/layout-geometry.js');
const catalog=require('../src/data/catalog.js');
const profile=require('../scripts/lib/model-profiles.cjs').profiles().find(p=>p.id==='drying-rack-hotata-y024');
const rack=profile.fixture;
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.005,`${actual} ≠ ${expected}`);
const parts=f=>G.bodyParts(f).map(p=>p.vertical);
const bounds=f=>parts(f).map(({bottom,top})=>[bottom,top]);
const all=bounds(rack),names=require('../src/data/drying-rack-hotata-y024-blender-asset.js').parts.map(p=>p.name);
assert.equal(all.length,28);
assert.equal(names.filter(n=>n.endsWith('-rail')).length,4);
assert(catalog.navigation().find(x=>x.id==='other').children.find(x=>x.id==='other/drying').items.some(x=>x[0]===rack.type));
for(const drop of [0,500,1500]){
 const state=P.editDryingRackDrop(rack,drop),next=bounds(state);
 next.forEach(([low,high],i)=>{
  close(low,all[i][0]-(names[i].startsWith('ceiling-')?0:drop));
  close(high,all[i][1]-(names[i].startsWith('moving-')?drop:0));
 });
 close(D.furnitureVerticalBounds(state).top,2640);
 close(P.bottomHeight(state),2180-drop);
 const raised=P.editDryingRackDrop(state,0);
 assert.deepEqual(raised,rack);
 assert.deepEqual(J.unpack(J.pack({planId:'verification',current:{furniture:[state]},designs:[],catalog:[]})).current.furniture[0],state);
}
const lowered=P.editDryingRackDrop(rack,900);
const replaced=D.replaceFurniture(lowered,rack);
assert.deepEqual(P.dryingRackLayout(replaced),P.dryingRackLayout(lowered));
const freestanding={type:'dryingrack',name:'落地晾衣架',w:1400,d:550,h:1300,color:'#cfd6d9'};
const floorRack=D.replaceFurniture(lowered,freestanding);
assert.equal(floorRack.h,1300);
assert.deepEqual(P.dryingRackLayout(D.replaceFurniture(floorRack,rack)),P.dryingRackLayout(rack));
assert.throws(()=>P.editDryingRackDrop(rack,1501),/下降量/);
assert.throws(()=>P.editDryingRackDrop({...rack,mountHeight:0},1),/底部离地/);
assert.throws(()=>D.resizeFurniture(rack,{h:459}),/晾衣架当前总高/);
assert.throws(()=>J.validateWork({furniture:[{...rack,h:1961}]}),/晾衣架当前总高/);
// The empty middle between the two runs is usable even at the rods’ height.
const probe={id:'obstacle',type:'block',w:100,d:100,h:100,cx:0,cy:0,rot:0,mountHeight:2150};
assert.equal(G.volumeOverlap(rack,probe),false);
assert.equal(G.volumeOverlap(rack,{...probe,cy:225}),true);
assert.equal(G.volumeOverlap(P.editDryingRackDrop(rack,1500),{...probe,cy:225}),false);
console.log('PASS Y024 rigid rails, fixed seats, cable positions, clearance and project restore');
