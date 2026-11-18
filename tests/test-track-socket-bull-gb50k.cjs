'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const P=require('../src/core/product-rules.js'),G=require('../src/core/layout-geometry.js'),S=require('../src/core/snapping.js');
const E=require('../src/core/electrical-core.js'),J=require('../src/core/project-core.js'),C=require('../src/data/catalog.js');
const spec=require('../scripts/lib/track-socket-bull-gb50k-spec.json');
const asset=require('../src/data/track-socket-bull-gb50k-blender-asset.js');
const id='track-socket-bull-gb50k',type=spec.type,rule=P.definition(type),track=rule.trackSocket;
const fixture=require('./helpers/wall-finish-fixture.cjs').fixture();
const item=C.library.flatMap(group=>group.items).find(row=>row[0]===type);
const f={id:'track-1',name:item[1],type,w:item[2],d:item[3],h:item[6],color:item[4],cx:500,cy:500,rot:0,mountHeight:1150};
const near=(a,b)=>assert(Math.abs(a-b)<.002,`${a} != ${b}`);
assert.deepEqual([f.w,f.h,f.d],spec.size);
assert.deepEqual(track.moduleCenters,spec.moduleCenters);
assert.equal(track.railDepth,spec.trackDepth);assert.equal(track.moduleDiameter,spec.moduleDiameter);
assert.equal(P.initial({type}).mountHeight,0);
assert.equal(P.bottomHeight({...f,mountHeight:undefined}),0);
assert(!P.supports(f,'panelVariant'));
assert.deepEqual(new Set(asset.parts.map(p=>p.name)),new Set(spec.parts));
const glb=fs.readFileSync(require.resolve(`../assets/models/${id}/v1/${id}-v1.glb`));
assert.equal(asset.sourceSha256,crypto.createHash('sha256').update(glb).digest('hex'));

// Each opening reaches the front, with intact material between holes.
function surfaceAt(positions,x,y){
 for(let i=0;i<positions.length;i+=9){
  const tri=[0,3,6].map(j=>positions.slice(i+j,i+j+3));
  if(tri.some(v=>Math.abs(v[2]-.018)>1e-7))continue;
  const sides=tri.map(([ax,ay],j)=>{const [bx,by]=tri[(j+1)%3];return (bx-ax)*(y-ay)-(by-ay)*(x-ax);});
  if(Math.min(...sides)>=-1e-13||Math.max(...sides)<=1e-13)return true;
 }
 return false;
}
for(const [i,x] of spec.moduleCenters.entries()){
 const {positions}=asset.parts.find(p=>p.name===['left','middle','right'][i]+'-face');
 for(const [dx,dy] of [[-6.7,6.6],[0,6.6],[6.7,6.6],[-6.5,-11.3],[6.5,-11.3]])
  assert(!surfaceAt(positions,(x+dx)/1000,(47+dy)/1000));
 assert(surfaceAt(positions,x/1000,.047));
}

const work={...fixture.work,furniture:[f]},wallPlan={walls:[[0,0,1200,200]]};
const surface=E.surfaces(wallPlan,work,f).find(s=>s.kind==='wall');
const placed=E.place(f,surface,600);
assert(E.panel(f));assert.equal(E.points(work)[0].variant.label,track.label);
E.assertEditable(work,{...work,furniture:[placed]});
assert(E.nearest(placed,[surface],.001));
const body=G.bodyParts(f);
const points=body.flatMap(p=>p.vertices);
near(Math.min(...points.map(p=>p[1])),1150);near(Math.max(...points.map(p=>p[1])),1244);
near(Math.min(...points.map(p=>p[2])),482);near(Math.max(...points.map(p=>p[2])),518);
for(const rot of [0,37,90])for(const flip of [false,true]){
 const a={...f,rot,flip},bounds=G.bbox(G.footprints(a).flat());
 const block={...a,id:'block',type:'block',w:2000,d:2000,h:50,mountHeight:1244};
 assert(!G.volumeOverlap(a,block));
 assert(G.volumeOverlap(a,{...block,mountHeight:1243.9}));
 const probe={...block,w:100,d:2000,cx:bounds[2]+150,rot:0,flip:false,mountHeight:1150};
 near(S.directional(a,{furniture:[probe]}).r.distance,100);
}
const payload={planId:fixture.plan.id,current:work,designs:[{name:'轨道插座',work}],catalog:[{...f,price:0}]};
assert.deepEqual(J.unpack(J.pack(payload)),payload);
const restore=require('../src/core/work-state.js').create({makeId:()=> 'fixture',colorFor:()=>f.color,materials:C.materials}).restore;
assert.deepEqual(restore(restore(work,fixture.plan),fixture.plan).furniture,[f]);
const fingerprint=item=>J.checkFingerprint({},fixture.plan,[item],800);
assert.notEqual(fingerprint(f),fingerprint({...f,mountHeight:1200}));
assert.equal(fingerprint(f),fingerprint({...f,color:'#ffffff',price:200}));
console.log('PASS GB50K: dimensions, five open holes per module, mounting, rotation/mirror, clearance, electrical placement, project round trip and cache inputs');
