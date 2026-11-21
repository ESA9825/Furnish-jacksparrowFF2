'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('../src/render/viewport-gtao.js');
require('../src/render/viewport-bloom.js');

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
 const T=await import(imports.three);
 let target=null,width=2841,height=1555,status=1;
 const recorded=[];
 const gl={SAMPLES:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:1,
  getParameter:()=>4,checkFramebufferStatus:()=>target?.width===200?0:status,isContextLost:()=>false};
 const renderer={
  capabilities:{isWebGL2:true,maxSamples:4},
  info:{autoReset:true,reset(){}},
  outputColorSpace:T.SRGBColorSpace,
  getContext:()=>gl,getRenderTarget:()=>target,
  setRenderTarget(value){target=value;},
  getDrawingBufferSize(out){return out.set(width,height);},
  render(scene){recorded.push({scene,target,background:scene.background?.clone()});}
 };
 const effect=FurnishViewportGTAO.create(T,renderer);
 const model=new T.Scene(),camera=new T.PerspectiveCamera();
 const background=new T.Color(0x1c2130);
 model.background=background;
 assert.equal(effect.draw(model,camera),true);
 assert.equal(recorded.length,4);
 assert.equal(recorded[0].scene,model);
 assert.equal(model.background,background);
 assert.deepEqual(recorded[0].background.toArray().map(value=>Math.round(value*255)),[28,33,48]);
 const [first,half,filtered]=recorded.map(x=>x.target);
 assert.deepEqual([first.width,first.height],[2841,1555]);
 assert.deepEqual([half.width,half.height],[1421,778]);
 assert.equal(first.samples,4);
 assert.ok(first.depthTexture.isDepthTexture);
 assert.deepEqual([filtered.width,filtered.height],[1421,778]);
 assert.equal(recorded[3].target,null);
 assert.equal(renderer.info.autoReset,true);
 recorded.length=0;
 assert.equal(effect.draw(model,camera,{aoEnabled:false}),true);
 assert.equal(recorded.length,2);
 assert.equal(recorded[0].target,first);
 const lamp=new T.Group();
 lamp.userData.fid='fmwf2mkf12';
 const mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({emissive:0xffde9e}));
 mesh.material.userData.ceilingPanelEmitter=true;
 const brightWall=new T.Mesh(mesh.geometry,mesh.material.clone());
 lamp.add(mesh);model.add(lamp,brightWall);
 recorded.length=0;
 assert.equal(effect.draw(model,camera,{aoEnabled:false,bloomRevision:1}),true);
 assert.equal(recorded.length,5);
 assert.equal(recorded[0].target,first);
 const seed=recorded[1];
 assert.equal(seed.scene.children.length,1,'Bright unrelated surfaces cannot seed Bloom');
 const proxy=seed.scene.children[0];
 assert.equal(proxy.geometry,mesh.geometry);
 assert.deepEqual([seed.target.width,seed.target.height],[1421,778]);
 assert.deepEqual([recorded[2].target.width,recorded[2].target.height],[711,389]);
 assert.equal(recorded[4].target,null);
 recorded.length=0;
 assert.equal(effect.draw(model,camera,{aoEnabled:true,bloomRevision:1}),true);
 assert.equal(recorded.length,7);
 assert.equal(recorded[0].target,first);
 assert.equal(recorded[1].target,half);
 assert.equal(recorded[3].target,seed.target);
 lamp.visible=false;
 recorded.length=0;
 assert.equal(effect.draw(model,camera,{aoEnabled:false,bloomRevision:1}),true);
 assert.equal(recorded.length,2);
 lamp.visible=true;
 mesh.material.emissiveIntensity=0;
 recorded.length=0;
 assert.equal(effect.draw(model,camera,{aoEnabled:false,bloomRevision:1}),true);
 assert.equal(recorded.length,2);
 mesh.material.emissiveIntensity=1;
 let geometryDisposed=false;
 mesh.geometry.addEventListener('dispose',()=>{geometryDisposed=true;});
 effect.releaseBloom();
 assert.equal(geometryDisposed,false);
 let released=0;
 first.addEventListener('dispose',()=>released++);
 half.addEventListener('dispose',()=>released++);
 filtered.addEventListener('dispose',()=>released++);
 width=800;height=600;recorded.length=0;
 assert.equal(effect.draw(model,camera),true);
 assert.equal(released,3);
 assert.deepEqual([recorded[1].target.width,recorded[1].target.height],[400,300]);
 const warn=console.warn;console.warn=()=>{};
 try{assert.equal(effect.draw(model,camera,{aoEnabled:true,bloomRevision:1}),true);}finally{console.warn=warn;}
 assert.equal(effect.available(),true,'Bloom framebuffer failure must keep GTAO available');
 assert.equal(effect.bloomAvailable(),false);
 target=first;assert.equal(effect.draw(model,camera),false);
 assert.equal(target,first);
 target=null;status=0;width=700;
 console.warn=()=>{};
 try{assert.equal(effect.draw(model,camera),false);}finally{console.warn=warn;}
 assert.equal(target,null);
 assert.equal(effect.available(),false);
 assert.equal(renderer.info.autoReset,true);
 effect.dispose();
 console.log('PASS shared beauty, GTAO and selective Bloom, independent fallback and resource lifecycle');
})().catch(error=>{console.error(error);process.exitCode=1;});
