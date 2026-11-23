/* Room-scoped raster daylight and floor contact for 1601. */
(function(root){
'use strict';
const planId='custom_mv37igji';
const livingRooms=['area_fmv3qb1oi4','area_fmv3p2ig914','area_fmv3qajd93'];
const livingRoomSet=new Set(livingRooms);
const finishRooms=new Set([livingRooms[0],livingRooms[2]]);
const bedrooms=['area_fmv3p1fkz7','area_fmv3oztg03'];
const nightFinishRooms=new Set([...finishRooms,...bedrooms]);
const paintRooms=new Set([...finishRooms,...bedrooms,'bay_cad_window_11_5','bay_cad_window_10_4']);
const adjoiningIds=new Set(['area_fmv3qb1oi5','area_fmv3qcck717']);
const kitchenRoom='area_fmv3qcck717';
const apertures=[
 // Opening ref, room receiving the light, additional continuous or bay floor.
 ['cad_window_9_3','area_fmv3p2ig914',livingRooms],
 ['cad_window_23_6','area_fmv3p2ig914',['area_fmv3p2ig914','area_fmv3qb1oi4']],
 ['cad_window_11_5:front',bedrooms[0],[bedrooms[0],'bay_cad_window_11_5']],
 ['cad_window_8_2',bedrooms[0],[bedrooms[0]]],
 ['cad_window_10_4:front',bedrooms[1],[bedrooms[1],'bay_cad_window_10_4']],
 ['cad_window_6_0','area_fmv3qcck717',['area_fmv3qcck717']],
 ['cad_window_7_1','area_fmv3qdfiz23',['area_fmv3qdfiz23']]
];
const contactTypes=/^(sofa|armchair|chair|coffeetable|table|roundtable|bed|nightstand|desk|cabinet|bookshelf|cat_tree|cat_tower|plant_clivia|plant_spider|aircon_floor)/;
const resolution=192;
const maxApertures=apertures.length+1; // slot zero is always unlit
// Tile lengths in metres and micro-height in metres. Painted boards and
// stone use local board coordinates; veneer uses its existing physical UVs.
const finishSurfaces={
 matte:{uv:'furnishFinishPosition.xy',tile:.115,roughness:.78,variation:.13,height:.000055,tone:1,contrast:.033,channel:'b'},
 stone:{uv:'furnishFinishPosition.xz',tile:.175,roughness:.38,variation:.17,height:.000080,tone:.94,contrast:.09,channel:'r'},
 veneer:{uv:'vMapUv',tile:1,roughness:.56,variation:.15,tone:1,contrast:.045,channel:'r'}
};

function edgeDistance(x,y,polygon){
 let nearest=Infinity;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i],dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  nearest=Math.min(nearest,Math.hypot(x-ax-dx*t,y-ay-dy*t));
 }
 return nearest;
}

// Periodic value noise keeps the small shared finish map seamless, with
// different bands for broad mineral variation and the fine surface grain.
function finishRandom(x,y,cells,seed){
 const a=(x+cells)%cells,b=(y+cells)%cells;
 let hash=Math.imul(a+1,1597334677)^Math.imul(b+1,3812015801)^seed;
 hash=Math.imul(hash^(hash>>>16),2246822519);
 return ((hash^(hash>>>13))>>>0)/4294967295;
}
function finishNoise(x,y,cells,seed){
 const sx=x*cells,sy=y*cells,ix=Math.floor(sx),iy=Math.floor(sy);
 const tx=sx-ix,ty=sy-iy,u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty);
 const at=(a,b)=>finishRandom(a,b,cells,seed);
 const top=at(ix,iy)*(1-u)+at(ix+1,iy)*u;
 const bottom=at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u;
 return top*(1-v)+bottom*v;
}
function latexHeight(x,y){
 const cells=25,s=x*cells,t=y*cells,ix=Math.floor(s),iy=Math.floor(t);
 let nearest=1;
 for(let j=iy-1;j<=iy+1;j++)for(let i=ix-1;i<=ix+1;i++){
  const dx=s-i-.19-.62*finishRandom(i,j,cells,83),dy=t-j-.19-.62*finishRandom(i,j,cells,139);
  nearest=Math.min(nearest,dx*dx+dy*dy);
 }
 const roll=Math.max(0,Math.min(1,(.71-Math.sqrt(nearest))/.64));
 return .78*roll*roll*(3-2*roll)+.22*finishNoise(x,y,64,157);
}

