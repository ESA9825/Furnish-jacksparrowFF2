/* Shared browser / Node module; no DOM or application state dependencies. */
(function(root){
'use strict';
const STYLES = [
  {id:'warm-walnut', zh:'暖白＋胡桃木', en:'Warm White & Walnut', soft:'#e5ddd0', wood:'#f3f0e8', textile:'#e8e0d3', pop:'#798368', floor:['tile800','wood'], furnitureWood:'#765239',frame:'#615b52',bay:'#eee8df',floorColor:'#dfd4c2',sheer:'#f4f0e7', cabinet:{bodyColor:'#765239',frontColor:'#f3f0e8',bodySurface:'walnut'}, description:'暖白柜门 · 胡桃木柜身与开放格'},
  {id:'natural', frame:'#746e63',bay:'#eee5d8',floorColor:'#d6b58a',sheer:'#f4efe6', zh:'原木', en:'Natural Oak', soft:'#cdbfa8', wood:'#d9bf98', textile:'#e7dccd', pop:'#9db08a', floor:['wood', 'wood']},
  {id:'cream', frame:'#a3998c',bay:'#f0e9dd',floorColor:'#e8dfd1',sheer:'#f7f1e7', zh:'奶油', en:'Cream', soft:'#efe3cf', wood:'#e8dcc6', textile:'#f5ecdc', pop:'#d9b99a', floor:['tile800', 'wood']},
  {id:'nordic', frame:'#66727a',bay:'#e9e9e3',floorColor:'#d9cfbc',sheer:'#f4f5f1', zh:'北欧', en:'Nordic', soft:'#c9d3da', wood:'#e2d3bc', textile:'#dfe6ea', pop:'#8fa8ba', floor:['wood', 'wood']},
  {id:'industrial', frame:'#414144',bay:'#bdb7ae',floorColor:'#a6a19b',sheer:'#d7d7d3', zh:'工业', en:'Industrial', soft:'#6b6b6e', wood:'#8a6f5a', textile:'#7b7f84', pop:'#c0623a', floor:['terrazzo', 'walnut']},
  {id:'chinese', frame:'#594b3d',bay:'#e9e2d4',floorColor:'#bda083',sheer:'#f1ebde', zh:'新中式', en:'New Chinese', soft:'#c2ae93', wood:'#6b4f3a', textile:'#e8dfc8', pop:'#8a3b2e', floor:['marble', 'walnut']},
  {id:'morandi', frame:'#707a75',bay:'#e5e1db',floorColor:'#d3cec4',sheer:'#efece6', zh:'莫兰迪', en:'Morandi', soft:'#a3b1a8', wood:'#cbbfb2', textile:'#c4b8c9', pop:'#b8a0a0', floor:['tile800', 'carpet']},
];

const api=STYLES;
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishStylePresets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
