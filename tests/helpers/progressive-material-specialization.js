'use strict';
// The audit runs on the actual imported preview materials, including off-camera ones.
const audit=`
function auditMaterialFeatures(scene){
 const definitions={clearcoat:['clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap'],sheen:['sheenColorMap','sheenRoughnessMap'],iridescence:['iridescenceMap','iridescenceThicknessMap'],anisotropy:['anisotropyMap'],transmission:['transmissionMap'],dispersion:[]};
 const materials=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m)materials.add(m);});
 const extras={anisotropy:['anisotropyRotation'],iridescence:['iridescenceIor','iridescenceThicknessRange'],sheen:['sheenColor','sheenRoughness']};
 const features={};for(const [key,maps] of Object.entries(definitions)){let positive=0,textures=0,unknown=0,max=0;for(const m of materials){const x=m[key]===undefined?0:m[key];if(typeof x!=='number'||!Number.isFinite(x)||x<0)unknown++;else{max=Math.max(max,x);if(x>0)positive++;}if(maps.some(k=>m[k]))textures++;for(const field of extras[key]||[]){const value=m[field];if(value===undefined)continue;const a=Array.isArray(value)?value:value?.isColor?[value.r,value.g,value.b]:[value];if(a.some(x=>typeof x!=='number'||!Number.isFinite(x)))unknown++;}}features[key]={used:positive>0||textures>0||unknown>0,positive,textures,unknown,max};}
 const textureFields=['map','normalMap','bumpMap','roughnessMap','metalnessMap','emissiveMap','transmissionMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','sheenColorMap','sheenRoughnessMap','iridescenceMap','iridescenceThicknessMap','specularColorMap','specularIntensityMap','anisotropyMap','alphaMap'];const textures={};for(const key of textureFields){let count=0;for(const m of materials)if(m[key])count++;textures[key]={used:count>0,count};}
 return {materials:materials.size,features,textures};
}
`;
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
module.exports={audit,transformMaterial};

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
module.exports.transformSurface=transformSurface;
module.exports.transformKernel=transformKernel;
