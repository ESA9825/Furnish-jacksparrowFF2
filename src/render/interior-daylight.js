/* Room-scoped raster daylight and floor contact for 1601. */
(function(root){
'use strict';
const planId='custom_mv37igji';
const livingRooms=['area_fmv3qb1oi4','area_fmv3p2ig914','area_fmv3qajd93'];
const adjoiningIds=new Set(['area_fmv3qb1oi5','area_fmv3qcck717']);
const apertures=[
 // Opening ref, room receiving the light, additional continuous or bay floor.
 ['cad_window_9_3','area_fmv3p2ig914',livingRooms],
 ['cad_window_23_6','area_fmv3p2ig914',['area_fmv3p2ig914','area_fmv3qb1oi4']],
 ['cad_window_11_5:front','area_fmv3p1fkz7',['area_fmv3p1fkz7','bay_cad_window_11_5']],
 ['cad_window_8_2','area_fmv3p1fkz7',['area_fmv3p1fkz7']],
 ['cad_window_10_4:front','area_fmv3oztg03',['area_fmv3oztg03','bay_cad_window_10_4']],
 ['cad_window_6_0','area_fmv3qcck717',['area_fmv3qcck717']],
 ['cad_window_7_1','area_fmv3qdfiz23',['area_fmv3qdfiz23']]
];
const contactTypes=/^(sofa|armchair|chair|coffeetable|table|roundtable|bed|nightstand|desk|cabinet|bookshelf|cat_tree|cat_tower|plant_clivia|plant_spider|aircon_floor)/;
const resolution=192;
const maxApertures=apertures.length+1; // slot zero is always unlit

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
  furnishDaylightSources:{value:Array.from({length:maxApertures},()=>new T.Vector4(0,0,0,0))},
  furnishWindowShapes:{value:Array.from({length:maxApertures},()=>new T.Vector4(0,0,0,0))},
  furnishDaylightStrength:{value:0},
  furnishSkyTint:{value:new T.Vector3(.80,.91,1)},
  furnishInteriorSun:{value:new T.Vector4(0,1,0,0)}
 };
 const decorated=new Map(),variants=new Map(),supports=new Map();
 const inverse=new T.Matrix4(),matrix=new T.Matrix4(),box=new T.Box3();
 const local=new T.Vector3(),center=new T.Vector3(),length=new T.Vector3();
 const transform=new T.Object3D(),skyColor=new T.Color();
 transform.rotation.x=-Math.PI/2;
 const overlay=new T.Group();
 scene.add(overlay);
 let patch,sky,field,floors=[],bounds=null,lastPose='',daylight=0;
 let roomById=new Map();

 function dataTexture(width,height,fill){
  const bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes.set(fill(x,y),4*(x+y*width));
  const texture=new T.DataTexture(bytes,width,height);
  texture.minFilter=texture.magFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
 }
 function opening(rectWindow,room,lightRooms,id){
  const {rect:[left,front,right,back],sill,head}=rectWindow;
  const alongX=right-left>=back-front;
  const x=(left+right)/2,y=(front+back)/2;
  const center=room.at||room.poly.reduce(([a,b],[u,v])=>[a+u/room.poly.length,b+v/room.poly.length],[0,0]);
  const normal=(alongX?center[1]-y:center[0]-x)>=0?1:-1;
  const inner=alongX?(normal>0?back:front):(normal>0?right:left);
  const outer=alongX?(normal>0?front:back):(normal>0?left:right);
  const width=alongX?right-left:back-front;
  return {id,lightRooms,alongX,normal,inner,outer,width,x,y,sill,head};
 }
 function mapLight(plan){
  const windows=[];
  for(const [ref,roomId,ids] of apertures){
   const window=plan.wins?.[plan.winRefs?.indexOf(ref)];
   const room=roomById.get(roomId);
   if(!room||!window||!(window.head>window.sill))continue;
   windows.push(opening(window,room,new Set(ids),windows.length+1));
  }
  if(!windows.length)return;
  const corners=[...roomById.values()].flatMap(room=>room.poly);
  const xmin=Math.min(...corners.map(p=>p[0]))-160,xmax=Math.max(...corners.map(p=>p[0]))+160;
  const ymin=Math.min(...corners.map(p=>p[1]))-160,ymax=Math.max(...corners.map(p=>p[1]))+160;
  bounds=new T.Box3(new T.Vector3(wx(xmin),-.15,wz(ymin)),new T.Vector3(wx(xmax),3.3,wz(ymax)));
  uniforms.furnishDaylightBounds.value.set(wx(xmin),wz(ymin),1000/(xmax-xmin),1000/(ymax-ymin));
  for(const w of windows){
   uniforms.furnishDaylightSources.value[w.id].set(wx(w.alongX?w.x:w.inner),(w.sill+w.head)/2,wz(w.alongX?w.inner:w.y),w.lightRooms.has(livingRooms[0])?1:0);
   uniforms.furnishWindowShapes.value[w.id].set(w.width/2000,(w.head-w.sill)/2,w.alongX?0:w.normal,w.alongX?w.normal:0);
  }
  const rooms=[...roomById.values()];
  const adjoining=rooms.filter(room=>adjoiningIds.has(room.id));
  const litRooms=rooms.filter(room=>windows.some(w=>w.lightRooms.has(room.id)));
  field=dataTexture(resolution,resolution,(i,j)=>{
   const x=xmin+(i+.5)/resolution*(xmax-xmin),y=ymin+(j+.5)/resolution*(ymax-ymin);
   // Use the exact owning room first. The allowance lights the wall faces
   // beside furniture and room footprints without crossing into a neighbor.
   const exact=rooms.find(room=>inside(x,y,room.poly));
   const near=exact?[exact]:litRooms.filter(room=>edgeDistance(x,y,room.poly)<=90);
   const weights=[];
   for(const w of windows){
    if(!near.some(room=>w.lightRooms.has(room.id)))continue;
    const lateral=Math.max(0,Math.abs(w.alongX?x-w.x:y-w.y)-w.width/2);
    const depth=Math.max(0,((w.alongX?y:x)-w.inner)*w.normal);
    const edge=w.lightRooms.has(livingRooms[2])?
     Math.min(1,...adjoining.map(room=>edgeDistance(x,y,room.poly)/780)):1;
    const area=Math.min(1,Math.sqrt(w.width*(w.head-w.sill)/2500));
    const soft=area*Math.exp(-depth/(w.width*1.25)-lateral*lateral/600000)*edge*edge*(3-2*edge);
    weights.push([Math.round(soft*255),w.id]);
   }
   // Keep aperture slots stable inside a room even where one side is faint.
   const [a=[0,0],b=[0,0]]=weights;
   // An empty texel still has well-defined source zero for the shader.
   return [a[0],b[0],a[1],b[1]];
  });
  uniforms.furnishDaylightMap.value=field;

  const skyMap=dataTexture(1,32,(_,y)=>{
   const t=y/31;
   return [Math.round(239-38*t),Math.round(242-24*t),Math.round(239-4*t),255];
  });
  skyMap.colorSpace=T.SRGBColorSpace;
  sky=new T.InstancedMesh(new T.PlaneGeometry(1,1),
   new T.MeshBasicMaterial({map:skyMap,toneMapped:false}),windows.length);
  const apertureTransform=new T.Object3D();
  for(const [i,w] of windows.entries()){
   const outer=w.outer-.01*1000*w.normal;
   apertureTransform.position.set(wx(w.alongX?w.x:outer),(w.sill+w.head)/2,wz(w.alongX?outer:w.y));
   apertureTransform.rotation.y=Math.atan2(w.alongX?0:w.normal,w.alongX?w.normal:0);
   apertureTransform.scale.set(w.width/1000,w.head-w.sill,1);
   apertureTransform.updateMatrix();
   sky.setMatrixAt(i,apertureTransform.matrix);
  }
  overlay.add(sky);
 }
 function appearance(source){
  if(!source?.isMeshStandardMaterial||source.transparent)return source;
  if(variants.has(source))return variants.get(source);
  const material=source.clone();
  const satinTile=source.userData.satinTile===true;
  const smoothReflection=!!source.envMap&&source.roughness<=.30&&source.metalness===0;
  // Keep source PBR values and pre-existing shaders. Export strips these
  // raster hooks and keeps the source values.
  const cacheKey=source.customProgramCacheKey();
  material.customProgramCacheKey=()=>cacheKey+'|room-daylight-v3|'+smoothReflection+'|'+satinTile;
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
    uniform vec4 furnishDaylightSources[${maxApertures}];
    uniform vec4 furnishWindowShapes[${maxApertures}];
    uniform float furnishDaylightStrength;
    uniform vec3 furnishSkyTint;
    uniform vec4 furnishInteriorSun;
    void furnishWindowLight(int sourceIndex,float energy,vec3 normal,vec3 view,vec3 diffuse,
                            float metalness,float roughness,inout vec3 indirectDiffuse,inout vec3 indirectSpecular){
     if(sourceIndex==0||energy<=0.0)return;
     vec4 emitter=furnishDaylightSources[sourceIndex];
     vec3 source=emitter.xyz;
     vec4 aperture=furnishWindowShapes[sourceIndex];
     vec3 towards=normalize(source-furnishInteriorPosition+vec3(0.0,0.0,-0.001));
     vec3 direction=(viewMatrix*vec4(towards,0.0)).xyz;
     float facing=clamp(dot(normal,direction),0.0,1.0);
     vec3 tint=vec3(0.80,0.91,1.0)*energy;
     vec3 bounce=vec3(0.0);
     float sunward=max(0.0,-dot(aperture.zw,furnishInteriorSun.xz));
     if(emitter.w>0.0){
      tint=furnishSkyTint*energy;
      float underside=max(-dot(normal,viewMatrix[1].xyz),0.0);
      vec3 bounceTint=mix(vec3(0.65,0.50,0.35),vec3(1.00,0.46,0.19),furnishInteriorSun.w);
      bounce=bounceTint*energy*(0.055+0.18*underside)*(0.80+0.20*sunward);
     }
     indirectDiffuse+=diffuse*(tint*(0.27+0.51*facing)+bounce)*(1.0-metalness);
     float gloss=1.0-roughness;
     vec3 halfVector=normalize(direction+view);
     indirectSpecular+=tint*(0.03+0.12*metalness)*gloss*facing
       *pow(max(dot(normal,halfVector),0.0),mix(5.0,30.0,gloss));
     ${smoothReflection||satinTile?`
      // Project the reflection against this specific aperture plane.
      vec3 ray=(vec4(reflect(-view,normal),0.0)*viewMatrix).xyz;
      float incidence=-dot(ray.xz,aperture.zw);
      float travel=dot(furnishInteriorPosition.xz-source.xz,aperture.zw)/max(incidence,0.001);
      vec3 hit=furnishInteriorPosition+travel*ray-source;
      vec2 offset=abs(vec2(dot(hit.xz,aperture.wz),hit.y));
      float spread=mix(0.48,mix(0.36,1.05,roughness),emitter.w);
      vec2 falloff=1.0-smoothstep(aperture.xy*0.55,aperture.xy+spread,offset);
      float weight=falloff.x*falloff.y*step(0.015,incidence)*step(0.0,travel);
      float fresnel=0.16+0.24*pow(1.0-clamp(dot(view,normal),0.0,1.0),3.0);
      ${satinTile?`
       float lowAngle=1.0-clamp(dot(view,normal),0.0,1.0);
       indirectSpecular+=tint*weight*(0.025+0.11*lowAngle*lowAngle)*emitter.w;
      `:`
       vec3 lightTint=mix(tint,tint*vec3(1.38,1.08,.80),sunward*furnishInteriorSun.w*emitter.w);
       indirectSpecular+=lightTint*weight*fresnel*(1.0+0.34*emitter.w);
      `}
     `:``}
    }
   `+shader.fragmentShader.replace('#include <aomap_fragment>',`
    if(furnishDaylightStrength>0.0){
     vec2 uv=(furnishInteriorPosition.xz-furnishDaylightBounds.xy)*furnishDaylightBounds.zw;
     vec2 energy=texture2D(furnishDaylightMap,uv).rg*furnishDaylightStrength;
     if(max(energy.x,energy.y)>0.0){
      vec2 nearestUV=(floor(uv*${resolution}.0)+0.5)/${resolution}.0;
      ivec2 ids=ivec2(texture2D(furnishDaylightMap,nearestUV).ba*255.0+0.5);
      // Retain the global ambient for all other rooms. In the living suite,
      // some of that fill is reassigned to window-facing diffuse light.
      if(furnishDaylightSources[ids.x].w>0.0){
       float localFill=smoothstep(0.0,0.15,energy.x);
       float ambientShare=0.10+0.30*furnishInteriorSun.w;
       reflectedLight.indirectDiffuse*=1.0-ambientShare*localFill;
      }
      vec3 view=normalize(vViewPosition);
      furnishWindowLight(ids.x,energy.x,normal,view,diffuseColor.rgb,metalnessFactor,roughnessFactor,
                         reflectedLight.indirectDiffuse,reflectedLight.indirectSpecular);
      furnishWindowLight(ids.y,energy.y,normal,view,diffuseColor.rgb,metalnessFactor,roughnessFactor,
                         reflectedLight.indirectDiffuse,reflectedLight.indirectSpecular);
     }
    }
    #include <aomap_fragment>`);
  };
  variants.set(source,material);
  return material;
 }
 function paint(mesh){
  if(!bounds||!mesh.isMesh||decorated.has(mesh)||!box.setFromObject(mesh).intersectsBox(bounds))return;
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
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
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
  if(plan?.id!==planId||!plan.rooms?.length){
   reset();return;
  }
  if(!patch){
   roomById=new Map(plan.rooms.filter(room=>room.poly?.length>=3).map(room=>[room.id,room]));
   mapLight(plan);
   const mask=dataTexture(32,32,(x,y)=>{
    const q=Math.max(Math.abs((x+.5)/16-1),Math.abs((y+.5)/16-1));
    const a=(1-q*q)**2;
    return [255,Math.round(255*a),255,255];
   });
   patch=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({
    color:'#28201b',alphaMap:mask,opacity:.38,transparent:true,depthWrite:false
   }),256);
   patch.count=0;patch.frustumCulled=false;patch.renderOrder=1;
   patch.instanceMatrix.setUsage(T.DynamicDrawUsage);
   overlay.add(patch);
  }
  const accepted=new Set();
  floors=archFloor.children.filter(mesh=>mesh.userData.floor&&roomById.has(mesh.userData.room));
  for(const floor of floors){
   const room=roomById.get(floor.userData.room);
   floor.userData.interiorPolygon=room?.poly.map(([x,y])=>[wx(x),wz(y)]);
   accepted.add(floor);paint(floor);
  }
  archUp.updateWorldMatrix(true,true);
  archUp.traverse(mesh=>{
   if(mesh.userData.recessWall||mesh.userData.wallFinish||mesh.userData.wallTiling||mesh.userData.room?.startsWith('bay_')){accepted.add(mesh);paint(mesh);}
  });
  const byId=new Map(furniture.map(f=>[f.id,f]));
  furnG.updateWorldMatrix(true,true);
  supports.clear();
  for(const model of furnG.children){
   const f=byId.get(model.userData.fid);
   if(!f||!roomById.has(model.userData.floorBase?.roomId))continue;
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
 function setLight(amount,solar){
  daylight=amount;
  uniforms.furnishDaylightStrength.value=daylight;
  for(const [source,material] of variants)if(source.envMap)material.envMapIntensity=source.envMapIntensity;
  const {furnishInteriorSun:sun,furnishSkyTint:tint}=uniforms;
  if(solar){
   center.set(...solar.position).normalize();
   const low=Math.max(0,Math.min(1,solar.warm));
   sun.value.set(center.x,center.y,center.z,low);
   tint.value.set(.80+.44*low,.91-.02*low,1-.42*low);
  }
  if(sky){
   sky.visible=daylight>0;
   if(daylight>0){
    for(let i=0;i<sky.count;i++){
     const opening=uniforms.furnishDaylightSources.value[i+1],shape=uniforms.furnishWindowShapes.value[i+1];
     const facing=Math.max(0,-shape.z*sun.value.x-shape.w*sun.value.z);
     const low=opening.w*sun.value.w,glow=low*facing;
     skyColor.setRGB(1-.10*low,1-.16*low+.09*glow,1-.23*low+.08*glow);
     sky.setColorAt(i,skyColor);
    }
    sky.instanceColor.needsUpdate=true;
   }
  }
  if(patch)patch.material.opacity=daylight>0?.38:.13;
 }
 function reset(){
  for(const [mesh,source] of decorated)mesh.material=source;
  for(const material of variants.values())material.dispose();
  decorated.clear();variants.clear();supports.clear();
  for(const mesh of [sky,patch])if(mesh){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.alphaMap?.dispose();mesh.material.dispose();mesh.dispose?.();overlay.remove(mesh);}
  field?.dispose();uniforms.furnishDaylightMap.value=null;
  patch=sky=field=bounds=null;roomById.clear();floors=[];lastPose='';
 }
 return {begin,contacts,setLight,reset,overlay};
}
root.FurnishInteriorDaylight={create};
})(globalThis);
