/* Material-preserving display for three existing custom OBJ products. */
(function(root){
'use strict';
const assets=new Map([
 ['MJJYSH01YM','FurnishMijiaKettleAsset'],
 ['KL65-V573','FurnishJoyoungV573Asset'],
 ['LR-D3027S','FurnishLivenD3027SAsset'],
]);
function asset(f){
 if(f.type!=='custom'||!f.obj?.positions?.length)return null;
 const key=assets.get(f.model),source=key&&root[key];
 return source&&source.product.brand===f.brand&&source.product.sourceUrl===f.sourceUrl?source:null;
}
function build(T,source,f){
 return root.FurnishStaticAssetModel.build(T,source,{...f,h:f.h||800},0,root.FurnishModelPrimitives.createMaterial);
}
root.FurnishKitchenCountertopApplianceModel={asset,build};
})(typeof globalThis!=='undefined'?globalThis:this);
