'use strict';
const assert=require('node:assert/strict'),E=require('../src/core/electrical-core.js'),P=require('../src/core/product-rules.js'),G=require('../src/core/layout-geometry.js'),B=require('../src/core/cabinet-builder-core.js'),J=require('../src/core/project-core.js');
const panel={id:'p',name:'插座',color:'#fff',type:'panel_bull_g12',w:86,d:10,h:86,cx:0,cy:0,rot:0,mountHeight:500,panelVariant:'socket5-diagonal'};
const cabinet={id:'c',name:'柜体',color:'#fff',type:'cabinet',w:1000,d:600,h:1000,cx:2000,cy:2000,rot:0,mountHeight:0,cabinet:{version:2,boxes:[{id:'box1',w:1000,d:600,h:1000,thickness:18,backThickness:18,bottom:true,components:[]}]}};
const clone=v=>structuredClone(v),work={furniture:[cabinet,panel],rooms:{},measures:[],notes:[]},edit=fn=>{const next=clone(work);fn(next);return next;};
assert(E.panel(panel));assert(!E.panel(cabinet));E.assertEditable(work,{...work,scene3d:{night:true,hour:18}});
E.assertEditable(work,edit(w=>Object.assign(w.furniture[1],{cx:42,mountHeight:1300,panelVariant:'switch1-single'})));
for(const fn of [w=>w.furniture[0].cx++,w=>w.furniture[0].w++,w=>w.furniture[0].rot=90,w=>w.furniture[0].mountHeight=50,w=>w.furniture[0].cabinet.boxes[0].thickness=20,w=>w.furniture.shift(),w=>w.furniture.push({...cabinet,id:'new'}),w=>w.rooms.a={},w=>w.measures.push({a:{x:0,y:0},b:{x:1,y:1}}),w=>w.furniture[1].groupId='mixed'])assert.throws(()=>E.assertEditable(work,edit(fn)));
const door=B.add(cabinet,'multiDoor',{boxId:'box1'}).furniture;
const opened=B.setOpening(door,true);E.assertEditable({...work,furniture:[door,panel]},{...work,furniture:[opened,panel]});
assert.throws(()=>E.assertEditable({...work,furniture:[door,panel]},{...work,furniture:[{...opened,cx:2001},panel]}));
for(const rot of [0,37,90])for(const flip of [false,true]){
 const c={...cabinet,rot,flip},w={...work,furniture:[c,panel]},faces=E.surfaces({walls:[]},w,panel).filter(s=>s.label.includes('侧板'));assert.equal(faces.length,4);
 for(const s of faces){const p=E.place(panel,s,s.length/2),hit=E.nearest(p,[s],.001);assert(hit);assert(Math.abs(hit.offset-s.length/2)<1e-6);assert(!G.volumeOverlap(p,c,null,w.furniture),'touching the side face must not penetrate a production board');assert.throws(()=>E.place(panel,s,42.9));}
 assert.equal(E.surfaces({walls:[]},w,{...panel,mountHeight:1001}).length,0,'no cabinet face above its production height');
 assert.equal(E.surfaces({walls:[]},w,{...panel,mountHeight:950}).length,0,'full panel height must fit');
}
const floors={walls:[],furnitureDatum:'finished-floor',rooms:[{id:'low',poly:[[0,0],[1000,0],[1000,3000],[0,3000]]},{id:'high',poly:[[1000,0],[3000,0],[3000,3000],[1000,3000]]}],floorFinish:{areas:{low:{id:'low',finishedZ:0},high:{id:'high',finishedZ:600}}}};
const low={...panel,cx:500,cy:2000,mountHeight:100},high={...low,cx:2000};assert.equal(E.surfaces(floors,work,low).length,0);assert(E.surfaces(floors,work,high).length>0,'moving across floor datums invalidates the face cache');
const unknown=clone(floors);delete unknown.floorFinish.areas.high.finishedZ;assert.equal(E.surfaces(unknown,work,high).length,0,'unknown floor height must not invent a cabinet mounting face');
const faces=E.surfaces({walls:[[0,0,1000,200]]},work,panel);assert.equal(faces.filter(s=>s.kind==='wall').length,4);
assert.equal(E.points(work)[0].number,'E01');assert.equal(E.points(work)[0].center,543);
const plan=require('../src/data/plans.js')[0],W=require('../src/core/work-state.js').create({makeId:()=> 'fixture',colorFor:()=> '#fff',materials:require('../src/data/catalog.js').materials}),full={...W.fresh(plan),furniture:[cabinet,panel]},payload={planId:plan.id,current:full,designs:[{name:'插座布置',work:clone(full)}],catalog:[]};
assert.deepEqual(J.unpack(J.pack(payload)),payload);let restored=clone(full);for(let i=0;i<3;i++)restored=W.restore(clone(restored),plan);assert.deepEqual(restored.furniture,full.furniture);P.validate(panel);
console.log('electrical planning: protected layout, opening exception, actual inner/outer board faces, rotated/mirrored contact, height limits and project round trip passed');
