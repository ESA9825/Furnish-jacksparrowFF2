'use strict';
const assert=require('node:assert/strict');
const K=require('../src/core/kitchen-core.js');
const M=require('../src/core/cabinet-motion.js');
const B=require('../src/core/cabinet-builder-core.js');
const G=require('../src/core/layout-geometry.js');
const P=require('../src/core/project-core.js');
const D=require('../src/core/drawer-contents.js');
const fixture=require('./fixtures/kitchen-service-1601.json');
const choice={boxId:'service-B',componentId:'bowls-B'};
const moduleOf=f=>K.cabinetLayout(f).find(m=>m.index===2);
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const board=(f,inner)=>M.boards(K.moduleFurniture(f,moduleOf(f)),{includeStatic:true}).find(b=>
 b.metadata.cabinetBuilder?.componentId===choice.componentId&&(inner?b.metadata.cabinetInnerTrayFloor:b.metadata.cabinetDrawerBoard==='bottom'));
function placement(host,id,model,inner){
 const {poly,top}=board(host,inner);
 const [x,y]=poly.reduce(([x,y],q)=>[x+q[0]/poly.length,y+q[1]/poly.length],[0,0]);
 const [cx,cy]=K.world(K.moduleFurniture(host,moduleOf(host)),x,y);
 return {id,name:id,type:'custom',brand:'宜家/IKEA',model,cx,cy,rot:host.rot,w:40,d:80,h:10,mountHeight:top+1,
  obj:{positions:[-.02,0,0,.02,.01,0,0,0,.04]}};
}
function setOpening(host,outer,inner){
 const part=K.moduleFurniture(host,moduleOf(host));
 const p=B.selection(part,choice).component;
 const edit=B.update(part,choice,{open:outer>0,extension:outer,
  innerTray:{...p.innerTray,open:inner>0,extension:inner}});
 const result=structuredClone(host);
 result.kitchen.modules[2].structure.cabinet=edit.cabinet;
 return result;
}
let scenarios=0;
for(const rot of [0,37,180])for(const flip of [false,true]){
 const host={...structuredClone(fixture),rot,flip};
 const contents=[placement(host,'dishes','906.213.59',false),placement(host,'sticks','703.429.72',true)];
 for(const [outer,inner] of [[0,0],[.38,0],[.7,.24],[1,1],[.42,.82]]){
  const edited=setOpening(host,outer,inner);
  const all=[edited,...contents];
  const start=K.moduleFurniture(edited,moduleOf(edited));
  const original=structuredClone(contents);
  for(const [i,item] of contents.entries()){
   const b=board(edited,i===1);
   const [x,y]=K.world(start,0,b.phase*b.motion.travel);
   const expected=[x-start.cx,y-start.cy];
   const match=D.attachment(item,all);
   assert.equal(match.kind,i===0?'drawer':'innerTray');
   const positioned=D.pose(item,all);
   near(positioned.cx-item.cx,expected[0]);near(positioned.cy-item.cy,expected[1]);
   near(positioned.mountHeight,item.mountHeight);
   const [closed]=G.footprints(item),[opened]=G.footprints(item,{furniture:all});
   near(opened[0][0]-closed[0][0],expected[0]);near(opened[0][1]-closed[0][1],expected[1]);
   const numeric=G.bodyParts(item,null,all)[0].p;
   near(numeric[0][0],opened[0][0]);near(numeric[0][1],opened[0][1]);
  }
  assert.deepEqual(contents,original);
  assert.equal(D.attachment({...contents[0],cx:host.cx+9999},all),null);
  assert.equal(D.attachment({...contents[1],mountHeight:900},all),null);
  assert.equal(D.attachment({...contents[1],mountHeight:contents[1].mountHeight-2},all),null);
  const packed=P.pack({planId:'drawer-fixture',current:{furniture:all},designs:[],catalog:[]});
  const recovered=P.unpack(packed).current.furniture;
  near(D.pose(recovered[2],recovered).cy,D.pose(all[2],all).cy);
  scenarios++;
 }
}

const plan={id:'drawer-room',walls:[],doors:[],rooms:[{id:'r',poly:[[0,0],[13000,0],[13000,13000],[0,13000]]}],ceilingHeight:2700};
const host=setOpening(fixture,1,0);
const dishes={...placement(fixture,'dishes','906.213.59',false),cx:7530,cy:9743,rot:0,w:764.27,d:241.38,h:111.18,mountHeight:435};
const carried=D.pose(dishes,[host,dishes],plan);
const checks=item=>P.spaceCheck(plan,[host,item],{scanPassages:false}).filter(i=>i.id===host.id&&i.message.includes('被 dishes 占用'));
assert.notEqual(carried.cy,dishes.cy);
assert(checks(dishes).some(i=>i.kind==='cabinetdoor'&&i.column===1),'the adjacent door still detects the carried load');
assert(!checks(dishes).some(i=>i.kind==='cabinetdrawer'&&i.column===2),'the drawer does not block its own carried load');
assert(checks({...carried,model:'other'}).some(i=>i.kind==='cabinetdrawer'&&i.column===2),'an independent object at the same pose still blocks the drawer');
console.log(`PASS ${scenarios} drawer poses, project round-trip, and separate checks for supported loads and independent obstacles`);
