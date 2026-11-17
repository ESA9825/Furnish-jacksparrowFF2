'use strict';
const assert=require('node:assert/strict');
function edit(s,a,b){assert(s.includes(a),'split kernel anchor missing: '+a.slice(0,70));return s.replace(a,b);}
const basicScope=`function withBasicAudit(fn){const previous=globalThis.__furnishMaterialAudit;try{globalThis.__furnishMaterialAudit={...previous,features:{...previous.features,clearcoat:{used:false},transmission:{used:false}},textures:{...previous.textures,clearcoatMap:{used:false},clearcoatNormalMap:{used:false},clearcoatRoughnessMap:{used:false},transmissionMap:{used:false}}};return fn();}finally{globalThis.__furnishMaterialAudit=previous;}}`;
function transform(file,s){
 if(file==='compute/wavefront/MaterialKernel.js'){
  const start=s.indexOf('export class MaterialKernel');assert(start>=0);const original=s.slice(start);
  const guard=basic=>`let input = \${ params.rayDataStorage }[ index ];\nif(input.objectIndex<0){${basic?'':'return;'}}else{let entry=\${ materialsStorage }[\${ transformsStorage }[u32(input.objectIndex)].materialIndex];let basic=entry.clearcoat==0.0&&entry.transmission==0.0&&entry.clearcoatMap<0&&entry.clearcoatNormalMap<0&&entry.clearcoatRoughnessMap<0&&entry.transmissionMap<0;if(${basic?'!basic':'basic'}){return;}}`;
  const a=edit(original,'let input = ${ params.rayDataStorage }[ index ];',guard(false));
  let b=edit(original,'export class MaterialKernel','export class BasicMaterialKernel');b=edit(b,'let input = ${ params.rayDataStorage }[ index ];',guard(true));b=edit(b,"contextProxyFn( 'bvhData.fns.getSurfaceRecord' )","contextProxyFn( 'bvhData.fns.getBasicSurfaceRecord' )");
  return s.slice(0,start)+a+'\n'+b;
 }
 if(file==='nodes/PathtracerBVHComputeData.js'){
  s=edit(s,'export class PathtracerBVHComputeData',basicScope+'\nexport class PathtracerBVHComputeData');
  s=edit(s,'fns.getSurfaceRecord = getSurfaceRecordFunc( sampleTexel, fns.getUvFromChannel, fns.getColor );','fns.getSurfaceRecord = getSurfaceRecordFunc( sampleTexel, fns.getUvFromChannel, fns.getColor );\n fns.getBasicSurfaceRecord=withBasicAudit(()=>getSurfaceRecordFunc(sampleTexel,fns.getUvFromChannel,fns.getColor));');
 }
 if(file==='WaveFrontPathTracer.js'){
  s=edit(s,'import { MaterialKernel }','import { MaterialKernel, BasicMaterialKernel }');
  s=edit(s,'export class WaveFrontPathTracer',basicScope+'\nexport class WaveFrontPathTracer');
  s=edit(s,'this.materialKernel = new MaterialKernel().setWorkgroupSize( 64, 1, 1 );','this.materialKernel = new MaterialKernel().setWorkgroupSize( 64, 1, 1 );\n this.basicMaterialKernel = new BasicMaterialKernel().setWorkgroupSize(64,1,1);');
  s=edit(s,'this.materialKernel.context.bvhData = bvhData;','this.materialKernel.context.bvhData = bvhData;\n this.basicMaterialKernel.context.bvhData=bvhData;this.basicMaterialKernel.needsUpdate=true;');
  s=edit(s,"// MaterialKernel bakes in the camera ray function, so a camera swap needs a recompile","this.basicMaterialKernel.needsUpdate=true;\n // MaterialKernel bakes in the camera ray function, so a camera swap needs a recompile");
  s=edit(s,'this.materialKernel.context.random = random;','this.materialKernel.context.random = random;\n this.basicMaterialKernel.context.random=random;this.basicMaterialKernel.needsUpdate=true;');
  s=edit(s,'this.materialKernel.material = material.getData();','this.materialKernel.material = material.getData();\n this.basicMaterialKernel.material=withBasicAudit(()=>{const basic=Object.create(material);basic._bsdfEvalPdfNode=null;return basic.getData();});this.basicMaterialKernel.needsUpdate=true;');
  s=edit(s,'this.materialKernel.filterGlossy = value === 0 ? FILTER_GLOSSY_DISABLED : 1 / value;','this.materialKernel.filterGlossy = value === 0 ? FILTER_GLOSSY_DISABLED : 1 / value;\n this.basicMaterialKernel.filterGlossy=this.materialKernel.filterGlossy;');
  s=edit(s,'yield* this.compileKernels( [','yield* this.compileKernels( [ this.basicMaterialKernel,');
  s=edit(s,'this.dispatch( materialKernel, materialKernel.getDispatchSize( rayCount, 1, 1 ) );',`this.dispatch( materialKernel, materialKernel.getDispatchSize( rayCount, 1, 1 ) );
   const basic=this.basicMaterialKernel;for(const key of ['rayDataStorage','rayQueue','shadowRayQueue','queueCounters','pixelQueue','sampleCountTarget','seed','maxSamples','rayCount','maxTransparentBounces','maxBounces'])basic[key]=materialKernel[key];basic.targetDimensions.copy(targetDimensions);this.dispatch(basic,basic.getDispatchSize(rayCount,1,1));`);
 }
 return s;
}
module.exports={transform};
