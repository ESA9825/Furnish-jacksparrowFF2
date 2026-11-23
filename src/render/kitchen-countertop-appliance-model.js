/* Shared production models for built-in countertop items and matching legacy OBJ placements. */
(function(root){
'use strict';
const products=root.FurnishProducts||require('../core/product-rules.js');
const byModel=new Map(Object.values(products.types).filter(r=>r.countertop).map(r=>[r.identity.model,r.countertop]));
const profile=f=>!f.obj&&products.definition(f)?.countertop;
const load=p=>root[p.assetGlobal]||(typeof require==='function'?require('../data/'+p.asset+'-blender-asset.js'):null);
function asset(f){
 const builtIn=profile(f);
 if(builtIn)return load(builtIn);
 if(f.type!=='custom'||!f.obj?.positions?.length)return null;
 const legacy=byModel.get(f.model),source=legacy&&load(legacy);
 return source&&source.product.brand===f.brand&&source.product.sourceUrl===f.sourceUrl?source:null;
}
const supported=f=>!!(profile(f)||asset(f));
function build(T,f,{material}={}){
 const builtIn=profile(f),source=asset(f);
 if(!source)throw Error('厨电或锅具模型未加载：'+f.type);
 const primitives=root.FurnishModelPrimitives||require('./model-primitives.js');
 const staticModel=root.FurnishStaticAssetModel||require('./static-asset-model.js');
 const createMaterial=material?(_T,color,finish)=>material(color,finish):primitives.createMaterial;
 const model=staticModel.build(T,source,{...f,h:builtIn?products.height(f):f.h||800},builtIn?products.value(f,'mountHeight'):0,createMaterial);
 if(!builtIn?.reverse)return model;
 const group=new T.Group();
 group.userData.furnishAsset=model.userData.furnishAsset;
 model.rotation.y=Math.PI;
 group.add(model);
 return group;
}
const api={asset,supported,build};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishKitchenCountertopApplianceModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
