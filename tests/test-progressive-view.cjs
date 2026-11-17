'use strict';
const assert=require('node:assert/strict'),P=require('../src/core/progressive-view-core.js');
const a={matrixWorld:Array(16).fill(1),projectionMatrix:Array(16).fill(2)},b=structuredClone(a);
b.matrixWorld[4]+=1e-11;assert.equal(P.cameraKey(a),P.cameraKey(b),'orbit floating point noise does not restart sampling');
b.matrixWorld[4]+=.001;assert.notEqual(P.cameraKey(a),P.cameraKey(b));
// Asymmetric frusta retain all screen-space coordinates during the depth-only
// WebGPU conversion. A later tracer camera refresh must not reconstruct old FOV.
const projection=[1.2,0,0,0,0,2.3,0,0,.15,-.2,-1.002,-1,0,0,-.2002,0],saved=projection.slice(),gpu=P.projectionMatrix(projection,true);
assert.deepEqual(P.projectionMatrix(projection),projection);assert.deepEqual(projection,saved);for(const i of [0,1,3,4,5,7,8,9,11,12,13,15])assert.equal(gpu[i],projection[i]);
for(const q of [[1,2,-3,1],[-2,1,-.1,1],[.3,-.5,-100,1]]){const apply=m=>[0,1,2,3].map(r=>q.reduce((s,v,c)=>s+v*m[c*4+r],0)),g=apply(gpu),w=apply(projection);assert(Math.abs(g[2]-(w[2]+w[3])/2)<1e-10);assert.equal(g[0]/g[3],w[0]/w[3]);assert.equal(g[1]/g[3],w[1]/w[3]);}assert.throws(()=>P.projectionMatrix([1]));
assert.deepEqual(P.size(2),{width:1200,height:600});assert.deepEqual(P.size(.5,640),{width:320,height:640});assert.throws(()=>P.size(NaN));assert.throws(()=>P.size(0));
assert.deepEqual(P.quality('auto'),{edge:800,samples:64});assert.deepEqual(P.quality('detail'),{edge:1200,samples:256});assert.deepEqual(P.quality('unknown'),P.quality('auto'));
let p=P.performancePolicy();assert.equal(p.sample({now:0,samples:0}).edge,800);assert.equal(P.performancePolicy('detail').sample({now:0,samples:0}).edge,1200);assert.equal(p.sample({now:0,samples:0}).action,'keep');assert.equal(p.sample({now:90000,samples:0}).action,'keep','even a long first compilation is not a slow-GPU sample');assert.equal(p.sample({now:100000,samples:1}).action,'keep');assert.equal(p.sample({now:111999,samples:1}).action,'keep');assert.equal(p.sample({now:112000,samples:1}).action,'reduce');
p.reset();assert.equal(p.sample({now:113000,samples:1}).edge,640,'camera updates preserve reduced resolution');assert.equal(p.sample({now:125000,samples:2}).action,'fallback');
p=P.performancePolicy();p.sample({now:0,samples:1});assert.equal(p.sample({now:15000,samples:256,frameTime:300}).action,'keep','a complete image is not a slow renderer');
p=P.performancePolicy();p.sample({now:0,samples:1});assert.equal(p.sample({now:20000,samples:25,frameTime:20}).action,'keep');
p=P.performancePolicy();p.sample({now:0,samples:1});for(const now of [3000,6000,9000])assert.equal(p.sample({now,samples:now/1000,frameTime:120}).action,'keep');assert.equal(p.sample({now:12000,samples:12,frameTime:120}).action,'reduce','sustained GPU frame time matters independently of samples/sec');
p=P.performancePolicy();p.sample({now:0,samples:1});for(const now of [3000,6000,9000])p.sample({now,samples:now/1000,frameTime:120});assert.equal(p.sample({now:12000,samples:64,frameTime:120}).action,'keep','completed fast quality must not be downgraded');
console.log('PASS stable camera keys, viewport aspect, post-compile measurement, two-stage slow-GPU fallback, no oscillation and healthy/complete negatives');
