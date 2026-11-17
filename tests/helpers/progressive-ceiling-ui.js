'use strict';
module.exports=async(p,V)=>{
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),errors=[],reports=[];
 assert.equal(V.mode,'desktop');p.on('pageerror',e=>errors.push(e.stack||e.message));
 const source=fs.readFileSync(path.resolve(__dirname,'../../src/render/lighting-preview.js'),'utf8');
 // Observe the camera actually consumed by the ray generator, after the
 // tracer has refreshed it. No private renderer state is modified here.
 await p.route('**/src/render/lighting-preview.js',r=>r.fulfill({contentType:'text/javascript',body:source+`\nglobalThis.previewCameraAudit=()=>({projection:liveCamera.projectionMatrix.elements.slice(),world:liveCamera.matrixWorld.elements.slice(),rayMatrix:tracer._invViewProjectionMatrix.value.elements.slice(),expectedRay:new T.Matrix4().multiplyMatrices(liveCamera.matrixWorld,liveCamera.projectionMatrixInverse).elements.slice(),aspect:liveCamera.aspect,maxSamples:tracer.maxSamples,bounces:tracer.maxBounces});`}));
 const call=(name,args={})=>p.evaluate(({name,args})=>FurnishMcp.execute(name,args),{name,args});let c=await call('get_current_plan');
 await call('configure_scene',{planId:c.plan.id,revision:c.revision,requestId:'ceiling-view-'+Date.now(),settings:{night:true,lamps:true,cut:2.8,labels:false,wallNumbers:false,clearances:false}});
 await p.setViewportSize({width:1450,height:960});await p.evaluate(()=>closeDrawers());await p.evaluate(()=>setView('3d'));await p.evaluate(()=>View3D.automationReady());await p.evaluate(()=>FurnishProgressiveView.exit());
 const above={mode:'orbit',horizontalFov:65,position:{x:10500,y:7300,z:5000},target:{x:8000,y:9100,z:400}},inside={mode:'orbit',horizontalFov:70,position:{x:8410,y:6270,z:1660},target:{x:8410,y:3400,z:1880}};
 const camera=pose=>p.evaluate(pose=>View3D.automationCamera(pose),pose),mode=m=>p.evaluate(m=>document.querySelector('[data-ceiling-display="'+m+'"]').click(),m);
 await p.evaluate(()=>{
  window.ceilingExports=[];
  window.inspectCeilingSnapshot=async data=>{
   const header=new DataView(data.buffer),length=header.getUint32(12,true),gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(data.buffer,20,length))),ceilings=[];window.lastCeilingJson=gltf;
   for(const node of gltf.nodes||[]){const key=node.extras?.layerObject||'';if(node.mesh!==undefined&&(key.startsWith('roomCeiling:')||key.startsWith('ceiling:')))ceilings.push({key,materials:gltf.meshes[node.mesh].primitives.map(pr=>gltf.materials[pr.material])});}
   const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   // Image encoders finish asynchronously, so identical exports can pack their
   // bufferViews in different orders. Compare each referenced payload by bytes,
   // preserving material/geometry data rather than hashing container offsets.
   const binaryStart=20+length+8,views=await Promise.all((gltf.bufferViews||[]).map(async v=>({hash:await hash(new Uint8Array(data.buffer,binaryStart+(v.byteOffset||0),v.byteLength)),byteLength:v.byteLength,...(v.byteStride?{byteStride:v.byteStride}:{}),...(v.target?{target:v.target}:{})})));
   const normalize=o=>Array.isArray(o)?o.map(normalize):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,k==='bufferView'?views[v]:normalize(v)])):o;
   const semantic=normalize(Object.fromEntries(Object.entries(gltf).filter(([k])=>!['buffers','bufferViews'].includes(k))));window.lastCeilingSemantic=semantic;
   return {hash:await hash(new TextEncoder().encode(JSON.stringify(semantic))),containerHash:await hash(data.buffer),meshes:data.meshCount,roofs:ceilings.filter(o=>o.key.startsWith('roomCeiling:')).length,ceilings:ceilings.filter(o=>o.key.startsWith('ceiling:')).length,blends:ceilings.filter(o=>o.materials.some(m=>m.alphaMode==='BLEND')).length,materials:ceilings,rects:data.lighting.rects.length,spots:data.lighting.spots.length};
  };
  const original=View3D.progressiveScene;View3D.progressiveScene=async()=>{const data=await original();ceilingExports.push(await inspectCeilingSnapshot(data));return data;};
 });
 const snapshot=kind=>p.evaluate(async kind=>inspectCeilingSnapshot(await View3D[kind]()),kind);
 await camera(above);
 const formal=[];for(const m of ['solid','ghost','hidden']){await mode(m);formal.push(await snapshot('highQualityScene'));fs.writeFileSync(V.artifact('formal-'+m+'.json'),JSON.stringify(await p.evaluate(()=>lastCeilingSemantic)));}
 assert.equal(new Set(formal.map(s=>s.hash)).size,1,'formal GLB is identical across observation modes, including opaque roofs/materials');assert(formal[0].roofs>0&&formal[0].ceilings>0);assert.equal(formal[0].blends,formal[1].blends);
 const observed={};for(const m of ['solid','ghost','hidden']){await mode(m);observed[m]=await snapshot('progressiveScene');}
 assert.equal(observed.solid.hash,formal[0].hash,'solid observation remains physical');assert.equal(observed.ghost.roofs,0,'above-roof ghost removes the camera cutaway blocker');assert(observed.ghost.blends>observed.solid.blends);assert(observed.ghost.ceilings<observed.solid.ceilings,'ghost excludes panel backing');assert.equal(observed.hidden.roofs,0);assert.equal(observed.hidden.ceilings,0,'hidden excludes luminous ceiling faces too');assert(observed.hidden.rects<observed.solid.rects,'hidden ceiling emission is absent from observation');
 async function converged(label){
  console.log('WAIT '+label);const log=setInterval(async()=>{try{console.log('CEILING '+label+' '+await p.locator('#progressive-status').textContent());}catch{}},10000);
  try{await p.waitForFunction(()=>{const bar=document.querySelector('#progressive-controls'),f=document.querySelector('#progressive-frame');if(bar?.dataset.state==='fallback')throw Error(document.querySelector('#progressive-status').textContent);return f&&!f.hidden&&f.dataset.viewKey===View3D.progressiveState()?.viewKey&&/已收敛/.test(document.querySelector('#progressive-status')?.textContent||'');},null,{timeout:180000});}finally{clearInterval(log);}
  await auditCamera(label);await V.screenshot(label);
  const png=await p.frameLocator('#progressive-frame').locator('canvas').evaluate(c=>c.toDataURL('image/png'));fs.writeFileSync(V.artifact(label+'.png'),Buffer.from(png.split(',')[1],'base64'));
 }
 async function auditCamera(label){
  const state=await p.evaluate(()=>View3D.progressiveState()),audit=await p.frameLocator('#progressive-frame').locator('body').evaluate(()=>previewCameraAudit()),expected=await p.evaluate(projection=>FurnishProgressivePolicy.projectionMatrix(projection,true),state.camera.projectionMatrix);
  const max=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));assert(max(audit.projection,expected)<1e-10,'ray projection must preserve the current editor frustum');assert(max(audit.world,state.camera.matrixWorld)<1e-10);assert(max(audit.rayMatrix,audit.expectedRay)<1e-9,'actual ray uniform consumes that projection');assert.equal(audit.maxSamples,256);assert.equal(audit.bounces,8);
  const layout=await p.frameLocator('#progressive-frame').locator('canvas').evaluate(c=>({width:c.width,height:c.height,rect:{width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}})),host=await p.locator('#view3d').boundingBox();assert.equal(Math.max(layout.width,layout.height),1200);assert(Math.abs(host.width-layout.rect.width)<1&&Math.abs(host.height-layout.rect.height)<1);
  reports.push({label,...layout,projectionError:max(audit.projection,expected),rayError:max(audit.rayMatrix,audit.expectedRay),sampleBudget:audit.maxSamples,bounces:audit.bounces});
 }
 await mode('ghost');await V.screenshot('above-smooth');await p.evaluate(()=>FurnishProgressiveView.enter());await p.locator('#progressive-mode').selectOption('detail');await converged('above-ghost');
 await p.evaluate(()=>window.sameCeilingFrame=document.querySelector('#progressive-frame'));
 async function updated(label){await p.waitForFunction(()=>{const f=document.querySelector('#progressive-frame');return f&&!f.hidden&&f.dataset.viewKey===View3D.progressiveState()?.viewKey;},null,{timeout:60000});assert(await p.evaluate(()=>sameCeilingFrame===document.querySelector('#progressive-frame')),'same mask reuses BVH/context');await auditCamera(label);}
 await p.setViewportSize({width:720,height:1060});await updated('portrait-resize');await camera({horizontalFov:90});await updated('fov-90');
 await p.setViewportSize({width:1450,height:960});await camera(above);await updated('landscape-return');
 await mode('hidden');await converged('above-hidden');await p.evaluate(()=>window.aboveCeilingFrame=document.querySelector('#progressive-frame'));
 await mode('ghost');await camera(inside);await converged('inside-ghost');assert(await p.evaluate(()=>aboveCeilingFrame!==document.querySelector('#progressive-frame')),'crossing ceiling bounds invalidates the scene mask');
 await p.evaluate(()=>FurnishProgressiveView.exit());await V.screenshot('inside-smooth');
 const indoorFormal=await snapshot('highQualityScene'),indoorGhost=await snapshot('progressiveScene');assert.equal(indoorGhost.hash,indoorFormal.hash,'inside ghost keeps exact physical geometry/materials/lighting');
 await mode('hidden');const indoorHidden=await snapshot('progressiveScene');assert.equal(indoorHidden.ceilings,0);assert.equal(indoorHidden.roofs,indoorFormal.roofs,'inside keeps the structural ceiling');await mode('solid');assert.equal((await snapshot('highQualityScene')).hash,indoorFormal.hash,'formal occlusion remains physical after hidden/ghost cycles');
 // Reload preferences in this isolated profile.
 await p.reload();await p.waitForFunction(()=>typeof View3D!=='undefined'&&!repositoryBooting);await p.evaluate(()=>setView('3d'));await p.locator('#progressive-mode').waitFor();assert.equal(await p.locator('#progressive-mode').inputValue(),'detail');await p.evaluate(()=>FurnishProgressiveView.exit());
 assert.deepEqual(errors,[]);const summary={reports,formal:formal.map(({materials,...s})=>s),observed:Object.fromEntries(Object.entries(observed).map(([m,{materials,...s}])=>[m,s])),indoor:{formal:indoorFormal.hash,ghost:indoorGhost.hash,hiddenRoofs:indoorHidden.roofs}};
 fs.writeFileSync(V.artifact('ceiling-result.json'),JSON.stringify(summary,null,2));return {passed:true,...summary};
};
