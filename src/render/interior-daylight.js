/* A bounded raster preview for the 1601 balcony and living/dining rooms. */
(function(root){
'use strict';
const planId='custom_mv37igji',windowId='cad_window_9_3';
const roomIds=new Set(['area_fmv3qb1oi4','area_fmv3p2ig914','area_fmv3qajd93']);
const adjoiningIds=new Set(['area_fmv3qb1oi5','area_fmv3qcck717']);
const contactTypes=/^(sofa|armchair|chair|coffeetable|table|roundtable|cat_tree|plant_clivia|plant_spider|aircon_floor)/;
const resolution=64;

function edgeDistance(x,y,polygon){
 let nearest=Infinity;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i],dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  nearest=Math.min(nearest,Math.hypot(x-ax-dx*t,y-ay-dy*t));
 }
 return nearest;
}

function create(T,scene,{wx,wz,inside}){
 const uniforms={
  furnishDaylightMap:{value:null},furnishDaylightBounds:{value:new T.Vector4()},
  furnishDaylightSource:{value:new T.Vector3()},furnishWindowHalfSize:{value:new T.Vector2()},
  furnishDaylightStrength:{value:0}
 };
 const decorated=new Map(),variants=new Map(),supports=new Map();
 const inverse=new T.Matrix4(),matrix=new T.Matrix4(),box=new T.Box3();
 const local=new T.Vector3(),center=new T.Vector3(),length=new T.Vector3();
 const transform=new T.Object3D();
 transform.rotation.x=-Math.PI/2;
 const overlay=new T.Group();
 scene.add(overlay);
 let patch,sky,field,rooms=[],floors=[],bounds=null,lastPose='',daylight=0;

 function dataTexture(width,height,fill){
  const bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes.set(fill(x,y),4*(x+y*width));
  const texture=new T.DataTexture(bytes,width,height);
  texture.minFilter=texture.magFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
 }
 function mapLight(window,adjoining){
  const corners=rooms.flatMap(room=>room.poly);
  const xmin=Math.min(...corners.map(p=>p[0]))-160,xmax=Math.max(...corners.map(p=>p[0]))+160;
  const ymin=Math.min(...corners.map(p=>p[1]))-160,ymax=Math.max(...corners.map(p=>p[1]))+160;
  const [left,front,right,back]=window.rect;
  bounds=new T.Box3(new T.Vector3(wx(xmin),-.15,wz(ymin)),new T.Vector3(wx(xmax),3.3,wz(ymax)));
  uniforms.furnishDaylightBounds.value.set(wx(xmin),wz(ymin),1000/(xmax-xmin),1000/(ymax-ymin));
  uniforms.furnishDaylightSource.value.set(wx((left+right)/2),(window.sill+window.head)/2,wz(back));
  const width=right-left;
  uniforms.furnishWindowHalfSize.value.set(width/2000,(window.head-window.sill)/2);
  field=dataTexture(resolution,resolution,(i,j)=>{
   const x=xmin+(i+.5)/resolution*(xmax-xmin),y=ymin+(j+.5)/resolution*(ymax-ymin);
   if(!rooms.some(room=>[[-90,0],[0,-90],[0,0],[0,90],[90,0]].some(([a,b])=>inside(x+a,y+b,room.poly))))return [0,0,0,0];
   const lateral=Math.max(0,left-x,x-right),depth=Math.max(0,y-back);
   const edge=Math.min(1,...adjoining.map(room=>edgeDistance(x,y,room.poly)/780));
   const soft=Math.exp(-depth/(width*1.25)-lateral*lateral/600000)*edge*edge*(3-2*edge);
   return [Math.round(soft*255),0,0,255];
  });
  uniforms.furnishDaylightMap.value=field;
  const skyMap=dataTexture(1,32,(_,y)=>{
   const t=y/31;
   return [Math.round(239-38*t),Math.round(242-24*t),Math.round(239-4*t),255];
  });
  skyMap.colorSpace=T.SRGBColorSpace;
  sky=new T.Mesh(new T.PlaneGeometry(width/1000,window.head-window.sill),
   new T.MeshBasicMaterial({map:skyMap,toneMapped:false}));
  sky.position.set(wx((left+right)/2),(window.sill+window.head)/2,wz(front)-.01);
  overlay.add(sky);
 }
 function appearance(source){
  if(!source?.isMeshStandardMaterial||source.transparent)return source;
  if(variants.has(source))return variants.get(source);
  const material=source.clone();
  const smoothReflection=!!source.envMap&&source.roughness<=.30&&source.metalness===0;
  // Keep source PBR values and pre-existing shaders. Export strips these
  // raster hooks and keeps the source values.
  const cacheKey=source.customProgramCacheKey();
  material.customProgramCacheKey=()=>cacheKey+'|room-daylight-v1|'+smoothReflection;
  material.onBeforeCompile=function(shader,renderer){
   source.onBeforeCompile.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 furnishInteriorPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`
    #include <project_vertex>
    vec4 furnishInteriorVertex=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     furnishInteriorVertex=instanceMatrix*furnishInteriorVertex;
    #endif
    furnishInteriorPosition=(modelMatrix*furnishInteriorVertex).xyz;`);
   shader.fragmentShader=`
    varying vec3 furnishInteriorPosition;
    uniform sampler2D furnishDaylightMap;
    uniform vec4 furnishDaylightBounds;
    uniform vec3 furnishDaylightSource;
    uniform vec2 furnishWindowHalfSize;
    uniform float furnishDaylightStrength;
   `+shader.fragmentShader.replace('#include <aomap_fragment>',`
    vec2 furnishLightUV=(furnishInteriorPosition.xz-furnishDaylightBounds.xy)*furnishDaylightBounds.zw;
    float furnishSky=texture2D(furnishDaylightMap,furnishLightUV).r*furnishDaylightStrength;
    vec3 furnishToWindow=normalize(furnishDaylightSource-furnishInteriorPosition+vec3(0.0,0.0,-0.001));
    vec3 furnishWindowView=(viewMatrix*vec4(furnishToWindow,0.0)).xyz;
    float furnishFacing=clamp(dot(normal,furnishWindowView),0.0,1.0);
    vec3 furnishTint=vec3(0.80,0.91,1.0)*furnishSky;
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*furnishTint*(0.27+0.51*furnishFacing)*(1.0-metalnessFactor);
    vec3 furnishHalfVector=normalize(furnishWindowView+normalize(vViewPosition));
    float furnishGloss=1.0-roughnessFactor;
    reflectedLight.indirectSpecular+=furnishTint*(0.03+0.12*metalnessFactor)*furnishGloss*furnishFacing
      *pow(max(dot(normal,furnishHalfVector),0.0),mix(5.0,30.0,furnishGloss));
    ${smoothReflection?`
     // A broad aperture reflection for smooth opaque finishes.
     vec3 furnishView=normalize(vViewPosition);
     vec3 furnishRay=inverseTransformDirection(reflect(-furnishView,normal),viewMatrix);
     float furnishTravel=(furnishInteriorPosition.z-furnishDaylightSource.z)/max(-furnishRay.z,0.001);
     vec2 furnishAperture=abs(furnishInteriorPosition.xy+furnishTravel*furnishRay.xy-furnishDaylightSource.xy);
     vec2 furnishInside=1.0-smoothstep(furnishWindowHalfSize*0.55,furnishWindowHalfSize+0.48,furnishAperture);
     float furnishWindowWeight=furnishInside.x*furnishInside.y*step(0.015,-furnishRay.z)*step(0.0,furnishTravel);
     float furnishFresnel=0.16+0.24*pow(1.0-clamp(dot(furnishView,normal),0.0,1.0),3.0);
     reflectedLight.indirectSpecular+=furnishTint*furnishWindowWeight*furnishFresnel;
    `:``}
    #include <aomap_fragment>`);
  };
  variants.set(source,material);
  return material;
 }
 function paint(mesh){
  if(!mesh.isMesh||decorated.has(mesh)||!box.setFromObject(mesh).intersectsBox(bounds))return;
  const source=mesh.material,next=Array.isArray(source)?source.map(appearance):appearance(source);
  if(Array.isArray(source)?source.every((m,i)=>m===next[i]):source===next)return;
  decorated.set(mesh,source);
  mesh.material=next;
 }
 function findSupports(model){
  model.updateWorldMatrix(true,true);
  inverse.copy(model.matrixWorld).invert();
  const parts=[];
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   mesh.geometry.computeBoundingBox();
   matrix.multiplyMatrices(inverse,mesh.matrixWorld);
   box.copy(mesh.geometry.boundingBox).applyMatrix4(matrix);
   // Only low geometry in contact with the known floor carries a patch.
   if(Math.abs(box.min.y)>.025)return;
   box.getCenter(center);box.getSize(length);
   if(length.x>.012&&length.z>.012)parts.push([center.x,center.z,length.x+.19,length.z+.19]);
  });
  return parts.slice(0,8);
 }
 function contacts(){
  if(!patch)return;
  const entries=[...supports];
  const group=entries[0]?.[0].parent;
  if(!group?.visible||group.scale.y<.99){
   patch.count=0;lastPose='';return;
  }
  const key=entries.map(([model])=>[model.visible,model.position.x,model.position.y,model.position.z,model.rotation.y,model.scale.x].join(',')).join('|')
   +floors.map(floor=>floor.visible?'1':'0').join('');
  if(key===lastPose)return;
  lastPose=key;
  let count=0;
  for(const [model,parts] of entries){
   if(!model.visible||!model.parent?.visible)continue;
   model.updateMatrixWorld();
   for(const [x,z,w,d] of parts){
    local.set(x,0,z).applyMatrix4(model.matrixWorld);
    const floor=floors.find(o=>o.visible&&Math.abs(o.position.y-local.y)<.026&&o.userData.interiorPolygon&&inside(local.x,local.z,o.userData.interiorPolygon));
    if(!floor||count>=patch.instanceMatrix.count)continue;
    transform.position.set(local.x,floor.position.y+.0025,local.z);
    transform.rotation.set(-Math.PI/2,0,model.rotation.y);
    transform.scale.set(w,d,1);
    transform.updateMatrix();
    patch.setMatrixAt(count++,transform.matrix);
   }
  }
  patch.count=count;
  patch.instanceMatrix.needsUpdate=true;
 }
 function begin(plan,archFloor,archUp,furnG,furniture){
  const window=plan?.id===planId?plan.wins?.[plan.winRefs?.indexOf(windowId)]:null;
  if(!window||window.head<=window.sill||window.rect[2]-window.rect[0]<window.rect[3]-window.rect[1]){
   reset();return;
  }
  if(!field){
   rooms=plan.rooms.filter(room=>roomIds.has(room.id)&&room.poly?.length>=3);
   if(!rooms.length)return;
   mapLight(window,plan.rooms.filter(room=>adjoiningIds.has(room.id)&&room.poly?.length>=3));
   const mask=dataTexture(32,32,(x,y)=>{
    const q=Math.max(Math.abs((x+.5)/16-1),Math.abs((y+.5)/16-1));
    const a=(1-q*q)**2;
    return [255,Math.round(255*a),255,255];
   });
   patch=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({
    color:'#28201b',alphaMap:mask,opacity:.38,transparent:true,depthWrite:false
   }),96);
   patch.count=0;patch.frustumCulled=false;patch.renderOrder=1;
   patch.instanceMatrix.setUsage(T.DynamicDrawUsage);
   overlay.add(patch);
  }
  const accepted=new Set();
  floors=archFloor.children.filter(mesh=>mesh.userData.floor&&roomIds.has(mesh.userData.room));
  for(const floor of floors){
   const room=rooms.find(r=>r.id===floor.userData.room);
   floor.userData.interiorPolygon=room?.poly.map(([x,y])=>[wx(x),wz(y)]);
   accepted.add(floor);paint(floor);
  }
  archUp.updateWorldMatrix(true,true);
  archUp.traverse(mesh=>{
   if(mesh.userData.recessWall||mesh.userData.wallFinish){accepted.add(mesh);paint(mesh);}
  });
  const byId=new Map(furniture.map(f=>[f.id,f]));
  furnG.updateWorldMatrix(true,true);
  supports.clear();
  for(const model of furnG.children){
   const f=byId.get(model.userData.fid);
   if(!f||!roomIds.has(model.userData.floorBase?.roomId))continue;
   model.traverse(mesh=>{if(mesh.isMesh){accepted.add(mesh);paint(mesh);}});
   if(contactTypes.test(f.type)&&!f.pose3D&&model.userData.floorBase.known&&Math.abs(model.position.y-model.userData.floorBase.z/1000)<.025){
    supports.set(model,findSupports(model));
   }
  }
  for(const [mesh,source] of decorated){
   if(accepted.has(mesh))continue;
   mesh.material=source;
   decorated.delete(mesh);
  }
  const used=new Set([...decorated.values()].flat());
  for(const [source,material] of variants)if(!used.has(source)){
   material.dispose();variants.delete(source);
  }
  lastPose='';
  setLight(daylight);
 }
 function setLight(amount){
  daylight=amount;
  uniforms.furnishDaylightStrength.value=daylight;
  for(const [source,material] of variants)if(source.envMap)material.envMapIntensity=source.envMapIntensity;
  if(sky)sky.visible=daylight>0;
  if(patch)patch.material.opacity=daylight>0?.38:.13;
 }
 function reset(){
  for(const [mesh,source] of decorated)mesh.material=source;
  for(const material of variants.values())material.dispose();
  decorated.clear();variants.clear();supports.clear();
  for(const mesh of [sky,patch])if(mesh){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.alphaMap?.dispose();mesh.material.dispose();mesh.dispose?.();overlay.remove(mesh);}
  field?.dispose();uniforms.furnishDaylightMap.value=null;
  patch=sky=field=bounds=null;rooms=[];floors=[];lastPose='';
 }
 return {begin,contacts,setLight,reset,overlay};
}
root.FurnishInteriorDaylight={create};
})(globalThis);
