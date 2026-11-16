'use strict';
module.exports=async(p,V)=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
 const instrument=s=>s.replace('const started=performance.now();',`const started=performance.now();globalThis.__perf={kernels:{},uids:{},cpuRenderMs:0,frames:0,scene:{glbBytes:data.buffer.byteLength,meshes:data.meshCount,rects:data.lighting.rects.length,spots:data.lighting.spots.length}};`).replace('tracer.setDenoiser(denoiser);',`tracer.setDenoiser(denoiser);const denoiseUpdate=denoiser.update.bind(denoiser);denoiser.update=(...args)=>{globalThis.__perf.denoiseStartedAt=performance.now();return denoiseUpdate(...args);};`).replace("send('live-complete',","globalThis.__perf.denoiseMs=performance.now()-globalThis.__perf.denoiseStartedAt;send('live-complete',").replace('tracer.renderSample();',`const t=performance.now();tracer.renderSample();const q=globalThis.__perf||(globalThis.__perf={kernels:{},uids:{},cpuRenderMs:0,frames:0});q.cpuRenderMs+=performance.now()-t;q.frames++;`);
 return require('./progressive-scheduling-ui.js')(p,{...V,benchmark:{
  labels:(process.env.FURNISH_PROFILE_VARIANTS||'baseline,wg32,wg128,baseline').split(','),
  source:(s,label)=>{if(label==='mega')s=s.replace('tracer=new WebGPUPathTracer(renderer);','tracer=new WebGPUPathTracer(renderer);tracer.useMegakernel(true);');if(label==='merge')s="import {mergeGeometries} from '../../vendor/lighting-preview/three/examples/jsm/utils/BufferGeometryUtils.js';\n"+require('./progressive-merge-experiment.js')+s.replace('tracer=new WebGPUPathTracer(renderer);','mergeStaticOpaque(scene);tracer=new WebGPUPathTracer(renderer);');return instrument(s);},
  routes:async(p,label)=>{
   await p.route('**/webgpu/WebGPUPathTracer.js',r=>{let s=fs.readFileSync(path.join(root,'vendor/lighting-preview/three-gpu-pathtracer/src/webgpu/WebGPUPathTracer.js'),'utf8');if(label()==='leaf2')s=s.replaceAll('targetLeafSize: 5','targetLeafSize: 2');return r.fulfill({contentType:'text/javascript',body:s});});
   await p.route('**/webgpu/PathTracerBackend.js',r=>{
    let s=fs.readFileSync(path.join(root,'vendor/lighting-preview/three-gpu-pathtracer/src/webgpu/PathTracerBackend.js'),'utf8');
    s=s.replace('renderer.compute( kernel.kernel, dispatchSize );',`const q=globalThis.__perf||(globalThis.__perf={kernels:{},uids:{},cpuRenderMs:0,frames:0});const name=kernel.constructor.name;const k=q.kernels[name]||(q.kernels[name]={cpuMs:0,calls:0,gpuMs:0,measured:0});const t=performance.now();renderer.compute(kernel.kernel,dispatchSize);k.cpuMs+=performance.now()-t;k.calls++;q.uids[renderer.backend.getTimestampUID(kernel.kernel)]=name;`);
    s=s.replace('timing.count ++;',`timing.count++;const q=globalThis.__perf;if(q)for(const uid of uids){const k=q.kernels[q.uids[uid]];if(k){k.gpuMs+=backend.getTimestamp(uid);k.measured++;}}`);
    return r.fulfill({contentType:'text/javascript',body:s});
   });
   await p.route('**/webgpu/WaveFrontPathTracer.js',r=>{
    let s=fs.readFileSync(path.join(root,'vendor/lighting-preview/three-gpu-pathtracer/src/webgpu/WaveFrontPathTracer.js'),'utf8');
    const size=label()==='wg32'?32:label()==='wg128'?128:64;
    s=s.replaceAll('.setWorkgroupSize( 64, 1, 1 )',`.setWorkgroupSize( ${size}, 1, 1 )`);
    // Indirect thread counts must match the actual trace workgroup size.
    s=s.replaceAll('new QueueLengthToDispatchKernel( RAY_QUEUE_LENGTH )',`new QueueLengthToDispatchKernel( RAY_QUEUE_LENGTH, ${size} )`).replaceAll('new QueueLengthToDispatchKernel( SHADOW_RAY_QUEUE_LENGTH )',`new QueueLengthToDispatchKernel( SHADOW_RAY_QUEUE_LENGTH, ${size} )`).replaceAll('new QueueLengthToDispatchKernel( MEDIUM_QUEUE_LENGTH )',`new QueueLengthToDispatchKernel( MEDIUM_QUEUE_LENGTH, ${size} )`);
    return r.fulfill({contentType:'text/javascript',body:s});
   });
  }
 }});
};
