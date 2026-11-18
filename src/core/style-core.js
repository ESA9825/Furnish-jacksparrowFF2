/* Style rules share the existing room semantics without depending on the UI. */
(function(root){
'use strict';
const inNode = typeof module === 'object' && module.exports;
const presets = inNode ? require('../data/style-presets.js') : root.FurnishStylePresets;
const design = inNode ? require('./design-core.js') : root.FurnishDesign;
const SOFT_T = new Set(['sofa','sofa_yeswood_cherry','cornersofa','beanbag','bed','baycushion','bench','chair','barstool','officechair']);
const WOOD_T = new Set(['wardrobe','cabinet','shoecab','dresser','desk','bookshelf','nightstand','coffeetable','tvstand','table','roundtable','sidetable','chest','crib']);

function find(id) { return presets.find(style => style.id === id); }
function color(f,id){
  const style=find(id);if(!style)return f.color;
  return f.type==='armchair'?style.pop:SOFT_T.has(f.type)?style.soft:WOOD_T.has(f.type)?style.wood:['rug','curtain'].includes(f.type)?style.textile:f.color;
}
function furniture(f,id){
 const style=find(id);if(!style)return f;
 const next={...f,color:color(f,id)},C=root.FurnishCabinet||(inNode?require('./cabinet-core.js'):null);
 if(!f.obj&&(f.kitchen||C?.supported(f))){
  const key=f.kitchen?'kitchen':'cabinet',config=f[key]||(C?.config(f));
  if(config){const appearance={...(style.cabinet||{bodyColor:style.wood,frontColor:style.soft,bodySurface:'solid'})};next.color=appearance.frontColor;next[key]={...config,...(config.version===3?{bodyColor:appearance.bodyColor}:{}),appearance};}
 }
 return next;
}
function applyCabinets(work,id){if(!find(id))return null;work.furniture=work.furniture.map(f=>{const next=furniture(f,id);return next.cabinet?.appearance||next.kitchen?.appearance?next:f;});work.style=id;return find(id);}
function applyColors(work,id){if(!find(id))return null;work.furniture=work.furniture.map(f=>furniture(f,id));work.style=id;return find(id);}
// The caller owns history and rendering. This function edits only style fields.
function apply(work, rooms, id, custom = false) {
  const style = find(id);
  if (!style) return null;
  applyColors(work,id);
  rooms.forEach(room => {
    const material = design.styleFloor(room, work.rooms[room.id], style, custom);
    if (material) work.rooms[room.id].mat = material;
  });
  work.style = id;
  return style;
}
const api = {find, apply, color, furniture, applyColors, applyCabinets};
if (inNode) module.exports = api;
else root.FurnishStyles = api;
})(typeof globalThis!=='undefined'?globalThis:this);
