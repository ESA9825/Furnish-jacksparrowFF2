/* Passive RSS samples. macOS WebKit services may be reparented outside the tree. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function parsePs(output){return output.trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);return m&&{pid:+m[1],ppid:+m[2],rssKiB:+m[3],command:m[4]};}).filter(Boolean);}
function tree(rows,pid){const ids=new Set([pid]);let n;do{n=ids.size;for(const r of rows)if(ids.has(r.ppid))ids.add(r.pid);}while(n!==ids.size);return rows.filter(r=>ids.has(r.pid));}
function responsiblePids(pids){
 if(process.platform!=='darwin'||!pids.length)return {};
 const code="import ctypes,json,sys\nlib=ctypes.CDLL('/usr/lib/libSystem.B.dylib')\nf=lib.responsibility_get_pid_responsible_for_pid\nf.argtypes=[ctypes.c_int];f.restype=ctypes.c_int\nprint(json.dumps({pid:f(pid) for pid in json.load(sys.stdin)}))";
 try{return JSON.parse(execFileSync('python3',['-c',code],{input:JSON.stringify(pids),encoding:'utf8'}));}catch{return {};}
}
function snapshot(pid,additionalPids=[]){
 if(process.platform==='win32')throw Error('RSS collection currently supports macOS/Linux only');
 const rows=parsePs(execFileSync('ps',['-axo','pid=,ppid=,rss=,comm='],{encoding:'utf8'})),owned=Array.from(new Map([pid,...additionalPids].flatMap(id=>tree(rows,id)).map(row=>[row.pid,row])).values());
 if(!owned.some(r=>r.pid===pid))throw Error('Target process has exited');
 const candidates=rows.filter(r=>/WebKit/.test(r.command)&&!owned.includes(r)),responsible=responsiblePids(candidates.map(r=>r.pid)),ids=new Set(owned.map(r=>r.pid));
 const attributedWebKit=candidates.filter(r=>ids.has(responsible[r.pid])).map(r=>({...r,responsiblePid:responsible[r.pid]}));
 return {time:new Date().toISOString(),pid,treeRssMiB:owned.reduce((s,r)=>s+r.rssKiB,0)/1024,attributedRssMiB:[...owned,...attributedWebKit].reduce((s,r)=>s+r.rssKiB,0)/1024,processes:owned,attributedWebKit,unattributedWebKit:candidates.filter(r=>!ids.has(responsible[r.pid])).map(r=>({...r,responsiblePid:responsible[r.pid]??null})),note:'RSS sum double-counts shared pages; macOS WebKit XPC services are attributed only when the OS responsible PID belongs to the owned tree; remaining candidates are NOT attributed to this app. Not total physical/GPU memory.'};
}
async function main(){
 const [launchFile,label='unlabelled',count='5']=process.argv.slice(2),n=Number(count);
 if(!launchFile||!Number.isInteger(n)||n<1||n>120)throw Error('Usage: node scripts/tauri-memory.cjs <engine-launch.json> <stage> [samples 1..120]');
 const meta=JSON.parse(fs.readFileSync(launchFile,'utf8')),samples=[];
 for(let i=0;i<n;i++){samples.push(snapshot(meta.launcherPid||meta.pid,[meta.pid]));if(i+1<n)await new Promise(r=>setTimeout(r,1000));}
 const report={engine:meta.engine,label,source:meta.source,platform:process.platform,arch:process.arch,samples};
 const out=path.join(path.dirname(launchFile),meta.engine+'-memory-'+Date.now()+'.json');fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(out);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parsePs,tree,snapshot};
