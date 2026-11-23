/* The offline mesh supplies both the production display and the numeric solid recorder. */
(function(root){
'use strict';
function build(T,f,{material}={}){
 const P=root.FurnishProducts||require('../core/product-rules.js');
 const asset=root.FurnishBullGB50KAsset||require('../data/track-socket-bull-gb50k-blender-asset.js');
 const model=root.FurnishStaticAssetModel||require('./static-asset-model.js');
 const createMaterial=material?(_T,color,finish)=>{
  // Receive the room environment on metal and exposed moulded surfaces.
  const reflection=finish.metalness>0?1.25:finish.roughness<=.50?.65:undefined;
  return material(color,finish,reflection);
 }:undefined;
 const group=model.build(T,asset,{...f,h:P.height(f)},P.bottomHeight(f),createMaterial);
 if(material)for(const part of group.children)part.userData.ceilingOwnMaterial=false; // Renderer material cache.
 return group;
}
const api={build};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishBullGB50KModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
