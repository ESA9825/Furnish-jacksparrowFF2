/* Material-preserving display for known countertop products with custom OBJ placements. */
(function(root){
'use strict';
const assets=new Map([
 ['MJJYSH01YM','FurnishMijiaKettleAsset'],
 ['KL65-V573','FurnishJoyoungV573Asset'],
 ['LR-D3027S','FurnishLivenD3027SAsset'],
 ['F40H8093S','FurnishSuporF40H8093SAsset'],
 ['104.883.83','FurnishIkeaVardagenWokAsset'],
 ['404.842.51','FurnishIkea365SteamerPotAsset'],
 ['901.635.25','FurnishIkeaStabilSteamerAsset'],
]);
function asset(f){
 if(f.type!=='custom'||!f.obj?.positions?.length)return null;
 const key=assets.get(f.model),source=key&&root[key];
 return source&&source.product.brand===f.brand&&source.product.sourceUrl===f.sourceUrl?source:null;
}
function build(T,source,f,material){
 const createMaterial=material?(_T,color,finish)=>material(color,finish):root.FurnishModelPrimitives.createMaterial;
 return root.FurnishStaticAssetModel.build(T,source,{...f,h:f.h||800},0,createMaterial);
}
root.FurnishKitchenCountertopApplianceModel={asset,build};
})(typeof globalThis!=='undefined'?globalThis:this);
