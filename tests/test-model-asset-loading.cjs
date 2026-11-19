'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const loaderFile=require.resolve('../src/io/model-assets.js');
const {parse}=require(loaderFile);
const root=path.dirname(require.resolve('../index.html'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const template=html.match(/<template id="model-assets">([\s\S]*?)<\/template>/)[1];
const entries=[...template.matchAll(/data-src="([^"]+)" data-asset="([^"]+)"/g)]
 .map(([,src,asset])=>({dataset:{src,asset}}));
assert(entries.length>0);
assert.equal(new Set(entries.map(e=>e.dataset.asset)).size,entries.length);
assert.equal(new Set(entries.map(e=>e.dataset.src)).size,entries.length);

const assetSource=fs.readFileSync(loaderFile,'utf8');
const requests=[];
let fail=true;
class Request {
 open(method,url,async){
  assert.equal(method,'GET');
  assert.equal(async,false);
  this.url=url;
 }
 send(){
  requests.push(this.url);
  this.status=fail?404:200;
  this.responseText=fail?'':fs.readFileSync(path.join(root,this.url),'utf8');
 }
}
const document={getElementById:()=>({content:{querySelectorAll:()=>entries}})};
const app=vm.createContext({document,location:{protocol:'http:'},XMLHttpRequest:Request});
vm.runInContext(assetSource,app);
assert.deepEqual(requests,[],'registering the assets does not load their payloads');
const name='FurnishPanelBullG12Asset',file='src/data/panel-bull-g12-blender-asset.js';
assert.throws(()=>app[name],/无法读取模型资产/);
fail=false;
const model=app[name];
assert.equal(app[name],model);
assert.deepEqual(requests,[file,file],'a failed request can retry; a success is reused');
assert(JSON.stringify(model)===JSON.stringify(require(path.join(root,file))),'the loaded payload matches the classic asset');
assert.throws(()=>parse('const asset={};if(typeof module)root.Other=asset;',name),/模型资产格式无效/);
assert.throws(()=>parse('const asset={"format":2};if(typeof module)root.'+name+'=asset;',name),/版本不受支持/);

let classicScripts;
const offline=vm.createContext({document:{...document,write:html=>{classicScripts=html;}},location:{protocol:'file:'}});
vm.runInContext(assetSource,offline);
const offlinePaths=[...classicScripts.matchAll(/<script src="([^"]+)"><\/script>/g)].map(([,src])=>src);
assert.deepEqual(offlinePaths,entries.map(entry=>entry.dataset.src));

console.log('PASS model asset manifest, deferred fetch, original payload, retry, cache and offline script loading');
