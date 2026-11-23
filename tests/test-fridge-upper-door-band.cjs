'use strict';
const assert=require('node:assert/strict'),C=require('../src/core/cabinet-core.js'),M=require('../src/core/cabinet-motion.js'),P=require('../src/core/project-core.js');
const box=b=>({lo:[Math.min(...b.poly.map(p=>p[0])),b.bottom,Math.min(...b.poly.map(p=>p[1]))],hi:[Math.max(...b.poly.map(p=>p[0])),b.top,Math.max(...b.poly.map(p=>p[1]))]});
const overlap=(a,b)=>a.lo.every((v,i)=>Math.min(a.hi[i],b.hi[i])-Math.max(v,b.lo[i])>.001);
for(const overlay of [undefined,'full','inset'])for(const closure of [false,true]){
 if(closure&&overlay!=='full')continue;
 const f={...C.preset('sideboard-fridge'),id:'fridge-upper',type:'cabinet',cx:0,cy:0,rot:0};
 if(overlay)f.cabinet.doorOverlay=overlay;
 if(closure)f.cabinet.topClosure={height:50,doorGap:10};
 const before=JSON.stringify(f),boards=M.boards(f,{includeStatic:true}),doors=boards.filter(b=>b.metadata.cabinetPart?.section==='fridgeUpper'),fixed=boards.filter(b=>!b.motion);
 assert.equal(doors.length,2);
 for(const d of doors)for(const b of fixed)assert(!overlap(box(d),box(b)),'closed upper door intersects a fixed production board');
 const c=C.config(f),rear=-f.d/2,front=rear+c.sideboard.fridgeDepth;
 assert(fixed.some(b=>b.bottom===0&&Math.abs(Math.max(...b.poly.map(p=>p[1]))-front)<.001),'lower refrigerator surround remains full depth');
 assert.equal(JSON.stringify(f),before,'production derivation must not modify saved data');
 const work={furniture:[f]},round=P.unpack(P.pack({planId:'test',current:work,designs:[],catalog:[]}));assert.deepEqual(round.current.furniture[0].cabinet,f.cabinet);
 assert.equal(C.spatialConfig(f).fridgeUpperFrameRule,'reserved-door-band-and-top-joint-v2');
 assert.deepEqual(C.spatialConfig({...f,color:'#123456'}),C.spatialConfig(f));
}
const ordinary={...C.preset('storage'),type:'cabinet'};assert.equal(C.spatialConfig(ordinary).fridgeUpperFrameRule,undefined);
console.log('PASS refrigerator upper closed doors clear fixed production boards; overlays/closure, lower surround, persistence and scoped spatial rule');
