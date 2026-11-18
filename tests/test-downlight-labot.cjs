'use strict';
const assert=require('node:assert/strict'),P=require('../src/core/product-rules.js'),J=require('../src/core/project-core.js'),D=require('../src/core/design-core.js'),C=require('../src/core/ceiling-core.js'),G=require('../src/core/layout-geometry.js'),Model=require('../src/render/downlight-model.js'),asset=require('../src/data/downlight-labot-ip65-blender-asset.js');
const item=require('../src/data/catalog.js').library.flatMap(c=>c.items).find(i=>i[0]==='downlight_labot_ip65_7w');assert(item);
const f={id:'labot',type:item[0],name:item[1],cx:500,cy:500,w:85,d:85,h:45,rot:0,color:item[4],...P.initial({type:item[0]}),mountHeight:2343};
assert.equal(asset.parts.length,10);assert.deepEqual(asset.sizeMm,[85,45,85]);assert.equal(P.downlightSpec(f).lumens,null);assert.equal(P.downlightSpec(f).previewLumens,500);assert.throws(()=>P.editDownlight(f,'downlightWatts',5));
const c={id:'flat',kind:'flat',height:2400,thickness:8,polygon:[[0,0],[1000,0],[1000,1000],[0,1000]]},plan={rooms:[{id:'room',poly:c.polygon}],ceilings:{items:[c]},furnitureDatum:'finished-floor',floorFinish:{areas:[{roomId:'room',polygon:c.polygon,z:55,known:true}]}};
// Use actual production geometry, independent mount height, rotation and mirror.
for(const mountHeight of [0,2343])for(const rot of [0,37])for(const flip of [false,true]){
 const x={...f,mountHeight,rot,flip},parts=G.bodyParts(x,undefined,[x]);assert.equal(parts.length,10);const vs=parts.flatMap(p=>p.vertices||[]);assert(parts.every(p=>p.vertical));assert(Math.abs(Math.min(...parts.map(p=>p.vertical.bottom))-mountHeight)<.001);assert(Math.abs(Math.max(...parts.map(p=>p.vertical.top))-(mountHeight+45))<.001);
 const restored=J.unpack(J.pack({planId:'test',current:{furniture:[x]},designs:[{name:'saved',work:{furniture:[x]}}],catalog:[]})).current.furniture[0];assert.deepEqual(restored,x);
}
const body={f,vertical:{bottom:2398,top:2443}};assert.equal(C.downlightHoles(c,[body]).length,1);assert.equal(C.downlightHoles(c,[{...body,vertical:null}]).length,0);
const installed={...f,mountHeight:2398},bodies=G.bodyParts(installed,undefined,[installed]).map(p=>({f:installed,p:p.p,vertical:p.vertical}));
assert(bodies[0].vertical.bottom>2398,'exercise upper mesh first');assert.equal(C.downlightHoles(c,bodies).length,1);assert.equal(C.downlightHoles(c,[...bodies].reverse()).length,1);assert.equal(C.checks({ceilings:{items:[c]}},bodies).length,0);
for(const dx of [-.01,0,.01])assert.equal(C.downlightHoles(c,[{...body,f:{...f,cx:42.5+dx}}]).length,dx<0?0:1);
for(const delta of [-.01,.01])assert.equal(C.downlightHoles(c,[{...body,vertical:{bottom:2398+delta,top:2443+delta}}]).length,0);
const replaced=D.replaceFurniture({...f,type:'surface_light',w:100,d:100,h:20}, {type:f.type,name:f.name,w:85,d:85,h:45,color:f.color});assert.equal(replaced.id,f.id);assert.equal(replaced.type,f.type);assert.equal(replaced.mountHeight,P.value({type:f.type},'mountHeight'));

assert.match(J.procurement({rooms:[]},{furniture:[f]}).items[0].model,/光通量待核/);
console.log('PASS LABOT asset parts, mounting heights, rotation/mirror, cutout thresholds, unknown height, replacement and project roundtrip');
