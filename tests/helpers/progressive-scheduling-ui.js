'use strict';
module.exports=async(p,V)=>{
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
 assert.equal(V.mode,'desktop','benchmark the installed desktop GPU in an isolated workspace');
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const call=(name,args={})=>p.evaluate(({name,args})=>FurnishMcp.execute(name,args),{name,args});
 const c=await call('get_current_plan');
 await call('configure_scene',{planId:c.plan.id,revision:c.revision,requestId:'schedule-night-'+Date.now(),settings:{night:true,lamps:true,cut:2.8,labels:false,wallNumbers:false,clearances:false}});
 await p.setViewportSize({width:1640,height:1060});await p.locator('#tgLib').click();await p.locator('#tgPanel').click();
 await p.evaluate(()=>setView('3d'));await p.evaluate(()=>View3D.automationReady());
 await p.evaluate(camera=>View3D.automationCamera(camera),V.benchmark?.camera||{mode:'orbit',horizontalFov:70,position:{x:8410,y:6270,z:1660},target:{x:8410,y:3400,z:1880}});
 await p.evaluate(()=>View3D.automationReady());
 const snapshotMs=await p.evaluate(async()=>{FurnishProgressiveView.exit();const t=performance.now(),data=await View3D.progressiveScene();window.scheduleScene={...data,camera:View3D.progressiveState().camera};return performance.now()-t;});
 if(V.benchmark?.resolution)await p.evaluate(({width,height})=>{const c=scheduleScene.camera;c.aspect=width/height;c.projectionMatrix[0]=c.projectionMatrix[5]/c.aspect;scheduleScene.aspect=c.aspect;},V.benchmark.resolution);
 const candidate=fs.readFileSync(path.resolve(__dirname,'../../src/render/lighting-preview.js'),'utf8');
 const baseline=process.env.FURNISH_PROGRESSIVE_BASELINE?fs.readFileSync(process.env.FURNISH_PROGRESSIVE_BASELINE,'utf8'):candidate.replace('tracer.frameBudget=1000000;tracer.targetFrameTime=32;','');
 const reports=[];let source=baseline,labelNow='before';
 if(V.benchmark?.routes)await V.benchmark.routes(p,()=>labelNow);
 await p.route('**/src/render/lighting-preview.js',r=>r.fulfill({contentType:'text/javascript',body:source}));
 // Repeat in reverse order to expose cache/order effects. Every run uses the exact same GLB bytes.
 for(const label of (V.benchmark?.labels||(process.env.FURNISH_PROGRESSIVE_BENCHMARK_REPEATS==='1'?['before','after']:['before','after','after','before']))){
  labelNow=label;source=V.benchmark?.source?V.benchmark.source(candidate,label):label==='before'?baseline:candidate;
  const result=await p.evaluate(async label=>{
   const f=document.createElement('iframe');f.id='schedule-film';f.style='position:fixed;inset:100px 0 0;width:100%;height:80%;z-index:99999';f.src='src/render/lighting-preview.html';
   const token='schedule-'+Math.random(),start=performance.now(),progress=[],stages=[];let firstMs=null,sixteenMs=null,finishedMs=null,tracedMs=null;
   return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(Error('benchmark timeout'));},240000);
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);}
    function receive(e){if(e.source!==f.contentWindow||e.data?.channel!=='furnish-lighting-preview')return;const d=e.data;
     if(d.type==='ready'){const data={...scheduleScene,mode:'live',quality:'detail',edge:1200,token,viewKey:'fixed'};data.buffer=data.buffer.slice(0);f.contentWindow.postMessage({channel:'furnish-lighting-preview',type:'scene',...data},location.origin,[data.buffer]);}
     if(d.token!==token)return;
     if(d.type==='status'||d.type==='live-ready')stages.push({ms:performance.now()-start,type:d.type,message:d.message});
     if(d.type==='benchmark-first')firstMs=performance.now()-start;if(d.type==='benchmark-sixteen')sixteenMs=performance.now()-start;if(d.type==='benchmark-traced')tracedMs=performance.now()-start;if(d.type==='benchmark-finished')finishedMs=performance.now()-start;
     if(d.type==='live-progress')progress.push({ms:performance.now()-start,samples:d.samples,frameTime:d.frameTime});
     if(d.type==='error'){cleanup();reject(Error(d.message));}
     if(d.type==='live-complete'){cleanup();resolve({label,ms:performance.now()-start,samples:d.samples,progress,stages,firstMs,sixteenMs,finishedMs,tracedMs});}
    }
    window.addEventListener('message',receive);document.body.append(f);
   });
  },label);
  const pixels=await p.frameLocator('#schedule-film').locator('canvas').evaluate(c=>({width:c.width,height:c.height,png:globalThis.__muPNG||c.toDataURL('image/png'),first:globalThis.__firstMuRaw,sixteen:globalThis.__sixteenMuRaw}));
  assert.equal(Math.max(pixels.width,pixels.height),1200);assert.equal(result.samples,256);if(V.benchmark?.resolution)assert.equal(pixels.height,V.benchmark.resolution.height);
  const name=label+'-'+reports.length;fs.writeFileSync(V.artifact(name+'.png'),Buffer.from(pixels.png.split(',')[1],'base64'));
  const profile=await p.frameLocator('#schedule-film').locator('body').evaluate(()=>globalThis.__perf|| (globalThis.__denoiserInfo?{denoiser:globalThis.__denoiserInfo}:null));
  for(const key of ['first','sixteen'])if(pixels[key])fs.writeFileSync(V.artifact(name+'-'+key+'.png'),Buffer.from(pixels[key].split(',')[1],'base64'));
  reports.push({...result,profile,snapshotMs,width:pixels.width,height:pixels.height,image:name+'.png'});console.log('SCHEDULE '+label+' '+Math.round(result.ms)+'ms');fs.writeFileSync(V.artifact('scheduling.json'),JSON.stringify(reports,null,2));
  // Compare final decoded pixels in-browser, without a lossy screenshot or a new imaging dependency.
  if(!await p.evaluate(()=>!!window.scheduleReference))await p.evaluate(png=>{window.scheduleReference=png;},pixels.png);
  else {
   const diff=await p.evaluate(async png=>{async function read(url){const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height).data;}const a=await read(scheduleReference),b=await read(png);let max=0,sum=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;max=Math.max(max,d);if(d)changed++;}return {max,mean:sum/a.length,changed,total:a.length};},pixels.png);
   reports.at(-1).pixelDifference=diff;console.log('PIXELS '+JSON.stringify(diff));
  }
  await p.evaluate(()=>document.querySelector('#schedule-film').remove());
 }
 fs.writeFileSync(V.artifact('scheduling.json'),JSON.stringify(reports,null,2));const repeat=reports[3]?.pixelDifference.mean??0;for(const r of reports.filter(r=>r.label==='after'))assert(r.pixelDifference.mean<=.5&&r.pixelDifference.mean<=repeat*1.25+.5,'candidate image difference must stay within repeated baseline noise');assert.deepEqual(errors,[]);
 if(V.benchmark?.validate)V.benchmark.validate(reports);
 return {passed:true,reports};
};
