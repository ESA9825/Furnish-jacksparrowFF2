/* Extract current production functions without coupling fixtures to parameter defaults. */
'use strict';
const vm=require('node:vm');
function betweenFunctions(source,start,end){
 const marker=name=>new RegExp('^function '+name+'\\(', 'm').exec(source),a=marker(start),b=marker(end);
 if(!a||!b||b.index<=a.index)throw Error('Missing production source range: '+start+' → '+end);
 return source.slice(a.index,b.index);
}
function loadSceneFurniture(html,context,end='buildHeaterClearances'){
 context.FurnishDrawing??=require('../../src/core/drawing-core.js');
 context.FurnishLighting??=require('../../src/core/lighting-core.js');
 context.opt={hour:10,night:false,...context.opt};
 vm.runInContext(betweenFunctions(html,'sceneSun','applyLight')+betweenFunctions(html,'buildFurn',end),context);
}
function createModelContext(globals){
 return vm.createContext({FurnishProducts:require('../../src/core/product-rules.js'),...globals});
}
module.exports={betweenFunctions,loadSceneFurniture,createModelContext};
