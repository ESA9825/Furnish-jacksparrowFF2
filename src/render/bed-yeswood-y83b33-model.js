/* Y83B33 storage bed in its closed display position. */
(function(root){
'use strict';
const products=()=>root.FurnishProducts||require('../core/product-rules.js');
const supported=f=>(products().family(f,'yeswood-storage-bed')||products().family(f,'yeswood-bed-linen'))&&!f.obj;
function build(T,f){
 const P=products();
 const {bedAsset='bed-yeswood-y83b33',assetGlobal='FurnishY83B33BlenderAsset'}=P.definition(f);
 const asset=root[assetGlobal]||(typeof require==='function'?require('../data/'+bedAsset+'-blender-asset.js'):null);
 const model=root.FurnishStaticAssetModel||require('./static-asset-model.js');
 const bed=model.build(T,asset,{...f,h:P.height(f)},P.value(f,'mountHeight'));
 const surfaces=root.FurnishCabinetModel||require('./cabinet-model.js');
 if(T.Texture&&P.family(f,'yeswood-storage-bed')){
  const wood=bed.children.filter(o=>/^(?:Oak|Rounded oak|Recessed shelf rear|Wood headboard)/.test(o.name));
  surfaces.applyWoodVeneer(T,wood,'white-oak-veneer',f.color||'#fff0db');
 }else if(T.LinearMipmapLinearFilter&&P.family(f,'yeswood-bed-linen')){
  const cloth=root.FurnishBasicFurnitureModel||require('./basic-furniture-model.js');
  for(const mesh of bed.children){
   const material=mesh.material;
   mesh.material=cloth.bedCloth(T,material.color);
   mesh.material.roughness=material.roughness;
   material.dispose();
   surfaces.projectSurfaceUV(T,mesh.geometry,{sampleWidthMm:9,grainAxis:'v'});
  }
 }
 return bed;
}
const api={supported,build};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishYeswoodBedModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
