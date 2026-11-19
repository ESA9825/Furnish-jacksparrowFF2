/* Roof seats and rods reuse the Blender meshes; only the exposed wire length changes. */
(function(root){
'use strict';
function build(T,f){
 const products=root.FurnishProducts||require('../core/product-rules.js');
 const {asset:assetName}=products.definition(f).dryingRack;
 const asset=root[assetName]||(assetName==='FurnishHotataY024TwoMetreAsset'?
  require('../data/drying-rack-hotata-y024-2m-blender-asset.js'):require('../data/drying-rack-hotata-y024-blender-asset.js'));
 const loader=root.FurnishStaticAssetModel||require('./static-asset-model.js');
 const {bottom,drop}=products.dryingRackLayout(f);
 const group=loader.build(T,asset,{...f,h:asset.sizeMm[1]},bottom);
 for(const part of group.children){
  if(part.name.startsWith('ceiling-'))part.position.y+=drop/1000;
  if(part.name.startsWith('cable-')){
   const {positions}=asset.parts.find(p=>p.name===part.name);
   let lowerEnd=Infinity,upperEnd=-Infinity;
   for(let i=1;i<positions.length;i+=3){
    lowerEnd=Math.min(lowerEnd,positions[i]);upperEnd=Math.max(upperEnd,positions[i]);
   }
   part.scale.y=1+drop/1000/(upperEnd-lowerEnd);
   // The lower end travels with the rails while the wire extends to the seat.
   part.position.y-=lowerEnd*(part.scale.y-1);
  }
 }
 return group;
}
const api={build};
if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishDryingRackModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
