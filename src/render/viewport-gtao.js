/* Shared r160 viewport color/depth, with optional horizon AO and lamp Bloom. */
(function(root){
'use strict';

const vertex=`
 varying vec2 screenUv;
 void main(){
  screenUv=uv;
  gl_Position=vec4(position.xy,0.0,1.0);
 }
`;

const positionSource=`
 uniform highp sampler2D sceneDepth;
 uniform mat4 inverseProjection;
 float depthAt(vec2 uv){return texture2D(sceneDepth,uv).r;}
 float eyeDepth(float depth){
  float clip=depth*2.0-1.0;
  return -(inverseProjection[2][2]*clip+inverseProjection[3][2])
    /(inverseProjection[2][3]*clip+inverseProjection[3][3]);
 }
 vec3 viewPoint(vec2 uv,float depth){
  vec4 point=inverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
  return point.xyz/point.w;
 }
`;

// Integrate cosine-weighted visibility in paired horizon slices. See
// Jimenez et al., Practical Real-Time Strategies for Accurate Indirect Occlusion.
// Use the saved surface depth instead of another traversal of the scene.
const horizon=`
 varying vec2 screenUv;
 uniform vec2 pixel;
 uniform vec2 focal;
 ${positionSource}
 const float reach=0.34;
 vec3 normalAt(vec2 uv,vec3 p){
  vec2 x=vec2(pixel.x,0.0),y=vec2(0.0,pixel.y);
  vec3 west=viewPoint(uv-x,depthAt(uv-x)),east=viewPoint(uv+x,depthAt(uv+x));
  vec3 south=viewPoint(uv-y,depthAt(uv-y)),north=viewPoint(uv+y,depthAt(uv+y));
  vec3 dx=abs(west.z-p.z)<abs(east.z-p.z)?p-west:east-p;
  vec3 dy=abs(south.z-p.z)<abs(north.z-p.z)?p-south:north-p;
  vec3 n=cross(dx,dy);
  return n*inversesqrt(max(1e-12,dot(n,n)));
 }
 vec2 texelCenter(vec2 uv){
  return clamp((floor(uv/pixel)+0.5)*pixel,pixel*0.5,1.0-pixel*0.5);
 }
 float horizonAt(vec2 uv,vec3 p,vec3 eye,vec3 n,float initial){
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return initial;
  uv=texelCenter(uv);
  float depth=depthAt(uv);
  if(depth>=0.999999)return initial;
  vec3 delta=viewPoint(uv,depth)-p;
  float d2=dot(delta,delta);
  float planeBias=0.006+0.0024*-p.z;
  float abovePlane=smoothstep(planeBias,planeBias+0.035,dot(delta,n));
  float gate=(1.0-smoothstep(0.15*reach,reach,sqrt(d2)))*abovePlane;
  float h=dot(delta,eye)*inversesqrt(max(d2,0.000001));
  return mix(initial,max(initial,h),gate);
 }
 float integral(float angle,vec2 n){
  return 0.5*(n.x*(angle-sin(angle)*cos(angle))+n.y*sin(angle)*sin(angle));
 }
 void main(){
  vec2 uv=texelCenter(screenUv);
  float d=depthAt(uv);
  if(d>=0.999999){gl_FragColor=vec4(0.0,1.0,0.0,1.0);return;}
  vec3 p=viewPoint(uv,d),v=normalize(-p),n=normalAt(uv,p);
  vec2 pixelReach=reach*focal/(2.0*-p.z);
  vec2 grid=mod(floor(gl_FragCoord.xy),8.0);
  float jitter=fract(dot(grid,vec2(0.7548777,0.5698403)));
  float shift=fract(jitter*3.731);
  float loss=0.0;
  for(int slice=0;slice<3;slice++){
   float phi=(jitter+float(slice))*1.0471976;
   vec2 axis=vec2(cos(phi),sin(phi));
   vec3 tangent=normalize(vec3(axis,0.0)-v*dot(v,vec3(axis,0.0)));
   vec2 projected=vec2(dot(n,tangent),max(0.0,dot(n,v)));
   float tip=projected.x/max(0.001,length(projected));
   vec2 openHorizon=vec2(-tip,tip);
   vec2 found=openHorizon;
   for(int stepIndex=1;stepIndex<=3;stepIndex++){
    float u=(float(stepIndex)-0.63+0.63*shift)/3.0;
    vec2 offset=axis*pixelReach*(0.2*u+0.8*u*u);
    found.x=max(found.x,horizonAt(uv+offset,p,v,n,openHorizon.x));
    found.y=max(found.y,horizonAt(uv-offset,p,v,n,openHorizon.y));
   }
   vec2 openAngle=acos(clamp(openHorizon,-1.0,1.0));
   vec2 hitAngle=acos(clamp(found,-1.0,1.0));
   loss+=integral(openAngle.x,projected)-integral(hitAngle.x,projected);
   vec2 opposite=vec2(-projected.x,projected.y);
   loss+=integral(openAngle.y,opposite)-integral(hitAngle.y,opposite);
  }
  float amount=clamp(loss*0.74,0.0,1.0)*(1.0-smoothstep(9.0,17.0,-p.z));
  float depthBytes=min(-p.z/24.0,1.0)*255.0;
  gl_FragColor=vec4(amount,floor(depthBytes)/255.0,fract(depthBytes),1.0);
 }
`;

// Filter the angular samples at half resolution. Preserve the source
// depth code so the final full-resolution resolve rejects silhouettes.
const denoise=`
 varying vec2 screenUv;
 uniform sampler2D occlusion;
 uniform vec2 aoSize;
 float viewDepth(vec3 sampleAO){return 24.0*(sampleAO.g+sampleAO.b/255.0);}
 vec2 filterAt(vec2 offset,float z,float weight){
  vec3 ao=texture2D(occlusion,screenUv+offset/aoSize).rgb;
  float difference=z-viewDepth(ao);
  float w=weight/(1.0+2800.0*difference*difference);
  return vec2(ao.r*w,w);
 }
 void main(){
  vec3 center=texture2D(occlusion,screenUv).rgb;
  float z=viewDepth(center);
  vec2 sum=vec2(center.r,1.0)*1.4;
  sum+=filterAt(vec2(1.6,0.0),z,0.8)+filterAt(vec2(-1.6,0.0),z,0.8);
  sum+=filterAt(vec2(0.0,1.6),z,0.8)+filterAt(vec2(0.0,-1.6),z,0.8);
  sum+=filterAt(vec2(1.6,1.6),z,0.55)+filterAt(vec2(-1.6,1.6),z,0.55);
  sum+=filterAt(vec2(1.6,-1.6),z,0.55)+filterAt(vec2(-1.6,-1.6),z,0.55);
  gl_FragColor=vec4(sum.x/sum.y,center.gb,1.0);
 }
`;

const resolve=`
 varying vec2 screenUv;
 uniform sampler2D beauty;
 uniform sampler2D occlusion;
 uniform vec2 aoSize;
 uniform float strength;
 uniform sampler2D bloom;
 uniform bool hasBloom;
 ${positionSource}
 vec2 tap(vec2 coord,float weight,float depth){
  vec3 sampleAO=texture2D(occlusion,(coord+0.5)/aoSize).rgb;
  float sampleZ=24.0*(sampleAO.g+sampleAO.b/255.0);
  float w=weight/(1.0+14000.0*(depth-sampleZ)*(depth-sampleZ));
  return vec2(sampleAO.r*w,w);
 }
 void main(){
  vec4 color=texture2D(beauty,screenUv);
  float d=strength>0.0?depthAt(screenUv):1.0;
  if(d<0.999999){
   float z=eyeDepth(d);
   vec2 p=screenUv*aoSize-0.5;
   vec2 base=floor(p),f=fract(p);
   vec2 sum=tap(base,(1.0-f.x)*(1.0-f.y),z)
    +tap(base+vec2(1.0,0.0),f.x*(1.0-f.y),z)
    +tap(base+vec2(0.0,1.0),(1.0-f.x)*f.y,z)
    +tap(base+vec2(1.0,1.0),f.x*f.y,z);
   float dark=min(0.145,strength*sum.x/max(sum.y,0.09));
   color.rgb*=1.0-dark;
  }
  if(hasBloom){
   vec3 glow=texture2D(bloom,screenUv).rgb;
   color.rgb+=min(vec3(0.095),glow*0.24)*(1.0-color.rgb*0.64);
  }
  gl_FragColor=color;
 }
`;

function create(T,renderer){
 const screen=new T.Vector2();
 const encodedBackground=new T.Color();
 const view=new T.Camera();
 const scene=new T.Scene();
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
 const uniforms={sceneDepth:{value:null},inverseProjection:{value:new T.Matrix4()}};
 const make=(fragmentShader,extra)=>new T.ShaderMaterial({vertexShader:vertex,fragmentShader,
  uniforms:{...uniforms,...extra},depthTest:false,depthWrite:false,toneMapped:false});
 const ao=make(horizon,{pixel:{value:new T.Vector2()},focal:{value:new T.Vector2()}});
 const aoSize=new T.Vector2();
 const filter=make(denoise,{occlusion:{value:null},aoSize:{value:aoSize}});
 const composite=make(resolve,{beauty:{value:null},occlusion:{value:null},aoSize:{value:aoSize},
  strength:{value:.43},bloom:{value:null},hasBloom:{value:false}});
 const triangle=new T.Mesh(geometry,ao);
 triangle.frustumCulled=false;scene.add(triangle);
 const gl=renderer.getContext();
 let beauty,buffer,filtered,bloom,failed=false,bloomFailed=false;
 // r160's offscreen output normally omits material tone mapping. This
 // internal path gives the beauty target the same color output as the canvas.
 // RGBA8 stores the resulting encoded bytes without an additional sRGB step.
 const supported=renderer.capabilities.isWebGL2&&T.REVISION==='160';
 function releaseAO(){
  buffer?.dispose();filtered?.dispose();buffer=filtered=null;
  filter.uniforms.occlusion.value=composite.uniforms.occlusion.value=null;
 }
 function releaseBloom(){
  bloom?.dispose();bloom=null;
  composite.uniforms.bloom.value=null;
 }
 function release(){
  releaseAO();releaseBloom();
  beauty?.dispose();beauty=null;
  uniforms.sceneDepth.value=composite.uniforms.beauty.value=null;
 }
 function checkTarget(target){
  renderer.setRenderTarget(target);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete viewport target');
 }
 function fullscreen(target,material){
  triangle.material=material;
  renderer.setRenderTarget(target);renderer.render(scene,view);
 }
 function renderBeauty(main,camera){
  const background=main.background;
  // r160 clears render targets with working-space values even when its
  // materials emit display-space bytes. Encode solid clears the same way.
  if(background?.isColor)main.background=background.getRGB(encodedBackground,renderer.outputColorSpace);
  try{renderer.render(main,camera);}finally{main.background=background;}
 }
 function sizeTargets(){
  renderer.getDrawingBufferSize(screen);
  const {x:w,y:h}=screen;
  if(beauty&&beauty.width===w&&beauty.height===h)return true;
  if(w<2||h<2)return false;
  release();
  const samples=Math.min(renderer.capabilities.maxSamples,gl.getParameter(gl.SAMPLES));
  beauty=new T.WebGLRenderTarget(w,h,{samples,depthTexture:new T.DepthTexture(w,h,T.UnsignedIntType),
   minFilter:T.NearestFilter,magFilter:T.NearestFilter,format:T.RGBAFormat,type:T.UnsignedByteType});
  beauty.isXRRenderTarget=true;
  beauty.texture.colorSpace=renderer.outputColorSpace;
  beauty.texture.internalFormat='RGBA8';
  uniforms.sceneDepth.value=beauty.depthTexture;
  ao.uniforms.pixel.value.set(1/w,1/h);
  composite.uniforms.beauty.value=beauty.texture;
  checkTarget(beauty);
  return true;
 }
 function sizeAO(){
  if(buffer)return;
  const {width,height}=beauty;
  const target=()=>new T.WebGLRenderTarget(Math.ceil(width/2),Math.ceil(height/2),{
   format:T.RGBAFormat,depthBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  buffer=target();filtered=target();
  filter.uniforms.occlusion.value=buffer.texture;
  composite.uniforms.occlusion.value=filtered.texture;
  aoSize.set(buffer.width,buffer.height);
  checkTarget(buffer);checkTarget(filtered);
 }
 function draw(main,camera,{aoEnabled=true,bloomRevision}={}){
  if(!supported||failed||renderer.getRenderTarget()||gl.isContextLost())return false;
  const autoReset=renderer.info.autoReset;
  try{
   if(!sizeTargets())return false;
   renderer.info.reset();renderer.info.autoReset=false;
   renderer.setRenderTarget(beauty);renderBeauty(main,camera);
   if(aoEnabled){
    sizeAO();
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    const projection=camera.projectionMatrix.elements;
    ao.uniforms.focal.value.set(projection[0],projection[5]);
    fullscreen(buffer,ao);fullscreen(filtered,filter);
   }
   let glow=null;
   if(bloomRevision!==undefined&&!bloomFailed){
    try{
     bloom??=root.FurnishViewportBloom.create(T,renderer,make);
     glow=bloom.draw(main,camera,bloomRevision,beauty,checkTarget,fullscreen);
    }catch(error){
     console.warn('Furnish Bloom:',error);
     bloomFailed=true;releaseBloom();
     if(!aoEnabled)return false;
    }
   }
   composite.uniforms.strength.value=aoEnabled?.43:0;
   composite.uniforms.bloom.value=glow;
   composite.uniforms.hasBloom.value=!!glow;
   fullscreen(null,composite);
   return true;
  }catch(error){
   console.warn('Furnish GTAO:',error);
   failed=true;
   return false;
  }finally{
   renderer.setRenderTarget(null);
   renderer.info.autoReset=autoReset;
   if(failed)release();
  }
 }
 function dispose(){release();geometry.dispose();ao.dispose();filter.dispose();composite.dispose();}
 return {draw,release,releaseAO,releaseBloom,dispose,available:()=>supported&&!failed,
  bloomAvailable:()=>supported&&!failed&&!bloomFailed};
}
root.FurnishViewportGTAO={create};
})(globalThis);
