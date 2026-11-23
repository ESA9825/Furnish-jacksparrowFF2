'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),P=require('../src/core/project-core.js');
const plan={rooms:[{id:'r',name:'room',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]}],walls:[[0,0,100,3000,'n']],doors:[]},item={id:'a',type:'block',name:'block',cx:1000,cy:1500,w:400,d:400,h:500,rot:0,mountHeight:0};
for(const threshold of [799,800,801])for(const patch of [{},{rot:37,flip:true},{mountHeight:501},{h:undefined,mountHeight:undefined}]){
 const work={furniture:[{...item,...patch},{...item,id:'b',cx:1300}],spaceThreshold:threshold,spaceIgnored:[]},before=JSON.stringify(work),steps=P.reviewSteps(plan,work);let step,n=0;do{step=steps.next();n++;}while(!step.done);assert(n>2,'review yields before completing');
 assert.deepEqual(step.value,P.spaceCheck(plan,work.furniture,{passage:threshold}).map(v=>({...v,ignored:false})),'incremental review retains all findings and their order');assert.equal(JSON.stringify(work),before);
 const partial=P.reviewSteps(plan,{...work,spaceThreshold:threshold+1});partial.next();partial.return();assert.deepEqual(P.review(plan,work),step.value,'abandoned review does not poison completed cache');
}
// Exercise the production scheduler with controlled time and a long review.
const code=fs.readFileSync(require.resolve('../src/ui/workflow-tools.js'),'utf8'),fn=code.slice(code.indexOf('function afterRender(){'),code.indexOf('function initialize(){',code.indexOf('function afterRender(){')));
let clock=0,id=0;const timers=new Map(),published=[],ctx={state:{revision:1},ui:{sel:{kind:'furn'}},drag:null,pinch:null,checkGeneration:0,checkTimer:0,checkKey:'',checking:false,issues:[],performance:{now:()=>clock},styleId(){},effective:()=>({revision:ctx.state.revision}),checkSignature:p=>String(p.revision),syncBadge:()=>{if(!ctx.checking)published.push(ctx.issues);},reviewPanelOpen:()=>false,$:()=>({remove(){},textContent:''}),t:v=>v,setTimeout:cb=>{timers.set(++id,cb);return id;},clearTimeout:key=>timers.delete(key),P:{*reviewSteps(p){for(let i=0;i<10;i++){clock+=5;yield;}return [{revision:p.revision}];}}};vm.createContext(ctx);vm.runInContext(fn,ctx);
const tick=()=>{const entry=timers.entries().next().value;assert(entry);timers.delete(entry[0]);entry[1]();};
ctx.afterRender();tick();assert(timers.size);assert.equal(published.length,0,'partial results are not published');ctx.drag={kind:'move'};tick();assert.equal(published.length,0,'gesture suspends review');ctx.state.revision=2;ctx.afterRender();ctx.drag=null;while(timers.size)tick();assert.deepEqual(published,[[{revision:2}]],'only newest render may publish');assert.equal(ctx.checkKey,'2');assert.equal(ctx.checking,false);
let interacting=true;
ctx.View3D={interacting:()=>interacting};
ctx.state.revision=3;ctx.afterRender();
const start=clock;
for(let i=0;i<9;i++)tick();
assert.equal(clock,start,'automatic review does no geometry work during a 3D gesture');
interacting=false;tick();assert(clock>start,'review starts again after release');
interacting=true;
const interrupted=clock;tick();assert.equal(clock,interrupted,'3D gesture also interrupts a running review');
interacting=false;while(timers.size)tick();
assert.deepEqual(published,[[{revision:2}],[{revision:3}]],'the final result is published once after release');
console.log('PASS incremental spatial findings, thresholds/unknown height/rotation/mirror, input immutability, abandoned cache, 2D/3D gesture cancellation and newest-result publication');
