/* The 1601 night trial uses only the emitting surfaces of the installed fixtures. */
(function(root){
'use strict';

const ceiling='ceiling_area_fmvntr1ym2_part_1';
const sideboard='fmv62bwbp1';
const fixtures=new Set(['fmwf2mkf01','fmwf2mkf12','fmvs67k751']);

function sourceWeight(mesh){
 if(!mesh.isMesh||!mesh.material?.emissive)return 0;
 const part=mesh.userData.ceiling;
 if(part?.id===ceiling&&['light','diffuser'].includes(part.part))return 1;
 const data=mesh.material.userData;
 if(!data.ceilingPanelEmitter&&!data.downlightEmitter&&mesh.userData.cabinetSection!=='led')return 0;
 for(let node=mesh;node;node=node.parent){
  const id=node.userData.fid;
  if(!id)continue;
  if(id===sideboard&&mesh.userData.cabinetSection==='led')return 1;
  return fixtures.has(id)&&(data.ceilingPanelEmitter||data.downlightEmitter)?.8:0;
 }
 return 0;
}
function washSource(mesh){
 const wash=root.FurnishCeilingModel?.washMask(mesh);
 return wash?.ceilingIds.size===1&&wash.ceilingIds.has(ceiling)?wash:null;
}

const seedVertex=`
 #ifdef CEILING_WASH
 varying vec3 worldPosition;
 varying vec3 worldNormal;
 #endif
 #include <clipping_planes_pars_vertex>
 void main(){
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mvPosition;
  #include <clipping_planes_vertex>
  #ifdef CEILING_WASH
  worldPosition=(modelMatrix*vec4(position,1.0)).xyz;
  worldNormal=normalize(mat3(modelMatrix)*normal);
  #endif
 }
`;
const seedFragment=`
 uniform highp sampler2D sceneDepth;
 uniform vec2 maskSize;
 uniform vec3 emission;
 #ifdef CEILING_WASH
 varying vec3 worldPosition;
 varying vec3 worldNormal;
 uniform sampler2D washMask;
 uniform vec4 washBounds;
 #endif
 #include <clipping_planes_pars_fragment>
 void main(){
  #include <clipping_planes_fragment>
  float depth=texture2D(sceneDepth,gl_FragCoord.xy/maskSize).r;
  if(gl_FragCoord.z>depth+0.000007)discard;
  float weight=1.0;
  #ifdef CEILING_WASH
  vec2 uv=(worldPosition.xz-washBounds.xy)/washBounds.zw;
  float wash=texture2D(washMask,uv).r*max(0.0,-worldNormal.y*(gl_FrontFacing?1.0:-1.0));
  weight=0.76*smoothstep(0.17,0.56,wash);
  if(weight<=0.0)discard;
  #endif
  gl_FragColor=vec4(emission*weight,1.0);
 }
`;
const blur=`
 varying vec2 screenUv;
 uniform sampler2D image;
 uniform vec2 stepSize;
 void main(){
  vec3 value=texture2D(image,screenUv).rgb*0.227027;
  vec2 nearTap=stepSize*1.384615,farTap=stepSize*3.230769;
  value+=(texture2D(image,screenUv+nearTap).rgb+texture2D(image,screenUv-nearTap).rgb)*0.316216;
  value+=(texture2D(image,screenUv+farTap).rgb+texture2D(image,screenUv-farTap).rgb)*0.070270;
  gl_FragColor=vec4(value,1.0);
 }
`;

function create(T,renderer,make){
 const mask=new T.Scene();
 mask.background=new T.Color(0);
 const uniformDepth={value:null},uniformSize={value:new T.Vector2()};
 const filter=make(blur,{image:{value:null},stepSize:{value:new T.Vector2()}});
 let emitters=[],sourceRevision,seed,horizontal,vertical;
 function bind(main,revision){
  if(sourceRevision===revision)return;
  for(const {proxy} of emitters)proxy.material.dispose();
  mask.clear();emitters=[];
  main.traverse(source=>{
   const wash=washSource(source);
   const weight=sourceWeight(source);
   if(!weight&&!wash)return;
   const material=new T.ShaderMaterial({
    vertexShader:seedVertex,fragmentShader:seedFragment,
    uniforms:{sceneDepth:uniformDepth,maskSize:uniformSize,emission:{value:new T.Color()},
     ...(wash?{washMask:{value:wash.texture},washBounds:{value:wash.bounds}}:{})},
    defines:wash?{CEILING_WASH:1}:{},clipping:true,
    side:source.material.side,depthTest:false,depthWrite:false,toneMapped:false
   });
   const proxy=new T.Mesh(source.geometry,material);
   proxy.matrixAutoUpdate=false;
   mask.add(proxy);
   emitters.push({source,proxy,weight,wash});
  });
  sourceRevision=revision;
 }
 function release(){
  seed?.dispose();horizontal?.dispose();vertical?.dispose();
  seed=horizontal=vertical=null;
  uniformDepth.value=filter.uniforms.image.value=null;
 }
 function setup(beauty,checkTarget){
  const {width,height}=beauty;
  const target=(width,height)=>new T.WebGLRenderTarget(width,height,{depthBuffer:false});
  seed=target(Math.ceil(width/2),Math.ceil(height/2));
  horizontal=target(Math.ceil(width/4),Math.ceil(height/4));
  vertical=target(horizontal.width,horizontal.height);
  for(const buffer of [seed,horizontal,vertical])checkTarget(buffer);
  uniformSize.value.set(seed.width,seed.height);
  uniformDepth.value=beauty.depthTexture;
 }
 function draw(main,camera,revision,beauty,checkTarget,fullscreen){
  bind(main,revision);
  let active=false;
  for(const {source,proxy,weight,wash} of emitters){
   const {material}=source;
   proxy.visible=material.visible&&(!!wash||material.emissiveIntensity>0)&&camera.layers.test(source.layers);
   for(let node=source;proxy.visible&&node;node=node.parent)proxy.visible=node.visible;
   if(!proxy.visible)continue;
   proxy.matrix.copy(source.matrixWorld);
   proxy.matrixWorldNeedsUpdate=true;
   proxy.material.clippingPlanes=material.clippingPlanes;
   const color=proxy.material.uniforms.emission.value;
   if(wash)color.set('#ffde9e').convertLinearToSRGB();
   else color.copy(material.emissive).convertLinearToSRGB().multiplyScalar(weight*Math.min(1,material.emissiveIntensity));
   active=true;
  }
  if(!active)return null;
  if(!seed)setup(beauty,checkTarget);
  renderer.setRenderTarget(seed);renderer.render(mask,camera);
  filter.uniforms.image.value=seed.texture;
  filter.uniforms.stepSize.value.set(1.5/horizontal.width,0);
  fullscreen(horizontal,filter);
  filter.uniforms.image.value=horizontal.texture;
  filter.uniforms.stepSize.value.set(0,1.5/vertical.height);
  fullscreen(vertical,filter);
  return vertical.texture;
 }
 function dispose(){
  release();filter.dispose();
  for(const {proxy} of emitters)proxy.material.dispose();
  mask.clear();emitters=[];
 }
 return {draw,dispose};
}
root.FurnishViewportBloom={create,sourceWeight,washSource};
})(globalThis);
