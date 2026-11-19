'use strict';
const assert=require('node:assert/strict');
const Drawing=require('../src/core/drawing-core.js'),Design=require('../src/core/design-core.js');
const Lighting=require('../src/core/lighting-core.js'),Project=require('../src/core/project-core.js');
const Repository=require('../src/core/repository-core.js'),Cache=require('../src/io/workspace-cache.js');
const Work=require('../src/core/work-state.js');
const summer='2026-06-21',winter='2026-12-21',equinox='2026-03-20';
const position=(latitude,date,hour=12,drawing)=>Drawing.solarPosition({latitude,date},hour,drawing);
const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≈ ${expected}`);

near(position(0,equinox).altitude,90,1);
near(position(40,equinox).altitude,50,1);
near(position(40,summer).altitude,73.44,.15);
near(position(40,winter).altitude,26.56,.15);
near(position(-40,winter).altitude,73.44,.15);
assert.ok(position(40,summer,9).direction[0]>0,'morning sun comes from the east');
assert.ok(position(40,summer,15).direction[0]<0,'afternoon sun comes from the west');
assert.ok(position(40,summer).direction[2]>0,'midday sun comes from the south');
assert.ok(position(-40,winter).direction[2]<0,'midday sun comes from the north');
assert.ok(position(90,winter).altitude<0);
assert.ok(position(90,summer,0).altitude>0);
const original=position(40,summer,9),rotated=position(40,summer,9,{northAngle:90,rotation:180});
near(Math.hypot(...rotated.direction),1,1e-12);
near(rotated.altitude,original.altitude,1e-12);
near(rotated.direction[0],-original.direction[2],1e-12);
near(rotated.direction[2],original.direction[0],1e-12);
assert.deepEqual(position(40,summer,9,{rotation:180}),original,'2D view rotation does not rotate sunlight');
assert.equal(Lighting.environment(true,12,0).sun,0);
assert.ok(Lighting.environment(true).sun>0,'legacy night lighting is preserved');

const solar={latitude:0,date:'2024-02-29'},legacy=Design.sceneSettings();
const scene3d=Design.sceneSettings({...legacy,hour:23.75,solar});
const current={furniture:[],rooms:{},scene3d},plan=require('../src/data/plans.js')[0];
const payload={planId:plan.id,current,designs:[{id:'sun',name:'日照',work:structuredClone(current)}],catalog:[]};
const project=Project.pack(payload);
assert.equal(project.version,Drawing.solarFormatVersion);
assert.deepEqual(Project.unpack(project),payload);
const workspace={v:project.version,planId:plan.id,work:{[plan.id]:current},designs:[],custom:[]};
const value=Repository.text(workspace);
assert.deepEqual(Repository.parse(JSON.parse(value)).work[plan.id].scene3d,scene3d);
const cache=Cache.load({read:k=>k==='huxing-design-v100'?JSON.stringify(workspace):null,firstPlan:plan,key:'huxing-design-v100'});
assert.deepEqual(cache.work[plan.id].scene3d,scene3d);
assert.equal(Cache.candidates({read:k=>k==='huxing-design-v99'?'{"v":99}':null})[0].v,99);
const restore=Work.create({makeId:()=> 'id',colorFor:()=> '#fff',materials:{}}).restore;
const restored=restore(structuredClone(current),plan);
assert.deepEqual(restore(structuredClone(restored),plan).scene3d,scene3d);
assert.equal(restore({furniture:[]},plan).scene3d.solar,undefined);
assert.equal(Project.formatVersion([{furniture:[],scene3d:legacy}]),1);
for(const input of [null,[],{...solar,latitude:90.001},{...solar,latitude:'0'},{...solar,date:'2026-02-29'},{...solar,date:'2026-04-31'},{...solar,date:'2026-1-01'},{...solar,x:1}]){
 assert.throws(()=>Project.validateWork({...current,scene3d:{...legacy,solar:input}}),/日照/);
}
for(const candidate of [{...scene3d,hour:-.25},{...scene3d,hour:24.25},{...legacy,hour:19}]){
 assert.throws(()=>Project.validateWork({...current,scene3d:candidate}),/三维/);
}
console.log('PASS seasonal solar elevation, hemispheres, true north, polar day/night, and project/design/repository/cache recovery');
