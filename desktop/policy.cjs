'use strict';
const fs=require('node:fs'),path=require('node:path');
// The writable workspace lives beside the .app, never inside its signed bundle.
function applicationRoot({packaged,executable,sourceRoot,platform=process.platform}){
 // Electron's stock executable name reports isPackaged=false. Treat code
 // actually loaded from this .app's Resources/app as embedded nevertheless;
 // running source code with node_modules/Electron.app must stay source mode.
 const mac=platform==='darwin',real=p=>fs.existsSync(p)?fs.realpathSync(p):path.resolve(p);
 const bin=executable&&path.dirname(mac?real(executable):executable);
 const embedded=mac&&bin&&path.basename(bin)==='MacOS'&&path.basename(path.dirname(bin))==='Contents'&&path.extname(path.resolve(bin,'../..'))==='.app'&&sourceRoot&&real(sourceRoot)===path.resolve(bin,'../Resources');
 if(!packaged&&!embedded)return sourceRoot;
 return mac?path.resolve(bin,'../../..'):path.dirname(executable);
}
function workspaceRoot({appRoot,config,override}){
 const root=path.resolve(override||config?.root||appRoot);
 for(const file of ['index.html','scripts/serve.cjs','src/core/repository-core.js'])
  if(!fs.statSync(path.join(root,file),{throwIfNoEntry:false})?.isFile())throw Error('Furnish 工作目录不存在或不完整：'+root);
 return fs.realpathSync(root);
}
function localPage(url,base){try{const u=new URL(url);return u.origin===new URL(base).origin;}catch{return false;}}
function externalPage(url){try{return ['https:','http:'].includes(new URL(url).protocol);}catch{return false;}}
module.exports={applicationRoot,workspaceRoot,localPage,externalPage};
