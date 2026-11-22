/* Shared ceiling-panel devices. Unmarked construction and light output are visual assumptions. */
(function(root){
'use strict';
const products=()=>root.FurnishProducts||require('../core/product-rules.js');
const lighting=()=>root.FurnishLighting||require('../core/lighting-core.js');
const rasterInstalled=new WeakSet();
function area(g,{position,width,height,candela,color,material}){
 const radiance=lighting().panel(candela,width,height);
 if(material){material.emissiveIntensity=radiance;material.userData.emissionOn=radiance;}
 (g.userData.lightingRects||=[]).push({position,width,height,u:[1,0,0],v:[0,0,-1],normal:[0,-1,0],radiance,color,material});
}
// The renderer's spot slots carry a view-space position, orientation and
// an optional shadow map. The material shader integrates the emitting area.
// Keep every direct-light shape parameter paired with its sorted shadow slot.
const extentOffset=8,rectangleCode=16,ellipseCode=32;
function areaSample(T,g,{position,width,height,candela,color,round=false,up=false,role,name}){
 const shape=round?ellipseCode:rectangleCode;
 const surface=width*height*(round?Math.PI/4:1);
 const lamp=new T.SpotLight(color,lighting().radiometric(candela)/surface,
  extentOffset+width/2,Math.PI/2,1,shape+height/2);
 const target=new T.Object3D();
 lamp.position.fromArray(position);
 target.position.copy(lamp.position);target.position.y+=up?1:-1;
 lamp.target=target;lamp.name=name;
 Object.assign(lamp.userData,{radiometricLight:true,areaSurrogate:true,ceilingPanelLight:true,ceilingArea:true});
 if(role==='bounce')lamp.userData.ceilingPanelBounce=true;
 else if(role){
  lamp.userData.panelSample=role;
  lamp.visible=role!=='tile';
 }
 lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.02;
 lamp.shadow.bias=-.0001;lamp.shadow.normalBias=up?.015:.01;lamp.shadow.focus=.85;
 g.add(lamp,target);
}
const axes=new WeakMap();
function orientArea(lamp){
 const matrix=lamp.matrixWorld;
 let frame=axes.get(lamp);
 if(!frame){
  frame=[lamp.up.clone(),lamp.up.clone(),lamp.up.clone(),lamp.up.clone()];axes.set(lamp,frame);
 }
 const [across,normal,tangent,bitangent]=frame;
 across.setFromMatrixColumn(matrix,0).normalize();
 normal.setFromMatrixColumn(matrix,1).normalize();
 if(lamp.target.position.y<lamp.position.y)normal.negate();
 tangent.set(Math.abs(normal.y)<.9?0:1,Math.abs(normal.y)<.9?1:0,0);
 tangent.addScaledVector(normal,-tangent.dot(normal)).normalize();
 bitangent.crossVectors(normal,tangent);
 const angle=Math.atan2(across.dot(bitangent),across.dot(tangent));
 lamp.penumbra=1-((angle+Math.PI)%Math.PI)/Math.PI;
}
function installRaster(T){
 const chunks=T.ShaderChunk,call='getSpotLightInfo( spotLight, geometryPosition, directLight );';
 if(!chunks)return false;
 if(rasterInstalled.has(chunks))return true;
 const spotShadow='directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;';
 const begin=chunks.lights_fragment_begin,start=begin.indexOf(call);
 if(start<0||!begin.slice(start).includes(spotShadow))return false;
 chunks.lights_pars_begin+=`
 #if NUM_SPOT_LIGHTS > 0
  // Vector form factor along a projected emitter edge. Polynomial used by
  // Three.js r160 LTC_EdgeVectorFormFactor (MIT, vendor/three-r160/LICENSE).
  vec3 furnishAreaEdge(vec3 a,vec3 b){
   float x=clamp(dot(a,b),-1.0,1.0),y=abs(x);
   float v=(0.8543985+(0.4965155+0.0145206*y)*y)/(3.4175940+(4.1616724+y)*y);
   return cross(a,b)*(x>0.0?v:0.5*inversesqrt(max(1.0-x*x,1e-7))-v);
  }
  void furnishCeilingArea(SpotLight slot,vec3 position,vec3 normal,out IncidentLight light){
   light.visible=false;
   light.color=vec3(0.0);
   light.direction=normal;
   vec3 center=slot.position-position;
   float rise=dot(center,slot.direction);
   float distance2=dot(center,center);
   if(rise<=0.0||distance2>slot.distance*slot.distance)return;
   bool ellipse=slot.decay>=${ellipseCode}.0;
   float halfWidth=slot.distance-${extentOffset}.0;
   float halfHeight=slot.decay-(ellipse?${ellipseCode}.0:${rectangleCode}.0);
   float extent=max(halfWidth,halfHeight);
   // At small subtended angles the projected-area limit converges to
   // the edge integral. Nearby surfaces retain the full emitter outline.
   if(distance2>196.0*extent*extent){
    vec3 direction=center*inversesqrt(distance2);
    if(dot(normal,direction)<=0.0)return;
    float surface=halfWidth*halfHeight*(ellipse?PI:4.0);
    light.direction=direction;
    light.color=slot.color*(surface*dot(direction,slot.direction)/distance2);
    light.visible=true;
    return;
   }
   vec3 emitter=-slot.direction;
   vec3 seed=abs((vec4(emitter,0.0)*viewMatrix).y)<0.9?viewMatrix[1].xyz:viewMatrix[0].xyz;
   vec3 tangent=normalize(seed-emitter*dot(seed,emitter));
   vec3 bitangent=cross(emitter,tangent);
   float angle=2.0*acos(clamp(slot.penumbraCos,-1.0,1.0));
   float c=cos(angle),s=sin(angle);
   vec3 u=halfWidth*(tangent*c+bitangent*s),v=halfHeight*(bitangent*c-tangent*s);
   if(dot(center,normal)+abs(dot(u,normal))+abs(dot(v,normal))<=0.0)return;
   vec3 form;
   if(ellipse){
    // Equal-area octagon for a circular or oval diffuser.
    vec3 x=u*1.0539074,y=v*1.0539074;
    vec3 a=normalize(center+x),b=normalize(center+(x+y)*0.70710678);
    vec3 c=normalize(center+y),d=normalize(center+(-x+y)*0.70710678);
    vec3 e=normalize(center-x),f=normalize(center-(x+y)*0.70710678);
    vec3 g=normalize(center-y),h=normalize(center+(x-y)*0.70710678);
    form=-(furnishAreaEdge(a,b)+furnishAreaEdge(b,c)+furnishAreaEdge(c,d)+furnishAreaEdge(d,e)
          +furnishAreaEdge(e,f)+furnishAreaEdge(f,g)+furnishAreaEdge(g,h)+furnishAreaEdge(h,a));
   }else{
    vec3 a=normalize(center-u-v),b=normalize(center+u-v);
    vec3 c=normalize(center+u+v),d=normalize(center-u+v);
    form=-(furnishAreaEdge(a,b)+furnishAreaEdge(b,c)+furnishAreaEdge(c,d)+furnishAreaEdge(d,a));
   }
   float weight=length(form);
   // Match the projected solid angle, including a smooth receiver horizon.
   // The existing BRDF uses an equivalent incident direction for highlights.
   float projected=max((weight*weight+dot(normal,form))/(1.0+weight),0.0);
   if(projected<=0.0)return;
   vec3 direction=form/max(weight,1e-6);
   direction=normalize(direction+normal*max(0.0,0.08-dot(normal,direction)));
   light.direction=direction;
   light.color=slot.color*(PI*projected/max(dot(normal,direction),0.001));
   light.visible=true;
  }
 #endif
 `;
 const spot=begin.slice(start).replace(call,`
  if(spotLight.decay>${rectangleCode}.0){
   furnishCeilingArea(spotLight,geometryPosition,geometryNormal,directLight);
  }else{
   ${call}
  }`).replace(spotShadow,`
  {
  vec4 furnishShadowAt=vSpotLightCoord[ i ];
  if(spotLight.decay>${rectangleCode}.0){
   // Retain edge visibility for grazing rays beyond the finite shadow
   // frustum. The padding keeps the existing PCF taps on valid texels.
   vec2 border=2.0/spotLightShadow.shadowMapSize;
   float w=max(furnishShadowAt.w,0.0001);
   furnishShadowAt.xy=clamp(furnishShadowAt.xy/w,border,1.0-border)*w;
  }
  directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, furnishShadowAt ) : 1.0;
  }`);
 chunks.lights_fragment_begin=begin.slice(0,start)+spot;
 rasterInstalled.add(chunks);
 return true;
}
function assetArea(T,group,mesh,{candela,color,round=false}){
 const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3());
 const size=box.getSize(new T.Vector3());
 const position=[center.x,box.min.y-.001,center.z],width=size.x,height=size.z;
 const extent=round?Math.sqrt(Math.PI)/2:1;
 area(group,{position,width:width*extent,height:height*extent,candela,color,material:mesh.material});
 if(installRaster(T))areaSample(T,group,{position,width,height,candela,color,round,name:'Ceiling diffuser area'});
}
const supported=f=>!!(products().definition(f)?.ceilingPanel||products().definition(f)?.panelLight)&&!f.obj;
function buildCeilingLight(T,f,light){
 const P=products(),base=P.value(f,'mountHeight');
 const asset=root[light.global]||(typeof require==='function'?require('../data/'+light.asset+'-blender-asset.js'):null);
 const loader=root.FurnishStaticAssetModel||require('./static-asset-model.js');
 const group=loader.build(T,asset,{...f,h:P.height(f)},base);
 if(!T.SpotLight||!T.Object3D)return group;
 const diffuser=group.children.find(mesh=>mesh.name==='diffuser');
 const candela=light.previewCandela*P.value(f,'lightPreviewLevel')/100;
 diffuser.material.emissive.set(light.color);
 diffuser.material.userData.ceilingPanelEmitter=true;
 assetArea(T,group,diffuser,{candela,color:light.color,round:light.round});
 return group;
}
function heaterLight(T,g,f){
 const light=products().definition(f)?.heaterLight;
 if(!light||!T.SpotLight)return g;
 const diffuser=g.getObjectByName(light.part);
 if(!diffuser?.material.emissive)return g;
 diffuser.material.emissive.set(light.color);
 diffuser.material.userData.ceilingPanelEmitter=true;
 assetArea(T,g,diffuser,{candela:light.previewCandela,color:light.color});
 return g;
}
function build(T,f){
 const lightProfile=products().definition(f).panelLight;
 if(lightProfile?.asset)return buildCeilingLight(T,f,lightProfile);
 if(products().definition(f).ceilingPanel?.profile==='se2'){
  const asset=root.FurnishSE2BlenderAsset||(typeof require==='function'?require('../data/se2-blender-asset.js'):null);
  const loader=root.FurnishStaticAssetModel||(typeof require==='function'?require('./static-asset-model.js'):null);
  if(asset&&loader)return heaterLight(T,loader.build(T,asset,{...f,h:products().height(f)},products().value(f,'mountHeight')),f);
  return heaterLight(T,buildSE2(T,f),f);
 }
 const P=products(),spec=P.definition(f).ceilingPanel||{rim:3},g=new T.Group(),base=P.value(f,'mountHeight')/1000,w=f.w/1000,d=f.d/1000,h=P.height(f)/1000,rim=Math.min(spec.rim/1000,h);
 const white=new T.MeshStandardMaterial({color:f.color||'#f5f5f0',roughness:.48}),dark=new T.MeshStandardMaterial({color:'#454a4c',roughness:.8}),metal=new T.MeshStandardMaterial({color:'#a7acae',metalness:.4,roughness:.65});
 function box(name,width,height,depth,x,y,z,material){const m=new T.Mesh(new T.BoxGeometry(width,height,depth),material);m.position.set(x,base+y,z);m.name=name;m.userData.furnishPartSource='bath-heater:'+name;m.userData.furnishStablePart='bath-heater:'+name;m.userData.ceilingOwnMaterial=true;m.castShadow=m.receiveShadow=true;g.add(m);}
 const level=P.supports(f,'lightPreviewLevel')?P.value(f,'lightPreviewLevel')/100:1;
 const light=P.definition(f).panelLight,energy=level*(light?.referenceArea?Math.max(.15,Math.min(2,f.w*f.d/light.referenceArea)):1);
 if(light){
  const edge=Math.min(light.frame/1000,w/4,d/4),glow=new T.MeshStandardMaterial({color:'#fafbf8',emissive:light.color,emissiveIntensity:1.5,roughness:.65});
  (glow.userData||={}).ceilingPanelEmitter=true;
  area(g,{position:[0,base-.001,0],width:w-2*edge,height:d-2*edge,candela:light.previewCandela*energy,color:light.color,material:glow});
  for(const side of [-1,1]){
   box('light-frame-x-'+side,edge,rim,d,side*(w-edge)/2,rim/2,0,white);
   box('light-frame-z-'+side,w-2*edge,rim,edge,0,rim/2,side*(d-edge)/2,white);
  }
  box('light-diffuser',w-2*edge,rim,d-2*edge,0,rim/2,0,glow);
  if(h>rim)box('light-housing',w,h-rim,d,0,rim+(h-rim)/2,0,white);
  if(T.SpotLight&&installRaster(T)){
   const width=w-2*edge,height=d-2*edge,position=[0,base-.001,0],candela=light.previewCandela*energy;
   const multi=f.type==='panel_light_300x600';
   areaSample(T,g,{position,width,height,candela,color:light.color,role:multi?'full':undefined,name:'Panel diffuser area'});
   // Each tile integrates a quarter of the same diffuser. A separate map
   // per tile can resolve partial obstruction by cabinets near the light.
   if(multi)for(const x of [-1,1])for(const z of [-1,1]){
    areaSample(T,g,{position:[x*width/4,position[1],z*height/4],width:width/2,height:height/2,
     candela:candela/4,color:light.color,role:'tile',name:'Panel diffuser area tile'});
   }
   for(const side of [-1,1]){
    areaSample(T,g,{position:[0,base-light.bounceDrop/1000,side*d/4],width,height:height/2,
     candela:light.bounceCandela*energy/2,color:light.color,up:true,role:'bounce',name:'Panel reflected area'});
   }
  }
  return g;
 }
 box('face-back',w,rim,d*.69,0,rim/2,-d*.155,white);
 box('face-front',w,rim,d*.09,0,rim/2,d*.455,white);
 for(const side of [-1,1])box('face-side-'+side,w*.12,rim,d*.22,side*w*.44,rim/2,d*.3,white);
 if(h>rim)box('body',w*.86,h-rim,d*.9,0,rim+(h-rim)/2,0,metal);
 // Recessed-look grille below the panel face; kept within the recorded envelope.
 box('grille',w*.76,rim*.15,d*.22,0,rim*.15,d*.3,dark);
 for(let i=0;i<10;i++)box('louvre-'+i,w*.76,rim*.1,d*.009,0,rim*.08,d*(.2+i*.022),white);
 return g;
}
// SE2: 110 mm box above a 2 mm visual face (face thickness is unconfirmed).
function buildSE2(T,f){
 const P=products(),spec=P.definition(f).ceilingPanel,g=new T.Group(),base=P.value(f,'mountHeight')/1000,w=f.w/1000,d=f.d/1000,h=P.height(f)/1000,r=Math.min(spec.rim/1000,h);
 const white=new T.MeshStandardMaterial({color:f.color||'#f5f5f3',roughness:.4}),metal=new T.MeshStandardMaterial({color:'#9da3a6',metalness:.55,roughness:.55}),dark=new T.MeshStandardMaterial({color:'#626b70',roughness:.65}),display=new T.MeshStandardMaterial({color:'#252e34',roughness:.28}),light=new T.MeshStandardMaterial({color:'#fffffa',emissive:'#fffff0',emissiveIntensity:.65,roughness:.65}),ink=new T.MeshStandardMaterial({color:'#d9e5e8'}),orange=new T.MeshStandardMaterial({color:'#ec7b28'});
 function mesh(name,geometry,x,y,z,mat){const m=new T.Mesh(geometry,mat);m.position.set(x,base+y,z);m.name=name;m.userData.furnishPartSource='bath-heater-se2:'+name;m.userData.furnishStablePart='bath-heater-se2:'+name;m.userData.ceilingOwnMaterial=true;m.castShadow=m.receiveShadow=true;g.add(m);return m;}
 function box(n,a,b,c,x,y,z,mat){return mesh(n,new T.BoxGeometry(a,b,c),x,y,z,mat);}
 box('face',w,r*.2,d,0,r*.9,0,white);
 for(const side of [-1,1]){box('rim-side-'+side,w*.025,r,d,side*w*.4875,r/2,0,white);box('rim-end-'+side,w*.95,r,d*.025,0,r/2,side*d*.4875,white);}
 // The broad luminous face and five full-length vent slots follow the supplied underside views.
 box('diffuser',w*.675,r*.35,d*.95,w*.1375,r*.475,0,light);
 for(let i=0;i<5;i++)box('vent-'+i,w*.018,r*.2,d*.91,w*(-.45+i*.032),r*.55,0,dark);
 const radius=w*.036;
 mesh('display',new T.CylinderGeometry(radius,radius,r*.2,32),-w*.235,r*.5,-d*.425,display);
 for(let i=0;i<3;i++)box('display-mark-'+i,w*.007,r*.1,d*.009,-w*.235+w*(i-1)*.015,r*.35,-d*.425,ink);
 for(let i=0;i<4;i++){box('indicator-'+i,w*.015,r*.1,d*.012,-w*.235,r*.4,d*(-.29+i*.12),metal);box('indicator-label-'+i,w*.008,r*.1,d*.024,-w*.235,r*.4,d*(-.26+i*.12),metal);}
 box('brand-accent',w*.012,r*.1,d*.025,-w*.235,r*.35,d*.325,orange);
 for(let i=0;i<4;i++)box('brand-mark-'+i,w*.02,r*.1,d*.004,-w*.235,r*.35,d*(.37+i*.016),dark);
 if(h>r)box('body',w*.86,h-r,d*.9,0,r+(h-r)/2,0,metal);
 return g;
}
const api={supported,build,buildLegacySE2:buildSE2,installRaster,orientArea};if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishBathHeaterModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
