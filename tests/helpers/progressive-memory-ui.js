'use strict';
module.exports=async(p,V)=>{
 const assert=require('node:assert/strict'),fs=require('node:fs'),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.evaluate(()=>{
  window.memoryExports=0;window.stillAudits=[];window.releases=0;
  const original=View3D.progressiveScene;View3D.progressiveScene=async()=>{memoryExports++;return original();};
  const hash=async canvas=>{const c=document.createElement('canvas');c.width=canvas.naturalWidth||canvas.width;c.height=canvas.naturalHeight||canvas.height;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;return {width:c.width,height:c.height,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join(''),range:Math.max(...a.subarray(0,1000))-Math.min(...a.subarray(0,1000))};};
  window.hashStill=hash;
  window.addEventListener('message',async e=>{if(e.data?.channel!=='furnish-lighting-preview')return;if(e.data.type==='released')releases++;if(e.data.type!=='live-image')return;
   const bitmap=await createImageBitmap(e.data.blob),png=await hash(bitmap);bitmap.close();stillAudits.push({key:e.data.viewKey,png});
  });
 });
 const call=(name,args={})=>p.evaluate(({name,args})=>FurnishMcp.execute(name,args),{name,args});
 const spatial=async()=>{const {revision,save,...result}=await call('check_space');return result;};
 await p.evaluate(()=>setView('3d'));await p.locator('#progressive-mode').selectOption('detail');
 if(V.mode==='file'){
  await p.waitForFunction(()=>document.querySelector('#progressive-controls')?.dataset.state==='fallback');assert.equal(await p.locator('#progressive-image').count(),0);return ['file: existing offline WebGL fallback; no retained image or WebGPU iframe'];
 }
 const settled=async(label,previousExports=0)=>{
  await p.waitForFunction(min=>memoryExports>min&&/已收敛/.test(document.querySelector('#progressive-status')?.textContent||'')&&!!document.querySelector('#progressive-frame'),previousExports,{timeout:240000});
  const before=await p.locator('#view3d').screenshot({path:V.artifact(label+'-canvas.png')});
  await p.waitForFunction(min=>{const i=document.querySelector('#progressive-image');return i&&i.dataset.viewKey===View3D.progressiveState()?.viewKey&&!document.querySelector('#progressive-frame')&&memoryExports>min;},previousExports,{timeout:240000});
  assert.match(await p.locator('#progressive-status').textContent(),/已收敛/);
  const result=await p.evaluate(async()=>{const i=document.querySelector('#progressive-image');return {layout:{host:document.querySelector('#view3d').getBoundingClientRect().toJSON(),image:i.getBoundingClientRect().toJSON(),dpr:devicePixelRatio},actual:await hashStill(i),audit:stillAudits.findLast(a=>a.key===i.dataset.viewKey),key:i.dataset.viewKey,current:View3D.progressiveState().viewKey,releases,exports:memoryExports};});
  fs.writeFileSync(V.artifact(label+'-pixels.json'),JSON.stringify(result,null,2));
  const after=await p.locator('#view3d').screenshot({path:V.artifact(label+'-image.png')});
  result.compositor=await p.evaluate(async([a,b])=>{const read=async text=>{const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+text)).blob()),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(0,0,c.width,c.height).data;};const x=await read(a),y=await read(b);if(x.length!==y.length)throw Error('Compositor dimensions changed');let sum=0,max=0,differing=0,interiorMax=0,interiorDiffering=0;const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+a)).blob()),width=bitmap.width,height=bitmap.height;bitmap.close();for(let i=0;i<x.length;i++){const d=Math.abs(x[i]-y[i]);sum+=d;max=Math.max(max,d);if(d){differing++;const px=Math.floor(i/4)%width,py=Math.floor(i/4/width);if(px>=24&&px<width-24&&py>=24&&py<height-24){interiorDiffering++;interiorMax=Math.max(interiorMax,d);}}}return {width,height,mean:sum/x.length,max,differing,interiorDiffering,interiorMax};},[before.toString('base64'),after.toString('base64')]);
  fs.writeFileSync(V.artifact(label+'-pixels.json'),JSON.stringify(result,null,2));assert(result.compositor.interiorDiffering===0&&result.compositor.mean<=.05&&result.compositor.max<=64&&result.compositor.differing<=8*(result.compositor.width+result.compositor.height),'canvas/image scene pixels differ; only the fractional rounded viewport mask may vary');
  assert.equal(result.key,result.current);assert.equal(Math.max(result.actual.width,result.actual.height),1200);
  assert(result.audit,'captured canvas and PNG evidence');assert.equal(result.actual.hash,result.audit.png.hash,'displayed PNG pixels remain exact');assert(result.actual.range>0);assert(result.releases>0,'device disposal completed before iframe removal');
  await V.screenshot(label);return result;
 };
 const first=await settled('settled');const check=await spatial();
 const oldURL=await p.locator('#progressive-image').getAttribute('data-source');
 await p.locator('#view3d').dispatchEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100});assert(await p.locator('#progressive-image').evaluate(i=>i.hidden));
 await p.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1})));await p.waitForFunction(()=>document.querySelector('#progressive-image')?.hidden===false);
 assert.equal(await p.evaluate(()=>memoryExports),first.exports,'same-view interaction reuses the image without a scene export');
 await p.evaluate(()=>selectIds([state.furniture.find(f=>f.type.startsWith('sofa')).id]));await p.waitForFunction(()=>document.querySelector('#progressive-image')?.hidden&&View3D.progressiveState()?.editing);assert.match(await p.locator('#progressive-status').textContent(),/编辑中/);
 await p.evaluate(()=>selectIds([]));await p.waitForFunction(()=>document.querySelector('#progressive-image')?.hidden===false&&/已收敛/.test(document.querySelector('#progressive-status').textContent));assert.equal(await p.evaluate(()=>memoryExports),first.exports,'selection-only editing restores the settled image without export');

 await p.evaluate(async()=>{const c=await View3D.automationCamera();await View3D.automationCamera({mode:'orbit',position:{...c.position,x:c.position.x+100},target:c.target});});
 const second=await settled('camera-rebuilt',first.exports);assert(second.exports>first.exports);assert.deepEqual(await spatial(),check,'collision/clearance results survive release and camera rebuild');
 assert(await p.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},oldURL),'replaced image URL revoked');
 await p.setViewportSize({width:1380,height:960});const third=await settled('resize-rebuilt',second.exports);assert(third.exports>second.exports,'projection change rebuilds after retirement');
 let c=await call('get_current_plan');await call('configure_scene',{planId:c.plan.id,revision:c.revision,requestId:'memory-light-'+Date.now(),settings:{lamps:false}});
 const fourth=await settled('scene-rebuilt',third.exports);assert(fourth.exports>third.exports,'scene edit cannot reuse stale pixels');
 await p.locator('#vLightingPreview').click();await p.waitForFunction(()=>!document.querySelector('#progressive-image')&&!document.querySelector('#progressive-frame'));await p.locator('#lighting-stop').click();await p.locator('#lighting-close').click();
 await p.locator('#progressive-mode').selectOption('smooth');await p.waitForTimeout(2500);assert.equal(await p.locator('#progressive-image,#progressive-frame').count(),0,'late image decode cannot resurrect a cancelled preview');
 await p.evaluate(()=>setView('2d'));assert.equal(await p.locator('#progressive-controls,#progressive-image,#progressive-frame').count(),0);
 await p.evaluate(()=>setView('3d'));assert.equal(await p.locator('#progressive-mode').inputValue(),'smooth');
 fs.writeFileSync(V.artifact('memory-lifecycle.json'),JSON.stringify({first,second,third,fourth,errors},null,2));assert.deepEqual(errors,[]);
 return ['canvas/image compositor comparison and exact PNG/display pixel hashes, selection hide/restore, 1200px fine render, explicit GPU disposal, pointer reuse, camera/projection/scene rebuild, unchanged collision results, stale cancellation, independent preview and 2D cleanup'];
};
