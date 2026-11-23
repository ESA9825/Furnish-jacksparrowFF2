'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const three=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports.three;
const Bath=require('../src/render/bath-heater-model.js');
const Cove=require('../src/render/cove-light-model.js');
const Shadows=require('../src/render/raster-shadows.js');

async function checkComposition(){
 const {ShaderChunk:original}=await import(three);
 const T={ShaderChunk:{...original}};
 assert(Bath.installRaster(T)&&Cove.installRaster(T)&&Shadows.install(T));
 const {lights_fragment_begin:lights,shadowmap_pars_fragment:source}=T.ShaderChunk;
 assert.equal((source.match(/furnishPlaneCompare\( shadowMap/g)||[]).length,16);
 assert.match(lights,/vDirectionalShadowCoord\[ i \], furnishReceiverSlope/);
 assert.match(lights,/furnishShadowSlope\(vSpotLightCoord\[ i \]\)/);
 assert.match(lights,/furnishShadowAt, furnishReceiverSlope/);
 assert.match(lights,/getPointShadow\(/);
 assert.match(lights,/furnishCeilingArea\(/);
 assert.match(lights,/furnishCoveLight\(/);
 assert.match(source,/float dx = texelSize.x;/,'Indoor daylight can still widen the same filter');
 assert.equal(Shadows.install(T),true);
 assert.equal(T.ShaderChunk.shadowmap_pars_fragment,source);
 assert.equal(T.ShaderChunk.lights_fragment_begin,lights);
 assert.match(html,/FurnishCoveLightModel.installRaster\(THREE\);\s*FurnishRasterShadows.install\(THREE\);/);
}

async function checkWebGL(){
 const V=require('../scripts/lib/browser-verification.cjs');
 const launch=V.configuration().launchOptions;
 const browser=await V.loadPlaywright().chromium.launch({...launch,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const files=['src/core/product-rules.js','src/data/panel-bull-g12-blender-asset.js',
   'src/data/panel-xiaomi-switch2-blender-asset.js','src/render/static-asset-model.js','src/render/panel-bull-g12-model.js',
   'src/render/bath-heater-model.js','src/render/cove-light-model.js','src/render/raster-shadows.js'];
  await page.route('http://localhost/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(files.includes(name))return route.fulfill({path:path.join(root,name),contentType:'text/javascript'});
   if(name==='three.js')return route.fulfill({body:Buffer.from(three.split(',')[1],'base64'),contentType:'text/javascript'});
   const scripts=files.map(file=>'<script src="/'+file+'"></script>').join('');
   return route.fulfill({contentType:'text/html',body:scripts+'<script type="module">import * as T from "/three.js"; window.T=T;</script>'});
  });
  await page.goto('http://localhost/');
  await page.waitForFunction(()=>window.T);
  const results=await page.evaluate(()=>{
   const T=window.T,size=256;
   FurnishBathHeaterModel.installRaster(T);
   FurnishCoveLightModel.installRaster(T);
   const old={...T.ShaderChunk};
   FurnishRasterShadows.install(T);
   const fixed={...T.ShaderChunk};
   const scene=new T.Scene();
   const panel=FurnishPanelBullG12Model.build(T,{type:'panel_bull_g12',panelVariant:'xiaomi-2pro-2-white',w:86,h:86,d:5,mountHeight:0});
   scene.add(panel,new T.HemisphereLight(0xffffff,0xffffff,1));
   const blocker=new T.Mesh(new T.BoxGeometry(.011,.11,.01),new T.MeshStandardMaterial({colorWrite:false,depthWrite:false}));
   blocker.position.set(-.016,.059,.017);
   blocker.castShadow=true;
   scene.add(blocker);
   const camera=new T.OrthographicCamera(-.055,.055,.055,-.055,.01,10);
   camera.position.set(0,.043,.3);
   camera.lookAt(0,.043,0);
   const target=new T.WebGLRenderTarget(size,size);
   const renderer=new T.WebGLRenderer();
   renderer.shadowMap.enabled=true;
   renderer.shadowMap.type=T.PCFSoftShadowMap;
   const pixels=new Uint8Array(size*size*4);
   const sun=new T.DirectionalLight(0xffffff,2.6);
   sun.position.set(6,18,14);
   Object.assign(sun.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:1,far:60});
   sun.shadow.camera.updateProjectionMatrix();
   sun.shadow.bias=-.00001;sun.shadow.normalBias=.001;
   sun.castShadow=true;
   const spot=new T.SpotLight(0xffffff,2.6,4,Math.PI/3,0,0);
   spot.position.copy(sun.position).multiplyScalar(.1);
   spot.target.position.y=.04;
   spot.castShadow=true;
   spot.shadow.bias=-.0001;
   const render=(chunks,blocked,cast=true)=>{
    Object.assign(T.ShaderChunk,chunks);
    panel.traverse(part=>{
     if(!part.isMesh)return;
     part.castShadow=cast;
     part.material.customProgramCacheKey=()=>chunks===old?'before':'after';
     part.material.needsUpdate=true;
    });
    blocker.visible=blocked;
    renderer.setRenderTarget(target);
    renderer.render(scene,camera);
    renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
    const sampled=[];
    for(let y=80;y<180;y++)for(let x=46;x<112;x++)sampled.push(pixels[(y*size+x)*4]);
    return sampled;
   };
   const changed=(a,b,threshold)=>a.filter((value,i)=>value-b[i]>=threshold).length;
   const results=[];
   for(const [name,light,size] of [['sun-2048',sun,2048],['sun-4096',sun,4096],['spot',spot,512]]){
    light.shadow.map?.dispose();
    light.shadow.map=null;
    light.shadow.mapSize.setScalar(size);
    scene.add(light,light.target);
    const reference=render(fixed,false,false),before=render(old,false),after=render(fixed,false);
    const shadow=render(fixed,true);
    results.push({name,before:changed(reference,before,4),after:changed(reference,after,4),
     projectedShadow:changed(after,shadow,8)});
    scene.remove(light,light.target);
   }
   renderer.dispose();
   target.dispose();
   return results;
  });
  assert.deepEqual(errors,[]);
  for(const sample of results){
   assert(sample.before>=100,'The old shader must reproduce the bands: '+JSON.stringify(sample));
   assert(sample.after<=2,'The corrected receiver remains smooth: '+JSON.stringify(sample));
   assert(sample.projectedShadow>=100,'A nearby independent caster still darkens the panel: '+JSON.stringify(sample));
  }
  console.log('PASS WebGL shadow bands and independent occluder',results);
 }finally{await browser.close();}
}

(async()=>{
 await checkComposition();
 console.log('PASS raster shadow shader composition and idempotence');
 if(process.argv.includes('--webgl'))await checkWebGL();
})().catch(error=>{console.error(error);process.exitCode=1;});