function create(T,scene,{wx,wz,inside}){
 const uniforms={
  furnishDaylightMap:{value:null},furnishDaylightBounds:{value:new T.Vector4()},
  furnishDaylightSources:{value:Array.from({length:maxApertures},()=>new T.Vector4(0,0,0,0))},
  furnishWindowShapes:{value:Array.from({length:maxApertures},()=>new T.Vector4(0,0,0,0))},
  furnishDaylightStrength:{value:0},
  furnishSkyTint:{value:new T.Vector3(.80,.91,1)},
  furnishInteriorSun:{value:new T.Vector4(0,1,0,0)},
  furnishFinishField:{value:null},furnishFinishBounds:{value:new T.Vector4()},
  furnishFinishTexture:{value:null},furnishWallContact:{value:1},
  furnishPaintColor:{value:new T.Color('#f4f1eb')},furnishCeilingAmbient:{value:0},
  furnishNightMap:{value:null},furnishNightBounds:{value:new T.Vector4()},furnishNightActive:{value:0},
  furnishUpperReturn:{value:null},
  furnishWindowRaster:{value:0},furnishWindowEmitter:{value:new T.Vector4(0,0,0,0)},
  furnishWindowPanel:{value:new T.Vector4()},furnishWindowTint:{value:new T.Color()},
  furnishWindowZone:{value:new T.Vector4()},
  furnishFinishLights:{value:[new T.Vector4(),new T.Vector4()]},
  furnishSofaPose:{value:new T.Vector4()},furnishSofaSize:{value:new T.Vector4()},
  furnishSofaVisible:{value:0}
 };
 const decorated=new Map(),variants=new Map(),supports=new Map();
 const inverse=new T.Matrix4(),matrix=new T.Matrix4(),box=new T.Box3();
 const local=new T.Vector3(),center=new T.Vector3(),length=new T.Vector3();
 const transform=new T.Object3D(),skyColor=new T.Color();
 transform.rotation.x=-Math.PI/2;
 const overlay=new T.Group();
 scene.add(overlay);
 let patch,sky,field,finishField,finishTexture,wallsGroup,floors=[],bounds=null,lastPose='',daylight=0,openingsKey='';
 let roomById=new Map(),sofa=null;
 let nightRooms=[],nightSources=[],nightField,upperField,nightKey='',nightEnabled=false;
 let nightSky=false,windowSource;

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
 function mapLight(openings){
  const windows=[];
  for(const [index,[,roomId,ids]] of apertures.entries()){
   const window=openings[index];
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
  uniforms.furnishWindowRaster.value=windows.length?1:0;
 }
 function mapFinishes(archUp,rooms){
  if(!rooms.length)return;
  const points=rooms.flatMap(room=>room.poly);
  const minX=Math.min(...points.map(p=>p[0]))-.20,maxX=Math.max(...points.map(p=>p[0]))+.20;
  const minZ=Math.min(...points.map(p=>p[1]))-.20,maxZ=Math.max(...points.map(p=>p[1]))+.20;
  uniforms.furnishFinishBounds.value.set(minX,minZ,1/(maxX-minX),1/(maxZ-minZ));
  const bases=[];
  archUp.updateWorldMatrix(true,true);
  archUp.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.visible||mesh.userData.walkOnly||!(mesh.userData.recessWall||mesh.userData.wallFinish))return;
   box.setFromObject(mesh);
   if(box.max.x<minX||box.min.x>maxX||box.max.z<minZ||box.min.z>maxZ)return;
   // Sample only wall solids that actually reach the finished floor.
   // Lintels and open doorways leave no footprint.
   if(box.max.y-box.min.y<.20)return;
   const polygon=mesh.userData.wallFinish?.poly?.map(([x,y])=>[wx(x),wz(y)]);
   bases.push({bounds:box.clone(),polygon,runsAlongX:box.max.x-box.min.x>=box.max.z-box.min.z});
  });
  // Preserve the spatial detail of the contact field as painted rooms spread
  // across the plan. The material still samples a single texture.
  const width=Math.min(768,Math.max(256,Math.ceil((maxX-minX)/.016)));
  const height=Math.min(512,Math.max(256,Math.ceil((maxZ-minZ)/.030)));
  finishField=dataTexture(width,height,(i,j)=>{
   const x=minX+(i+.5)/width*(maxX-minX),z=minZ+(j+.5)/height*(maxZ-minZ);
   const room=rooms.find(room=>inside(x,z,room.poly));
   if(!room)return [0,0,0,255];
   const y=room.floor;
   let nearest=.18,alongX=.62,alongZ=.62;
   for(const {bounds:base,polygon,runsAlongX} of bases){
    if(base.min.y>y+.014||base.max.y<y+.08)continue;
    const dx=Math.max(0,base.min.x-x,x-base.max.x),dz=Math.max(0,base.min.z-z,z-base.max.z);
    if(dx>=.62||dz>=.62)continue;
    const distance=polygon?(inside(x,z,polygon)?0:edgeDistance(x,z,polygon)):Math.hypot(dx,dz);
    nearest=Math.min(nearest,distance);
    if(runsAlongX)alongX=Math.min(alongX,distance);else alongZ=Math.min(alongZ,distance);
   }
   const contact=Math.pow(Math.max(0,1-nearest/.18),1.65);
   // Two converging surfaces reduce aperture visibility more than a single
   // flat wall. Door gaps and above-floor solids keep the same exclusions.
   const corner=(1-alongX/.62)*(1-alongZ/.62);
   return [Math.round(255*contact),255,Math.round(255*corner),255];
  });
  uniforms.furnishFinishField.value=finishField;
  finishTexture=dataTexture(128,128,(x,y)=>{
   const u=(x+.5)/128,v=(y+.5)/128;
   const mottling=.53*finishNoise(u,v,5,19)+.31*finishNoise(u,v,13,29)+.16*finishNoise(u,v,29,41);
   const grain=finishNoise(u,v,61,53);
   return [Math.round(255*mottling),Math.round(255*grain),Math.round(255*latexHeight(u,v)),255];
  });
  finishTexture.wrapS=finishTexture.wrapT=T.RepeatWrapping;
  finishTexture.minFilter=T.LinearMipmapLinearFilter;
  finishTexture.generateMipmaps=true;
  uniforms.furnishFinishTexture.value=finishTexture;
 }
 function applySun(shader,soften,aperture){
  let lighting=T.ShaderChunk?.lights_fragment_begin;
  if(!lighting)return;
  if(soften){
   // Negative radius selects the wider filter without changing spot shadows.
   lighting=lighting.replace('directionalLightShadow.shadowRadius, vDirectionalShadowCoord',
    '\n#ifdef SHADOWMAP_TYPE_PCF_SOFT\n-furnishReceiverSpread,\n#else\ndirectionalLightShadow.shadowRadius,\n#endif\nvDirectionalShadowCoord');
  }
  if(aperture){
   lighting=lighting.replace('getDirectionalLightInfo( directionalLight, directLight );',
    `getDirectionalLightInfo( directionalLight, directLight );
     directLight.color*=furnishSunThroughWindow;
     directLight.visible=directLight.visible&&furnishSunThroughWindow>0.0;`);
  }
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lighting);
 }
 function appearance(source,profile,seam,upperReceiver,kitchenReceiver,sunReceiver){
  if(!source?.isMeshStandardMaterial||source.transparent)return source;
  if(!finishField||source.flatShading||(profile==='wall'&&(source.map||source.roughness<.8)))profile='';
  const pool=variants.get(source)||new Map();
  const fineEdge=profile==='cabinet'&&!!seam;
  const variantKey=(fineEdge?profile+':'+seam.toArray().join(','):profile)+'|'+upperReceiver+'|'+kitchenReceiver+'|'+sunReceiver;
  if(pool.has(variantKey))return pool.get(variantKey);
  const material=source.clone();
  const satinTile=source.userData.satinTile===true||profile==='floor'&&!!source.userData.tileFinish?.layout;
  const tileDetail=profile==='floor'&&satinTile;
  const layout=source.userData.tileFinish?.layout;
  const groutHalfWidth=layout?layout.gap/(2*(Math.min(layout.width,layout.height)+layout.gap)):.006;
  const paintDetail=profile==='wall',cabinetDetail=profile==='cabinet';
  const apertureReceiver=sunReceiver==='room'||sunReceiver==='wall'&&paintDetail;
  const ceiling=profile==='ceiling',pile=profile==='pile',stone=profile==='stone';
  const latex=paintDetail||ceiling;
  const replacePaintColor=ceiling||paintDetail&&source.color.getHex()===0x37332b;
  const veneer=profile==='veneer';
  const wood=profile==='wood'||veneer;
  const finishKind=veneer?'veneer':stone?'stone':profile==='matte'?'matte':'';
  const finishSurface=finishSurfaces[finishKind];
  const localFinish=finishSurface&&!veneer;
  if(veneer&&source.normalMap)material.normalScale.multiplyScalar(1.13);
  const finishResponse=pile||stone||wood||cabinetDetail;
  const nightReceiver=ceiling||paintDetail||cabinetDetail;
  const smoothReflection=!!source.envMap&&source.roughness<=.30&&source.metalness===0;
  // Keep source PBR values and pre-existing shaders. Export strips these
  // raster hooks and keeps the source values.
  const cacheKey=source.customProgramCacheKey();
  material.customProgramCacheKey=()=>cacheKey+'|room-daylight-v13|'+smoothReflection+'|'+satinTile+'|'+profile+'|'+fineEdge+'|'+replacePaintColor+'|'+upperReceiver+'|'+kitchenReceiver+'|'+finishKind+'|'+sunReceiver;
  material.onBeforeCompile=function(shader,renderer){
   source.onBeforeCompile.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   if(tileDetail)shader.uniforms.furnishFinishJoint={value:groutHalfWidth};
   if(fineEdge)shader.uniforms.furnishDoorHeights={value:seam};
   shader.vertexShader='varying vec3 furnishInteriorPosition;\n'+(localFinish?'varying vec3 furnishFinishPosition;\n':'')+(cabinetDetail?'varying vec2 furnishBoardPosition;\n':'')+(fineEdge?'varying float furnishIsDoorFace;\n':'')+shader.vertexShader.replace('#include <project_vertex>',`
    #include <project_vertex>
    vec4 furnishInteriorVertex=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     furnishInteriorVertex=instanceMatrix*furnishInteriorVertex;
    #endif
    furnishInteriorPosition=(modelMatrix*furnishInteriorVertex).xyz;
    ${localFinish?'furnishFinishPosition=position;':''}
    ${cabinetDetail?'furnishBoardPosition=position.xy;':''}
    ${fineEdge?'furnishIsDoorFace=abs(normal.z);':''}
   `);
   shader.fragmentShader=`
    varying vec3 furnishInteriorPosition;
    ${localFinish?'varying vec3 furnishFinishPosition;':''}
    uniform sampler2D furnishDaylightMap;
    uniform vec4 furnishDaylightBounds;
    uniform vec4 furnishDaylightSources[${maxApertures}];
    uniform vec4 furnishWindowShapes[${maxApertures}];
    uniform float furnishDaylightStrength;
    uniform vec3 furnishSkyTint;
    uniform vec4 furnishInteriorSun;
    ${replacePaintColor?'uniform vec3 furnishPaintColor;':''}
    ${ceiling?'uniform float furnishCeilingAmbient;':''}
    ${nightReceiver||finishResponse||upperReceiver||kitchenReceiver?`
     uniform sampler2D furnishNightMap;
     uniform vec4 furnishNightBounds;
     uniform float furnishNightActive;
    `:''}
    ${upperReceiver?'uniform sampler2D furnishUpperReturn;':''}
    ${finishResponse?'uniform vec4 furnishFinishLights[2];':''}
    ${profile?`
     uniform sampler2D furnishFinishField;
     uniform vec4 furnishFinishBounds;
     uniform sampler2D furnishFinishTexture;
     uniform float furnishWallContact;
     vec2 furnishFinishUV(vec2 planPoint){
      return (planPoint-furnishFinishBounds.xy)*furnishFinishBounds.zw;
     }
    `:''}
    ${paintDetail?`
     uniform vec4 furnishSofaPose;
     uniform vec4 furnishSofaSize;
     uniform float furnishSofaVisible;
    `:''}
    ${tileDetail?'uniform float furnishFinishJoint;':''}
    ${cabinetDetail?'varying vec2 furnishBoardPosition;':''}
    ${fineEdge?'varying float furnishIsDoorFace; uniform vec2 furnishDoorHeights;':''}
    ${apertureReceiver?`
    float furnishApertureSun(int id){
     if(id==0||furnishDaylightSources[id].w==0.0)return 0.0;
     vec3 delta=furnishDaylightSources[id].xyz-furnishInteriorPosition;
     vec4 window=furnishWindowShapes[id];
     vec3 sun=furnishInteriorSun.xyz;
     float incidence=-dot(sun.xz,window.zw);
     if(incidence<=0.001)return 0.0;
     float travel=-dot(delta.xz,window.zw)/incidence;
     if(travel<0.0)return 0.0;
     vec3 hit=travel*sun-delta;
     vec2 offset=abs(vec2(dot(hit.xz,window.wz),hit.y));
     float edge=0.008+0.0047*travel;
     vec2 coverage=1.0-smoothstep(window.xy-edge,window.xy+edge,offset);
     return coverage.x*coverage.y;
    }
    `:''}
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
     ${pile?`
      float grazing=1.0-clamp(dot(normal,view),0.0,1.0);
      indirectSpecular+=diffuse*tint*(0.28*emitter.w*grazing*grazing)*(0.48+0.52*facing);
     `:stone?`
      // The satin slab retains a broad sky response even when the sharp
      // mirror ray just misses the physical opening.
      indirectSpecular+=tint*(0.22*emitter.w*facing)
       *pow(max(dot(normal,halfVector),0.0),4.5);
     `:wood?`
      indirectSpecular+=diffuse*tint*(0.16*emitter.w*facing)*pow(max(dot(normal,halfVector),0.0),4.0);
     `:''}
     ${cabinetDetail?`
      // Broad satin response from the same window aperture; transparent
      // glazing and hardware retain their existing rendering path.
      float lacquerAngle=1.0-clamp(dot(normal,view),0.0,1.0);
      indirectSpecular+=tint*(emitter.w*facing)*(0.057+0.040*lacquerAngle)
       *pow(max(dot(normal,halfVector),0.0),5.0);
     `:''}
     ${smoothReflection||satinTile?`
      // Project the reflection against this specific aperture plane.
      vec3 ray=(vec4(reflect(-view,normal),0.0)*viewMatrix).xyz;
      float incidence=-dot(ray.xz,aperture.zw);
      float travel=dot(furnishInteriorPosition.xz-source.xz,aperture.zw)/max(incidence,0.001);
      vec3 hit=furnishInteriorPosition+travel*ray-source;
      vec2 offset=abs(vec2(dot(hit.xz,aperture.wz),hit.y));
      float spread=mix(0.48,${stone?'0.71+0.62*roughness':'mix(0.36,1.05,roughness)'},emitter.w);
      vec2 falloff=1.0-smoothstep(aperture.xy*0.55,aperture.xy+spread,offset);
      float weight=falloff.x*falloff.y*step(0.015,incidence)*step(0.0,travel);
      float fresnel=${stone?'0.12+0.32':'0.16+0.24'}*pow(1.0-clamp(dot(view,normal),0.0,1.0),3.0);
      ${satinTile?`
       float lowAngle=1.0-clamp(dot(view,normal),0.0,1.0);
       indirectSpecular+=tint*weight*(0.025+0.11*lowAngle*lowAngle)*emitter.w;
      `:`
       vec3 lightTint=mix(tint,tint*vec3(1.38,1.08,.80),sunward*furnishInteriorSun.w*emitter.w);
       indirectSpecular+=lightTint*weight*fresnel*(1.0+0.34*emitter.w);
      `}
     `:``}
    }
   `+shader.fragmentShader.replace('#include <lights_fragment_begin>',`
    ${apertureReceiver?`
     float furnishSunThroughWindow=1.0;
     float furnishRoomDaylight=0.0;
     if(furnishDaylightStrength>0.0){
      vec2 roomPoint=furnishInteriorPosition.xz;
      ${sunReceiver==='wall'?'roomPoint=wallPlan;':''}
      float interior=${sunReceiver==='wall'?'hasPaint':'1.0'};
      vec2 apertureUV=(roomPoint-furnishDaylightBounds.xy)*furnishDaylightBounds.zw;
      vec2 texel=(floor(apertureUV*${resolution}.0)+0.5)/${resolution}.0;
      vec4 opening=texture2D(furnishDaylightMap,texel);
      ivec2 ids=ivec2(opening.ba*255.0+0.5);
      if(interior>0.0&&furnishDaylightSources[ids.x].w>0.0){
       furnishSunThroughWindow=mix(1.0,max(furnishApertureSun(ids.x),furnishApertureSun(ids.y)),interior);
       vec2 sky=texture2D(furnishDaylightMap,apertureUV).rg;
       furnishRoomDaylight=interior*(0.18+0.22*min(1.0,sky.x+sky.y))*furnishDaylightStrength;
      }
     }
    `:''}
    ${profile?`
     float furnishReceiver=1.0;
     ${paintDetail?`
      furnishReceiver=paintAndCorner.x;
     `:''}
     float furnishReceiverSpread=mix(1.0,2.9,furnishReceiver);
    `:''}
    #include <lights_fragment_begin>
   `).replace('#include <roughnessmap_fragment>',`
    #include <roughnessmap_fragment>
    ${paintDetail?`
     vec3 wallNormal=normalize((vec4(vNormal,0.0)*viewMatrix).xyz);
     vec2 wallPlan=furnishInteriorPosition.xz+wallNormal.xz*.065;
     vec2 paintAndCorner=texture2D(furnishFinishField,furnishFinishUV(wallPlan)).gb;
     float hasPaint=paintAndCorner.x*(1.0-abs(wallNormal.y));
    `:''}
    ${ceiling?`
     vec3 wallNormal=normalize((vec4(vNormal,0.0)*viewMatrix).xyz);
     float hasPaint=1.0;
    `:''}
    ${latex?`
     vec2 paintUV=abs(wallNormal.y)>.70?furnishInteriorPosition.xz:
      abs(wallNormal.x)>abs(wallNormal.z)?furnishInteriorPosition.zy:furnishInteriorPosition.xy;
     vec3 paintGrain=texture2D(furnishFinishTexture,paintUV*5.05).rgb;
     ${replacePaintColor?'diffuseColor.rgb=mix(diffuseColor.rgb,furnishPaintColor,hasPaint);':''}
     diffuseColor.rgb*=mix(1.0,1.0+0.062*(paintGrain.b-.5)+0.023*(paintGrain.r-.5),hasPaint);
     roughnessFactor=mix(roughnessFactor,0.87+0.11*(paintGrain.b-.5),hasPaint);
    `:''}
    ${tileDetail?`
     vec2 cell=floor(vMapUv);
     vec2 finishTileUV=fract(vMapUv);
     vec2 glaze=texture2D(furnishFinishTexture,vMapUv*.72+vec2(.37,.17)).rg;
     float tileTone=fract(sin(dot(cell,vec2(41.39,59.21)))*19341.701);
     vec2 edgeToJoint=min(finishTileUV,1.0-finishTileUV);
     float edge=min(edgeToJoint.x,edgeToJoint.y);
     vec2 tilePixel=fwidth(vMapUv);
     float jointGuard=max(furnishFinishJoint,max(tilePixel.x,tilePixel.y)*.38);
     float interior=smoothstep(jointGuard,jointGuard+.014,edge);
     float rolledEdge=1.0-smoothstep(0.008,0.023,edge);
     diffuseColor.rgb*=mix(1.0,0.975+0.24*(tileTone-.5)+0.28*(glaze.r-.5)+0.04*(glaze.g-.5)-0.065*rolledEdge,interior);
     roughnessFactor=mix(roughnessFactor,0.33+0.29*(glaze.r-.5)+0.08*rolledEdge,interior);
    `:''}
    ${cabinetDetail?`
     vec2 lacquer=texture2D(furnishFinishTexture,furnishBoardPosition*vec2(2.1,1.3)).rg;
     diffuseColor.rgb*=0.985+0.093*(lacquer.r-.5)+0.042*(lacquer.g-.5);
     roughnessFactor=min(roughnessFactor,0.43+0.14*(lacquer.r-.5));
    `:''}
    ${fineEdge?`
     // Prefilter the upper and lower door lip finish, around one
     // screen pixel wide at room distance. Geometry still resolves the gap.
     float toDoorEdge=min(furnishBoardPosition.y-furnishDoorHeights.x,
                          furnishDoorHeights.y-furnishBoardPosition.y);
     vec2 footprint=fwidth(furnishBoardPosition);
     float fade=1.0-smoothstep(0.0,clamp(footprint.y*1.28,0.0008,0.0055),toDoorEdge);
     float edge=fade*smoothstep(0.0008,0.0024,max(footprint.x,footprint.y))
      *smoothstep(0.82,0.98,furnishIsDoorFace);
     diffuseColor.rgb*=1.0-0.23*edge;
     roughnessFactor=mix(roughnessFactor,0.68,0.7*edge);
    `:''}
    ${stone?`
     diffuseColor.rgb*=0.91;
     roughnessFactor=max(roughnessFactor,0.31);
    `:''}
    ${finishSurface?`
     ${veneer?'#ifdef USE_MAP':''}
     vec3 finishGrain=texture2D(furnishFinishTexture,${finishSurface.uv}/${finishSurface.tile.toFixed(4)}).rgb;
     float finishRoughness=${finishSurface.roughness.toFixed(3)}+${finishSurface.variation.toFixed(3)}*(finishGrain.r-.5);
     roughnessFactor=mix(roughnessFactor,finishRoughness,${veneer?'0.42':'0.78'});
     diffuseColor.rgb*=${finishSurface.tone.toFixed(3)}+${finishSurface.contrast.toFixed(3)}*(finishGrain.${finishSurface.channel}-.5);
     ${veneer?'#endif':''}
    `:''}
   `).replace('#include <normal_fragment_maps>',`
    #include <normal_fragment_maps>
    ${latex?`
     // Mipmapped micro-height keeps grazing highlights stable at room scale.
     vec3 paintDx=dFdx(-vViewPosition),paintDy=dFdy(-vViewPosition);
     vec3 paintU=cross(paintDy,normal),paintV=cross(normal,paintDx);
     float paintArea=dot(paintDx,paintU);
     vec2 paintGradient=vec2(dFdx(paintGrain.b),dFdy(paintGrain.b))*0.00027*hasPaint;
     normal=normalize(normal*max(abs(paintArea),1e-10)
      -sign(paintArea)*(paintGradient.x*paintU+paintGradient.y*paintV));
    `:''}
    ${localFinish?`
     vec3 finishDx=dFdx(-vViewPosition),finishDy=dFdy(-vViewPosition);
     vec3 finishU=cross(finishDy,normal),finishV=cross(normal,finishDx);
     float finishArea=dot(finishDx,finishU);
     vec2 finishGradient=vec2(dFdx(finishGrain.b),dFdy(finishGrain.b))*${finishSurface.height.toFixed(6)};
     normal=normalize(normal*max(abs(finishArea),1e-10)
      -sign(finishArea)*(finishGradient.x*finishU+finishGradient.y*finishV));
    `:''}
   `).replace('#include <aomap_fragment>',`
    ${upperReceiver==='ceiling'||ceiling?'':`
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
    `}
    ${upperReceiver?`
     if(furnishNightActive>0.0){
      vec3 upperNormal=normalize((vec4(geometryNormal,0.0)*viewMatrix).xyz);
      vec2 sampleAt=furnishInteriorPosition.xz${upperReceiver==='wall'?'+0.085*upperNormal.xz':''};
      vec2 returnUV=(sampleAt-furnishNightBounds.xy)*furnishNightBounds.zw;
      if(all(greaterThan(returnUV,vec2(0.0)))&&all(lessThan(returnUV,vec2(1.0)))){
       vec4 roomReturn=texture2D(furnishUpperReturn,returnUV);
       ${upperReceiver==='wall'?`
        // A broad floor return rises toward the top of the wall. Using the
        // room height keeps it continuous across soffits and shallow drops.
        float roomHeight=max(1.62,roomReturn.a*6.0);
        float upperGain=0.027*(1.0-abs(upperNormal.y))*
         smoothstep(roomHeight-1.30,roomHeight-0.24,furnishInteriorPosition.y);
       `:`
        float upperGain=${ceiling?'0.014':'0.025'}*max(0.0,-upperNormal.y);
       `}
       reflectedLight.indirectDiffuse+=diffuseColor.rgb*roomReturn.rgb*upperGain*(1.0-metalnessFactor);
      }
     }
    `:''}
    ${kitchenReceiver?`
     if(furnishNightActive>0.0){
      vec3 receiver=normalize((vec4(geometryNormal,0.0)*viewMatrix).xyz);
      vec2 uv=(furnishInteriorPosition.xz+receiver.xz*0.085-furnishNightBounds.xy)*furnishNightBounds.zw;
      vec3 returned=texture2D(furnishNightMap,uv).rgb;
      // Cabinet undersides see the lit worktop and floor. Vertical
      // surfaces receive both this return and adjacent wall scatter.
      float gain=mix(0.32,0.19,abs(receiver.y));
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*returned*gain*(1.0-metalnessFactor);
     }
    `:''}
    #include <aomap_fragment>
    ${ceiling?`
     vec2 openingUV=(furnishInteriorPosition.xz-furnishDaylightBounds.xy)*furnishDaylightBounds.zw;
     vec2 openings=texture2D(furnishDaylightMap,openingUV).rg;
     float skyReturn=min(1.0,openings.x+openings.y)*furnishDaylightStrength*0.045;
     float facingDown=0.28+0.72*max(0.0,-wallNormal.y);
     reflectedLight.indirectDiffuse+=diffuseColor.rgb*hasPaint*facingDown*
      (vec3(0.88,0.94,1.0)*skyReturn+vec3(1.0,0.94,0.84)*furnishCeilingAmbient);
    `:''}
    ${profile==='floor'?`
     vec3 floorProximity=texture2D(furnishFinishField,furnishFinishUV(furnishInteriorPosition.xz)).rgb;
     float floorContact=floorProximity.r*furnishWallContact;
     reflectedLight.indirectDiffuse*=1.0-0.30*floorProximity.b*furnishWallContact;
     reflectedLight.indirectDiffuse*=1.0-0.64*floorContact;
     reflectedLight.directDiffuse*=1.0-0.26*floorContact;
     reflectedLight.indirectSpecular*=1.0-0.48*floorContact;
    `:''}
    ${paintDetail?`
     if(hasPaint>0.0){
      float localCorner=paintAndCorner.y;
      float nearFloor=1.0-smoothstep(0.23,1.48,furnishInteriorPosition.y);
      vec2 toSofa=furnishInteriorPosition.xz-furnishSofaPose.xy;
      float couchX=dot(toSofa,vec2(furnishSofaPose.z,-furnishSofaPose.w));
      float couchZ=dot(toSofa,vec2(furnishSofaPose.w,furnishSofaPose.z));
      float behind=1.0-smoothstep(0.022,0.34,max(0.0,-couchZ-furnishSofaSize.y));
      behind*=1.0-smoothstep(-furnishSofaSize.y+0.015,-furnishSofaSize.y+0.11,couchZ);
      float along=1.0-smoothstep(furnishSofaSize.x-0.05,furnishSofaSize.x+0.18,abs(couchX));
      float above=1.0-smoothstep(furnishSofaSize.w-0.035,furnishSofaSize.w+0.27,furnishInteriorPosition.y);
      float low=smoothstep(furnishSofaSize.z-0.04,furnishSofaSize.z+0.10,furnishInteriorPosition.y);
      float sofaShade=behind*along*above*low*furnishSofaVisible;
      reflectedLight.indirectDiffuse*=1.0-hasPaint*(0.40*localCorner*(0.32+0.68*nearFloor)+0.45*sofaShade);
      // A retained, broad floor bounce softens the transition over the
      // contact zone. The existing room colour and daylight drive the tint.
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(0.95,0.82,0.66)
       *(0.065*nearFloor*(1.0-localCorner)*(1.0-sofaShade)*hasPaint*furnishDaylightStrength);
     }
    `:''}
    ${apertureReceiver?`
     // A broad room return provides light on the far side of the window beam.
     reflectedLight.indirectDiffuse+=diffuseColor.rgb*(1.0-metalnessFactor)
      *vec3(1.0,0.96,0.90)*furnishRoomDaylight;
    `:''}
    ${nightReceiver||finishResponse?`
     if(furnishNightActive>0.0){
      vec3 receiver=normalize((vec4(geometryNormal,0.0)*viewMatrix).xyz);
      vec2 uv=(furnishInteriorPosition.xz+receiver.xz*0.085-furnishNightBounds.xy)*furnishNightBounds.zw;
      if(all(greaterThan(uv,vec2(0.0)))&&all(lessThan(uv,vec2(1.0)))){
       vec4 nightLight=texture2D(furnishNightMap,uv);
       vec3 energy=nightLight.rgb;
       float high=smoothstep(0.95,2.46,furnishInteriorPosition.y);
       ${nightReceiver?`
        float gain=${ceiling?'0.012*max(0.0,-receiver.y)':paintDetail?'0.0038*high*hasPaint':'0.0016*high*(1.0-abs(receiver.y))'};
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*energy*gain;
       `:''}
       ${ceiling?'reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.0,0.86,0.67)*nightLight.a*facingDown*0.024;':''}
       ${finishResponse?`
        vec3 view=normalize(vViewPosition);
        float grazing=1.0-clamp(dot(normal,view),0.0,1.0);
        vec3 lightSum=vec3(0.0);
        for(int i=0;i<2;i++){
         vec4 fixture=furnishFinishLights[i];
         vec3 offset=fixture.xyz-furnishInteriorPosition;
         if(fixture.w<=0.0||offset.y<=0.0)continue;
         float power=fixture.w/(1.0+0.55*dot(offset,offset));
         vec3 lamp=(viewMatrix*vec4(normalize(offset),0.0)).xyz;
         float facing=max(0.0,dot(normal,lamp));
         vec3 h=normalize(view+lamp);
         float lobe=pow(max(0.0,dot(normal,h)),${stone?'5.0':cabinetDetail?'5.0':'3.4'});
         lightSum+=power*${pile?'diffuseColor.rgb*grazing*grazing*(0.20+0.80*facing)*0.075':stone?'vec3((0.133+0.032*grazing)*facing*lobe)':wood?'diffuseColor.rgb*(0.083*facing*lobe)':'vec3(0.028*facing*lobe)'};
        }
        reflectedLight.indirectSpecular+=energy*lightSum;
       `:''}
      }
     }
    `:''}
   `);
   if(profile&&!ceiling||apertureReceiver)applySun(shader,profile&&!ceiling,apertureReceiver);
  };
  pool.set(variantKey,material);variants.set(source,pool);
  return material;
 }
 function paint(mesh,profile='',seam,upperReceiver='',kitchenReceiver=false,sunReceiver=''){
  const previous=decorated.get(mesh);
  if(previous?.sunReceiver===sunReceiver||!bounds||!mesh.isMesh||!box.setFromObject(mesh).intersectsBox(bounds))return;
  const source=previous?.source??mesh.material;
  const variant=m=>appearance(m,profile,seam,upperReceiver,kitchenReceiver,sunReceiver);
  const next=Array.isArray(source)?source.map(variant):variant(source);
  if(previous&&(Array.isArray(next)?next.every((m,i)=>m===previous.next[i]):next===previous.next))return;
  if(Array.isArray(source)?source.every((m,i)=>m===next[i]):source===next)return;
  decorated.set(mesh,{source,next,sunReceiver});
  mesh.material=next;
 }
 function findSupports(model,tightBase){
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
   if(length.x<=.012||length.z<=.012)return;
   if(tightBase&&length.x>.28&&length.z>.06){
    // Draw the narrow front contact of an actual low rigid board.
    parts.unshift([center.x,box.max.z+.018,length.x+.08,.18]);
    parts.push([box.min.x-.012,center.z,.14,length.z+.07],[box.max.x+.012,center.z,.14,length.z+.07]);
   }else parts.push([center.x,center.z,length.x+.19,length.z+.19]);
  });
  return parts.slice(0,8);
 }
 function configureNight(furnG,archUp){
  const heights=new Map();
  archUp.traverse(o=>{
   const key=o.userData.layerObject;
   if(key?.startsWith('roomCeiling:'))heights.set(key.slice(12),o.position.y);
  });
  const floorByRoom=new Map(floors.map(mesh=>[mesh.userData.room,mesh]));
  nightRooms=[...roomById.values()].map(room=>({id:room.id,floor:floorByRoom.get(room.id),
   roof:heights.get(room.id)??(room.ceilingHeight||2700)/1000,
   poly:room.poly.map(([x,y])=>[wx(x),wz(y)])
  }));
  const kitchen=nightRooms.find(room=>room.id===kitchenRoom);
  if(kitchen){
   const xs=kitchen.poly.map(point=>point[0]),zs=kitchen.poly.map(point=>point[1]);
   uniforms.furnishWindowZone.value.set(Math.min(...xs)-.15,Math.min(...zs)-.15,Math.max(...xs)+.15,Math.max(...zs)+.15);
  }
  const points=nightRooms.flatMap(room=>room.poly);
  nightSources=[];nightKey='';
  if(!points.length)return;
  const border=.09;
  const [xmin,zmin,xmax,zmax]=[
   Math.min(...points.map(([x])=>x))-border,Math.min(...points.map(([,z])=>z))-border,
   Math.max(...points.map(([x])=>x))+border,Math.max(...points.map(([,z])=>z))+border
  ];
  uniforms.furnishNightBounds.value.set(xmin,zmin,1/(xmax-xmin),1/(zmax-zmin));
  furnG.traverse(o=>{
   for(const rectangle of o.userData.lightingRects||[]){
    if(!rectangle.material)continue;
    const normal=new T.Vector3().fromArray(rectangle.normal).transformDirection(o.matrixWorld);
    if(Math.abs(normal.y)<.8)continue;
    const position=new T.Vector3().fromArray(rectangle.position).applyMatrix4(o.matrixWorld);
    const room=nightRooms.find(r=>inside(position.x,position.z,r.poly));
    if(!room)continue;
    const floor=room.floor?.material;
    const tint=new T.Color(rectangle.color);
    const upward=normal.y>0;
    const upperTint=tint.clone();
    if(floor&&!upward){
     const base=floor.userData.tileFinish?.color??floor.userData.floorReflectance??floor.color;
     upperTint.multiply(new T.Color(base));
     const {r,g,b}=floor.color;
     tint.multiply(new T.Color(.60+.40*r,.60+.40*g,.60+.40*b));
    }
    const power=Math.min(1.7,rectangle.radiance*rectangle.width*rectangle.height*.58);
    const reach=Math.max(1.35,Math.min(2.15,position.y*.69));
    const axis=upward?new T.Vector3().fromArray(rectangle.u).transformDirection(o.matrixWorld):null;
    const u=room.id===kitchenRoom&&!upward&&rectangle.u&&rectangle.width>=.25&&rectangle.height>=.25?
     new T.Vector3().fromArray(rectangle.u).transformDirection(o.matrixWorld):null;
    nightSources.push({o,rectangle,position,room,tint,upperTint,power,reach,axis,u});
   }
  });
  // Reuse the ceiling wash that has already passed the cove occlusion test.
  archUp.traverse(o=>{
   const energy=o.userData.ceilingWashEnergy;
   if(!o.isMesh||!(energy>0)||!o.userData.ceilingWashApplied)return;
   const wash=root.FurnishCeilingModel?.washMask(o);
   if(!wash?.active)return;
   const position=box.setFromObject(o).getCenter(new T.Vector3());
   const room=nightRooms.find(r=>inside(position.x,position.z,r.poly));
   if(room)nightSources.push({o,position,room,tint:new T.Color('#ffde9e'),power:Math.min(.65,1.35*energy),reach:2.45,cove:wash.active});
  });
 }
 function updateNight(){
  const show=uniforms.furnishNightActive;
  if(!nightEnabled||!nightSources.length){show.value=0;updateWindowEmitter();return;}
  const active=nightSources.filter(({o,rectangle,cove})=>{
   if(rectangle&&(rectangle.enabled===false||rectangle.material.emissiveIntensity<=0))return false;
   if(cove&&!cove())return false;
   for(let node=o;node;node=node.parent)if(!node.visible)return false;
   return true;
  });
  show.value=active.length?1:0;
  updateWindowEmitter(active.find(source=>source.u));
  if(!active.length)return;
  const key=active.map(({o,rectangle,room})=>o.id+':'+(rectangle?.material.id??'cove')+':'+(room.floor?.visible!==false)).join(',');
  if(nightKey===key)return;
  nightKey=key;
  for(const [i,id] of [...finishRooms].entries()){
   const slot=uniforms.furnishFinishLights.value[i];
   const main=active.filter(source=>!source.cove&&!source.axis&&source.room.id===id).sort((a,b)=>b.power-a.power)[0];
   if(main)slot.set(main.position.x,main.position.y,main.position.z,main.power);
   else slot.set(0,0,0,0);
  }
  const {x:xmin,y:zmin,z:sx,w:sz}=uniforms.furnishNightBounds.value;
  const width=Math.min(192,Math.max(80,Math.ceil(1/(sx*.0625))));
  const height=Math.min(192,Math.max(80,Math.ceil(1/(sz*.0625))));
  nightField?.dispose();
  upperField?.dispose();
  const upper=new Uint8Array(width*height*4);
  nightField=dataTexture(width,height,(i,j)=>{
   const x=xmin+(i+.5)/(width*sx),z=zmin+(j+.5)/(height*sz);
   const interior=nightRooms.find(r=>inside(x,z,r.poly));
   // Extend only into unowned texels. Bilinear filtering at the wall no
   // longer pulls black from the other side of its own room boundary.
   let room=interior;
   if(!room){
    let closest=.085;
    for(const candidate of nightRooms){
     const d=edgeDistance(x,z,candidate.poly);
     if(d<closest){closest=d;room=candidate;}
    }
   }
   if(!room)return [0,0,0,0];
   let r=0,g=0,b=0,cove=0,upperR=0,upperG=0,upperB=0;
   for(const source of active){
    if(source.room!==room)continue;
    let dx=x-source.position.x,dz=z-source.position.z;
    if(source.axis){
     const half=source.rectangle.width/2;
     const along=Math.max(-half,Math.min(half,dx*source.axis.x+dz*source.axis.z));
     dx-=along*source.axis.x;dz-=along*source.axis.z;
    }
    const radius=Math.hypot(dx,dz)/source.reach;
    const weight=source.power/(1+radius**4);
    if(source.axis||source.cove||room.floor?.visible!==false){
     const returned=source.power/(1+(radius/1.16)**4)*(source.axis?1.7:source.position.y<room.roof-.80?.45:1);
     const tint=source.upperTint??source.tint;
     upperR+=tint.r*returned;upperG+=tint.g*returned;upperB+=tint.b*returned;
    }
    if((room.id===kitchenRoom||interior&&nightFinishRooms.has(room.id))&&!source.axis){
     if(source.cove)cove+=weight;
     else{r+=source.tint.r*weight;g+=source.tint.g*weight;b+=source.tint.b*weight;}
    }
   }
   const edge=edgeDistance(x,z,room.poly);
   const at=4*(i+j*width);
   const encode=value=>Math.round(255*Math.min(1,value/(1+.85*value)));
   upper.set([encode(upperR),encode(upperG),encode(upperB),Math.round(255*Math.min(1,room.roof/6))],at);
   const distance=Math.min(1,edge/.52);
   const fade=room.id===kitchenRoom?1:distance*distance*(3-2*distance);
   return [r,g,b,cove].map(value=>Math.round(255*fade*Math.min(1,value/(1+.60*value))));
  });
  uniforms.furnishNightMap.value=nightField;
  upperField=new T.DataTexture(upper,width,height);
  upperField.minFilter=upperField.magFilter=T.LinearFilter;upperField.needsUpdate=true;
  uniforms.furnishUpperReturn.value=upperField;
 }
 function contacts(){
  updateNight();
  if(!patch)return;
  uniforms.furnishWallContact.value=wallsGroup?.visible?1:0;
  const entries=[...supports];
  const group=entries[0]?.[0].parent;
  if(!group?.visible||group.scale.y<.99){
   uniforms.furnishSofaVisible.value=0;
   patch.count=0;lastPose='';return;
  }
  const key=entries.map(([model])=>[model.visible,model.position.x,model.position.y,model.position.z,model.rotation.y,model.scale.x].join(',')).join('|')
   +floors.map(floor=>floor.visible?'1':'0').join('');
  if(key===lastPose)return;
  lastPose=key;
  const model=sofa?.model;
  const showSofa=model?.visible&&Math.abs(model.position.y-sofa.floor)<.026;
  uniforms.furnishSofaVisible.value=showSofa?1:0;
  if(showSofa){
   const yaw=model.rotation.y;
   uniforms.furnishSofaPose.value.set(model.position.x,model.position.z,Math.cos(yaw),Math.sin(yaw));
   uniforms.furnishSofaSize.value.set(sofa.width/2,sofa.depth/2,sofa.floor,sofa.floor+sofa.height);
  }
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
  const openings=apertures.map(([ref])=>plan.wins?.[plan.winRefs?.indexOf(ref)]);
  const key=JSON.stringify([wx(0),wz(0),openings,plan.rooms.map(({id,poly,at})=>[id,poly,at])]);
  if(openingsKey!==key){reset();openingsKey=key;}
  if(!patch){
   roomById=new Map(plan.rooms.filter(room=>room.poly?.length>=3).map(room=>[room.id,room]));
   mapLight(openings);
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
  wallsGroup=archUp;
  floors=archFloor.children.filter(mesh=>mesh.userData.floor&&roomById.has(mesh.userData.room));
  for(const floor of floors){
   const room=roomById.get(floor.userData.room);
   floor.userData.interiorPolygon=room?.poly.map(([x,y])=>[wx(x),wz(y)]);
   accepted.add(floor);
  }
  const paintedAreas=[...paintRooms].flatMap(id=>{
   const room=roomById.get(id);
   if(!room)return [];
   const floor=floors.find(mesh=>mesh.userData.room===id);
   return [{poly:floor?.userData.interiorPolygon??room.poly.map(([x,y])=>[wx(x),wz(y)]),
    floor:floor?.position.y??(room.height??0)}];
  });
  if(!finishField)mapFinishes(archUp,paintedAreas);
  for(const floor of floors){
   const room=floor.userData.room;
   paint(floor,finishRooms.has(room)?'floor':'',undefined,'',false,livingRoomSet.has(room)?'room':'');
  }
  archUp.updateWorldMatrix(true,true);
  const paintBounds=paintedAreas.map(({poly})=>new T.Box3().setFromPoints(poly.map(([x,z])=>new T.Vector3(x,0,z))));
  archUp.traverse(mesh=>{
   const roomCeiling=mesh.userData.layerObject?.startsWith('roomCeiling:');
   let paintedGypsum=false;
   if(mesh.isMesh&&mesh.userData.ceilingPaint){
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    // A gypsum piece can continue across a plan zone. Finish the entire
    // piece if its footprint overlaps a painted room.
    paintedGypsum=paintBounds.some(room=>
     Math.min(box.max.x,room.max.x)-Math.max(box.min.x,room.min.x)>.012&&
     Math.min(box.max.z,room.max.z)-Math.max(box.min.z,room.min.z)>.012);
   }
   const part=mesh.userData.ceiling?.part;
   const paintedRoof=roomCeiling&&paintRooms.has(mesh.userData.layerObject.slice(12));
   if(roomCeiling||paintedGypsum||part==='flat'||part==='panel'||part==='panel-trim'){
    accepted.add(mesh);paint(mesh,paintedRoof||paintedGypsum?'ceiling':'',undefined,
     roomCeiling||part==='flat'||part==='panel'||part==='panel-trim'?'ceiling':'');
   }
   if(mesh.userData.recessWall||mesh.userData.wallFinish||mesh.userData.wallTiling||mesh.userData.room?.startsWith('bay_')){
    const wall=mesh.userData.recessWall||mesh.userData.wallFinish;
    accepted.add(mesh);paint(mesh,wall&&!mesh.userData.walkOnly?'wall':'',undefined,
     wall||mesh.userData.wallTiling?'wall':'',mesh.userData.wallTiling?.roomId===kitchenRoom,
     wall||mesh.userData.wallTiling?'wall':'');
   }
  });
  const byId=new Map(furniture.map(f=>[f.id,f]));
  furnG.updateWorldMatrix(true,true);
  configureNight(furnG,archUp);
  supports.clear();sofa=null;
  for(const model of furnG.children){
   const f=byId.get(model.userData.fid);
   if(!f||!roomById.has(model.userData.floorBase?.roomId))continue;
   const base=model.userData.floorBase;
   const scopedCabinet=f.type==='cabinet'&&finishRooms.has(base.roomId);
   const sunReceiver=livingRoomSet.has(base.roomId)?'room':'';
   if(!sofa&&f.type==='sofa_yeswood_cherry'&&finishRooms.has(base.roomId)&&base.known&&!f.pose3D){
    sofa={model,floor:base.z/1000,width:(f.w??2160)/1000,depth:(f.d??892)/1000,height:(f.h??895)/1000};
   }
   model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const part=mesh.userData;
    const satin=scopedCabinet&&(part.cabinetDoorSize||part.cabinetDrawerBoard==='front')&&
     !part.cabinetHardware&&!mesh.material?.map&&mesh.material?.metalness===0;
    const inSuite=finishRooms.has(base.roomId);
    const pile=inSuite&&f.type==='sofa_yeswood_cherry'&&mesh.material?.sheen>0;
    const coffeePart=inSuite&&part.cherryCoffeePart;
    const kitchenReceiver=base.roomId===kitchenRoom&&
     (f.kitchen||f.type==='kitchenwall'||f.type==='rangehood_fotile_jcd10ta')&&!part.cabinetHardware;
    const matte=kitchenReceiver&&(part.cabinetDoorSize||part.cabinetDrawerBoard==='front')&&
     !mesh.material?.map&&mesh.material?.metalness===0;
    const veneer=scopedCabinet&&mesh.material?.map&&part.cabinetSurface&&
     (part.cabinetSurface!=='solid'||part.cabinetSection==='operationBack');
    const finish=pile?'pile':coffeePart==='white-stone'?'stone':
     coffeePart&&mesh.material?.map?'wood':satin?'cabinet':veneer?'veneer':matte?'matte':'';
    let seam;
    if(f.id==='fmv62bwbp1'&&finish==='cabinet'&&part.cabinetDoorSize){
     if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
     const {min,max}=mesh.geometry.boundingBox;
     seam=new T.Vector2(min.y,max.y);
    }
    accepted.add(mesh);paint(mesh,finish,seam,'',!!kitchenReceiver,sunReceiver);
   });
   if(contactTypes.test(f.type)&&!f.pose3D&&model.userData.floorBase.known&&Math.abs(model.position.y-model.userData.floorBase.z/1000)<.025){
    supports.set(model,findSupports(model,scopedCabinet));
   }
  }
  for(const [mesh,{source}] of decorated){
   if(accepted.has(mesh))continue;
   mesh.material=source;
   decorated.delete(mesh);
  }
  const used=new Set([...decorated.values()].flatMap(entry=>entry.next));
  for(const [source,pool] of variants){
   for(const [profile,material] of pool)if(!used.has(material)){
    material.dispose();pool.delete(profile);
   }
   if(!pool.size)variants.delete(source);
  }
  lastPose='';
  setLight(daylight);
 }
 // Keep the production pane material identity for picking and export.
 function prepareGlass(material){
  const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.customProgramCacheKey=()=>key+'|interior-window-raster';
  material.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   for(const name of ['furnishWindowRaster','furnishWindowEmitter','furnishWindowPanel','furnishWindowTint','furnishWindowZone']){
    shader.uniforms[name]=uniforms[name];
   }
   shader.vertexShader='varying vec3 furnishWindowPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`
    #include <project_vertex>
    furnishWindowPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
   `);
   shader.fragmentShader=`
    varying vec3 furnishWindowPosition;
    uniform float furnishWindowRaster;
    uniform vec4 furnishWindowEmitter;
    uniform vec4 furnishWindowPanel;
    uniform vec3 furnishWindowTint;
    uniform vec4 furnishWindowZone;
   `+shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
     #include <roughnessmap_fragment>
     // Discrete spot samples approximate broad emitters in the viewport.
     roughnessFactor=mix(roughnessFactor,max(roughnessFactor,0.20),furnishWindowRaster);
    `).replace('#include <opaque_fragment>',`
     if(furnishWindowRaster>0.0){
      vec3 windowView=normalize(vViewPosition);
      float glassFacing=abs(dot(windowView,normal));
      float windowFresnel=pow(1.0-clamp(glassFacing,0.0,1.0),5.0);
      diffuseColor.a=mix(diffuseColor.a,1.0,0.33*windowFresnel);
      vec2 pane=furnishWindowPosition.xz;
      if(gl_FrontFacing&&furnishWindowEmitter.w>0.0&&all(greaterThanEqual(pane,furnishWindowZone.xy))
       &&all(lessThanEqual(pane,furnishWindowZone.zw))){
       vec3 reflectedRay=(vec4(reflect(-windowView,normal),0.0)*viewMatrix).xyz;
       if(reflectedRay.y>0.015){
        vec3 delta=furnishWindowEmitter.xyz-furnishWindowPosition;
        float travel=delta.y/reflectedRay.y;
        vec2 offset=reflectedRay.xz*travel-delta.xz;
        vec2 axis=furnishWindowPanel.zw;
        vec2 at=vec2(dot(offset,axis),dot(offset,vec2(-axis.y,axis.x)));
        vec2 extent=furnishWindowPanel.xy;
        vec2 edge=1.0-smoothstep(extent*0.62,extent+0.045*max(0.0,travel),abs(at));
        float reflectance=(0.04+0.96*windowFresnel)*step(0.0,travel)*edge.x*edge.y;
        outgoingLight+=furnishWindowTint*reflectance*furnishWindowEmitter.w;
       }
      }
     }
     #include <opaque_fragment>
    `);
  };
 }
 function updateSky(){
  if(!sky)return;
  sky.visible=daylight>0||nightSky;
  if(!sky.visible)return;
  const sun=uniforms.furnishInteriorSun.value;
  for(let i=0;i<sky.count;i++){
   if(nightSky)skyColor.setRGB(.012,.019,.036);
   else{
    const opening=uniforms.furnishDaylightSources.value[i+1],shape=uniforms.furnishWindowShapes.value[i+1];
    const facing=Math.max(0,-shape.z*sun.x-shape.w*sun.z);
    const low=opening.w*sun.w,glow=low*facing;
    skyColor.setRGB(1-.10*low,1-.16*low+.09*glow,1-.23*low+.08*glow);
   }
   sky.setColorAt(i,skyColor);
  }
  if(sky.instanceColor)sky.instanceColor.needsUpdate=true;
 }
 function updateWindowEmitter(source){
  if(source===windowSource)return;
  windowSource=source;
  const emitter=uniforms.furnishWindowEmitter.value;
  if(!source){emitter.w=0;return;}
  const {position,rectangle,u}=source;
  emitter.set(position.x,position.y,position.z,Math.min(.35,rectangle.radiance));
  uniforms.furnishWindowTint.value.set(rectangle.color);
  uniforms.furnishWindowPanel.value.set(rectangle.width/2,rectangle.height/2,u.x,u.z);
 }
 function setLight(amount,solar){
  daylight=amount;
  uniforms.furnishDaylightStrength.value=daylight;
  for(const [source,pool] of variants)if(source.envMap)for(const material of pool.values())material.envMapIntensity=source.envMapIntensity;
  const {furnishInteriorSun:sun,furnishSkyTint:tint}=uniforms;
  if(solar){
   center.set(...solar.position).normalize();
   const low=Math.max(0,Math.min(1,solar.warm));
   sun.value.set(center.x,center.y,center.z,low);
   tint.value.set(.80+.44*low,.91-.02*low,1-.42*low);
  }
  updateSky();
  if(patch)patch.material.opacity=daylight>0?.38:.13;
 }
 function reset(){
  for(const [mesh,{source}] of decorated)mesh.material=source;
  for(const pool of variants.values())for(const material of pool.values())material.dispose();
  decorated.clear();variants.clear();supports.clear();
  for(const mesh of [sky,patch])if(mesh){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.alphaMap?.dispose();mesh.material.dispose();mesh.dispose?.();overlay.remove(mesh);}
  field?.dispose();uniforms.furnishDaylightMap.value=null;
  nightField?.dispose();nightField=null;nightKey='';nightSources=[];nightRooms=[];
  upperField?.dispose();upperField=null;uniforms.furnishUpperReturn.value=null;
  uniforms.furnishNightMap.value=null;uniforms.furnishNightActive.value=0;
  uniforms.furnishWindowRaster.value=0;updateWindowEmitter();
  finishField?.dispose();finishTexture?.dispose();
  uniforms.furnishFinishField.value=uniforms.furnishFinishTexture.value=null;
  patch=sky=field=finishField=finishTexture=wallsGroup=bounds=null;roomById.clear();floors=[];sofa=null;uniforms.furnishSofaVisible.value=0;lastPose='';openingsKey='';
 }
 function setNight(enabled,ambient=0){
  nightEnabled=enabled;
  const nextSky=enabled||ambient>0;
  if(nightSky!==nextSky){nightSky=nextSky;updateSky();}
  uniforms.furnishCeilingAmbient.value=ambient*.44;
 }
 function panelRoom(position){
  const room=nightRooms.find(room=>room.id===kitchenRoom);
  if(room&&inside(position.x,position.z,room.poly))return room.id;
 }
 return {begin,contacts,setLight,setNight,reset,overlay,panelRoom,prepareGlass};
}
root.FurnishInteriorDaylight={create};
})(globalThis);
