'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const {_electron}=require('playwright');
const artifacts=require('../lib/test-artifacts.cjs');
const {runtimeFiles}=require('../package-desktop.cjs');
const {desktopExecutable}=require('../launch-desktop.cjs');

const root=path.resolve(__dirname,'../..');
const [project,baseline]=process.argv.slice(2);
const files=['index.html','src/ui/canvas-interactions.js','src/render/yeswood-sofa-model.js','src/render/cherry-coffee-table-model.js'];
const camera=process.env.FURNISH_RASTER_CAMERA?JSON.parse(process.env.FURNISH_RASTER_CAMERA):
 {mode:'orbit',position:{x:9530,y:5320,z:1470},target:{x:7600,y:3800,z:610},horizontalFov:51};
const defaultTargets=['fmv5bzynf3','fmvglvcws1'];
const targets=(process.env.FURNISH_RASTER_TARGETS||defaultTargets.join(',')).split(',');
const customTargets=!!process.env.FURNISH_RASTER_TARGETS;
const daylightFile='src/render/interior-daylight.js';
const secondCamera=process.env.FURNISH_RASTER_SECOND_CAMERA?JSON.parse(process.env.FURNISH_RASTER_SECOND_CAMERA):null;
const rooms=process.env.FURNISH_RASTER_ROOMS?JSON.parse(fs.readFileSync(process.env.FURNISH_RASTER_ROOMS,'utf8')):null;
const panCamera=rooms||process.env.FURNISH_RASTER_PAN==='1';
const previewHours=(process.env.FURNISH_RASTER_HOURS||'').split(',').filter(Boolean).map(Number);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFileSync(file);
const variants=(process.env.FURNISH_RASTER_RUNS||'before,after,no-sheen,no-sheen,after,before').split(',');
const collectSource=()=>Object.fromEntries([...files,daylightFile].map(file=>[file,read(path.join(root,file))]));
const summary=values=>{
 const sorted=[...values].sort((a,b)=>a-b);
 const percentile=p=>sorted[Math.ceil(sorted.length*p)-1];
 return {n:sorted.length,p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)};
};

async function measure(page,cdp,start,offset,check,modifiers=0){
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...start,modifiers});
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',buttons:1,clickCount:1,modifiers});
 await page.evaluate(()=>{window.furnitureBench.samples=[];window.furnitureBench.moves=[];});
 let last;
 const began=performance.now();
 for(let i=1;i<=72;i++){
  await delay(Math.max(0,began+i*1000/60-performance.now()));
  const point=offset(i/72);
  last={x:start.x+point.x,y:start.y+point.y};
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...last,button:'left',buttons:1,modifiers});
 }
 const {frames,moves}=await page.evaluate(()=>window.furnitureBench.takeSamples());
 const changed=await check();
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...last,button:'left',buttons:0,clickCount:1,modifiers});
 assert.ok(changed,'The real pointer gesture did not move the camera or furniture');
 assert.ok(frames.length>=2,`Too few actual renderer frames (${frames.length}, ${moves.length} drag events)`);
 const intervals=frames.slice(1).map((f,i)=>f.at-frames[i].at);
 const changes=moves.filter(move=>move.changed);
 const responses=changes.flatMap(move=>{
  const frame=frames.find(f=>f.at>=move.at);
  return frame?[frame.at+frame.cpu-move.at]:[];
 });
 return {frameIntervalMs:summary(intervals),renderSubmissionMs:summary(frames.map(f=>f.cpu)),
  framesOver33ms:intervals.filter(ms=>ms>33.5).length,framesOver50ms:intervals.filter(ms=>ms>50).length,
  ...(moves.length?{snapMs:summary(moves.map(move=>move.cpu)),poseChanges:changes.length,
   poseInputToSubmissionMs:summary(responses)}:{}),frames,moves};
}

async function closeTestApp(app){
 // This only applies to a launched copy. Preserve its cache even on errors
 // without blocking on the desktop's unflushed-save dialog.
 await app.evaluate(({BrowserWindow})=>{
  for(const window of BrowserWindow.getAllWindows()){
   window.webContents.removeAllListeners('will-prevent-unload');
   window.webContents.on('will-prevent-unload',event=>event.preventDefault());
  }
 });
 await app.close();
}

