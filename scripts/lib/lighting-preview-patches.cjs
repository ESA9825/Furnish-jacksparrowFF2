/* Reproducible adaptations of the pinned WebGPU graph. No material or sampling edits. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const VERSION=2;
const PINS={
  "nodes/material.wgsl.js": "bd9e7ba9eaf3f2427b1929e63e4a77df482a704c008d4f417e96e776c5457690",
  "nodes/PathtracerBVHComputeData.js": "bb024ff8320542fee895fe4de6dd8e5136b542a9b17833b63dcf9bc9e7c52dc8",
  "materials/GltfCompliantMaterial.js": "72377067a481c2e4ead1370a7daef63366eddd08f08c7d29961117921a92f561",
  "compute/wavefront/MaterialKernel.js": "011daf1e05476f78c3624ae058d0b06fd433b9292f5ef44ad0e3b91d452f26af",
  "compute/wavefront/LogicKernel.js": "bb87eaaaca84ac1537389db33bdf65afb0a80b72ca6fa3fb2cb87f7406825c9d",
  "WaveFrontPathTracer.js": "00fcddce80cc66c3542490f66ffb40bcaea98df40635d4de08a1f771b5979bd3"
};
function transformMaterial(source){
 // Only rvalue reads in the BSDF implementation are replaced; surface construction remains intact.
 const wrapper=`
function sceneWgsl(strings,...values){
 const flags=globalThis.__furnishMaterialAudit?.features;
 const parts=Array.from(strings,s=>{if(flags)for(const key of ['clearcoat','sheen','iridescence','anisotropy','transmission'])if(flags[key]?.used===false)s=s.replace(new RegExp('\\\\bsurf\\\\.'+key+'\\\\b','g'),'0.0');return s;});parts.raw=parts;return wgslTagFn(parts,...values);
}
`;
 return source.replace('export class GltfCompliantMaterial',wrapper+'\nexport class GltfCompliantMaterial').replaceAll('= wgslTagFn/* wgsl */','= sceneWgsl/* wgsl */');
}
function transformSurface(source,allTextures=false){
 const wrapper=`
function sceneSurfaceFn(code,...includes){
 const features=globalThis.__furnishMaterialAudit?.features;
 const maps={sheen:['sheenColorMap','sheenRoughnessMap'],iridescence:['iridescenceMap','iridescenceThicknessMap'],anisotropy:['anisotropyMap'],clearcoat:['clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap'],transmission:['transmissionMap']};
 if(features)for(const [key,fields] of Object.entries(maps))if(features[key]?.used===false){code=code.replace(new RegExp('\\\\bmaterial\\\\.'+key+'\\\\b','g'),'0.0');for(const field of fields)code=code.replace(new RegExp('\\\\bmaterial\\\\.'+field+'\\\\b','g'),'-1');}
 if(${allTextures})for(const [key,info] of Object.entries(globalThis.__furnishMaterialAudit?.textures||{}))if(info.used===false)code=code.replace(new RegExp('\\\\bmaterial\\\\.'+key+'\\\\b','g'),'-1');
 if(features?.anisotropy?.used===false)code=code.replace(/\\bmaterial\\.anisotropyRotation\\b/g,'0.0');
 return wgslFn(code,...includes);
}
function sceneTransmissionTag(strings,...values){const flags=globalThis.__furnishMaterialAudit?.features;const parts=Array.from(strings,s=>flags?.iridescence?.used===false?s.replace(/\\bsurf\\.iridescence\\b/g,'0.0'):s);parts.raw=parts;return wgslTagFn(parts,...values);}
`;
 return source.replace('export const getSurfaceRecordFunc',wrapper+'\nexport const getSurfaceRecordFunc').replace('=> wgslFn( /* wgsl */','=> sceneSurfaceFn( /* wgsl */').replaceAll('=> wgslTagFn/* wgsl */','=> sceneTransmissionTag/* wgsl */');
}
function transformKernel(source){
 const wrapper=`
function sceneKernelTag(strings,...values){const flags=globalThis.__furnishMaterialAudit?.features;const parts=Array.from(strings,s=>flags?.dispersion?.used===false?s.replace(/\\bmaterialInfo\\.dispersion\\b/g,'0.0'):s);parts.raw=parts;return wgslTagFn(parts,...values);}
`;
 return source.replace('export class MaterialKernel',wrapper+'\nexport class MaterialKernel').replace('const fn = wgslTagFn','const fn = sceneKernelTag');
}
function replace(s,a,b){assert(s.includes(a),'Pinned lighting patch anchor missing: '+a.slice(0,80));return s.replace(a,b);}
function surfaceVisibility(source){
 const shadowFlag="const skipShadowObject = bool( false ).toVar( 'bvh_skipShadowObject' );";
 const range='fn intersectRange( ray: ${ rayStruct }, offset: u32, count: u32, result: ptr<function, ${ intersectionResultStruct }> ) -> bool {';
 const shadowCull='${ skipShadowObject } = ${ isShadowRay } && object.visibleToShadowRays == 0u;';
 const shadowSlot='transformBufferU32[ writeOffset * this.structs.transform.getLength() + 34 ] = info.object.visibleToShadowRays === false ? 0 : 1;';
 source=replace(source,"_alignment0: 'uint',","visibleToSurfaceRays: 'uint',");
 source=replace(source,shadowFlag,shadowFlag+"\n\t\tconst skipSurfaceObject = bool( false ).toVar( 'bvh_skipSurfaceObject' );");
 source=replace(source,range,range+'\n\n\t\t\t\t\tif ( ${ skipSurfaceObject } ) { return false; }');
 source=replace(source,shadowCull,shadowCull+'\n\t\t\t\t\t${ skipSurfaceObject } = ! ${ isShadowRay } && object.visibleToSurfaceRays == 0u;');
 return replace(source,shadowSlot,shadowSlot+'\n\t\ttransformBufferU32[ writeOffset * this.structs.transform.getLength() + 35 ] = info.object.visibleToSurfaceRays === false ? 0 : 1;');
}
function mediumKernel(source,material){
 const edits=material?[
  ['let segmentInMedium = medium.inside;','let segmentInMedium = false;'],
  ['input.walkPending == 0u','true'],
  ['if ( scatterRec.isTransmissive && ! surface.thinWall && input.side > 0.0 )','if ( false )'],
  ['if ( segmentInMedium || medium.inside )','if ( false )'],
  ['if ( ! isTerminated && medium.inside )','if ( false )'],
 ]:[['let isWalking = ! isTerminated && input.walkPending != 0u;','let isWalking = false;'],['input.mediumScattered == 0u','true']];
 for(const [anchor]of edits)assert(source.includes(anchor),'Pinned medium anchor missing: '+anchor);
 const tag=`const furnishMediumTag=(strings,...values)=>{if(globalThis.FurnishPathTracerFeatures?.noScatter){const parts=Array.from(strings,s=>{${edits.map(([a,b])=>'s=s.replaceAll('+JSON.stringify(a)+','+JSON.stringify(b)+');').join('')}return s.replaceAll('input.subsurfaceBounces','0u');});parts.raw=parts;return wgslTagFn(parts,...values);}return wgslTagFn(strings,...values);};\n\t\tconst fn = furnishMediumTag`;
 return replace(source,'const fn = wgslTagFn',tag);
}
function apply(name,source){
 const prefix='three-gpu-pathtracer/src/webgpu/',file=name.startsWith(prefix)?name.slice(prefix.length):name;
 if(!PINS[file])return source;
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),PINS[file],'Pinned lighting source changed: '+file);
 if(file==='nodes/material.wgsl.js')source=transformSurface(source,true);
 if(file==='nodes/PathtracerBVHComputeData.js')source=surfaceVisibility(source);
 if(file==='materials/GltfCompliantMaterial.js')source=transformMaterial(source);
 if(file==='compute/wavefront/MaterialKernel.js'){
  source=mediumKernel(source,true).replaceAll('return wgslTagFn(','return sceneKernelTag(');
  source=transformKernel(source);
 }
 if(file==='compute/wavefront/LogicKernel.js'){
  source=mediumKernel(source,false);
  source=replace(source,"outputTarget: textureStore( createOutputTarget() ).toWriteOnly()","outputTarget: globalThis.FurnishPathTracerFeatures?.inPlaceOutput ? textureStore( createOutputTarget() ).toReadWrite() : textureStore( createOutputTarget() ).toWriteOnly()");
  source=replace(source,'const fn = furnishMediumTag','const accumulationTarget=globalThis.FurnishPathTracerFeatures?.inPlaceOutput?params.outputTarget:params.prevOutputTarget;\n\t\tconst fn = furnishMediumTag');
  source=replace(source,'textureLoad( ${ params.prevOutputTarget }, colorIndex )','textureLoad( ${ accumulationTarget }, colorIndex )');
 }
 if(file==='WaveFrontPathTracer.js'){
  source=replace(source,'renderer.copyTextureToTexture( this.outputTarget, this.prevOutputTarget );','if(!globalThis.FurnishPathTracerFeatures?.inPlaceOutput){\n\t\t\t\t renderer.copyTextureToTexture( this.outputTarget, this.prevOutputTarget );');
  source=replace(source,'[ this.outputTarget, this.prevOutputTarget ] = [ this.prevOutputTarget, this.outputTarget ];','[ this.outputTarget, this.prevOutputTarget ] = [ this.prevOutputTarget, this.outputTarget ];\n\t\t\t\t}');
  source=replace(source,'// Step 5: walk the paths inside media for a capped number of steps','if(!globalThis.FurnishPathTracerFeatures?.noScatter){\n\t\t\t\t// Step 5: walk the paths inside media for a capped number of steps');
  source=replace(source,'this.dispatch( mediumKernel, mediumDispatchConverter.outputDispatch );','this.dispatch( mediumKernel, mediumDispatchConverter.outputDispatch );\n\t\t\t\t}');
 }
 return source.replaceAll('globalThis.__furnishMaterialAudit','globalThis.FurnishPathTracerFeatures');
}
module.exports={VERSION,PINS,apply,transformMaterial,transformSurface,transformKernel};
