'use strict';
const assert=require('node:assert/strict');
const E=require('../src/core/electrical-core.js');
const J=require('../src/core/project-core.js');
const R=require('../src/core/repository-core.js');
const Cache=require('../src/io/workspace-cache.js');
const plan=require('../src/data/plans.js')[0];
const W=require('../src/core/work-state.js').create({makeId:()=> 'fixture',colorFor:()=> '#fff',materials:require('../src/data/catalog.js').materials});
const socket={id:'outlet',name:'插座',color:'#fff',type:'panel_bull_g12',w:86,d:10,h:86,cx:3000,cy:1000,rot:0,mountHeight:457,panelVariant:'socket5-diagonal'};
const data={...socket,id:'network',panelVariant:'phone-net6'};
const box={id:'box',type:'electrical_box_strong',name:'强电箱',color:'#fff',w:300,d:120,h:400,mountHeight:300,cx:0,cy:1000,rot:0};
const route={id:'wire',kind:'power',name:'客厅电线',points:[
 {x:0,y:1000,z:500,furnitureId:box.id},
 {x:0,y:1000,z:900},
 {x:3000,y:1000,z:900},
 {x:3000,y:1000,z:500,furnitureId:socket.id},
]};
const model={furnitureDatum:'survey',rooms:[]};
const clone=structuredClone;
assert.equal(E.routeGeometry(route,model,[box,socket]).length,3800);
const diagonal={...route,points:[{x:0,y:0,z:0},{x:300,y:400,z:1200}]};
assert.equal(E.routeGeometry(diagonal,model,[]).length,1300);
function bends(points,axes){
 return points.slice(1,-1).map((p,i)=>{
  const u=axes.map(k=>p[k]-points[i][k]),v=axes.map(k=>points[i+2][k]-p[k]);
  return u.reduce((sum,n,j)=>sum+n*v[j],0)/(Math.hypot(...u)*Math.hypot(...v));
 }).filter(Number.isFinite);
}
const network=points=>E.routeGeometry({kind:'network',points},model,[]);
const xy=['x','y'],xyz=[...xy,'z'];
const right=[{x:0,y:0,z:0},{x:1000,y:0,z:0},{x:1000,y:1000,z:0}];
const rounded=network(right);
assert.deepEqual(rounded.path,[right[0],{x:850,y:0,z:0},{x:1000,y:150,z:0},right[2]]);
assert.equal(rounded.length,1700+150*Math.SQRT2);
assert.equal(E.routeGeometry({...route,points:right},model,[]).length,2000);
const obtuse=[right[0],right[1],{x:1500,y:1000,z:0}];
assert.deepEqual(network(obtuse).path,obtuse);
const shortAdjacent=[...right.slice(0,2),{x:1000,y:90,z:0},{x:1400,y:90,z:0}];
assert.equal(network(shortAdjacent).path.length,6);
assert.deepEqual(network(shortAdjacent).path.slice(2,4).map(p=>p.y),[30,60]);
for(const points of [
 right,
 [right[0],right[1],{x:400,y:1000,z:0}],
 [{...right[0],z:0},{...right[1],z:800},{...right[2],z:1800}],
 [{...right[0],z:0},{...right[1],z:800},{...right[2],z:0}],
]){
 const shape=network(points);
 assert.equal(shape.reversals.length,0);
 assert(shape.path.length>3);
 for(const axes of [xy,xyz])assert(bends(shape.path,axes).every(dot=>dot>0));
}
const wallRiser=[{x:800,y:400,z:60},{x:0,y:0,z:60},{x:0,y:0,z:500}];
for(const points of [wallRiser,wallRiser.slice().reverse()]){
 const shape=network(points);
 assert.deepEqual(shape.path,points);
 assert.equal(shape.length,Math.hypot(800,400)+440);
}
// A later planar bend still receives its chamfer without moving the wall foot.
const mixed=[wallRiser[2],wallRiser[1],{...right[1],z:60},{...right[2],z:60}];
const mixedPath=network(mixed).path;
assert.deepEqual(mixedPath.slice(0,2),mixed.slice(0,2));
assert.equal(mixedPath.length,5);
for(const folded of [
 [right[0],right[1],{x:800,y:0,z:0}],
 [right[0],{...right[0],z:500},{...right[0],z:200}],
]){
 assert.deepEqual(network(folded).reversals,[1]);
 assert.equal(network(folded).length,null);
}