async function run(){
 assert.ok(project&&baseline,'Usage: verify-living-furniture-raster.cjs <1601 workspace file> <before commit>');
 assert.ok(previewHours.every(hour=>Number.isFinite(hour)&&hour>=0&&hour<=24),'Invalid preview hour');
 assert.ok(variants.every(v=>['before','after','no-sheen'].includes(v)),'Unknown benchmark variant');
 const source=read(project),after=collectSource(),before=Object.fromEntries(files.map(file=>
  [file,execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:8*1024*1024})]));
 if(execFileSync('git',['ls-tree',baseline,'--',daylightFile],{cwd:root}).length)
  before[daylightFile]=execFileSync('git',['show',baseline+':'+daylightFile],{cwd:root});
 const job=artifacts.createRun({parent:path.join(root,'output/desktop-verification.noindex'),prefix:rooms||customTargets?'room-raster-':'living-furniture-'});
 const cases=rooms||[{camera,targets,secondCamera}];
 const report={sourceHash:hash(source),baseline,...(rooms?{rooms}:{camera,targets,...(secondCamera?{secondCamera}:{})}),results:[]};
 let passed=false,app;
 console.log(job.dir);
 try{
  const work=job.workspace('workspace',root,{directories:['src','styles','vendor'],files:['index.html','manifest.webmanifest']});
  for(const file of runtimeFiles)job.copy(path.join(root,'scripts',file),path.join('workspace/scripts',file));
  const save=path.join(work,'projects/workspace.furnish.json');
  report.sources=Object.fromEntries(files.map(file=>[file,{before:hash(before[file]),after:hash(after[file])}]));
  report.sources[daylightFile]={...(before[daylightFile]?{before:hash(before[daylightFile])}:{}),after:hash(after[daylightFile])};
  for(const [i,variant] of variants.entries()){
   const profile=job.discard('profile-'+i);
   fs.writeFileSync(save,source);
   const version=variant==='before'?before:after;
   for(const [file,buffer] of Object.entries(version)){
    let code=buffer.toString();
    if(file.endsWith('yeswood-sofa-model.js')&&variant==='no-sheen'){
     code=code.replace(/sheen:\s*[.\d]+(?=,sheenColor)/,'sheen:0');
     assert.notEqual(code,buffer.toString(),'Could not isolate the sheen parameter');
    }
    if(file==='index.html'){
     const render='renderer.render(scene,camera);}';
     assert.equal(code.split(render).length,2,'Production render hook changed');
     code=code.replace(render,`const started=performance.now();renderer.render(scene,camera);
      const metrics=window.furnitureBench;if(metrics.samples)metrics.samples.push({at:started,cpu:performance.now()-started});
      if(!metrics.target)metrics.target=(id)=>{
       const rect=renderer.domElement.getBoundingClientRect();
       const model=furnG.children.find(o=>o.userData.fid===id);
       if(!model)return null;
       const bounds=new THREE.Box3().setFromObject(model);
       const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
       for(const yRatio of [.55,.82,.3])for(const xRatio of [0,.22,-.22,.39,-.39])for(const zRatio of [0,.22,-.22]){
        const at=new THREE.Vector3(center.x+xRatio*size.x,bounds.min.y+yRatio*size.y,center.z+zRatio*size.z).project(camera);
        const x=rect.left+(at.x+1)*rect.width/2,y=rect.top+(1-at.y)*rect.height/2;
        if(Number.isFinite(x)&&Number.isFinite(y)&&document.elementFromPoint(x,y)===renderer.domElement&&pick({clientX:x,clientY:y})?.fid===id)return {x,y};
       }
       return null;
      };
      if(!metrics.info)metrics.info=()=>{
       const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
       return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
        canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],dpr:devicePixelRatio,
        calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      };
      if(!metrics.exportModels)metrics.exportModels=async ids=>{
       const groups=furnG.children.filter(model=>ids.includes(model.userData.fid));
       const {buffer}=await FurnishBlenderExport.encode(THREE,{groups,camera});
       return await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);
        reader.readAsDataURL(new Blob([buffer]));
       });
      };
     }`);
    }
    fs.writeFileSync(path.join(work,file),code);
   }
   const server=http.createServer();
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   const {port}=server.address();
   await new Promise(resolve=>server.close(resolve));
   const env={...process.env,FURNISH_DESKTOP_ROOT:work,FURNISH_DESKTOP_PROFILE:profile,FURNISH_PORT:String(port),FURNISH_MCP_DISABLE:'1'};
   delete env.ELECTRON_RUN_AS_NODE;
   app=await _electron.launch({executablePath:desktopExecutable(root),env,timeout:60000});
   const page=await app.firstWindow();
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|Shader Error/.test(message.text()))errors.push(message.text());});
   await app.context().addInitScript(()=>{
    localStorage.setItem('furnish-observation-v1','smooth');
    window.furnitureBench={samples:null,moves:null,takeSamples(){
     const result={frames:this.samples,moves:this.moves};
     this.samples=this.moves=null;
     return result;
    }};
    window.addEventListener('pointermove',()=>{window.furnitureBench.inputAt=performance.now();},true);
   });
   await page.waitForURL(`http://127.0.0.1:${port}/`);
   await page.reload();
   await page.locator('#repository-loading').waitFor({state:'hidden',timeout:60000});
   const cdp=await page.context().newCDPSession(page);
   for(const {name,camera,targets=[],secondCamera} of cases){
    const scene=await page.evaluate(async ({camera,targets})=>{
     if(FurnishElectricalUI.active())FurnishElectricalUI.setMode('furniture');
     drawer('lib',false);drawer('panel',false);
     select(null);
     await setView('3d');
     const pose=await View3D.automationCamera(camera);
     const effective=FurnishProject.effectivePlan(PLAN,state);
     const openings=effective.wins?.map((opening,index)=>({
      ref:effective.winRefs?.[index],rect:opening.rect,sill:opening.sill,head:opening.head
     }));
     return {name:PLAN.name,count:state.furniture.length,settings:state.scene3d,pose,openings,
      targets:targets.map(id=>({id,type:getF(id)?.type,locked:furnitureLocked(getF(id))}))};
    },{camera,targets});
    assert.ok(scene.targets.every(f=>f.type),'Missing benchmark furniture');
    if(!rooms&&!customTargets)assert.deepEqual(scene.targets.map(f=>f.type),['sofa_yeswood_cherry','coffeetable_yeswood_cherry']);
    const movable=scene.targets.at(-1);
    assert.ok(scene.pose,'Production 3D did not open');
    await page.waitForFunction(()=>document.querySelector('#progressive-controls')?.dataset.state==='smooth');
    assert.equal(await page.locator('#progressive-frame').count(),0);
    await page.evaluate(()=>View3D.automationReady());
    const capture=async suffix=>{
     const png=await page.evaluate(()=>View3D.image());
     fs.writeFileSync(path.join(job.dir,variant+'-'+i+(name?'-'+name:'')+suffix+'.png'),Buffer.from(png.split(',')[1],'base64'));
    };
    await capture('');
    if(secondCamera){
     await page.evaluate(pose=>View3D.automationCamera(pose),secondCamera);
     await capture('-secondary');
     await page.evaluate(pose=>View3D.automationCamera(pose),camera);
    }
    if(previewHours.length){
     const originalHour=scene.settings.hour;
     const previewHour=hour=>page.evaluate(hour=>{
      const slider=document.getElementById('sun');
      slider.value=hour;slider.dispatchEvent(new Event('input',{bubbles:true}));
      return +slider.value;
     },hour);
     for(const hour of previewHours){
      assert.equal(await previewHour(hour),hour);
      await capture('-hour-'+hour);
     }
     assert.equal(await page.evaluate(()=>state.scene3d.hour),originalHour,'Preview overwrote the saved scene time');
     assert.equal(await previewHour(originalHour),originalHour);
     await page.evaluate(()=>View3D.automationReady());
    }
    const render=await page.evaluate(()=>furnitureBench.info());
    if(!movable){report.results.push({variant,name,scene,render});continue;}
    const box=await page.locator('#view3d canvas').first().boundingBox();
    const from={x:box.x+box.width*.45,y:box.y+box.height*.49};
    const rotate=await measure(page,cdp,from,t=>({x:34*Math.sin(t*4*Math.PI)+12*t,y:8*Math.sin(t*2*Math.PI)}),
     async()=>Math.abs((await page.evaluate(()=>View3D.automationCamera())).position.y-camera.position.y)>1);
    let pan;
    if(panCamera){
     await page.evaluate(pose=>View3D.automationCamera(pose),camera);
     // Shift+left is OrbitControls' alternate pan gesture (CDP Shift=8).
     pan=await measure(page,cdp,from,t=>({x:96*t,y:14*Math.sin(t*Math.PI)}),async()=>{
      const {target}=await page.evaluate(()=>View3D.automationCamera());
      return Math.hypot(target.x-camera.target.x,target.y-camera.target.y)>1;
     },8);
    }
    const drag=await page.evaluate(async ({camera,id})=>{
     await View3D.automationCamera(camera);
     selectIds([id]);ui.sceneMove=true;View3D.sync();renderFab();
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     furnitureBench.originalSnap??=snapMove;
     snapMove=(f,...args)=>{
      const start=performance.now();
      const position=furnitureBench.originalSnap(f,...args);
      furnitureBench.moves?.push({at:furnitureBench.inputAt,cpu:performance.now()-start,changed:position[0]!==f.cx||position[1]!==f.cy});
      return position;
     };
     const f=getF(id);
     return {point:furnitureBench.target(id),cx:f.cx,cy:f.cy,locked:furnitureLocked(f)};
    },{camera,id:movable.id});
    assert.ok(drag.point&&!drag.locked,`Furniture ${movable.id} must be pickable and unlocked`);
    const move=await measure(page,cdp,drag.point,t=>({x:30+110*t+29*Math.sin(t*2*Math.PI),y:18+23*Math.sin(t*Math.PI)}),
     ()=>page.evaluate(({id,cx,cy})=>getF(id).cx!==cx||getF(id).cy!==cy,{...drag,id:movable.id}));
    assert.equal(await page.locator('#progressive-frame').count(),0);
    assert.deepEqual(errors,[]);
    report.results.push({variant,name,scene,render,rotate,...(pan?{pan}:{}),move});
    console.log(variant,name||'',JSON.stringify({render,rotate:rotate.frameIntervalMs,...(pan?{pan:pan.frameIntervalMs}:{}),move:move.frameIntervalMs,
     snap:move.snapMs,poseChanges:move.poseChanges,poseInputToSubmissionMs:move.poseInputToSubmissionMs}));
    if(rooms){
     const restored=await page.evaluate(id=>{
      snapMove=furnitureBench.originalSnap;undo();
      select(null);ui.sceneMove=false;View3D.sync();
      const {cx,cy}=getF(id);
      return [cx,cy];
     },movable.id);
     assert.deepEqual(restored,[drag.cx,drag.cy]);
     continue;
    }
    if(variant==='after'&&!report.productionExport){
     const id=movable.id;
     const positions=await page.evaluate(id=>{
      const at=()=>[getF(id).cx,getF(id).cy];
      const moved=at();
      undo();const undone=at();
      redo();const redone=at();
      return {moved,undone,redone};
     },id);
     assert.notDeepEqual(positions.moved,[drag.cx,drag.cy]);
     assert.deepEqual(positions.undone,[drag.cx,drag.cy]);
     assert.deepEqual(positions.redone,positions.moved);
     assert.ok(await page.evaluate(()=>saveNow()),'Isolated workspace save failed');
     await page.reload();
     await page.locator('#repository-loading').waitFor({state:'hidden',timeout:60000});
     assert.deepEqual(await page.evaluate(id=>[getF(id).cx,getF(id).cy],id),positions.moved);
     const data=await page.evaluate(async ({camera,scene})=>{
      await setView('3d');await View3D.automationCamera(camera);
      return await furnitureBench.exportModels(scene.targets.map(f=>f.id));
     },{camera,scene});
     const glb=Buffer.from(data.split(',')[1],'base64');
     const document=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
     const fabrics=document.materials.filter(m=>m.extensions?.KHR_materials_sheen);
     assert.ok(document.nodes.length&&document.materials.length,'Furniture GLB must contain production geometry');
     if(!customTargets){
      assert.equal(fabrics.length,1);
      assert.ok(fabrics[0].normalTexture&&fabrics[0].pbrMetallicRoughness.baseColorTexture);
     }
     const filename=customTargets?'production-models.glb':'two-production-models.glb';
     fs.writeFileSync(path.join(job.dir,filename),glb);
     report.productionExport={filename,sha256:hash(glb),nodes:document.nodes.length,
      sheenMaterials:fabrics.length,undoRedo:true,reload:true};
    }
   }
   await cdp.detach();
   assert.deepEqual(errors,[]);
   assert.ok(await page.evaluate(()=>saveNow()),'Isolated workspace save failed');
   await closeTestApp(app);
   app=null;
  }
  passed=true;
 }catch(error){
  report.error=error.message;
  console.error(error);
  throw error;
 }finally{
  if(app)await closeTestApp(app);
  report.sourceUnchanged=hash(read(project))===report.sourceHash;
  report.passed=passed&&report.sourceUnchanged;
  fs.writeFileSync(path.join(job.dir,'results.json'),JSON.stringify(report,null,2));
  job.finish(report.passed);
  assert.ok(report.sourceUnchanged,'Source project changed during measurement');
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
