'use strict';
const assert=require('node:assert/strict');
module.exports=async(p,V)=>{
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const setup=await p.evaluate(()=>{
  state.furniture=[];ui.sel=null;renderAll();
  const Q=FurnishWardrobeQuestionnaire,W=FurnishWardrobePlanner,answers=Object.fromEntries(Q.questions.map(q=>[q.id,{value:q.options?(q.type==='multi'?[]:null):['number','measurement'].includes(q.type)?null:'',note:'',...(q.type==='measurement'?{source:'unknown'}:{})}]));
  answers.caseName.value='导入候选测试';answers.location.value='指定区域';answers.shortCount.value=10;answers.longCount.value=0;answers.must.value='<img src=x onerror=alert(1)> 补充说明需人工复核';
  const answer={format:Q.SCHEMA,version:1,status:'complete',answers},plan=FurnishProject.effectivePlan(PLAN,state);
  for(const room of plan.rooms)for(const poly of room.polys||[room.poly]){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);for(const rot of [0,90])for(let x=Math.min(...xs)+950;x<Math.max(...xs)-300;x+=350)for(let y=Math.min(...ys)+350;y<Math.max(...ys)-300;y+=350){const area={cx:x,cy:y,w:1800,d:600,h:2200,mountHeight:0,rot,flip:false};if(!FurnishProject.fitsInRooms([room],FurnishProject.polygon(area)))continue;const result=W.generate(answer,area);if(W.assess(plan,state,result.candidates[0],'probe').blocking.length===0)return {answer,area,before:snap()};}}
  throw Error('No free fixture placement found');
 });
 await p.evaluate(()=>FurnishWardrobePlannerUI.open());
 await p.setInputFiles('[data-w-import]',{name:'answer.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(setup.answer))});
 await p.waitForFunction(()=>document.querySelector('[data-w-answer]').textContent.includes('导入候选测试'));
 for(const [k,v]of Object.entries(setup.area).filter(([k])=>k!=='flip'))await p.locator('[data-w-area="'+k+'"]').fill(String(v));
 await p.locator('[data-w-area="rot"]').dispatchEvent('change');
 await p.click('[data-w-generate]');await p.waitForSelector('[data-w-candidate]');await p.waitForSelector('[data-w-model] canvas');
 assert.equal(await p.locator('[data-w-candidate]').count(),3);assert.equal(await p.evaluate(()=>snap()),setup.before,'Generating does not mutate work');assert.equal(await p.locator('[data-w-answer] img').count(),0);
 const cards=await p.locator('[data-w-candidate]').allTextContents();assert.equal(new Set(cards).size,3);
 await p.click('[data-w-candidate="access"]');await p.waitForSelector('[data-w-model] canvas');await p.click('[data-w-oblique]');await p.click('[data-w-open]');
 await V.screenshot('questionnaire-candidates');
 await p.click('[data-w-use]');assert.match(await p.locator('[data-w-error]').innerText(),/先核对/);
 await p.click('[data-w-scene]');await p.waitForSelector('#wardrobe-scene-banner');assert.equal(await p.evaluate(()=>snap()),setup.before);assert(await p.evaluate(()=>!!FurnishWardrobePlannerUI.previewWork()));
 await p.waitForFunction(()=>!switching&&document.body.classList.contains('m3d'));await p.waitForSelector('#wardrobe-scene-banner[data-ready="true"]');await p.evaluate(()=>View3D.automationReady());assert.equal((await p.evaluate(()=>View3D.automationCamera())).temporaryFocusClipping,true);await V.screenshot('questionnaire-room-preview');await p.click('[data-w-return]');await p.waitForSelector('[data-w-candidate]');await p.waitForSelector('[data-w-model] canvas');
 assert.equal(await p.locator('[data-w-candidate="access"]').getAttribute('aria-pressed'),'true');
 // Resume regenerates against the same unmodified work.
 await p.check('[data-w-ack]');await p.click('[data-w-use]');await p.waitForFunction(()=>document.querySelector('#dlg').hidden);
 const adopted=await p.evaluate(()=>structuredClone(state.furniture));assert.equal(adopted.length,1);assert.equal(adopted[0].cabinet.version,2);
 await p.evaluate(()=>undo());assert.equal(await p.evaluate(()=>state.furniture.length),0);await p.evaluate(()=>redo());assert.deepEqual(await p.evaluate(()=>structuredClone(state.furniture)),adopted);
 await p.waitForFunction(()=>!savePending);await p.evaluate(async()=>{if(repositoryClient?.flush&&repositoryClient.status.mode!=='error')await repositoryClient.flush();});await p.reload();await p.locator('#repository-loading').waitFor({state:'hidden'});assert.deepEqual(await p.evaluate(()=>structuredClone(state.furniture)),adopted,'Applied furniture survives save/reload');
 // Invalid answer does not replace the previous imported content; changed region invalidates candidates.
 await p.evaluate(()=>FurnishWardrobePlannerUI.open());await p.setInputFiles('[data-w-import]',{name:'answer.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(setup.answer))});await p.waitForFunction(()=>document.querySelector('[data-w-answer]').textContent.includes('导入候选测试'));
 await p.setInputFiles('[data-w-import]',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"invalid"}')});await p.waitForFunction(()=>document.querySelector('[data-w-error]').textContent.includes('受支持'));assert.match(await p.locator('[data-w-answer]').textContent(),/导入候选测试/);
 // Replacing the selected existing cabinet preserves its ID and creates no duplicate.
 const id=adopted[0].id;await p.selectOption('[data-w-replace]',id);await p.click('[data-w-generate]');await p.waitForSelector('[data-w-candidate]');await p.waitForSelector('[data-w-model] canvas');
 await p.locator('[data-w-area="w"]').fill('1810');await p.locator('[data-w-area="w"]').dispatchEvent('change');assert.equal(await p.locator('[data-w-candidate]').count(),0);assert(await p.locator('[data-w-use]').isDisabled());await p.locator('[data-w-area="w"]').fill('1800');await p.locator('[data-w-area="w"]').dispatchEvent('change');await p.click('[data-w-generate]');await p.waitForSelector('[data-w-candidate]');await p.waitForSelector('[data-w-model] canvas');
 await p.evaluate(()=>mutate(()=>state.designNote='stale candidate check'));await p.check('[data-w-ack]');await p.click('[data-w-use]');assert.match(await p.locator('[data-w-error]').innerText(),/已变化/);assert.equal(await p.evaluate(()=>state.furniture.length),1);
 await p.click('[data-w-generate]');await p.waitForSelector('[data-w-candidate]');await p.waitForSelector('[data-w-model] canvas');await p.check('[data-w-ack]');await p.click('[data-w-use]');await p.waitForFunction(()=>document.querySelector('#dlg').hidden);assert.equal(await p.evaluate(()=>state.furniture.length),1);assert.equal(await p.evaluate(()=>state.furniture[0].id),id);
 await p.waitForFunction(()=>!savePending);await p.evaluate(async()=>{if(repositoryClient?.flush&&repositoryClient.status.mode!=='error')await repositoryClient.flush();});await p.setViewportSize({width:390,height:844});await p.reload({waitUntil:'domcontentloaded',timeout:60000});await p.locator('#repository-loading').waitFor({state:'hidden'});await p.evaluate(()=>FurnishWardrobePlannerUI.open());await p.screenshot({path:V.artifact(V.mode+'-questionnaire-mobile.png'),animations:'disabled'});assert(await p.evaluate(()=>document.getElementById('wardrobe-planner').scrollWidth<=document.getElementById('wardrobe-planner').clientWidth+1));
 await p.click('#dlgClose');assert.equal(await p.evaluate(()=>state.furniture.length),1);
 assert.deepEqual(errors,[]);return {passed:true,checks:['answer import and atomic rejection','designated placement','three distinct candidates','production preview and opening','room scene preview without mutation','acknowledgement','apply and undo/redo','save/reload','replacement preserves identity','390px and cancel']};
};
