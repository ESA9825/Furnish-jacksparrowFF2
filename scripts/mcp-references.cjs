/* Product dossiers only. No network fetch, arbitrary path or executable input. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function safeDirectory(root,relative,create=true){let current=fs.realpathSync(root);for(const name of relative.split('/')){current=path.join(current,name);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Reference directories must not be symbolic links');if(!fs.existsSync(current)){if(!create)throw Error('Product dossier directory missing');fs.mkdirSync(current);}}return current;}
function dossier(root,id){if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id))throw Error('Invalid product ID');const directory=safeDirectory(root,'assets/models/'+id,false),file=path.join(directory,'asset.json');if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())throw Error('Create the product asset.json dossier first');const raw=fs.readFileSync(file),value=JSON.parse(raw);if(value.id!==id||value.format!==1||!Array.isArray(value.references)||!Array.isArray(value.sourceLinks))throw Error('Invalid product dossier');return {directory,file,raw,value,dossierRevision:hash(raw)};}
function call(root,name,args){
 const current=dossier(root,args.productId);
 if(name==='get_product_dossier')return {product:current.value,dossierRevision:current.dossierRevision,limit:'References are recorded evidence, not manufacturer dimension approval; this tool does not fetch remote pages.'};
 const local=safeDirectory(root,'.local/mcp-reference-receipts'),request=path.join(local,hash(args.requestId)+'.json'),signature=hash(JSON.stringify(args));
 if(fs.existsSync(request)){if(fs.lstatSync(request).isSymbolicLink())throw Error('Linked receipt rejected');const old=JSON.parse(fs.readFileSync(request));if(old.signature!==signature)throw Error('requestId already used for another reference request');return old.result;}
 const lock=path.join(local,args.productId+'.lock');let fd;
 try{fd=fs.openSync(lock,'wx',0o600);}catch{throw Error('Product dossier busy; retry the same request after the writer completes');}
 try{
  const active=dossier(root,args.productId);if(active.dossierRevision!==args.dossierRevision)throw Error('Product dossier changed; read its revision again');
  const files=[{data:Buffer.from(JSON.stringify({sourceUrl:args.sourceUrl??null,capturedOn:args.capturedOn??null,note:args.note??'',status:'recorded-not-independently-verified'},null,2)+'\n'),extension:'json'}];
  if(args.imageBase64){const data=Buffer.from(args.imageBase64,'base64');if(data.length>2e6||data.toString('base64')!==args.imageBase64)throw Error('Invalid reference image encoding or size');const magic=args.imageType==='png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):args.imageType==='jpeg'?data[0]===255&&data[1]===216&&data[2]===255:args.imageType==='webp'?data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP':false;if(!magic)throw Error('Reference image type invalid');files.push({data,extension:args.imageType==='jpeg'?'jpg':args.imageType});}
  const references=safeDirectory(root,'assets/models/'+args.productId+'/references/product-page'),product=active.value;
  for(const {data,extension}of files){const sha256=hash(data),relative='references/product-page/'+sha256+'.'+extension,target=path.join(references,sha256+'.'+extension);if(!fs.existsSync(target))fs.writeFileSync(target,data,{flag:'wx',mode:0o600});if(fs.lstatSync(target).isSymbolicLink()||!fs.readFileSync(target).equals(data))throw Error('Reference content collision');if(!product.references.some(r=>r.sha256===sha256))product.references.push({path:relative,kind:'product-page',sha256,bytes:data.length,legacyPaths:[],uploadNames:[]});}
  if(args.sourceUrl&&!product.sourceLinks.includes(args.sourceUrl))product.sourceLinks.push(args.sourceUrl);
  for(const ref of product.references){if(typeof ref.path!=='string'||!ref.path.startsWith('references/')||ref.path.includes('\\')||ref.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid reference path');safeDirectory(active.directory,path.dirname(ref.path),false);const target=path.join(active.directory,ref.path);if(fs.lstatSync(target).isSymbolicLink())throw Error('Linked reference rejected');let data=fs.readFileSync(target);if(ref.normalization==='utf8-lf')data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));if(data.length!==ref.bytes||hash(data)!==ref.sha256)throw Error('Reference hash mismatch');}
  if(hash(fs.readFileSync(active.file))!==active.dossierRevision)throw Error('Concurrent dossier modification; assets retained, manifest not overwritten');
  const next=Buffer.from(JSON.stringify(product,null,2)+'\n'),temp=active.file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,next,{flag:'wx'});fs.renameSync(temp,active.file);
  const result={archived:true,productId:args.productId,dossierRevision:hash(next),references:product.references,sourceLinks:product.sourceLinks};fs.writeFileSync(request,JSON.stringify({signature,result}),{flag:'wx',mode:0o600});return result;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
module.exports={call,dossier};
