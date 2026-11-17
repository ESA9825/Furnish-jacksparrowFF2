'use strict';
const assert=require('node:assert/strict'),C=require('../src/core/ceiling-core.js');
const flat={id:'flat',name:'平顶',kind:'flat',height:2500,thickness:12,polygon:[[0,0],[1000,0],[1000,800],[0,800]]};
const profile={id:'profile',name:'截面',kind:'profile',roomId:'r',height:2800,path:{a:[0,0],b:[1000,0],normal:[0,1]},section:C.lowCove()};
const bodies=[];
for(const [i,z]of [2499,2500,2512,2800,null].entries())for(const x of [0,500,1200])bodies.push({f:{id:'f'+bodies.length,type:'bed',name:'家具'},p:[[x,0],[x+100,0],[x+100,100],[x,100]],vertical:z===null?null:{bottom:z,top:z+10}});
for(const c of [flat,profile]){
 const plan={ceilings:{items:[c],pending:[{id:'pending',message:'未知'}]}};
 const before=JSON.stringify({plan,bodies}),all=C.checks(plan,bodies);
 for(const targets of [new Set(),new Set(['f0']),new Set(['f1','f5','f10']),new Set(bodies.map(b=>b.f.id))]){
  const filtered=v=>v.filter(i=>targets.has(i.id));
  assert.deepEqual(filtered(C.checks(plan,bodies,{focusIds:targets})),filtered(all));
 }
 assert.equal(JSON.stringify({plan,bodies}),before);
}
// A non-target installed panel must still cut an aperture for the target body.
const {fixture}=require('./helpers/wall-finish-fixture.cjs'),G=require('../src/core/layout-geometry.js'),D=require('../src/core/design-core.js'),source=fixture();
const region={id:'bath',name:'扣板',polygon:[[0,0],[1240,0],[1240,2440],[0,2440]],style:'aluminum',height:2500,thickness:8,aluminum:C.aluminumDefaults(),sections:[C.componentPreset('gypsum','low')],center:true};
const work=C.setRegion(source.work,region),plan={...source.plan,ceilings:work.ceilings};
const heater=C.fitCeilingPanel(plan,{id:'heater',name:'浴霸',type:'bath_heater_300x600',w:300,d:600,h:180,cx:180,cy:350,rot:0,color:'#fff',mountHeight:2498},[]);
const equipment={f:heater,p:G.corners(heater),vertical:D.furnitureVerticalBounds(heater,plan,[heater])};
for(const [left,right]of [[100,110],[310,330]]){
 const probe={f:{id:'probe',name:'测试实体',type:'block'},p:[[left,90],[right,90],[right,110],[left,110]],vertical:{bottom:2500,top:2508}},all=[equipment,probe];
 assert.deepEqual(C.checks(plan,all,{focusIds:new Set(['probe'])}).filter(i=>i.id==='probe'),C.checks(plan,all).filter(i=>i.id==='probe'));
}
console.log('ceiling focus result parity: contact, unknown height, flat/profile, empty/multiple targets passed');
