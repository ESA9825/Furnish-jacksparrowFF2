'use strict';
module.exports=async(p,V)=>{
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'../..'),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const before=fs.readFileSync(path.join(root,'tests/fixtures/blender-export-before-sharing.js'),'utf8'),after=fs.readFileSync(path.join(root,'src/io/blender-export.js'),'utf8');
 await p.evaluate(()=>setView('3d'));await p.locator('#progressive-mode').selectOption('smooth');await p.evaluate(()=>View3D.automationReady());
 const result=await p.evaluate(async({before,after})=>{
  const original=FurnishBlenderExport,hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  async function audit(data){
   const view=new DataView(data.buffer),length=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(data.buffer,20,length))),bin=28+length,views=new Map(),accessors=new Map();
   const imageView=i=>{if(!views.has(i)){const b=doc.bufferViews[i];views.set(i,hash(new Uint8Array(data.buffer,bin+(b.byteOffset||0),b.byteLength)));}return views.get(i);};
   const accessor=i=>{if(!accessors.has(i)){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView];accessors.set(i,imageView(a.bufferView).then(bytes=>({...a,bufferView:bytes,stride:v.byteStride||null})));}return accessors.get(i);};
   const primitives=async mesh=>Promise.all(mesh.primitives.map(async primitive=>{const attributes={};for(const key of Object.keys(primitive.attributes).sort())attributes[key]=await accessor(primitive.attributes[key]);const targets=[];for(const target of primitive.targets||[]){const row={};for(const key of Object.keys(target).sort())row[key]=await accessor(target[key]);targets.push(row);}return {...primitive,attributes,...(primitive.indices!==undefined?{indices:await accessor(primitive.indices)}:{}),...(targets.length?{targets}:{})};}));
   const meshes=await Promise.all(doc.meshes.map(primitives)),nodes=doc.nodes.map(n=>({...n,...(n.mesh!==undefined?{mesh:meshes[n.mesh]}:{})})),images=await Promise.all((doc.images||[]).map(async i=>({...i,...(i.bufferView!==undefined?{bufferView:await imageView(i.bufferView)}:{})})));
   return {bytes:data.buffer.byteLength,nodes:nodes.filter(n=>n.mesh!==undefined).length,geometryHash:await hash(new TextEncoder().encode(JSON.stringify(nodes))),materialsHash:await hash(new TextEncoder().encode(JSON.stringify([doc.materials,doc.textures,doc.samplers,images]))),lightingHash:await hash(new TextEncoder().encode(JSON.stringify([data.camera,data.environment,data.lighting])))};
  }
  const space=async()=>{const {revision,save,...rest}=await FurnishMcp.execute('check_space',{});return hash(new TextEncoder().encode(JSON.stringify(rest)));};
  try{const collisionBefore=await space();Function(before)();const baseline=await audit(await View3D.progressiveScene());Function(after)();const candidate=await audit(await View3D.progressiveScene());Function(before)();const repeated=await audit(await View3D.progressiveScene());return {baseline,candidate,repeated,collisionBefore,collisionAfter:await space()};}finally{globalThis.FurnishBlenderExport=original;}
 },{before,after});
 fs.writeFileSync(V.artifact(V.mode+'-scene-equivalence.json'),JSON.stringify(result,null,2));
 for(const key of ['nodes','geometryHash','materialsHash','lightingHash']){assert.equal(result.baseline[key],result.candidate[key],key+' preserved by actual production GLB');assert.equal(result.baseline[key],result.repeated[key],key+' source unchanged after borrowed export');}assert.equal(result.collisionBefore,result.collisionAfter);assert.deepEqual(errors,[]);
 return ['production GLB node identities/transforms, every accessor value/type/index, all materials/textures and lights exactly equal; source unchanged on repeated export; complete collision result unchanged'];
};
