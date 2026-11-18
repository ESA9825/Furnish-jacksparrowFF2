/* Style rules share the existing room semantics without depending on the UI. */
(function(root){
'use strict';
const inNode = typeof module === 'object' && module.exports;
const presets = inNode ? require('../data/style-presets.js') : root.FurnishStylePresets;
const design = inNode ? require('./design-core.js') : root.FurnishDesign;
const products=()=>root.FurnishProducts||(inNode?require('./product-rules.js'):null);
const cabinet=()=>root.FurnishCabinet||(inNode?require('./cabinet-core.js'):null);
const copy=v=>JSON.parse(JSON.stringify(v));
const validColor=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);

function find(id) { return presets.find(style => style.id === id); }
function palette(id,overrides={}){const s=find(id);if(!s)return null;const values={front:s.cabinet?.frontColor??s.soft,body:s.cabinet?.bodyColor??s.wood,soft:s.soft,wood:s.furnitureWood??s.cabinet?.bodyColor??s.wood,textile:s.textile,sheer:s.sheer??'#f4f1e9',pop:s.pop,frame:s.frame??'#5d6166',bay:s.bay??'#eee8df',floor:s.floorColor??'#dfd7c9'};for(const [k,v]of Object.entries(overrides)){if(!products().styleAppearance.palette.includes(k)||!validColor(v))throw Error('风格配色无效');values[k]=v;}return values;}
function category(f){if(!f||f.obj)return null;if(f.kitchen||cabinet()?.supported(f))return 'cabinet';const role=products().styleRole(f);return role==='frame'?'frames':products().family(f,'window-covering')?'curtains':role?'furniture':null;}
function color(f,id,overrides={}){const p=palette(id,overrides);if(!p)return f.color;const role=products().styleRole(f);return category(f)==='cabinet'?p.front:role?p[role]:f.color;}
function furniture(f,id,overrides={},bodySurface){
 const style=find(id);if(!style)return f;
 const next={...f,color:color(f,id,overrides)},C=root.FurnishCabinet||(inNode?require('./cabinet-core.js'):null);
 if(!f.obj&&(f.kitchen||C?.supported(f))){
  const key=f.kitchen?'kitchen':'cabinet',config=f[key]||(C?.config(f));
  if(config){const p=palette(id,overrides),appearance={...config.appearance,bodyColor:p.body,frontColor:p.front,bodySurface:bodySurface??style.cabinet?.bodySurface??'solid'};next.color=appearance.frontColor;next[key]={...config,...(config.version===3?{bodyColor:appearance.bodyColor}:{}),appearance};}
 }
 return next;
}
function applyCabinets(work,id,overrides={},bodySurface){if(!find(id))return null;work.furniture=work.furniture.map(f=>{const next=furniture(f,id,overrides,bodySurface);return next.cabinet?.appearance||next.kitchen?.appearance?next:f;});work.style=id;return find(id);}
function applyColors(work,id,overrides={},bodySurface){if(!find(id))return null;work.furniture=work.furniture.map(f=>furniture(f,id,overrides,bodySurface));work.style=id;return find(id);}
function validateAppearance(value){
 if(value===undefined)return;const r=products().styleAppearance;if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||Object.keys(value).some(k=>!['version',...r.surfaces.flatMap(k=>[k+'Color',k+'Overrides'])].includes(k)))throw Error('风格表面配色无效');
 for(const k of r.surfaces){if(value[k+'Color']!==undefined&&!validColor(value[k+'Color']))throw Error('风格颜色须为六位HEX');const rows=value[k+'Overrides'];if(rows!==undefined&&(!rows||typeof rows!=='object'||Array.isArray(rows)||Object.keys(rows).length>1000||Object.entries(rows).some(([id,c])=>!id||id.length>500||!validColor(c))))throw Error('局部表面配色无效');}
}
function surfaceColor(work,kind,id){const a=work?.styleAppearance;const overrides=a?.[kind+'Overrides'];return overrides&&Object.hasOwn(overrides,id)?overrides[id]:a?.[kind+'Color'];}
function frameKey(plan,index){return plan.winRefs?.[index]??'window:'+index;}
function editSurface(work,kind,id,value){if(!products().styleAppearance.surfaces.includes(kind)||typeof id!=='string'||!id||value!==undefined&&!validColor(value))throw Error('表面配色无效');validateAppearance(work.styleAppearance);work.styleAppearance??={version:1};const a=work.styleAppearance,key=kind+'Overrides';if(value===undefined){if(a[key]){delete a[key][id];if(!Object.keys(a[key]).length)delete a[key];}}else Object.defineProperty(a[key]??={},id,{value,enumerable:true,configurable:true,writable:true});if(Object.keys(a).length===1)delete work.styleAppearance;}
function options(value={}){const scopes=value.scopes??['cabinet'];if(!Array.isArray(scopes)||new Set(scopes).size!==scopes.length||scopes.some(k=>!products().styleAppearance.scopes.includes(k)))throw Error('风格应用范围无效');if(value.bodySurface!==undefined&&!products().cabinetAppearance.surfaces.includes(value.bodySurface))throw Error('柜身饰面无效');return {scopes:[...scopes],palette:{...(value.palette||{})},...(value.bodySurface===undefined?{}:{bodySurface:value.bodySurface})};}
function applySelected(work,rooms,id,value={}){
 if(!find(id))return null;const o=options(value),p=palette(id,o.palette);validateAppearance(work.styleAppearance);if(!o.scopes.length)return find(id);
 work.furniture=work.furniture.map(f=>o.scopes.includes(category(f))?furniture(f,id,o.palette,o.bodySurface):f);
 for(const [scope,kind]of [['frames','frame'],['bays','bay'],['floors','floor']])if(o.scopes.includes(scope)){work.styleAppearance??={version:1};work.styleAppearance[kind+'Color']=p[kind];}
 work.style=id;return find(id);
}
function preview(work,rooms,id,value){const next=copy(work);applySelected(next,rooms,id,value);return next;}
// Legacy whole-style action explicitly replaces floor material as before.
function apply(work, rooms, id, custom = false, overrides={}, bodySurface) {
 const style=find(id);if(!style)return null;applySelected(work,rooms,id,{scopes:products().styleAppearance.scopes,palette:overrides,bodySurface});
 rooms.forEach(room=>{const material=design.styleFloor(room,work.rooms[room.id],style,custom);if(material)work.rooms[room.id].mat=material;});work.style=id;return style;
}
const api={find,apply,color,furniture,applyColors,applyCabinets,palette,category,validateAppearance,surfaceColor,frameKey,editSurface,options,applySelected,preview};
if(inNode)module.exports=api;else root.FurnishStyles=api;
})(typeof globalThis!=='undefined'?globalThis:this);
