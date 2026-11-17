'use strict';
module.exports=async(p,V)=>{
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),reports=[],errors=[];
 assert.equal(V.mode,'desktop');p.on('pageerror',e=>errors.push(e.message));
 const source=fs.readFileSync(path.resolve(__dirname,'../../src/render/lighting-preview.js'),'utf8');
 await p.route('**/src/render/lighting-preview.js',r=>r.fulfill({contentType:'text/javascript',body:source+`\nglobalThis.projectionAudit=()=>({projection:liveCamera.projectionMatrix.elements.slice(),ray:tracer._invViewProjectionMatrix.value.elements.slice(),expectedRay:new T.Matrix4().multiplyMatrices(liveCamera.matrixWorld,liveCamera.projectionMatrixInverse).elements.slice()});`}));
 await p.setViewportSize({width:1640,height:1060});await p.evaluate(()=>setView('3d'));await p.evaluate(()=>View3D.automationReady());
 await p.evaluate(()=>View3D.automationCamera({mode:'orbit',horizontalFov:65,position:{x:10500,y:7300,z:5000},target:{x:8000,y:9100,z:400}}));
 async function check(label){
  await p.waitForFunction(()=>{if(document.querySelector('#progressive-controls')?.dataset.state==='fallback')throw Error(document.querySelector('#progressive-status').textContent);const f=document.querySelector('#progressive-frame');return f&&!f.hidden&&f.dataset.viewKey===View3D.progressiveState()?.viewKey;},null,{timeout:120000});
  const {actual,expected}=await p.evaluate(()=>({actual:document.querySelector('#progressive-frame').contentWindow.projectionAudit(),expected:FurnishProgressivePolicy.projectionMatrix(View3D.progressiveState().camera.projectionMatrix,true)})),max=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));fs.writeFileSync(V.artifact(label+'-camera.json'),JSON.stringify({actual,expected}));
  assert(max(actual.projection,expected)<1e-10);assert(max(actual.ray,actual.expectedRay)<1e-9);
  const host=await p.locator('#view3d').boundingBox();if(label==='portrait')assert(host.width<host.height);reports.push({label,viewport:{width:host.width,height:host.height},projectionError:max(actual.projection,expected),rayUniformError:max(actual.ray,actual.expectedRay)});
  if(label!=='initial')assert(await p.evaluate(()=>projectionFrame===document.querySelector('#progressive-frame')),'viewport/FOV changes reuse the scene');
 }
 await check('initial');await p.evaluate(()=>window.projectionFrame=document.querySelector('#progressive-frame'));
 const resized=async size=>{const before=await p.evaluate(()=>View3D.progressiveState().viewKey);await p.setViewportSize(size);await p.waitForFunction(before=>View3D.progressiveState().viewKey!==before,before);};
 await resized({width:720,height:1060});await check('portrait');
 await p.evaluate(()=>View3D.automationCamera({horizontalFov:90}));await check('fov-90');
 await resized({width:1640,height:800});await check('landscape');
 const sidebarKey=await p.evaluate(()=>View3D.progressiveState().viewKey);await p.locator('#tgLib').click();await p.waitForFunction(before=>View3D.progressiveState().viewKey!==before,sidebarKey);await check('sidebar-toggle');
 await p.evaluate(()=>FurnishProgressiveView.exit());assert.deepEqual(errors,[]);fs.writeFileSync(V.artifact('projection-result.json'),JSON.stringify(reports,null,2));return {passed:true,reports};
};
