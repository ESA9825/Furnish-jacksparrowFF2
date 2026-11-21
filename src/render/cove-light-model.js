/* Custom up-light channel around a proposed L2 strip, not a factory fixture replica. */
(function(root){'use strict';
const products=()=>root.FurnishProducts||require('../core/product-rules.js');
const supported=f=>!!products().definition(f)?.coveLight&&!f.obj;
const rasterInstalled=new WeakSet();
function build(T,f,{continuous=false}={}){
 const q=products().coveLightLayout(f),L=root.FurnishLighting||require('../core/lighting-core.js'),g=new T.Group(),m=v=>v/1000;
 const white=new T.MeshStandardMaterial({color:f.color||'#f0f0eb',roughness:.5,metalness:.2}),aluminum=new T.MeshStandardMaterial({color:'#b8bdba',roughness:.55,metalness:.6}),opal=new T.MeshStandardMaterial({color:'#f4f0e7',roughness:.65});
 function add(name,geometry,material,x,y,z){const o=new T.Mesh(geometry,material);o.name=name;o.position.set(m(x),m(q.base+y),m(z));o.userData.furnishPartSource='cove-light:'+name;o.userData.furnishStablePart='cove-light:'+name;o.castShadow=o.receiveShadow=true;g.add(o);return o;}
 const box=(n,w,h,d,x,y,z,mat)=>add(n,new T.BoxGeometry(m(w),m(h),m(d)),mat,x,y+h/2,z);
 box('base',q.w,q.t,q.d,0,0,0,white);
 box('back',q.innerWidth,q.h-q.t,q.t,0,q.t,-(q.d-q.t)/2,white);
 box('front-shield',q.innerWidth,q.h-q.t,q.t,0,q.t,(q.d-q.t)/2,white);
 for(const s of [-1,1])box('end-'+s,q.t,q.h-q.t,q.d,s*(q.w-q.t)/2,q.t,0,white);
 box('strip-support',q.innerWidth,q.emitterHeight-1-q.t,q.stripWidth+2,0,q.t,q.emitterZ,aluminum);
 box('diffuser',q.innerWidth,1,q.stripWidth,0,q.emitterHeight-1,q.emitterZ,opal);
 const width=m(q.innerWidth),depth=m(q.stripWidth),hw=width/2,hd=depth/2,plane=new T.BufferGeometry();
 plane.setAttribute('position',new T.Float32BufferAttribute([-hw,0,-hd,hw,0,hd,hw,0,-hd,-hw,0,-hd,-hw,0,hd,hw,0,hd],3));plane.computeVertexNormals();
 const radiance=L.panel(q.candela,width,depth),glow=new T.MeshStandardMaterial({color:'#fff9ee',emissive:q.color,emissiveIntensity:radiance,roughness:.65});
 Object.assign(glow.userData||=( {} ),{ceilingPanelEmitter:true,emissionOn:radiance});add('emitting-face',plane,glow,0,q.emitterHeight+.01,q.emitterZ);
 g.userData.lightingRects=[{name:'upward-cob-strip',position:[0,m(q.base+q.emitterHeight+.02),m(q.emitterZ)],width,height:depth,u:[1,0,0],v:[0,0,1],normal:[0,1,0],radiance,color:q.color,material:glow}];
 if(T.SpotLight&&q.candela>0){
  const count=Math.ceil(width/(continuous?1:.5)),span=width/count;
  for(let i=0;i<count;i++){
   const power=L.radiometric(q.candela)/(continuous?width:count);
   const lamp=new T.SpotLight(q.color,power,continuous?4:0,continuous?Math.PI*5/12:Math.PI/2,1,2);
   const target=new T.Object3D();
   lamp.position.fromArray(g.userData.lightingRects[0].position);
   lamp.position.x=span*(i+.5)-width/2;
   target.position.copy(lamp.position);target.position.y+=1;lamp.target=target;
   Object.assign(lamp.userData,{ceilingPanelLight:true,areaSurrogate:true,radiometricLight:true});
   lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.001;
   lamp.shadow.bias=-.00002;lamp.shadow.normalBias=.0002;
   if(continuous){lamp.userData.coveSpan=span;lamp.decay=-span/2;}
   g.add(lamp,target);
  }
 }
 return g;
}
// Encode the unoriented segment axis in the otherwise unused penumbra of
// a line light. Three uploads both fields in its normal sorted spot uniforms,
// so its light and shadow entries stay paired in every viewport pass.
function orientSpan(lamp){
 const normal=lamp.up.clone().setFromMatrixColumn(lamp.matrixWorld,1).normalize();
 const across=lamp.up.clone().setFromMatrixColumn(lamp.matrixWorld,0);
 const tangent=lamp.up.clone().set(Math.abs(normal.y)<.9?0:1,Math.abs(normal.y)<.9?1:0,0);
 tangent.addScaledVector(normal,-tangent.dot(normal)).normalize();
 const bitangent=normal.cross(tangent);
 const angle=Math.atan2(across.dot(bitangent),across.dot(tangent));
 lamp.penumbra=1-((angle+Math.PI)%Math.PI)/lamp.angle;
}
function installRaster(T){
 const chunks=T.ShaderChunk,call='getSpotLightInfo( spotLight, geometryPosition, directLight );';
 if(rasterInstalled.has(chunks))return true;
 if(!chunks.lights_fragment_begin.includes(call))return false;
 chunks.lights_pars_begin+=`
 #if NUM_SPOT_LIGHTS > 0
  float furnishLineIntegral(float x,float r2,float r){
   return (x/(r2+x*x)+atan(x/r)/r)/(2.0*r2);
  }
  void furnishCoveLight(SpotLight spot,vec3 position,vec3 normal,out IncidentLight light){
   light.visible=false;
   light.color=vec3(0.0);
   light.direction=vec3(0.0,1.0,0.0);
   vec3 delta=spot.position-position;
   float rise=dot(delta,spot.direction);
   float reach=spot.distance-spot.decay;
   if(rise<=0.0||dot(delta,delta)>=reach*reach)return;
   vec3 up=-spot.direction;
   vec3 seed=abs((vec4(up,0.0)*viewMatrix).y)<0.9?viewMatrix[1].xyz:viewMatrix[0].xyz;
   vec3 tangent=normalize(seed-up*dot(seed,up));
   float angle=acos(clamp(spot.penumbraCos,-1.0,1.0));
   vec3 axis=tangent*cos(angle)+cross(up,tangent)*sin(angle);
   float along=dot(delta,axis);
   vec3 radial=delta-axis*along;
   float a=along+spot.decay,b=along-spot.decay;
   float slope=dot(normal,axis),facing=dot(normal,radial);
   if(abs(slope)>0.0001){
    float horizon=-facing/slope;
    if(slope>0.0)a=max(a,horizon);else b=min(b,horizon);
   }else if(facing<=0.0)return;
   if(b<=a)return;
   // Integral of the upward Lambertian line over the receiver hemisphere.
   // The soft core bounds the near-field response at fixed scene exposure.
   float r2=dot(radial,radial)+0.08*0.08;
   float r=sqrt(r2);
   float i0=furnishLineIntegral(b,r2,r)-furnishLineIntegral(a,r2,r);
   float i1=0.5*(1.0/(r2+a*a)-1.0/(r2+b*b));
   vec3 integrated=radial*i0+axis*i1;
   float amplitude=length(integrated);
   if(amplitude<=0.0)return;
   light.direction=integrated/amplitude;
   light.color=spot.color*(0.85*rise*amplitude)*getDistanceAttenuation(length(radial),spot.distance,0.0);
   light.visible=true;
  }
 #endif
 `;
 // A segment without a shadow slot is omitted to avoid light leaking
 // through walls. The same PCF lookup as the ordinary spot masks the segment.
 chunks.lights_fragment_begin=chunks.lights_fragment_begin.replace(call,`
  if(spotLight.decay<0.0){
   #if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS)
    furnishCoveLight(spotLight,geometryPosition,geometryNormal,directLight);
   #else
    directLight.direction=vec3(0.0,1.0,0.0);
    directLight.color=vec3(0.0);
    directLight.visible=false;
   #endif
  }else{
   ${call}
  }`);
 rasterInstalled.add(chunks);
 return true;
}
const api={supported,build,installRaster,orientSpan};root.FurnishCoveLightModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
