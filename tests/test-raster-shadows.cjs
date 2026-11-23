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
 assert.match(source,/return furnishWideShadow\(shadowMap,shadowMapSize,shadowCoord.xyz,receiverSlope,-shadowRadius\)/);
 assert.match(source,/float dx = texelSize.x;/,'Standard soft shadows retain the original taps');
 assert.equal(Shadows.install(T),true);
 assert.equal(T.ShaderChunk.shadowmap_pars_fragment,source);
 assert.equal(T.ShaderChunk.lights_fragment_begin,lights);
 assert.match(html,/FurnishCoveLightModel.installRaster\(THREE\);\s*FurnishRasterShadows.install\(THREE\);/);
}

function checkSolarPass(){
 const sun={},spot={},envelope={visible:false},passes=[];
 const shadows={needsUpdate:true,render(lights){
  passes.push({lights,envelope:envelope.visible,dirty:this.needsUpdate});
  this.needsUpdate=false;
 }};
 const move=Shadows.solarPass(shadows,sun,envelope);
 const draw=(lights=[spot,sun])=>{passes.length=0;shadows.render(lights);assert.equal(envelope.visible,false);return [...passes];};
 assert.deepEqual(draw(),[
  {lights:[sun],envelope:true,dirty:true},{lights:[spot],envelope:false,dirty:true}
 ]);
 assert.deepEqual(draw(),[]);
 move();
 assert.deepEqual(draw([spot]),[],'A hidden sun keeps its pending refresh');
 assert.deepEqual(draw(),[{lights:[sun],envelope:true,dirty:true}]);
 shadows.needsUpdate=true;
 assert.deepEqual(draw([sun]),[{lights:[sun],envelope:true,dirty:true}]);
 assert.equal(shadows.needsUpdate,false,'A sun-only scene returns to idle');
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
   // A single straight, oblique caster edge should darken monotonically
   // along each column. The old sparse taps jump at individual texel boundaries.
   const edgeScene=new T.Scene(),edgeCamera=new T.OrthographicCamera(-.5,.5,.5,-.5,.01,10);
   edgeCamera.position.z=2;
   const receiver=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0xaaaaaa,roughness:1}));
   receiver.receiveShadow=true;
   const edge=new T.Mesh(new T.PlaneGeometry(2,1.5),new T.MeshStandardMaterial({side:T.DoubleSide,colorWrite:false,depthWrite:false}));
   edge.position.set(0,.72,.1);
   edge.rotation.z=.37;
   edge.castShadow=true;
   const key=new T.DirectionalLight(0xffffff,2.6);
   key.position.z=4;key.castShadow=true;key.shadow.mapSize.setScalar(32);
   Object.assign(key.shadow.camera,{left:-.5,right:.5,bottom:-.5,top:.5,near:.01,far:8});
   key.shadow.camera.updateProjectionMatrix();
   edgeScene.add(receiver,edge,key,new T.AmbientLight(0xffffff,.4));
   const sparse={...old,shadowmap_pars_fragment:old.shadowmap_pars_fragment
    .replace('float dx = texelSize.x;','vec2 filterStep = texelSize * max(1.0,-shadowRadius);\nfloat dx = filterStep.x;')
    .replace('float dy = texelSize.y;','float dy = filterStep.y;').replace('uv + texelSize,','uv + filterStep,')};
   const sampleEdge=(chunks,radius,program)=>{
    Object.assign(T.ShaderChunk,chunks);
    receiver.material.customProgramCacheKey=()=>program;
    receiver.material.needsUpdate=true;
    key.shadow.radius=radius;
    renderer.setRenderTarget(target);
    renderer.render(edgeScene,edgeCamera);
    renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
    let reverse=0,transition=0;
    for(let x=48;x<208;x++){
     const value=y=>pixels[(y*size+x)*4],bright=value(35),dark=value(220);
     if(bright-dark<20)throw Error('Independent caster shadow missing');
     for(let y=36;y<=220;y++){
      if(value(y)>value(y-1)+2)reverse++;
      if(value(y)<bright-3&&value(y)>dark+3)transition++;
     }
    }
    return {reverse,transition};
   };
   const edges={sparse:sampleEdge(sparse,-2.9,'sparse'),standard:sampleEdge(fixed,1,'standard'),
    wide:sampleEdge(fixed,-2.9,'wide')};
   const room=new T.Scene(),overhead=new T.OrthographicCamera(-2,2,2,-2,.01,10);
   overhead.position.set(0,5,0);overhead.up.set(0,0,-1);overhead.lookAt(0,0,0);
   const floor=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshStandardMaterial({color:0xaaaaaa}));
   floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
   const roof=new T.Mesh(new T.BoxGeometry(4,.04,4),new T.MeshBasicMaterial());
   roof.position.y=2;roof.castShadow=true;
   const jambs=new T.Group();
   for(const [width,height,x,y] of [[1.5,2,-1.25,1],[1.5,2,1.25,1],[1,.6,0,.3],[1,.4,0,1.8]]){
    const wall=new T.Mesh(new T.BoxGeometry(width,height,.08),roof.material);
    wall.position.set(x,y,-2);wall.castShadow=true;jambs.add(wall);
   }
   const glass=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshPhysicalMaterial({transparent:true,opacity:.18,depthWrite:false,side:T.DoubleSide}));
   glass.position.set(0,1.1,-2);
   const envelope=new T.Group();envelope.add(roof,jambs);envelope.visible=false;
   const daylight=new T.DirectionalLight(0xffffff,3);daylight.castShadow=true;
   daylight.shadow.mapSize.setScalar(1024);
   Object.assign(daylight.shadow.camera,{left:-4,right:4,bottom:-4,top:4,near:.1,far:25});
   daylight.position.set(0,5,-10);
   room.add(floor,glass,envelope,daylight,daylight.target,new T.AmbientLight(0xffffff,.25));
   renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
   const updateSun=FurnishRasterShadows.solarPass(renderer.shadowMap,daylight,envelope);
   function sampleFloor(){
    renderer.setRenderTarget(target);renderer.render(room,overhead);
    renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
    return [[128,128],[64,128],[128,35]].map(([x,y])=>pixels[(y*size+x)*4]);
   }
   const low=sampleFloor();
   daylight.position.set(0,10,0);updateSun();
   const overheadOnly=sampleFloor();
   const daylightSamples={low,overheadOnly};
   renderer.dispose();
   target.dispose();
   return {results,edges,daylightSamples};
  });
  assert.deepEqual(errors,[]);
  for(const sample of results.results){
   assert(sample.before>=100,'The old shader must reproduce the bands: '+JSON.stringify(sample));
   assert(sample.after<=2,'The corrected receiver remains smooth: '+JSON.stringify(sample));
   assert(sample.projectedShadow>=100,'A nearby independent caster still darkens the panel: '+JSON.stringify(sample));
  }
  const {sparse,wide,standard}=results.edges;
  assert(sparse.reverse>100,'The stretched taps must reproduce edge shimmer: '+JSON.stringify(results.edges));
  assert.equal(wide.reverse,0,'The wide penumbra darkens smoothly across texel boundaries');
  assert(wide.transition>standard.transition*1.2,'The corrected wide filter still softens the edge');
  const {low,overheadOnly}=results.daylightSamples;
  assert(low[0]>low[1]+25&&low[0]>low[2]+25,'A low sun lights the floor through the glazing only');
  assert(overheadOnly.every(value=>Math.abs(value-low[1])<=2),'Overhead sun is blocked while the roof stays out of the color pass');
  console.log('PASS WebGL shadow bands, independent occluder, wide penumbra and window daylight',results);
 }finally{await browser.close();}
}

(async()=>{
 await checkComposition();
 checkSolarPass();
 console.log('PASS raster shadow shader composition, idempotence and independent solar cache');
 if(process.argv.includes('--webgl'))await checkWebGL();
})().catch(error=>{console.error(error);process.exitCode=1;});
