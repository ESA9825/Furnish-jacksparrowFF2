const assert=require('node:assert/strict');

module.exports=async page=>{
 await page.evaluate(()=>localStorage.setItem('furnish-observation-v1','smooth'));
 await page.reload();
 await page.waitForFunction(()=>!repositoryBooting&&window.View3D);
 const canvas=page.locator('#view3d > canvas').first();
 const view=async mode=>{
  await page.evaluate(mode=>setView(mode),mode);
  await page.waitForFunction(mode=>viewMode===mode&&!switching,mode);
 };

 await view('3d');
 const context=await canvas.evaluateHandle(el=>el.getContext('webgl2')||el.getContext('webgl'));
 try{
  assert(await context.evaluate(gl=>gl&&!gl.isContextLost()&&gl.getExtension('WEBGL_lose_context')));
  await view('2d');
  assert.equal(await context.evaluate(gl=>gl.isContextLost()),false,'short 2D stays ready');
  await view('3d');
  const camera=await page.evaluate(()=>View3D.automationCamera({preset:'top'}));
  const picture=await page.evaluate(()=>View3D.image());
  assert(picture?.length>10000);
  await view('2d');
  await page.waitForFunction(gl=>gl.isContextLost(),context,{timeout:30000});
  assert.equal(await page.evaluate(()=>View3D.image()),picture,'2D keeps the last screenshot');
  await view('3d');
  assert.equal(await context.evaluate(gl=>gl.isContextLost()),false);
  const reopened=await page.evaluate(()=>View3D.automationCamera());
  for(const key of ['x','y','z']){
   assert(Math.abs(camera.position[key]-reopened.position[key])<1,'camera position '+key);
   assert(Math.abs(camera.target[key]-reopened.target[key])<1,'camera target '+key);
  }
  assert.equal(await page.evaluate(()=>View3D.image()),picture,'the restored WebGL frame is identical');
 }finally{
  await context.dispose();
 }
 return ['short 2D retains WebGL','idle 2D releases WebGL and retains the screenshot','3D restores the same camera and frame'];
};
