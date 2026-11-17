'use strict';
const assert=require('node:assert/strict'),K=require('../src/core/kitchen-core.js'),A=require('../src/core/cabinet-assembly-core.js'),B=require('../src/core/cabinet-builder-core.js'),P=require('../src/core/project-core.js');
const near=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
let count=0;
for(const shape of ['straight','L','U'])for(const corner of ['left','right'])for(const rot of [0,37,270])for(const flip of [false,true]){
 let f=A.editableKitchen(K.configure({id:'elevations',type:'counter',cx:4000,cy:4000,rot,flip,color:'#eee'},{version:1,shape,corner,depth:600,counterDepth:620,baseHeight:830,thickness:20,modules:[{run:0,width:1200,role:'door'},...(shape!=='straight'?[{run:1,width:1100,role:'door'}]:[]),...(shape==='U'?[{run:2,width:900,role:'door'}]:[])]}));
 const native=new Set(K.layout(f).map(m=>m.rot)),a=K.assemblyConfig(f,true),part=B.update(B.create(),{boxId:'box1'},{w:600,d:400,h:830});
 for(const angle of [0,90,180,270])a['cabinet'+angle]={w:600,d:400,h:830,x:angle*10,y:angle*5,rot:angle,mountHeight:0,cabinet:structuredClone(part.cabinet)};
 const saved=structuredClone(f),rows=K.elevationRuns(f);assert.equal(rows.length,4);assert.equal(new Set(rows.map(v=>v.run)).size,4);assert.deepEqual(f,saved,'views never migrate or reshape source');
 const seen=[];
 for(const view of rows){K.validate(view.furniture);for(const key of Object.keys(K.assemblyConfig(view.furniture)))seen.push(key);}
 assert.deepEqual(seen.sort(),Object.keys(a).sort(),'each actual cabinet appears once, including opposite-facing sides');
 for(const angle of [0,90,180,270].filter(v=>!native.has(v))){const view=rows.find(v=>v.run==='assembly:'+angle);assert(view);const row=A.placementRows(view.furniture).find(r=>r.id==='cabinet'+angle);near(row.x,0);near(row.z,0);near(row.rot,0);near(row.furniture.w,600);
  const added=A.drop(f,{kind:'shelf'},{x:0,y:400,elevation:view.run});assert.equal(added.id,row.id);assert.equal(K.assemblyConfig(added.furniture)[row.id].rot,angle);assert.equal(K.assemblyConfig(added.furniture)[row.id].cabinet.boxes[0].components.length,1);assert.deepEqual(added.furniture.kitchen.modules,f.kitchen.modules);
 }
 const disabled=structuredClone(f);a.cabinet360={...structuredClone(a.cabinet270),rot:270,y:a.cabinet270.y-600};const grouped=K.elevationRuns(f).find(v=>v.run==='assembly:270');if(!native.has(270)){assert.equal(Object.keys(K.assemblyConfig(grouped.furniture)).length,2);near(grouped.furniture.w,1200);}
 for(const p of Object.values(K.assemblyConfig(disabled)))p.enabled=false;assert.equal(K.elevationRuns(disabled).length,shape==='straight'?0:shape==='L'?2:3);
 const packed=P.pack({planId:'p',current:{furniture:[f]},designs:[{name:'copy',work:{furniture:[f]}}],catalog:[]}),restored=P.unpack(packed);assert.deepEqual(K.elevationRuns(restored.current.furniture[0]),K.elevationRuns(f));count++;
}
console.log('PASS '+count+' straight/L/U, turn/mirror: four actual orientations, grouping, disabled cabinets, stable identities, additional-view drop routing and project restoration');
(async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),C=require('../src/core/cabinet-core.js'),imports=JSON.parse(fs.readFileSync(require.resolve('../index.html'),'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports,T=await import(imports.three),ctx=vm.createContext({FurnishPartIdentity:require('../src/core/part-identity.js'),FurnishProducts:require('../src/core/product-rules.js'),FurnishCabinetProfiles:require('../src/core/cabinet-component-profiles.js'),FurnishCabinetBuilder:B,FurnishCabinetMotion:require('../src/core/cabinet-motion.js'),FurnishKitchen:K,FurnishCabinet:C});
 for(const name of ['cabinet-profile-model','cabinet-model','kitchen-model'])vm.runInContext(fs.readFileSync(require.resolve('../src/render/'+name+'.js'),'utf8'),ctx);
 const box=(w,h,d,color,x,y,z)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color}));o.position.set(x,y+h/2,z);return o;};
 for(const style of ['plain','square','reverse','bevel'])for(const outside of [false,true]){
  const f=A.editableKitchen(K.configure({id:'surface',type:'counter',cx:0,cy:0,rot:0},{version:1,shape:'straight',depth:600,counterDepth:620,baseHeight:830,thickness:20,edgeStyle:style,dropHeight:30,modules:[{run:0,width:1200,role:'door'}]})),part=B.update(B.create(),{boxId:'box1'},{w:800,d:400,h:830});
  K.assemblyConfig(f,true).cabinet1={w:800,d:400,h:830,x:outside?5000:0,y:0,rot:180,mountHeight:0,cabinet:part.cabinet};const row=K.elevationRuns(f).find(v=>v.assemblyOnly);assert(row);K.validate(row.furniture);const model=ctx.FurnishKitchenModel.build(T,row.furniture,box,{previewSurface:row.previewSurface}),slabs=[];model.traverse(n=>{if(n.isMesh&&n.userData.kitchenSlab)slabs.push(n);});assert.equal(slabs.length>0,!outside,'empty intersection creates no fake countertop');for(const n of slabs){n.geometry.computeBoundingBox();assert(Number.isFinite(n.geometry.boundingBox.min.x));}
 }
 console.log('PASS additional-view production surfaces: four edge styles, empty intersection, no invalid or invented slab');
})().catch(e=>{console.error(e);process.exitCode=1;});
