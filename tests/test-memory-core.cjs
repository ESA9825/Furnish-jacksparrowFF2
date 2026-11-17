'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/core/model-solid-recorder.js');
const points=[[0,0,0],[1,0,1],[0,1,0],[0,0,0],[1,0,1],[0,1,0],[1+1e-12,0,1]],faces=[0,1,2,3,4,5,6,1,2];
const scope={module:{exports:{}},FurnishModelSolidRecorder:A,FurnishCabinetMotion:require('../src/core/cabinet-motion.js'),FurnishProducts:{definition:()=>({solidModel:{global:'MemoryModel',base:'mountHeight'}}),family:()=>false,elevationSource:f=>f,elevationDelta:()=>0,value:(f,k)=>f[k]||0},MemoryModel:{build(T){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex(faces);const group=new T.Group();group.add(new T.Mesh(g));return group;}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/core/furniture-solids.js'),'utf8'),scope);const S=scope.module.exports;
for(const rot of [0,37])for(const flip of [false,true]){
 const f={type:'memory',w:1000,h:1000,d:1000,cx:123,cy:456,rot,flip,mountHeight:250},r=S.parts(f)[0],angle=rot*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 assert.equal(r.vertices.length,points.length);assert.deepEqual(Array.from(r.faces,face=>Array.from(face)),[[0,1,2],[3,4,5],[6,1,2]]);
 for(let i=0;i<points.length;i++){const [u,v,w]=points[i],x=u*1000*(flip?-1:1),z=w*1000,expected=[123+x*c-z*s,250+v*1000,456+x*s+z*c];assert.deepEqual(Array.from(r.vertices[i]),expected);}
 assert.strictEqual(r.vertices[0],r.vertices[3]);assert.strictEqual(r.vertices[1],r.vertices[4]);assert.notStrictEqual(r.vertices[1],r.vertices[6],'sub-nanometre differences must not be quantized away');
 assert.strictEqual(S.parts({...f})[0],r,'equal restored input hits immutable world records');
}
const P=require('../src/core/project-core.js'),D=require('../src/core/floorplan-core.js');
const draft=D.fromPlan(require('../src/data/plans.js')[0],'custom_memory').draft,original=D.build;let builds=0;
D.build=(...args)=>{builds++;return original(...args);};
try{
 const arch={draft,phase:'survey'},input=JSON.stringify(arch);
 P.withDraftCache(()=>{const one=P.architecture(arch);one.draft.name='changed result';const two=P.architecture(arch);assert.notEqual(two.draft.name,'changed result');P.validatePlanWork(null,{architecture:arch});assert.equal(builds,1,'one derivation, repeated input validation still runs');assert.throws(()=>P.validatePlanWork(null,{architecture:arch,demolished:['w99999']}),/拆墙/);const bad=JSON.parse(input);bad.draft.scale=NaN;assert.throws(()=>P.architecture(bad));});
 assert.equal(JSON.stringify(arch),input);P.architecture(arch);assert.equal(builds,2,'scope releases derived plans');
 assert.throws(()=>P.withDraftCache(()=>{P.architecture(arch);throw Error('abort');}),/abort/);const before=builds;P.architecture(arch);assert.equal(builds,before+1,'failure also releases scope');
}finally{D.build=original;}
console.log('PASS lossless shared vertices, full index/order/precision, mirrored transforms and restored objects; scoped plan reuse, detached outputs, invalid inputs and exception cleanup');
