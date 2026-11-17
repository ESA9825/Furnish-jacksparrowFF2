'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
if(!global.gc){const r=require('node:child_process').spawnSync(process.execPath,['--expose-gc',__filename],{stdio:'inherit'});process.exit(r.status??1);}
(async()=>{
const R=require('../scripts/server-runtime.cjs'),dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'furnish-server-memory-')));
try{
 const scripts=path.join(dir,'scripts'),data=path.join(dir,'src/data');fs.mkdirSync(scripts,{recursive:true});fs.mkdirSync(data,{recursive:true});const entry=path.join(scripts,'entry.cjs');const shared=path.join(dir,'shared.cjs');fs.writeFileSync(shared,'module.exports=1;');fs.writeFileSync(entry,"module.exports=require('../shared.cjs');");const asset=path.join(data,'large.js');fs.writeFileSync(asset,'const value=1;');
 const liveBuffers=new Set(),wrappedFs={...fs,readFileSync(...args){const b=fs.readFileSync(...args);if(Buffer.isBuffer(b))liveBuffers.add(new WeakRef(b));return b;}};
 const scope={module:{exports:{}},require:name=>name==='node:fs'?wrappedFs:require(name)};scope.require.resolve=require.resolve;
 vm.runInNewContext(fs.readFileSync(require.resolve('../scripts/server-runtime.cjs'),'utf8'),scope);const runtime=scope.module.exports,watch=runtime.watch(entry);
 const expected=files=>{const h=crypto.createHash('sha256');for(const file of files.sort((a,b)=>a.localeCompare(b)))h.update(path.relative(scripts,file)).update('\0').update(fs.readFileSync(file)).update('\0');return h.digest('hex');};
 assert.equal(watch(),expected([entry,shared,asset]),'preserve the exact path/NUL/bytes/NUL fingerprint protocol');assert.equal(watch(),R.fingerprint(entry));const first=watch();fs.writeFileSync(shared,'module.exports=2;');assert.notEqual(watch(),first,'literal dependencies outside scanned roots remain tracked');assert.equal(watch(),R.fingerprint(entry));fs.writeFileSync(asset,'const value=2;');assert.equal(watch(),R.fingerprint(entry));const added=path.join(data,'added.js');fs.writeFileSync(added,'const other=3;');assert.equal(watch(),R.fingerprint(entry));fs.unlinkSync(added);assert.equal(watch(),R.fingerprint(entry));
 // A watch must keep detecting equal-size/restored-mtime changes and lazy additions.
 const stat=fs.statSync(asset);fs.writeFileSync(asset,'const value=4;');fs.utimesSync(asset,stat.atime,stat.mtime);assert.equal(watch(),R.fingerprint(entry));assert.equal(watch(),R.fingerprint(entry));
 await new Promise(setImmediate);global.gc();await new Promise(setImmediate);
 assert([...liveBuffers].every(ref=>!ref.deref()),'a live watcher must not retain source Buffers');assert.equal(watch(),R.fingerprint(entry),'watch remains live and valid after source Buffers are collected');
 console.log('PASS released source Buffers; unchanged fingerprint protocol, lazy source add/remove, same-size/restored-mtime changes');
}finally{fs.rmSync(dir,{recursive:true,force:true});}

})().catch(e=>{console.error(e);process.exitCode=1;});
