/* Sequential same-source native shell checks. Writes only marked private copies. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const {prepare}=require('./tauri-launch.cjs'),{snapshot}=require('./tauri-memory.cjs');
const root=path.resolve(__dirname,'..');
async function run(engine){
 const workspace=prepare(),dir=path.dirname(workspace),records=[];
 const child=spawn(process.execPath,[path.join(__dirname,'tauri-launch.cjs'),'--workspace',workspace,'--engine',engine,'--probe',path.join(root,'tests/helpers/tauri-probe.js')],{env:process.env,stdio:['ignore','pipe','pipe']});
 let buffer='',stderr='',stdout='';
 child.stderr.on('data',b=>{stderr+=b;fs.appendFileSync(path.join(dir,'stderr.log'),b);});
 child.stdout.on('data',b=>{stdout+=b;fs.appendFileSync(path.join(dir,'stdout-live.log'),b);buffer+=b;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.startsWith('FURNISH_PROBE='))continue;
  const observation=JSON.parse(line.slice(14));let memory;try{const meta=JSON.parse(fs.readFileSync(path.join(dir,engine+'-launch.json')));memory=snapshot(child.pid,[meta.pid]);}catch(e){memory={error:e.message};}
  let screenshot;
  if(process.platform==='darwin'&&process.env.FURNISH_COMPARE_WINDOW_HELPER){try{const meta=JSON.parse(fs.readFileSync(path.join(dir,engine+'-launch.json'))),windows=JSON.parse(execFileSync(process.env.FURNISH_COMPARE_WINDOW_HELPER,[String(meta.pid)],{encoding:'utf8'})),win=windows.find(w=>w.kCGWindowLayer===0);if(win){screenshot=path.join(dir,observation.stage+'.png');execFileSync('/usr/sbin/screencapture',['-x','-l',String(win.kCGWindowNumber),screenshot],{timeout:15000});}}catch(e){screenshot={error:e.message};}}
  records.push({observation,memory,screenshot});console.log(engine+' '+observation.stage+' '+(observation.passed?'passed':observation.error));
 }});
 const timer=setTimeout(()=>child.kill('SIGTERM'),300000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});}finally{clearTimeout(timer);}
 const result={engine,workspace,environment:{platform:process.platform,arch:process.arch,node:process.version,os:require('node:os').release(),totalMemory:require('node:os').totalmem()},source:JSON.parse(fs.readFileSync(path.join(workspace,'.furnish-tauri-workspace.json'))),records,exit,stderr};
 result.sourceUnchanged=require('node:crypto').createHash('sha256').update(fs.readFileSync(result.source.source)).digest('hex')===result.source.sourceHash;
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(dir,'stdout.log'),stdout);
 result.passed=result.sourceUnchanged&&exit.code===0&&records.some(r=>r.observation.stage==='return-2d')&&records.every(r=>r.observation.passed);
 // The launcher has exited and released its workspace lock; reports and project
 // copies stay in place while the registered runtime inputs can be regenerated.
 const cleanup=require('./lib/test-artifacts.cjs').openRun(dir,{existing:true});
 cleanup.discard('profile-'+engine);result.cleanup=cleanup.finish(result.passed);
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(result,null,2));
 console.log(path.join(dir,'verification.json'));return result;
}
async function main(){
 const engines=process.argv.includes('--tauri-only')?['tauri']:process.argv.includes('--electron-only')?['electron']:['electron','tauri'],results=[];
 for(const engine of engines)results.push(await run(engine));
 if(results.some(r=>!r.passed))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
