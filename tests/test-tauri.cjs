'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {prepare,verifyWorkspace,lock,launch}=require('../scripts/tauri-launch.cjs');
const {parsePs,tree}=require('../scripts/tauri-memory.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'furnish-tauri-test-'));
 try{
  assert.throws(()=>verifyWorkspace(dir));
  for(const name of ['index.html','scripts/serve.cjs','src/core/repository-core.js']){fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.writeFileSync(path.join(dir,name),'');}
  fs.writeFileSync(path.join(dir,'.furnish-tauri-workspace.json'),JSON.stringify({version:1,sourceHash:'original'}));
  assert.equal(verifyWorkspace(dir),fs.realpathSync(dir));
  const unlock=lock(dir);assert.throws(()=>lock(dir),/正在使用/);unlock();
  fs.writeFileSync(path.join(dir,'.tauri-compare.lock'),JSON.stringify({pid:2147483647}));lock(dir)();
  await assert.rejects(launch({workspace:dir,engine:'bad'}),/engine/);
  await assert.rejects(launch({workspace:dir,executable:path.join(dir,'missing')}),/找不到/);
  const rows=parsePs('1 0 1024 /init\n2 1 2048 /app with space\n3 2 4096 /child\n4 1 8192 /other\n');
  assert.deepEqual(tree(rows,2).map(r=>r.pid),[2,3]);assert.equal(rows[1].command,'/app with space');
  for(const name of require('../scripts/package-desktop.cjs').runtimeFiles){fs.mkdirSync(path.dirname(path.join(dir,'scripts',name)),{recursive:true});fs.writeFileSync(path.join(dir,'scripts',name),'// isolated fixture');}
  fs.mkdirSync(path.join(dir,'projects'),{recursive:true});fs.writeFileSync(path.join(dir,'projects/workspace.furnish.json'),'{}');
  const copy=prepare({sourceRoot:dir,source:path.join(dir,'projects/workspace.furnish.json')});
  try{assert.equal(verifyWorkspace(copy),copy);assert.ok(fs.existsSync(path.join(copy,'scripts/serve.cjs')),'prepared workspace must survive artifact finalization');fs.writeFileSync(path.join(path.dirname(copy),'verification.json'),'evidence');const job=require('../scripts/lib/test-artifacts.cjs').openRun(path.dirname(copy),{existing:true});job.finish(false);assert(!fs.existsSync(path.join(copy,'scripts/serve.cjs')));assert(fs.existsSync(path.join(copy,'projects/workspace.furnish.json')));assert.equal(fs.readFileSync(path.join(path.dirname(copy),'verification.json'),'utf8'),'evidence');}finally{fs.rmSync(path.dirname(copy),{recursive:true,force:true});}
  fs.mkdirSync(path.join(dir,'alternate'),{recursive:true});fs.mkdirSync(path.join(dir,'.local'),{recursive:true});fs.writeFileSync(path.join(dir,'alternate/workspace.furnish.json'),'{"external":true}');fs.writeFileSync(path.join(dir,'.local/storage.json'),JSON.stringify({version:1,directory:path.join(dir,'alternate')}));fs.unlinkSync(path.join(dir,'projects/workspace.furnish.json'));
  const external=prepare({sourceRoot:dir});try{assert.equal(fs.readFileSync(path.join(external,'projects/workspace.furnish.json'),'utf8'),'{"external":true}');assert.equal(fs.existsSync(path.join(external,'.local/storage.json')),false,'formal storage pointer must not be copied');}finally{fs.rmSync(path.dirname(external),{recursive:true,force:true});}
  console.log('Tauri workspace guard, active lock, stale lock, missing executable and RSS process attribution passed');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
