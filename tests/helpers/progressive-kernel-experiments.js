'use strict';
const assert=require('node:assert/strict');
function replace(source,from,to){assert(source.includes(from),'pinned kernel anchor missing: '+from.slice(0,80));return source.replace(from,to);}
function transform(file,source,label){
 const cacheLights=label==='full-lights',split=label==='split',selection=['light-selection','full-selection'].includes(label),basis=['basis','full-basis'].includes(label);if(cacheLights||split||['full-selection','full-basis'].includes(label))label='full';
 const rw=['rw-output','combined','all-kernels','scalar-combined','full'].includes(label),medium=['medium-off','combined','all-kernels','scalar-combined','full'].includes(label),lights=cacheLights||['light-constants','all-kernels'].includes(label),scalar=['scalar-state','scalar-combined'].includes(label);
 if(scalar&&['compute/wavefront/MaterialKernel.js','compute/wavefront/LogicKernel.js'].includes(file)){
  const fields=[...new Set(Array.from(source.matchAll(/\binput\.(\w+)/g),m=>m[1]))];
  source=replace(source,'let input = ${ params.rayDataStorage }[ index ];',fields.map(f=>'let input_'+f+' = ${ params.rayDataStorage }[ index ].'+f+';').join('\n'));
  source=source.replace(/\binput\.(\w+)/g,'input_$1');
 }
 if(lights&&file==='nodes/structs.wgsl.js')source=replace(source,"iesProfile: 'int',\n}, 'Light' );","iesProfile: 'int',\n\tcachedNormal: 'vec3f',\n\tcachedPower: 'float',\n}, 'Light' );");
 if(lights&&file==='LightsInfoNode.js'){
  source=replace(source,'this.buffer.array.set( src.subarray( 0, count * stride ) );',`for(let i=0;i<count;i++){const a=i*24,b=i*stride;this.buffer.array.set(src.subarray(a,a+24),b);const ux=src[a+8],uy=src[a+9],uz=src[a+10],vx=src[a+12],vy=src[a+13],vz=src[a+14],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,n=Math.hypot(x,y,z);this.buffer.array[b+24]=n?x/n:0;this.buffer.array[b+25]=n?y/n:0;this.buffer.array[b+26]=n?z/n:0;this.buffer.array[b+27]=(src[a+4]*.2126+src[a+5]*.7152+src[a+6]*.0722)*src[a+7];}`);
  source=source.replaceAll('Math.round( src[ base +','Math.round( src[ i * 24 +');
  source=replace(source,'${ luminanceFn }( light.color * light.intensity )','light.cachedPower');
  source=source.replaceAll('normalize( cross( light.u, light.v ) )','light.cachedNormal').replaceAll('normalize( cross( u, v ) )','light.cachedNormal');
 }
 if(selection&&file==='LightsInfoNode.js'){
  source=replace(source,'let totalWeight = ${ this.getLightsWeight }( position ) + envWeight;',`var cachedWeights:array<f32,64>;var totalWeight=0.0;for(var i=0u;i<count;i++){let w=\${ this.getLightWeight }(i,position);cachedWeights[i]=w;totalWeight+=w;}totalWeight+=envWeight;`);
  source=replace(source,'let lightWeight = ${ this.getLightWeight }( i, position );','let lightWeight = cachedWeights[i];');
  source=replace(source,'weight = ${ this.getLightWeight }( index, position );','weight = cachedWeights[index];');
 }
 if(lights&&file==='nodes/lights.wgsl.js')source=source.replaceAll('normalize( cross( light.u, light.v ) )','light.cachedNormal').replaceAll('normalize( cross( u, v ) )','light.cachedNormal');
 if(rw&&file==='compute/wavefront/LogicKernel.js'){
  source=replace(source,"outputTarget: textureStore( createOutputTarget() ).toWriteOnly()","outputTarget: textureStore( createOutputTarget() ).toReadWrite()");
  source=replace(source,'textureLoad( ${ params.prevOutputTarget }, colorIndex )','textureLoad( ${ params.outputTarget }, colorIndex )');
 }
 if(rw&&file==='WaveFrontPathTracer.js'){
  source=replace(source,'renderer.copyTextureToTexture( this.outputTarget, this.prevOutputTarget );','// Experiment: each pixel has one active path, so accumulate in place.');
  source=replace(source,'[ this.outputTarget, this.prevOutputTarget ] = [ this.prevOutputTarget, this.outputTarget ];','');
 }
 if(medium&&['compute/wavefront/MaterialKernel.js','compute/wavefront/LogicKernel.js'].includes(file)){
  const edits=(file.endsWith('MaterialKernel.js')?[
   ['let segmentInMedium = medium.inside;','let segmentInMedium = false;'],
   ['input.walkPending == 0u','true'],
   ['if ( scatterRec.isTransmissive && ! surface.thinWall && input.side > 0.0 )','if ( false )'],
   ['if ( segmentInMedium || medium.inside )','if ( false )'],
   ['if ( ! isTerminated && medium.inside )','if ( false )'],
  ]:[['let isWalking = ! isTerminated && input.walkPending != 0u;','let isWalking = false;'],['input.mediumScattered == 0u','true']]).map(pair=>pair.map(s=>scalar?s.replace(/\binput\.(\w+)/g,'input_$1'):s));
  let body=source;for(const [from,to]of edits)body=replace(body,from,to);
  body=body.replaceAll('input.subsurfaceBounces','0u');
  // The feature audit is evaluated when kernels are constructed, after loading
  // every actual source material. Unknown or active scattering retains the original.
  const original=source.match(/const fn = wgslTagFn/);assert(original);
  const tag=`const sceneTag=(strings,...values)=>{if(globalThis.__kernelFlags?.noScatter){const parts=Array.from(strings,s=>{${edits.map(([a,b])=>'s=s.replaceAll('+JSON.stringify(a)+','+JSON.stringify(b)+');').join('')}return ${scalar?"s.replace(/\\binput_subsurfaceBounces\\b(?!\\s*=)/g,'0u')":"s.replaceAll('input.subsurfaceBounces','0u')"};});parts.raw=parts;return wgslTagFn(parts,...values);}return wgslTagFn(strings,...values);};\n\t\tconst fn = sceneTag`;
  source=source.replace('const fn = wgslTagFn',tag);
 }
 if(label==='full'){
  const M=require('./progressive-material-specialization.js');
  if(file==='nodes/material.wgsl.js')source=M.transformSurface(source,true);
  if(file==='materials/GltfCompliantMaterial.js')source=M.transformMaterial(source);
  if(file==='compute/wavefront/MaterialKernel.js')source=M.transformKernel(source.replaceAll('return wgslTagFn(','return sceneKernelTag('));
 }
 if(basis&&file==='nodes/material.wgsl.js'){
  source=replace(source,'surf.normalInvBasis = inverse( surf.normalBasis );','surf.normalInvBasis = transpose( surf.normalBasis );');
  source=replace(source,'surf.clearcoatInvBasis = inverse( surf.clearcoatBasis );','surf.clearcoatInvBasis = transpose( surf.clearcoatBasis );');
 }
 if(medium&&file==='WaveFrontPathTracer.js'){
  source=replace(source,'// Step 5: walk the paths inside media for a capped number of steps','if(!globalThis.__kernelFlags?.noScatter){\n\t\t\t\t// Step 5: walk the paths inside media for a capped number of steps');
  source=replace(source,'this.dispatch( mediumKernel, mediumDispatchConverter.outputDispatch );','this.dispatch( mediumKernel, mediumDispatchConverter.outputDispatch );\n\t\t\t\t}');
 }
 return split?require('./progressive-split-materials.js').transform(file,source):source;
}
const audit=`
function auditKernelScene(scene){let count=0,noScatter=true,lights=0;const materials=new Set();scene.traverse(o=>{if(o.isLight)lights++;if(o.isMesh)for(const m of [o.material].flat())materials.add(m);});for(const m of materials){count++;const strength=m.scatterStrength===undefined?0:m.scatterStrength;if(strength!==0||m.fogVolume)noScatter=false;}return {materials:count,noScatter,lights};}
`;
module.exports={transform,audit};
