'use strict';
module.exports=async(p,V)=>{
 const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),M=require('./progressive-material-specialization.js'),project=JSON.parse(fs.readFileSync(process.env.FURNISH_TEST_PROJECT)),w=project.workspace||project;
 const camera=JSON.parse(fs.readFileSync(process.env.FURNISH_PERF_CAMERA_FILE));
 const labels=(process.env.FURNISH_DEEP_VARIANTS||'baseline,pool64,pool256,fixed-pool,retry4,baseline').split(',');assert(labels.every(l=>['baseline','pool8','pool16','pool32','pool64','pool256','fixed-pool','retry4','positions','shadow-leaf','stack'].includes(l)),'unknown deep GPU variant');
 const transform=(file,s,label)=>{
  if(file==='WaveFrontPathTracer.js'&&/^pool(8|16|32|64|256)$/.test(label))s=s.replace('const MAX_BUFFER_SIZE = 134217728;',`const MAX_BUFFER_SIZE = ${Number(label.slice(4))*1024*1024};`);
  if(file==='WaveFrontPathTracer.js'&&label==='fixed-pool')s=s.replace('Math.min( MAX_RAY_DATA_COUNT, Math.max( 1, Math.floor( this.frameBudget ) ) )','MAX_RAY_DATA_COUNT');
  if(file==='compute/wavefront/MaterialKernel.js'&&label==='retry4'){
   for(const f of ['indexUV','combinedField','samples'])s=s.replace('let '+f+' =','var '+f+' =');
   const a='let isComplete = maxSamples != 0u && samples >= maxSamples;';assert(s.includes(a));s=s.replace(a,`for(var retry=0u;retry<4u&&elementCount>0u&&maxSamples!=0u&&samples>=maxSamples;retry++){let q=atomicAdd(&pixelQueue[\${ PIXEL_QUEUE_CURRENT }u],1u)%elementCount;pixelIndex=atomicExchange(&pixelQueue[\${ PIXEL_QUEUE_HEADER }u+q],pixelIndex);indexUV=vec2u(pixelIndex>>16,pixelIndex&0xFFFF);combinedField=textureLoad(\${ params.sampleCountTarget },indexUV).r;samples=\${ SAMPLE_COUNT_MASK }u&combinedField;}\n`+a);
  }
  if(file==='nodes/PathtracerBVHComputeData.js'&&label==='positions'){
   s=s.replace('super.update();',`super.update();const raw=this.storage.attributes.value.array,stride=this.structs.attributes.getLength(),positions=new Uint32Array(raw.length/stride*4);for(let i=0,j=0;i<raw.length;i+=stride,j+=4)positions.set(raw.subarray(i,i+4),j);this.storage.positions=storage(new StorageBufferAttribute(positions,4),'vec4').toReadOnly().setName('bvh_positions');`);
   s=s.replace(/\$\{ storage.attributes \}\[ (i[012]) \]\.position\.xyz/g,'${ storage.positions }[ $1 ].xyz');
  }
  if(file==='nodes/PathtracerBVHComputeData.js'&&label==='shadow-leaf')s=s.replace('result.didHit = true;', 'result.didHit = true; if(${ isShadowRay }){result.dist=triResult.dist;return true;}');
  return s;
 };
 return require('./progressive-profile-ui.js')(p,{...V,kernelExperiment:{camera,sceneSettings:{...w.work[w.planId].scene3d,labels:false,wallNumbers:false,clearances:false},resolution:{width:1200,height:846,horizontalFov:camera.horizontalFov},labels,transform,
 prepareSource:s=>M.audit+s.replace('const requiredLimits={','const requiredLimits={maxStorageBuffersPerShaderStage:Math.min(16,adapter.limits.maxStorageBuffersPerShaderStage),').replace('tracer=new WebGPUPathTracer(renderer);','globalThis.__perf.materialAudit=auditMaterialFeatures(scene);tracer=new WebGPUPathTracer(renderer);'),
 routes:async(p,label,root)=>{
  await p.route('**/webgpu/nodes/PathtracerBVHComputeData.js',r=>r.fulfill({contentType:'text/javascript',body:transform('nodes/PathtracerBVHComputeData.js',fs.readFileSync(path.join(root,'vendor/lighting-preview/three-gpu-pathtracer/src/webgpu/nodes/PathtracerBVHComputeData.js'),'utf8'),label())}));
  await p.route('**/three-mesh-bvh/src/webgpu/BVHComputeData.js',r=>{let s=fs.readFileSync(path.join(root,'vendor/lighting-preview/three-mesh-bvh/src/webgpu/BVHComputeData.js'),'utf8');s=s.replace('if ( maxTraversalDepth > BVH_STACK_DEPTH.value ) {',`${label()==='stack'?'BVH_STACK_DEPTH.value=Math.max(24,maxTraversalDepth);':''}globalThis.__perf.traversalDepth=maxTraversalDepth;globalThis.__perf.stackCapacity=BVH_STACK_DEPTH.value;if ( maxTraversalDepth > BVH_STACK_DEPTH.value ) {`);return r.fulfill({contentType:'text/javascript',body:s});});
 },
 validate:reports=>{for(const r of reports){assert.deepEqual(r.profile.materialAudit,reports[0].profile.materialAudit);if(r.pixelDifference)assert(r.pixelDifference.mean<=.5,'image difference gate');}},
 }});
};
