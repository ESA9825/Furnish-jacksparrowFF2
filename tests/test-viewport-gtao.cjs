'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('../src/render/viewport-gtao.js');

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
 const T=await import(imports.three);
 let target=null,width=2841,height=1555,status=1;
 const recorded=[];
 const gl={SAMPLES:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:1,
  getParameter:()=>4,checkFramebufferStatus:()=>status,isContextLost:()=>false};
 const renderer={
  capabilities:{isWebGL2:true,maxSamples:4},
  info:{autoReset:true,reset(){}},
  outputColorSpace:T.SRGBColorSpace,
  getContext:()=>gl,getRenderTarget:()=>target,
  setRenderTarget(value){target=value;},
  getDrawingBufferSize(out){return out.set(width,height);},
  render(scene){recorded.push({scene,target});}
 };
 const effect=FurnishViewportGTAO.create(T,renderer);
 const model=new T.Scene(),camera=new T.PerspectiveCamera();
 assert.equal(effect.draw(model,camera),true);
 assert.equal(recorded.length,4);
 assert.equal(recorded[0].scene,model);
 const [first,half,filtered]=recorded.map(x=>x.target);
 assert.deepEqual([first.width,first.height],[2841,1555]);
 assert.deepEqual([half.width,half.height],[1421,778]);
 assert.equal(first.samples,4);
 assert.ok(first.depthTexture.isDepthTexture);
 assert.deepEqual([filtered.width,filtered.height],[1421,778]);
 assert.equal(recorded[3].target,null);
 assert.equal(renderer.info.autoReset,true);
 recorded.length=0;
 assert.equal(effect.draw(model,camera,'beauty'),true);
 assert.equal(recorded.length,2);
 assert.equal(recorded[0].target,first);
 let released=0;
 first.addEventListener('dispose',()=>released++);
 half.addEventListener('dispose',()=>released++);
 filtered.addEventListener('dispose',()=>released++);
 width=800;height=600;recorded.length=0;
 assert.equal(effect.draw(model,camera),true);
 assert.equal(released,3);
 assert.deepEqual([recorded[1].target.width,recorded[1].target.height],[400,300]);
 target=first;assert.equal(effect.draw(model,camera),false);
 assert.equal(target,first);
 target=null;status=0;width=700;
 const warn=console.warn;console.warn=()=>{};
 try{assert.equal(effect.draw(model,camera),false);}finally{console.warn=warn;}
 assert.equal(target,null);
 assert.equal(effect.available(),false);
 assert.equal(renderer.info.autoReset,true);
 effect.dispose();
 console.log('PASS GTAO half-resolution dimensions, single scene pass, matched color inspection, resize, fallback and resource lifecycle');
})().catch(error=>{console.error(error);process.exitCode=1;});