assert.equal(E.routeGeometry(route,model,[box,{...socket,mountHeight:557}]).length,3700);
assert.equal(E.routeGeometry(route,model,[box,{...socket,cx:3300}]).points.at(-1).x,3300);
const room={id:'r',poly:[[-100,-100],[4000,-100],[4000,2000],[-100,2000]]};
const finish={furnitureDatum:'finished-floor',rooms:[room],floorFinish:{areas:{r:{id:'r',finishedZ:20}}}};
assert.equal(E.routeGeometry(route,finish,[box,socket]).length,3760);
for(const [p,furniture] of [[model,[box]],[model,[box,{...data,id:socket.id}]],[{...finish,floorFinish:{areas:{r:{id:'r'}}}},[box,socket]]]){
 const g=E.routeGeometry(route,p,furniture);
 assert.equal(g.length,null);
 assert.deepEqual(g.points.at(-1),{...route.points.at(-1),unresolved:true});
}
assert.equal(E.endpointKind(data),'network');
assert.equal(E.endpointKind({...box,type:'electrical_box_weak'}),'network');
assert.equal(E.endpointKind({...data,panelVariant:'tv'}),null);
assert.equal(E.endpointKind({...data,panelVariant:'cable'}),null);

const legacy={...W.fresh(plan),furniture:[box,socket]};
const work={...legacy,wireRoutes:[route]};
const payload={planId:plan.id,current:legacy,designs:[{name:'布线',work}],catalog:[]};
const packed=J.pack(payload);
assert.equal(packed.version,102);
assert(J.pack({...payload,designs:[]}).version<102);
assert.deepEqual(J.unpack(packed).designs[0].work.wireRoutes,[route]);
assert.deepEqual(W.restore(clone(work),plan).wireRoutes,[route]);
assert(!Object.hasOwn(W.restore(clone(legacy),plan),'wireRoutes'));
const workspace={v:101,planId:plan.id,work:{[plan.id]:legacy},designs:[]};
const next={...workspace,v:102,work:{[plan.id]:work},designs:[{...payload.designs[0],planId:plan.id}]};
const saved=R.parse(JSON.parse(R.text(next)));
assert.equal(saved.v,102);
assert.deepEqual(saved.work[plan.id].wireRoutes,[route]);
assert.deepEqual(saved.designs[0].work.wireRoutes,[route]);
const caches={'huxing-design-v101':JSON.stringify(workspace),'huxing-design-v102':JSON.stringify(next)};
const load=read=>Cache.load({read,key:'huxing-design-v102',firstPlan:plan,restore:W.restore});
assert.deepEqual(load(key=>caches[key]),next);
assert.deepEqual(load(key=>key.endsWith('101')?caches[key]:null),workspace);
E.assertEditable(legacy,work);
E.assertEditable(work,legacy);
assert.throws(()=>E.assertEditable(work,{...work,furniture:[{...box,cx:10},socket]}),/只读/);
for(const fail of [
 r=>r.kind='coax',
 r=>r.name='   ',
 r=>r.points.splice(1),
 r=>r.points[1].z=Infinity,
 r=>r.points[1].x='10',
 r=>r.points[1].furnitureId=socket.id,
 r=>r.points[2]={...r.points[1]},
]){
 const bad=clone(work);
 fail(bad.wireRoutes[0]);
 assert.throws(()=>E.assertEditable(work,bad));
 assert.throws(()=>W.restore(clone(bad),plan));
 assert.throws(()=>J.validateWork(bad));
}
assert.throws(()=>E.validateRoutes([route,route]));
console.log('PASS wiring geometry, anchor changes and loss, edit protection, import, named designs, workspace and cache compatibility');
