'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),S=require('../src/core/style-core.js'),B=require('../src/core/cabinet-builder-core.js'),C=require('../src/core/cabinet-core.js'),K=require('../src/core/kitchen-core.js'),A=require('../src/core/cabinet-assembly-core.js'),J=require('../src/core/project-core.js'),D=require('../src/core/design-core.js'),R=require('../src/core/repository-core.js');
(async()=>{
 const imports=JSON.parse(fs.readFileSync(require.resolve('../index.html'),'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports,T=await import(imports.three),Model=require('../src/render/cabinet-model.js'),box=(w,h,d,color,x,y,z)=>{const n=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color}));n.position.set(x,y+h/2,z);return n;};
 let f=B.create({id:'styled',cx:4000,cy:4000,rot:37,flip:true,mountHeight:120});for(const kind of ['shelf','door'])f=B.add(f,kind,{boxId:'box1'}).furniture;
 const spatial=C.spatialConfig(f),before=JSON.stringify(f),work={furniture:[f]};S.applyColors(work,'warm-walnut');f=work.furniture[0];assert.equal(JSON.stringify(JSON.parse(before)),before);C.validate(f);assert.deepEqual(C.spatialConfig(f),spatial);
 const g=Model.build(T,f,box),body=[],front=[];g.traverse(n=>{if(n.isMesh)(n.userData.cabinetDoorSize?front:body).push(n);});assert(front.length);assert(body.some(n=>n.material.map));assert(front.every(n=>n.material.color.getHexString()==='f3f0e8'&&!n.material.map));
 const shelf=f.cabinet.boxes[0].components.find(p=>p.kind==='shelf'),pick={boxId:'box1',componentId:shelf.id};let custom=B.update(f,pick,{surface:'solid',color:'#345678'});const cg=Model.build(T,custom,box);let found=0;cg.traverse(n=>{if(n.isMesh&&n.userData.cabinetBuilder?.componentId===shelf.id){found++;assert.equal(n.material.color.getHexString(),'345678');assert(!n.material.map);}});assert(found);assert.deepEqual(C.spatialConfig(custom),spatial);S.applyColors({furniture:[custom]},'natural');assert.equal(custom.cabinet.boxes[0].components.find(p=>p.id===shelf.id).color,'#345678');assert.deepEqual(B.update(custom,pick,{surface:undefined,color:undefined}),f);
 for(const surface of ['oak',null,{},false])assert.throws(()=>B.update(f,pick,{surface}));
 const native=A.editableKitchen(K.configure({id:'k',type:'counter',name:'厨房',cx:6000,cy:6000,rot:0,color:'#f3f1ec'},{version:1,shape:'L',depth:600,baseHeight:820,thickness:20,modules:[{run:0,width:900,role:'door'},{run:1,width:900,role:'door'}]}));const wk={furniture:[native]};S.applyColors(wk,'warm-walnut');K.validate(wk.furniture[0]);assert.deepEqual(K.spatialConfig(wk.furniture[0]),K.spatialConfig(native));
 const door=f.cabinet.boxes[0].components.find(p=>p.kind==='door'),wd=B.update(f,{boxId:'box1',componentId:door.id},{surface:'walnut'});let woodDoor=0;Model.build(T,wd,box).traverse(n=>{if(n.isMesh&&n.userData.cabinetDoorSize){woodDoor++;assert(n.material.map);assert.equal(n.material.color.getHexString(),'765239');}});assert(woodDoor);
 let drawers=B.add(B.create({id:'drawers',cx:4000,cy:4000,rot:0}),'drawers',{boxId:'box1'}).furniture;drawers=S.furniture(drawers,'warm-walnut');const drawer=drawers.cabinet.boxes[0].components[0];drawers=B.update(drawers,{boxId:'box1',componentId:drawer.id},{surface:'solid',color:'#81916a'});let fronts=0,interiors=0;Model.build(T,drawers,box).traverse(n=>{if(!n.isMesh)return;if(n.userData.cabinetDrawerBoard==='front'){fronts++;assert(!n.material.map);assert.equal(n.material.color.getHexString(),'81916a');}else if(n.userData.cabinetDrawerBoard){interiors++;assert(n.material.map);assert.equal(n.material.color.getHexString(),'765239');}});assert(fronts&&interiors);
 const recolored={...f,color:'#bbccdd'};Model.build(T,recolored,box).traverse(n=>{if(n.isMesh&&n.userData.cabinetDoorSize)assert.equal(n.material.color.getHexString(),'bbccdd');});
 const tv=S.furniture({...C.preset('tv-floor'),type:'tvstand',id:'tv',cx:4000,cy:4000,rot:0,color:'#f3f0e8'},'warm-walnut');
 for(const cabinet of [tv,B.upgrade(tv)]){
  const model=Model.build(T,cabinet,box);model.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(-1.2,1,0),new T.Vector3(0,-1,0));
  const fixed=ray.intersectObject(model,true)[0].object;
  const moving=[];
  model.traverse(o=>{if(o.isMesh&&o.userData.cabinetPart?.lid)moving.push(o);});
  const lid=moving.find(o=>!o.userData.cabinetDrawerBoard),front=moving.find(o=>o.userData.cabinetDrawerBoard==='front');
  assert.equal(lid.material,fixed.material,'The moving lid and fixed top boards share the body finish');
  assert.ok(lid.material.map);
  assert.equal(front.material.color.getHexString(),'f3f0e8');
  assert.equal(front.material.map,null);
 }
 const legacy={...C.preset('storage'),type:'cabinet',id:'legacy',cx:4000,cy:4000,rot:0};const themed=S.furniture(legacy,'warm-walnut'),upgraded=B.upgrade(themed);assert.deepEqual(upgraded.cabinet.appearance,themed.cabinet.appearance);assert.deepEqual(B.preset(f,null,'styled reusable').cabinet.appearance,f.cabinet.appearance);
 const packed=J.pack({planId:'demo',current:{furniture:[custom,wk.furniture[0]]},designs:[{name:'style',work:{furniture:[custom]}}],catalog:[]});assert.equal(packed.version,96);assert.deepEqual(J.unpack(packed).current.furniture,[custom,wk.furniture[0]]);let restored=[custom];for(let i=0;i<3;i++)restored=D.restoreFurniture(restored,{makeId:()=> 'x',colorFor:()=> '#fff'});assert.deepEqual(restored,[custom]);assert.equal(JSON.parse(R.text({v:96,planId:'demo',work:{demo:{furniture:[custom]}},designs:[],custom:[]})).version,96);
 const appearance=require('../src/core/product-rules.js').cabinetAppearance;
 const veneer=appearance.withBodySurface(custom,'black-walnut-warm');
 const veneerWork={furniture:[veneer]};
 assert.deepEqual(C.spatialConfig(veneer),spatial);
 assert.equal(veneer.cabinet.appearance.frontColor,'#f3f0e8');
 assert.deepEqual(veneer.cabinet.boxes,custom.cabinet.boxes);
 assert.throws(()=>appearance.withBodySurface(custom,'missing-veneer'));
 const preview=S.preview(veneerWork,[],'warm-walnut',{scopes:['cabinet'],bodySurface:'ash-veneer'});
 assert.equal(preview.furniture[0].cabinet.appearance.bodySurface,'ash-veneer');
 assert.deepEqual(preview.furniture[0].cabinet.boxes,custom.cabinet.boxes);
 assert.equal(veneer.cabinet.appearance.bodySurface,'black-walnut-warm');
 const local=B.update(custom,pick,{surface:'white-oak-veneer'});
 for(const [current,catalog] of [[veneerWork,[]],[{furniture:[custom]},[{...B.preset(local,null,'veneer preset'),id:'veneer-preset',price:0}]]]){
  const project=J.pack({planId:'demo',current,designs:[],catalog});
  assert.equal(project.version,99);
  const restored=J.unpack(project);
  assert.deepEqual(restored.current.furniture,current.furniture);
  assert.equal(restored.catalog[0]?.cabinet.boxes[0].components[0].surface,catalog.length?'white-oak-veneer':undefined);
 }
 assert.equal(J.pack({planId:'demo',current:{furniture:[custom]},designs:[{name:'wood',work:veneerWork}],catalog:[]}).version,99);
 const workspace={v:99,planId:'p1',work:{p1:veneerWork},designs:[],custom:[]};
 assert.deepEqual(R.parse(JSON.parse(R.text(workspace))).work.p1.furniture,[veneer]);
 console.log('PASS cabinet style: production walnut map / warm white fronts, component override/reset, spatial stability, kitchen, v96 project/named/repository and repeated recovery');
})().catch(e=>{console.error(e.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'three')||e);process.exitCode=1;});
