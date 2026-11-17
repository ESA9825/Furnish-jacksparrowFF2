/* Natural process-group RSS and macOS physical footprint, with no forced GC. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{_electron}=require('playwright');
const root=path.resolve(__dirname,'..'),{prepare,freePort}=require('./tauri-launch.cjs'),{snapshot}=require('./tauri-memory.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function run(label){
 const workspace=prepare(),directory=path.dirname(workspace),revision=label==='before'?'f076ba37':null;
 if(revision)for(const name of ['server-runtime.cjs','serve.cjs'])fs.writeFileSync(path.join(workspace,'scripts',name),execFileSync('git',['show',revision+':scripts/'+name],{cwd:root,maxBuffer:2000000}));
 const codeHashes=Object.fromEntries(['server-runtime.cjs','serve.cjs'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(workspace,'scripts',name))).digest('hex')]));
 const env={...process.env,FURNISH_DESKTOP_ROOT:workspace,FURNISH_DESKTOP_PROFILE:path.join(directory,'profile'),FURNISH_PORT:String(await freePort()),FURNISH_MCP_DISABLE:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('./launch-desktop.cjs').desktopExecutable(root),env,timeout:60000}),records=[],errors=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>window.FurnishRepository&&typeof repositoryBooting!=='undefined'&&!repositoryBooting,null,{timeout:120000});
  await ready();await page.addInitScript(()=>localStorage.setItem('furnish-observation-v1','smooth'));await page.reload();await ready();
  async function sample(stage){
   const readings=[];
   for(let i=0;i<3;i++){
    const rss=snapshot(app.process().pid),row={time:new Date().toISOString(),rss};
    if(process.platform==='darwin'){
     const target=path.join(directory,stage+'-'+i+'-footprint.json');
     try{execFileSync('/usr/bin/footprint',['-f','bytes','--noCategories','-j',target,...rss.processes.map(x=>String(x.pid))],{stdio:'pipe',timeout:20000});const physical=JSON.parse(fs.readFileSync(target));row.physicalMiB=physical['total footprint']/1048576;row.physicalProcesses=physical.processes.map(x=>({pid:x.pid,name:x.name,bytes:x.footprint}));row.footprintErrors=physical.errors;}catch(e){row.physicalError=e.message;}
    }
    readings.push(row);if(i<2)await pause(1000);
   }
   const state=await page.evaluate(()=>({planId:PLAN.id,furniture:state.furniture.length,view:viewMode,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,progressiveStatus:document.querySelector('#progressive-status')?.textContent,progressiveCanvases:Array.from(document.querySelector('#progressive-frame')?.contentDocument?.querySelectorAll('canvas')||[],c=>[c.width,c.height])}));
   records.push({stage,state,readings});console.log(label+' '+stage+' RSS '+Math.round(readings[1].rss.attributedRssMiB)+' MiB; footprint '+Math.round(readings[1].physicalMiB)+' MiB');
  }
  await pause(30000);await sample('2d-idle');
  if(!process.argv.includes('--2d-only')){
   await page.evaluate(()=>setView('3d'));await page.waitForFunction(()=>viewMode==='3d'&&!switching);await pause(6000);await sample('3d-smooth');
   await page.locator('#progressive-mode').selectOption('detail');await page.waitForFunction(()=>document.querySelector('#progressive-status')?.textContent.includes('已收敛')||document.querySelector('#progressive-controls')?.dataset.state==='fallback',null,{timeout:180000});await pause(6000);await sample('3d-detail');
   await page.evaluate(()=>setView('2d'));await pause(20000);await sample('return-2d');
  }
  const source=JSON.parse(fs.readFileSync(path.join(workspace,'.furnish-tauri-workspace.json'))),unchanged=crypto.createHash('sha256').update(fs.readFileSync(source.source)).digest('hex')===source.sourceHash;
  const result={label,revision:revision||'working-tree',codeHashes,workspace,source,sourceUnchanged:unchanged,records,errors,forcedGC:false};fs.writeFileSync(path.join(directory,'runtime-memory.json'),JSON.stringify(result,null,2));await page.screenshot({path:path.join(directory,'final.png')});console.log(path.join(directory,'runtime-memory.json'));
  if(errors.length||!unchanged)throw Error('Invalid run; inspect runtime-memory.json');
 }finally{await app.close();}
}
(async()=>{for(const label of (process.env.FURNISH_RUNTIME_VARIANTS||'before,after').split(','))await run(label);})().catch(e=>{console.error(e);process.exitCode=1;});
