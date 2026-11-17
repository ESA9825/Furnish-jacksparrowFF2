'use strict';
module.exports=async(p,V)=>{
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),baseline=process.env.FURNISH_SWITCH_BASELINE==='1',samples=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 // Start from the actual formal workspace in the private desktop copy.
 await p.evaluate(()=>{
  const original=JSON.parse(snap());
  FurnishDesign.preserveCurrentDesign(store,PLAN.id,original);
  store.designs=FurnishDesign.manageDesign(store.designs,PLAN.id,'create',{name:'切换性能验收 B',work:{...original,designNote:'independent B'},editable:true});
  window.switchFixture={a:FurnishDesign.activeDesign(store,PLAN.id).id,b:store.designs.at(-1).id,original};
  save();renderDesigns();
  const oldSave=save,oldReplan=View3D.replan;
  window.switchMetrics={saves:0,replans:0};
  save=function(...args){switchMetrics.saves++;return oldSave(...args);};
  View3D.replan=(...args)=>{switchMetrics.replans++;return oldReplan(...args);};
 });
 const switchTo=async(key,mode)=>{
  const id=await p.evaluate(key=>switchFixture[key],key);
  const result=await p.evaluate(id=>{
   const select=$('#design-select');window.switchMetrics.saves=window.switchMetrics.replans=0;
   const start=performance.now();select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));
   return {ms:performance.now()-start,...switchMetrics,retained:select===$('#design-select'),selected:$('#design-select').value,active:FurnishDesign.activeDesign(store,PLAN.id).id,note:state.designNote,undo:undoStack.length,redo:redoStack.length};
  },id);
  assert.equal(result.active,id);assert.equal(result.selected,id);assert.equal(result.undo,0);assert.equal(result.redo,0);
  if(!baseline){if(mode!=='unbound')assert(result.retained,'native selector must survive selection changes');assert.equal(result.saves,1,'one workspace save per switch');assert.equal(result.replans,1,'one scene reset per switch');}
  samples.push({mode,target:key,...result});
 };
 for(const key of ['b','a','b','a'])await switchTo(key,'2d');
 await p.locator('[data-view="3d"]').click();await p.waitForFunction(()=>is3D()&&!switching);await p.evaluate(()=>View3D.automationReady());
 for(const key of ['b','a']){await switchTo(key,'3d');await p.evaluate(()=>View3D.automationReady());}
 await V.screenshot('switch-3d');
 await p.locator('[data-view="2d"]').click();await p.waitForFunction(()=>!is3D()&&!switching);
 await p.setViewportSize({width:390,height:850});await switchTo('b','narrow');await V.screenshot('switch-narrow');
 if(!baseline){
  // Exercise the actual select control after repeated programmatic switches.
  for(const key of ['a','b','a','b']){
   const id=await p.evaluate(key=>switchFixture[key],key);
   await p.locator('#design-select').selectOption(id);
   assert.equal(await p.locator('#design-select').inputValue(),id);
   assert.equal(await p.evaluate(()=>FurnishDesign.activeDesign(store,PLAN.id).id),id);
  }
  await p.evaluate(()=>{ui.mA='test';});
  const rejected=await p.evaluate(()=>{const select=$('#design-select');select.value=switchFixture.a;select.dispatchEvent(new Event('change'));return {selected:select.value,active:FurnishDesign.activeDesign(store,PLAN.id).id,b:switchFixture.b};});
  assert.equal(rejected.selected,rejected.b);assert.equal(rejected.active,rejected.b);await p.evaluate(()=>{ui.mA=null;});
  await p.evaluate(()=>mutate(()=>state.designNote='B edited after switch'));
  await p.evaluate(()=>undo());assert.equal(await p.evaluate(()=>state.designNote),'independent B');
  await p.evaluate(()=>redo());assert.equal(await p.evaluate(()=>state.designNote),'B edited after switch');
  await switchTo('a','edited');assert.equal(await p.evaluate(()=>state.designNote),await p.evaluate(()=>switchFixture.original.designNote));
  await switchTo('b','edited');assert.equal(await p.evaluate(()=>state.designNote),'B edited after switch');
  assert(await p.evaluate(()=>hist.some(h=>h.reason==='切换方案前'&&h.data.designNote==='B edited after switch')),'outgoing work has a recovery point');
  // An unbound current layout must also survive its first design switch.
  await p.evaluate(()=>{delete store.activeDesigns[PLAN.id];mutate(()=>state.designNote='unbound current layout');renderDesignBar();});
  await switchTo('a','unbound');
  assert(await p.evaluate(()=>store.designs.some(d=>d.editable&&d.work.designNote==='unbound current layout')));
  await switchTo('b','unbound');assert.equal(await p.evaluate(()=>state.designNote),'B edited after switch');
 }
 if(V.mode==='desktop'){
  await p.evaluate(()=>FurnishRepository.flush());await p.reload();await p.waitForFunction(()=>!repositoryBooting);
  assert.equal(await p.evaluate(()=>$('#design-select').value),await p.evaluate(()=>FurnishDesign.activeDesign(store,PLAN.id).id));
  assert.equal(await p.evaluate(()=>state.designNote),baseline?'independent B':'B edited after switch');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(V.artifact(V.mode+'-timings.json'),JSON.stringify(samples,null,2));
 return {passed:true,baseline,samples,checks:['2D / 3D / narrow selector matches active design','independent work, rejected switch rollback, undo boundaries and saved reload']};
};
