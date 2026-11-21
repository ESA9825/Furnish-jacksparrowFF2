/* SMAA 1x Medium on the displayed, tone-mapped viewport color. */
(function(root){
'use strict';

function create(T,notify,ImageType=root.Image){
 const assets=root.FurnishSmaaAssets;
 const [edges,weights,blend]=assets.shaders(T).map(shader=>new T.ShaderMaterial({
  ...shader,depthTest:false,depthWrite:false,toneMapped:false
 }));
 // Existing MSAA already resolves fractional coverage. Use SMAA only as
 // a light correction of the remaining edge shape.
 edges.defines.SMAA_THRESHOLD='0.065';
 blend.uniforms.blendScale.value=.55;
 let ready=0,error=null,edgeTarget,weightTarget;
 const lookups=assets.lookups.map((url,index)=>{
  const texture=new T.Texture();
  const img=new ImageType();
  texture.image=img;
  texture.minFilter=T.LinearFilter;
  texture.magFilter=index===0?T.LinearFilter:T.NearestFilter;
  texture.generateMipmaps=false;
  texture.flipY=false;
  img.onload=()=>{
   texture.needsUpdate=true;
   ready++;
   notify();
  };
  img.onerror=()=>{
   error=Error('Could not decode the local SMAA lookup textures');
   notify();
  };
  img.src=url;
  return texture;
 });
 function release(){
  edgeTarget?.dispose();weightTarget?.dispose();
  edgeTarget=weightTarget=null;
  edges.uniforms.tDiffuse.value=weights.uniforms.tDiffuse.value=blend.uniforms.tColor.value=blend.uniforms.tDiffuse.value=null;
 }
 function setup({width,height},checkTarget){
  if(edgeTarget?.width===width&&edgeTarget.height===height)return;
  release();
  edgeTarget=new T.WebGLRenderTarget(width,height,{format:T.RGFormat,depthBuffer:false});
  weightTarget=new T.WebGLRenderTarget(width,height,{depthBuffer:false});
  checkTarget(edgeTarget);checkTarget(weightTarget);
  for(const material of [edges,weights,blend])material.uniforms.resolution.value.set(1/width,1/height);
  weights.uniforms.tDiffuse.value=edgeTarget.texture;
  weights.uniforms.tArea.value=lookups[0];
  weights.uniforms.tSearch.value=lookups[1];
  blend.uniforms.tDiffuse.value=weightTarget.texture;
 }
 function draw(input,checkTarget,fullscreen){
  if(error)throw error;
  if(ready<lookups.length)return false;
  setup(input,checkTarget);
  edges.uniforms.tDiffuse.value=blend.uniforms.tColor.value=input.texture;
  fullscreen(edgeTarget,edges);
  fullscreen(weightTarget,weights);
  fullscreen(null,blend);
  return true;
 }
 function dispose(){
  release();
  for(const texture of lookups){
   texture.image.onload=texture.image.onerror=null;
   texture.dispose();
  }
  for(const material of [edges,weights,blend])material.dispose();
 }
 return {draw,dispose};
}
root.FurnishViewportSMAA={create};
})(globalThis);
