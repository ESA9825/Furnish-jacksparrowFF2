'use strict';
module.exports=`
async function runMu(scene,camera,data){
 stopped=true;const previousDevice=renderer.backend.device;renderer.domElement.remove();renderer.dispose();renderer=null;await previousDevice.lost;stopped=false;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/__mutracer__/dist/mutracer.umd.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
 const M=globalThis.MuTracer,canvas=document.createElement('canvas');document.body.append(canvas);
 const engine=new M.Engine({canvas,backend:'webgpu'});window.addEventListener('pagehide',()=>engine.dispose());engine.on('error',fail);
 engine.on('progress',e=>status('MuTracer '+e.stage+' '+Math.round((e.progress||0)*100)+'%'));
 const materials=[],seen=new Set();let sourceMeshes=0,sourceTriangles=0;scene.traverse(o=>{if(o.isMesh){sourceMeshes++;sourceTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});const sourceBounds=new T.Box3().setFromObject(scene);
 scene.traverse(o=>{if(o.isSpotLight)o.userData.mutracerRadius=0;});
 const env=new M.Texture({data:new Float32Array([...data.environment.world.map(v=>Math.floor(v*255)/255),1]),width:1,height:1});
 const converted=M.fromTHREEScene(scene,{environment:env,onMeshConverted(mesh,source){const sm=source.material;if(!Array.isArray(sm)&&!seen.has(sm)){seen.add(sm);const dm=mesh.materials?.[0]||mesh.material;materials.push({name:sm.name,clearcoat:sm.clearcoat||0,transmission:sm.transmission||0,roughness:sm.roughness,ior:sm.ior,bumpMap:!!sm.bumpMap,bumpScale:sm.bumpScale,thickness:sm.thickness,attenuationDistance:Number.isFinite(sm.attenuationDistance)?sm.attenuationDistance:'Infinity',sourceThinWalled:(sm.thickness||0)===0&&(sm.attenuationDistance===undefined||sm.attenuationDistance===Infinity),converted:{coatWeight:dm?.coatWeight,coatRoughness:dm?.coatRoughness,transmissionWeight:dm?.transmissionWeight,specularIor:dm?.specularIor,specularRoughness:dm?.specularRoughness,baseMetalness:dm?.baseMetalness,coatIor:dm?.coatIor,coatDarkening:dm?.coatDarkening,transmissionDepth:dm?.transmissionDepth,transmissionColor:dm?.transmissionColor,bumpMap:!!dm?.bumpMap,thinWalled:dm?.geometryThinWalled}});}}});
 camera.matrixWorld.fromArray(data.camera.matrixWorld);camera.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);camera.updateMatrixWorld(true);camera.aspect=data.aspect;camera.fov=2*Math.atan(1/data.camera.projectionMatrix[5])*180/Math.PI;camera.zoom=1;camera.updateProjectionMatrix();
 engine.scene=converted;engine.camera=M.fromTHREECamera(camera,{fStop:0});
 engine.display.toneMapping='aces';engine.display.toneMappingExposure=data.environment.exposure;engine.display.setSize(1200,672);
 engine.update();
 const render=new M.Render(engine,{width:1200,height:672,maxSamples:256,bounces:8,bevel:false,directLightCandidates:1,clamping:0,batchSamples:true,timeBudgetMs:32,samplingPattern:'sobol',adaptiveResolution:false});
 await render.setDenoiser({type:'oidn',weightsUrl:new URL('../../vendor/lighting-preview/rt_hdr_alb_nrm_small.tza',location.href).href,aux:true,hdr:true,precision:'fp32',maxTileSize:512,dynamicTile:false});
 let first=false,sixteen=false,finished=false,traced=false,last=0;
 globalThis.__perf={backend:'MuTracer',version:M.VERSION,materials,meshCount:converted.meshes.length,geometry:{sourceMeshes,sourceTriangles,convertedTriangles:converted.meshes.reduce((n,m)=>n+m.geometry.triangleCount,0),sourceBounds:{min:sourceBounds.min.toArray(),max:sourceBounds.max.toArray()},convertedBounds:M.computeMeshesBoundingBox(converted.meshes)},lights:converted.lights.map(l=>({type:l.type,color:l.color,intensity:l.intensity,size:l.size,radius:l.radius})),projection:{requested:data.camera.projectionMatrix,actual:engine.camera.getProjectionMatrix(),transform:engine.camera.transform,requestedTransform:data.camera.matrixWorld},settings:{width:1200,height:672,samples:256,bounces:8,clamping:0,bevel:false,directLightCandidates:1},warnings:[]};
 send('live-ready',{viewKey});
 async function tick(){if(stopped||finished)return;try{render.refine();engine.display.present(render);if((!first&&render.samples>=1)||(!sixteen&&render.samples>=16)){await engine.device.queue.onSubmittedWorkDone();if(!first&&render.samples>=1){first=true;globalThis.__firstMuRaw=canvas.toDataURL('image/png');send('benchmark-first',{samples:render.samples});}if(!sixteen&&render.samples>=16){sixteen=true;globalThis.__sixteenMuRaw=canvas.toDataURL('image/png');send('benchmark-sixteen',{samples:render.samples});}}if(!traced&&render.samples>=256){traced=true;await engine.device.queue.onSubmittedWorkDone();send('benchmark-traced');}const now=performance.now();if(now-last>1300){last=now;send('live-progress',{viewKey,samples:render.samples,frameTime:0});}
  if(render.status==='error')throw Error(engine.lastError||'MuTracer render error');
  if(render.status==='finished'){finished=true;engine.display.present(render);await engine.device.queue.onSubmittedWorkDone();send('benchmark-finished');globalThis.__perf.diagnostics=engine.getDiagnostics();const blob=await engine.display.toBlob(render,{type:'image/png'});globalThis.__muPNG=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});send('live-complete',{viewKey,samples:render.samples});return;}
  requestAnimationFrame(tick);
 }catch(error){fail(error);}}
 requestAnimationFrame(tick);
}
`;
