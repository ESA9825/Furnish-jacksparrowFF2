/* Diagnostic-only Electron runs against a copied production workspace. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{_electron}=require('playwright');
const root=path.resolve(__dirname,'..'),{prepare,freePort}=require('./tauri-launch.cjs');
async function run(variant){
 const workspace=prepare(),run=path.dirname(workspace),file=path.join(workspace,'index.html');
 const revision=process.env.FURNISH_MEMORY_SOURCE_REVISION;if(revision){if(!/^[a-f0-9]{7,40}$/.test(revision))throw Error('Expected an immutable source revision');for(const name of ['furniture-solids.js','project-core.js','repository-core.js'])fs.writeFileSync(path.join(workspace,'src/core',name),require('node:child_process').execFileSync('git',['show',revision+':src/core/'+name],{cwd:root,maxBuffer:2000000}));}
 if(variant==='json-assets'){for(const match of fs.readFileSync(file,'utf8').matchAll(/<script src="(src\/data\/[^"]*-asset\.js)"><\/script>/g)){const assetFile=path.join(workspace,match[1]),code=fs.readFileSync(assetFile,'utf8'),binding=/const\s+\w+\s*=\s*(?=\{)/.exec(code),start=binding?binding.index+binding[0].length:-1,end=code.lastIndexOf(';if(typeof module');if(start<0||end<=start)throw Error('Unknown asset wrapper: '+match[1]);const literal=code.slice(start,end);JSON.parse(literal);fs.writeFileSync(assetFile,code.slice(0,start)+'JSON.parse('+JSON.stringify(literal)+')'+code.slice(end));}}
 if(variant==='without-assets')fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/<script src="src\/data\/[^\"]*-asset\.js"><\/script>/g,''));
 // Counters capture only counts, never additional mesh references.
 const solidFile=path.join(workspace,'src/core/furniture-solids.js');let solid=fs.readFileSync(solidFile,'utf8');
 solid=solid.replace('const cache=new Map(),worldCache=new Map();',"const cache=new Map(),worldCache=new Map(),profile={calls:0,worldHits:0,localHits:0,builds:{}};");
 solid=solid.replace('if(!supported(f))return null;',"if(!supported(f))return null;profile.calls++;").replace('if(worldCache.has(worldKey)){',"if(worldCache.has(worldKey)){profile.worldHits++;").replace('if(records){cache.delete',"if(records){profile.localHits++;cache.delete").replace('if(!records){',"if(!records){profile.builds[f.type]=(profile.builds[f.type]||0)+1;");
 solid=solid.replace('const api={supported,parts};',"const api={supported,parts,clearProfileCaches:()=>{cache.clear();worldCache.clear();},profile:()=>{const count=map=>{let vertices=0,parts=0;for(const records of map.values())for(const r of records){vertices+=r.vertices.length;parts++;}return {entries:map.size,vertices,parts};};return {...profile,local:count(cache),world:count(worldCache)};}};");fs.writeFileSync(solidFile,solid);
 const zoneFile=path.join(workspace,'src/core/zone-geometry.js');fs.writeFileSync(zoneFile,fs.readFileSync(zoneFile,'utf8').replace('function decompose(polys,predicate){',"function decompose(polys,predicate){root.__zoneProfile=(root.__zoneProfile||0)+1;"));
 // The instrumentation exists only in this copied backend, never the source server.
 fs.appendFileSync(path.join(workspace,'scripts/serve.cjs'),`\nconst profileFs=require('node:fs'),profilePath=require('node:path').join(__dirname,'../.local/memory-profile.jsonl');let profileTick=0;setInterval(()=>{profileFs.mkdirSync(require('node:path').dirname(profilePath),{recursive:true});let stage='natural';if(++profileTick===20&&!process.env.FURNISH_MEMORY_STEADY){require('node:v8').setFlagsFromString('--expose_gc');require('node:vm').runInNewContext('gc')();stage='forced-gc';}profileFs.appendFileSync(profilePath,JSON.stringify({stage,time:Date.now(),...process.memoryUsage()})+'\\n');},1000).unref();\n`);
 const env={...process.env,FURNISH_DESKTOP_ROOT:workspace,FURNISH_DESKTOP_PROFILE:path.join(run,'profile'),FURNISH_PORT:String(await freePort()),FURNISH_MCP_DISABLE:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('./launch-desktop.cjs').desktopExecutable(root),env,timeout:60000});
 let cdp,page;const errors=[],records=[];
 try{
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  async function sample(stage){const heap=await cdp.send('Runtime.getHeapUsage'),metrics=await app.evaluate(({app})=>app.getAppMetrics());const row={stage,time:Date.now(),heap,metrics,counters:await page.evaluate(()=>({solids:window.FurnishFurnitureSolids?.profile?.(),decompose:window.__zoneProfile}))};records.push(row);console.log(variant+' '+stage+' heap='+Math.round(heap.usedSize/1048576)+' MiB');}
  await page.waitForFunction(()=>window.FurnishRepository&&typeof repositoryBooting!=='undefined'&&!repositoryBooting,null,{timeout:120000});
  await sample('ready');await page.waitForTimeout(5000);await sample('idle-5s');if(process.env.FURNISH_MEMORY_STEADY){await page.waitForTimeout(25000);await sample('idle-30s');await page.waitForTimeout(30000);await sample('idle-60s');}
  await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(1000);await sample('after-renderer-gc');
  if(!process.env.FURNISH_MEMORY_STEADY&&!process.env.FURNISH_MEMORY_RETENTION){
  await cdp.send('HeapProfiler.startSampling',{samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
  await page.reload();await page.waitForFunction(()=>window.FurnishRepository&&typeof repositoryBooting!=='undefined'&&!repositoryBooting,null,{timeout:120000});await sample('reload');
  const profile=(await cdp.send('HeapProfiler.stopSampling')).profile;fs.writeFileSync(path.join(run,'allocations.json'),JSON.stringify(profile));
  await cdp.send('HeapProfiler.collectGarbage');await sample('reload-after-gc');}
  if(process.env.FURNISH_MEMORY_RETENTION){await page.evaluate(()=>FurnishFurnitureSolids.clearProfileCaches());await cdp.send('HeapProfiler.collectGarbage');await sample('after-drop-solid-caches');await page.evaluate(()=>{for(const key of Object.keys(window))if(/Asset$/.test(key)&&window[key]?.parts)delete window[key];});await cdp.send('HeapProfiler.collectGarbage');await sample('after-drop-asset-globals');}
  const state=await page.evaluate(()=>({planId:PLAN.id,furniture:state.furniture.length,designs:store.designs.length,work:Object.keys(store.work).length,view:viewMode,assets:performance.getEntriesByType('resource').filter(x=>x.name.includes('-asset.js')).map(x=>({url:new URL(x.name).pathname,bytes:x.decodedBodySize})),assetData:Object.keys(window).filter(k=>/Asset$/.test(k)&&window[k]?.parts).map(k=>({name:k,parts:window[k].parts.length,positionNumbers:window[k].parts.reduce((s,p)=>s+(p.positions?.length||0),0),normalNumbers:window[k].parts.reduce((s,p)=>s+(p.normals?.length||0),0)})),storeBytes:JSON.stringify(store).length,undo:undoStack.length,redo:redoStack.length,dom:document.getElementsByTagName('*').length}));
  await page.waitForTimeout(3000);await sample('final');
  const result={variant,sourceRevision:revision||'working-tree',workspace,records,state,errors,backend:fs.existsSync(path.join(workspace,'.local/memory-profile.jsonl'))?fs.readFileSync(path.join(workspace,'.local/memory-profile.jsonl'),'utf8').trim().split('\n').map(JSON.parse):[]};
  fs.writeFileSync(path.join(run,'memory-2d.json'),JSON.stringify(result,null,2));await page.screenshot({path:path.join(run,'2d.png')});console.log(path.join(run,'memory-2d.json'));
 }catch(error){fs.writeFileSync(path.join(run,'failure.json'),JSON.stringify({variant,workspace,error:error.message,errors,records},null,2));throw error;}finally{await cdp?.detach().catch(()=>{});await app.close();}
}
async function main(){for(const v of (process.env.FURNISH_MEMORY_VARIANTS||'baseline,json-assets').split(','))await run(v);}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
