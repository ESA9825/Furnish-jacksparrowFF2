/* Local observation policy only: no project state, geometry, exposure or light edits. */
(function(root){'use strict';
const rounded=a=>Array.from(a,n=>Math.round(n*1e8)/1e8);
function cameraKey(camera){return JSON.stringify([rounded(camera.matrixWorld),rounded(camera.projectionMatrix)]);}
// Preserve the editor's complete projection, including off-axis terms. Only
// convert clip-space depth from WebGL [-w,w] to WebGPU [0,w].
function projectionMatrix(elements,webGPU=false){if(!Array.isArray(elements)||elements.length!==16||!elements.every(Number.isFinite))throw Error('Invalid progressive projection');const p=elements.slice();if(webGPU)for(let i=2;i<16;i+=4)p[i]=(p[i]+p[i+1])*.5;return p;}
function materialFeatures(scene){
 const definitions={clearcoat:['clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap'],sheen:['sheenColorMap','sheenRoughnessMap'],iridescence:['iridescenceMap','iridescenceThicknessMap'],anisotropy:['anisotropyMap'],transmission:['transmissionMap'],dispersion:[]};
 const materials=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m)materials.add(m);});
 const extras={anisotropy:['anisotropyRotation'],iridescence:['iridescenceIor','iridescenceThicknessRange'],sheen:['sheenColor','sheenRoughness']};
 const features={};for(const [key,maps] of Object.entries(definitions)){let positive=0,textures=0,unknown=0,max=0;for(const m of materials){const x=key in m?m[key]:0;if(typeof x!=='number'||!Number.isFinite(x)||x<0)unknown++;else{max=Math.max(max,x);if(x>0)positive++;}if(maps.some(k=>m[k]))textures++;for(const field of extras[key]||[]){if(!(field in m))continue;const value=m[field],a=Array.isArray(value)?value:value?.isColor?[value.r,value.g,value.b]:[value];if(a.some(x=>typeof x!=='number'||!Number.isFinite(x))||field==='iridescenceThicknessRange'&&a.length!==2||field==='sheenColor'&&!value?.isColor)unknown++;}}features[key]={used:positive>0||textures>0||unknown>0,positive,textures,unknown,max};}
 const textureFields=['map','normalMap','bumpMap','roughnessMap','metalnessMap','emissiveMap','transmissionMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','sheenColorMap','sheenRoughnessMap','iridescenceMap','iridescenceThicknessMap','specularColorMap','specularIntensityMap','anisotropyMap','alphaMap'];const textures={};for(const key of textureFields){let count=0;for(const m of materials)if(m[key])count++;textures[key]={used:count>0,count};}
 let noScatter=true;for(const m of materials)if('scatterStrength' in m&&m.scatterStrength!==0||m.fogVolume)noScatter=false;return {materials:materials.size,features,textures,noScatter};
}
function size(aspect,edge=1200){if(!Number.isFinite(aspect)||aspect<.1||aspect>10)throw Error('Invalid progressive viewport');return aspect>=1?{width:edge,height:Math.max(1,Math.round(edge/aspect))}:{width:Math.max(1,Math.round(edge*aspect)),height:edge};}
// Measure only a settled view after compilation; the first slow scene build is not a GPU benchmark.
function quality(mode){return mode==='detail'?{edge:1200,samples:256}:{edge:800,samples:64};}
function performancePolicy(mode){let start=null,slow=0,edge=quality(mode).edge;return {reset(){start=null;slow=0;},sample({now,samples,frameTime}){if(start===null&&samples<1)return {action:'keep',edge};if(start===null){start={now,samples};return {action:'keep',edge};}const seconds=(now-start.now)/1000,rate=(samples-start.samples)/Math.max(.001,seconds);slow=Number.isFinite(frameTime)&&frameTime>100?slow+1:0;if(seconds<12||samples>=quality(mode).samples)return {action:'keep',edge};if(rate<.25||slow>=4){start={now,samples};slow=0;if(edge>640){edge=640;return {action:'reduce',edge,rate};}return {action:'fallback',edge,rate};}return {action:'keep',edge};}};}
const api={cameraKey,projectionMatrix,materialFeatures,size,quality,performancePolicy};root.FurnishProgressivePolicy=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
