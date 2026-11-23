/* Match each soft-shadow depth comparison to the receiver plane at that texel. */
(function(root){
'use strict';
const installed=new WeakSet();
function install(T){
 const chunks=T.ShaderChunk;
 if(!chunks)return false;
 if(installed.has(chunks))return true;
 const source=chunks.shadowmap_pars_fragment;
 const lighting=chunks.lights_fragment_begin;
 if(typeof source!=='string'||typeof lighting!=='string')return false;
 const start=source.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
 const end=source.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )',start);
 const signature='vec4 shadowCoord ) {';
 const following='vec2 cubeToUV(';
 const directional=withPlaneSlope(lighting,'directional','vDirectionalShadowCoord[ i ]');
 const withSpot=directional&&withPlaneSlope(directional,'spot','vSpotLightCoord[ i ]','furnishShadowAt');
 if(start<0||end<0||!source.includes(signature)||!source.includes(following)||
    !withSpot)return false;
 const soft=source.slice(start,end)
  .replace(/texture2DCompare\( shadowMap, (.*?), shadowCoord.z \)/g,
   'furnishPlaneCompare( shadowMap, $1, shadowMapSize, shadowCoord.xyz, receiverSlope )')
  .replace('vec2 texelSize = vec2( 1.0 ) / shadowMapSize;',`
   if(shadowRadius < -1.0){
    return furnishWideShadow(shadowMap,shadowMapSize,shadowCoord.xyz,receiverSlope,-shadowRadius);
   }
   vec2 texelSize = vec2( 1.0 ) / shadowMapSize;`);
 chunks.shadowmap_pars_fragment=(source.slice(0,start)+soft+source.slice(end))
  .replace('float getShadow(',`
 #ifdef SHADOWMAP_TYPE_PCF_SOFT
  vec2 furnishShadowSlope(vec4 coord){
   vec3 projected=coord.xyz/coord.w;
   vec4 x=dFdx(coord),y=dFdy(coord);
   // Differentiate the homogeneous coordinate before projection to avoid
   // subtracting nearly equal depths in a perspective light's far field.
   vec3 dx=x.xyz-projected*x.w,dy=y.xyz-projected*y.w;
   float determinant=dx.x*dy.y-dx.y*dy.x;
   // A plane seen edge-on in the shadow map has no stable depth gradient.
   if(abs(determinant)<=max(1e-20,1e-5*length(dx.xy)*length(dy.xy)))return vec2(0.0);
   return vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/determinant;
  }
  float furnishTexelCompare(sampler2D depths,vec2 texel,vec2 size,vec3 receiver,vec2 slope){
   texel=clamp(texel,vec2(0.0),size-1.0);
   vec2 center=(texel+0.5)/size;
   return texture2DCompare(depths,center,receiver.z+dot(slope,center-receiver.xy));
  }
  float furnishPlaneCompare(sampler2D depths,vec2 uv,vec2 size,vec3 receiver,vec2 slope){
   return furnishTexelCompare(depths,floor(uv*size),size,receiver,slope);
  }
  float furnishWideShadow(sampler2D depths,vec2 size,vec3 receiver,vec2 slope,float spread){
   // Standard soft PCF covers a three-texel box. Grow that box and blend
   // each overlapping texel by coverage so a shift across the grid is continuous.
   float width=2.0+min(spread,3.0);
   vec2 low=receiver.xy*size-0.5*width;
   vec2 first=floor(low),offset=fract(low);
   vec2 end=offset+width;
   float visible=0.0;
   // A box at most five texels wide overlaps at most six cells per axis.
   for(int y=0;y<6;y++){
    float row=float(y);
    float wy=max(0.0,min(row+1.0,end.y)-max(row,offset.y));
    for(int x=0;x<6;x++){
     float column=float(x);
     float wx=max(0.0,min(column+1.0,end.x)-max(column,offset.x));
     visible+=wx*wy*furnishTexelCompare(depths,first+vec2(column,row),size,receiver,slope);
    }
   }
   return visible/(width*width);
  }
 #endif
 float getShadow(`)
  .replace(signature,'vec4 shadowCoord, vec2 receiverSlope ) {')
  .replace(following,`
 float getShadow(sampler2D map,vec2 size,float bias,float radius,vec4 coord){
  return getShadow(map,size,bias,radius,coord,vec2(0.0));
 }
 ${following}`);
 chunks.lights_fragment_begin=withSpot;
 installed.add(chunks);
 return true;
}
function withPlaneSlope(shader,light,coord,edgeCoord=coord){
 const props=light+'LightShadow';
 const prefix=`directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( ${light}ShadowMap[ i ], ${props}.shadowMapSize, ${props}.shadowBias, ${props}.shadowRadius, `;
 const lookup=sample=>prefix+sample+' ) : 1.0;';
 // Area lights can clamp the lookup UV at the map edge. Compute the slope
 // from the original projected coordinate, before the light visibility branch.
 const sample=shader.includes(lookup(edgeCoord))?edgeCoord:coord;
 if(!shader.includes(lookup(sample)))return null;
 return shader.replace(lookup(sample),`
 {
 #ifdef SHADOWMAP_TYPE_PCF_SOFT
  vec2 furnishReceiverSlope=furnishShadowSlope(${coord});
 #else
  vec2 furnishReceiverSlope=vec2(0.0);
 #endif
  ${prefix}${sample}, furnishReceiverSlope ) : 1.0;
 }`);
}
const api={install};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishRasterShadows=api;
})(typeof globalThis!=='undefined'?globalThis:this);
