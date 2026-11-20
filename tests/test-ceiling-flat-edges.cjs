'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../src/core/ceiling-core.js');
const P=require('../src/core/project-core.js');
const Model=require('../src/render/ceiling-model.js');

const rect=(x1,y1,x2,y2)=>[[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
const room={id:'bedroom',name:'次卧',poly:rect(0,0,3000,3000),ceilingHeight:2700};
const plan={id:'flat-edges',rooms:[room],ceilingHeight:2700};
const region={id:'wardrobe-top',name:'次卧衣柜平顶',polygon:rect(0,2300,3000,3000),height:2510,thickness:12,style:'flat',center:true,sections:[]};
const work=C.setRegion({furniture:[],ceilingHeight:2700},region);
const effective=C.derive(plan,work);
const board=effective.ceilings.items[0];
const [edge]=effective.ceilings.closures;
assert.equal(effective.ceilings.closures.length,1,'the three wall-backed edges need no panel');
assert.deepEqual(edge,{id:board.id,key:'0-0-0',polygon:[[0,2300],[3000,2300],[2988,2312],[12,2312]],bottom:2522,top:2700});
assert.notDeepEqual(C.signature(effective.ceilings),C.signature(C.resolve(work.ceilings)));
assert.equal(C.derive({...plan,rooms:[{...room,ceilingHeight:2800}]},work).ceilings.closures[0].top,2800);

const neighbor={...region,id:'neighbor',polygon:rect(1000,1500,2000,2300)};
const joined=C.derive(plan,C.setRegion(work,neighbor)).ceilings.closures;
assert.deepEqual(joined.filter(v=>v.id===board.id).map(v=>v.polygon.slice(0,2)),[
 [[0,2300],[1000,2300]],[[2000,2300],[3000,2300]],
]);
const stepped=C.derive(plan,C.setRegion(work,{...neighbor,height:2610})).ceilings.closures;
assert.deepEqual(stepped.filter(v=>v.id===board.id).map(v=>v.top),[2700,2610,2700]);
const filled=C.derive(plan,C.setRegion(work,{...region,thickness:190}));
assert.equal(filled.ceilings.closures,undefined,'full-height curtain box needs no second panel');
const aluminum=C.setRegion(work,{...region,style:'aluminum',thickness:8});
assert.equal(C.derive(plan,aluminum).ceilings.closures,undefined);
assert.equal(C.derive(plan,{...work,ceilings:{version:1,items:[{...board,regionId:undefined,roomId:'bedroom'}]}}).ceilings.closures,undefined);

const body=(id,p,vertical)=>({f:{id,type:'bed',name:id},p,vertical});
const inEdge=rect(1500,2301,1510,2308);
const hits=C.checks(effective,[
 body('inside-edge',inEdge,{bottom:2550,top:2600}),
 body('above-board',rect(1500,2450,1510,2460),{bottom:2550,top:2600}),
 body('meets-edge',rect(1500,2290,1510,2300),{bottom:2550,top:2600}),
 body('unknown',inEdge,null),
]);
assert.deepEqual(hits.map(issue=>[issue.id,issue.ceilingId,issue.pending]),[['inside-edge',board.id,false],['unknown',board.id,true]]);
const reversed=C.setRegion(work,{...region,polygon:region.polygon.slice().reverse()});
assert.equal(C.checks(C.derive(plan,reversed),[body('inside-edge',inEdge,null)]).length,1);
const twoRoofs={...plan,rooms:[
 {...room,poly:rect(0,0,1500,3000)},
 {...room,id:'next-room',poly:rect(1500,0,3000,3000),ceilingHeight:2800},
]};
assert.deepEqual(C.derive(twoRoofs,work).ceilings.closures.map(v=>v.top),[2700,2800]);
const restored=P.unpack(P.pack({planId:plan.id,current:work,designs:[{name:'衣柜平顶',work}],catalog:[]}));
assert.deepEqual(restored.current.ceilings,work.ceilings);
assert.deepEqual(C.derive(plan,restored.current).ceilings.closures,effective.ceilings.closures);

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const T=await import(JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports.three);
 const group=Model.build(T,effective.ceilings);
 const parts=group.children.map(mesh=>mesh.userData.ceiling.part);
 assert.deepEqual(parts,['flat','flat-edge']);
 const zRange=mesh=>{const box=new T.Box3().setFromObject(mesh);return [box.min.y,box.max.y].map(z=>Math.round(z*1000));};
 assert.deepEqual(zRange(group.children[0]),[2510,2522]);
 assert.deepEqual(zRange(group.children[1]),[2522,2700]);
 assert.equal(group.children[1].userData.ceiling.id,board.id);
 const ray=new T.Raycaster(new T.Vector3(1.5,2.6,2),new T.Vector3(0,0,1));
 assert(ray.intersectObject(group.children[1]).some(hit=>Math.abs(hit.point.z-2.3)<.00001));
 assert.deepEqual(Model.build(T,effective.ceilings,{top:2522}).children.map(mesh=>mesh.userData.ceiling.part),['flat']);
 console.log('PASS flat ceiling edge geometry, adjacent levels, legacy recovery, collision and production meshes');
})().catch(error=>{console.error(error);process.exitCode=1;});
