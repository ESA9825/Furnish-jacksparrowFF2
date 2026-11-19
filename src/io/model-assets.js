/* The generated classic assets also load directly in standalone previews and Node.
 * On the local server, read only the JSON payload when a synchronous production
 * builder first asks for it. Never execute a response as JavaScript. */
(function(root){
 'use strict';

 function parse(source,name){
  const start=/\bconst (asset|a)=(?=\{)/.exec(source);
  const end=source.lastIndexOf(';if(typeof module');
  if(!start||end<start.index||!source.slice(end).includes('.'+name+'='+start[1]+';')){
   throw Error('模型资产格式无效：'+name);
  }
  const asset=JSON.parse(source.slice(start.index+start[0].length,end));
  if(asset.format!==1)throw Error('模型资产版本不受支持：'+name);
  return asset;
 }

 function install(document){
  const entries=[...document.getElementById('model-assets').content.querySelectorAll('script')].map(script=>{
   const {asset:name,src:path}=script.dataset;
   if(!/^Furnish\w+$/.test(name)||!/^src\/data\/[a-z0-9-]+-blender-asset\.js$/.test(path)){
    throw Error('模型资产清单无效');
   }
   return {name,path};
  });
  // A file page cannot read sibling files with XMLHttpRequest in Chromium.
  // Parser-inserted classic scripts keep the established direct-open entry.
  if(root.location.protocol==='file:'){
   document.write(entries.map(({path})=>'<script src="'+path+'"><\/script>').join(''));
   return;
  }
  for(const {name,path} of entries){
   Object.defineProperty(root,name,{configurable:true,enumerable:true,get(){
    const request=new XMLHttpRequest();
    request.open('GET',path,false);
    request.send();
    if(request.status!==200)throw Error('无法读取模型资产：'+path);
    const value=parse(request.responseText,name);
    Object.defineProperty(root,name,{configurable:true,enumerable:true,writable:true,value});
    return value;
   }});
  }
 }

 if(typeof module==='object'&&module.exports)module.exports={parse};
 else install(root.document);
})(globalThis);
