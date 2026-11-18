/* The offline mesh supplies both the production display and the numeric solid recorder. */
(function(root){
'use strict';
function build(T,f){
 const P=root.FurnishProducts||require('../core/product-rules.js');
 const asset=root.FurnishBullGB50KAsset||require('../data/track-socket-bull-gb50k-blender-asset.js');
 const model=root.FurnishStaticAssetModel||require('./static-asset-model.js');
 return model.build(T,asset,{...f,h:P.height(f)},P.bottomHeight(f));
}
const api={build};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishBullGB50KModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
