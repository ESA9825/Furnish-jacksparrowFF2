/* Production floor layer solids in metres; grid UVs use the original mm datum. */
(function(root){
'use strict';
// Stable authoring-site labels: keep existing labels when moving code; allocate new labels for new sites.
const syncIdentity=root.FurnishPartIdentity||(typeof require==='function'?require('../core/part-identity.js'):null);

const ceramics=Object.freeze({tile800:.49,tile600:.53,antislip:.78});
const ceramic=kind=>Object.hasOwn(ceramics,kind);
const tileCoats=Object.freeze({
 satin:{roughness:.46,clearcoat:.27,clearcoatRoughness:.34,reflection:.57,feather:.34},
 gloss:{roughness:.13,clearcoat:.64,clearcoatRoughness:.12,reflection:2.35,feather:.045},
 matte:{roughness:.86,clearcoat:.025,clearcoatRoughness:.78,reflection:.075,feather:.78}
});
const tileCoat=id=>Object.hasOwn(tileCoats,id)?tileCoats[id]:undefined;
const maxWindows=4;
const tileWindows=new WeakMap();
const windowDivisions=(widthMetres,panels)=>panels===3?3:Math.max(1,Math.round(widthMetres/.9));
function roomWindows(windows,room,{wx,wz,inside}){
 if(!room)return [];
 const shapes=room.polys||[room.poly];
 return windows.flatMap(({rect:[a,b,c,d],sill,head=2.4,panels})=>{
  if(!(head>sill))return [];
  const alongX=c-a>=d-b,x=(a+c)/2,z=(b+d)/2,width=alongX?c-a:d-b;
  const side=[-1,1].find(sign=>[0,-.32,.32].some(t=>shapes.some(poly=>inside(
   alongX?x+t*width:sign>0?c+85:a-85,alongX?sign>0?d+85:b-85:z+t*width,poly))));
  if(!side)return [];
  return [{center:[wx(alongX?x:side>0?c:a),(head+sill)/2,wz(alongX?side>0?d:b:z)],divisions:windowDivisions(width/1000,panels),
   shape:[width/2000,(head-sill)/2,alongX?0:side,alongX?side:0]}];
 }).sort((a,b)=>b.shape[0]*b.shape[1]-a.shape[0]*a.shape[1]).slice(0,maxWindows);
}
function tileReflection(THREE,material,windows,daylight,joint='0.0'){
 const coat=tileCoat(material.userData.floorTileSheen);
 if(!coat||!windows?.length)return;
 const prior=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
 const centers={value:Array.from({length:maxWindows},(_,i)=>new THREE.Vector4(...(windows[i]?.center||[0,0,0]),windows[i]?.divisions||1))};
 const shapes={value:Array.from({length:maxWindows},(_,i)=>new THREE.Vector4(...(windows[i]?.shape||[0,0,0,0])))};
 material.customProgramCacheKey=()=>cacheKey+'|tile-window-v2|'+joint;
 material.onBeforeCompile=function(shader,renderer){
  prior.call(this,shader,renderer);
  Object.assign(shader.uniforms,{furnishTileWindowCenters:centers,furnishTileWindowShapes:shapes,
   furnishTileSky:daylight,furnishTileCoat:{value:new THREE.Vector2(coat.reflection,coat.feather)}});
  shader.vertexShader='varying vec3 furnishTileWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   furnishTileWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
  `);
  shader.fragmentShader=`varying vec3 furnishTileWorld;
   uniform vec4 furnishTileWindowCenters[${maxWindows}];
   uniform vec4 furnishTileWindowShapes[${maxWindows}];
   uniform vec4 furnishTileSky;
   uniform vec2 furnishTileCoat;
  `+shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   if(furnishTileSky.a>0.0){
    vec3 observer=normalize(vViewPosition);
    vec3 ray=inverseTransformDirection(reflect(-observer,normal),viewMatrix);
    float edge=1.0-clamp(dot(observer,normal),0.0,1.0);
    float sheen=0.0;
    for(int i=0;i<${maxWindows};i++){
     vec4 shape=furnishTileWindowShapes[i];
     float incidence=-dot(ray.xz,shape.zw);
     if(shape.x<=0.0||incidence<=0.015)continue;
     vec4 window=furnishTileWindowCenters[i];
     vec3 fromWindow=furnishTileWorld-window.xyz;
     float travel=dot(fromWindow.xz,shape.zw)/incidence;
     if(travel<=0.0)continue;
     vec3 hit=fromWindow+ray*travel;
     float lateral=dot(hit.xz,shape.wz);
     vec2 distance=abs(vec2(lateral,hit.y));
     vec2 falloff=1.0-smoothstep(max(vec2(0.001),shape.xy-furnishTileCoat.y),shape.xy+furnishTileCoat.y,distance);
     float paneWidth=2.0*shape.x/window.w;
     float frame=abs(fract((lateral+shape.x)/paneWidth+0.5)-0.5)*paneWidth;
     float panes=mix(0.22+0.78*smoothstep(0.012,0.051,frame),1.0,smoothstep(0.05,0.30,furnishTileCoat.y));
     sheen=max(sheen,panes*falloff.x*falloff.y/(1.0+0.025*travel*travel));
    }
    reflectedLight.indirectSpecular+=furnishTileSky.rgb*furnishTileSky.a*furnishTileCoat.x
     *sheen*(0.11+0.34*edge*edge)*(1.0-${joint});
   }
  `);
 };
 tileWindows.set(material.onBeforeCompile,{windows,daylight,joint});
}
function copyTileReflection(THREE,from,to,{alreadyWrapped=false}={}){
 const reflection=tileWindows.get(from.onBeforeCompile);
 if(!reflection)return;
 if(alreadyWrapped)tileWindows.set(to.onBeforeCompile,reflection);
 else tileReflection(THREE,to,reflection.windows,reflection.daylight,reflection.joint);
}
// Presentation parameters for the supplied texture scans.
const floorCoats=Object.freeze({
 oak_wood_planks:{tint:'#f4f8ff',reflectance:'#a5754c',normal:.38,roughness:.94,coat:.19,coatRoughness:.36,windowSheen:.75},
 plank_flooring_04:{tint:'#f8f9ff',reflectance:'#563c2d',normal:.46,roughness:.95,coat:.18,coatRoughness:.40,windowSheen:.65},
 herringbone_parquet:{tint:'#f0f6ff',reflectance:'#a78553',normal:.37,roughness:.9,coat:.28,coatRoughness:.31,windowSheen:1},
 interior_tiles:{tint:'#f6faff',reflectance:'#b8a48a',normal:.54,roughness:.96,coat:.32,coatRoughness:.32,windowSheen:1.15}
});
const faceSize=256;
const grain=new Map();
function noise(x,y,scale,seed){
 const px=x*scale/faceSize,py=y*scale/faceSize,ix=Math.floor(px),iy=Math.floor(py);
 const smooth=t=>t*t*(3-2*t),u=smooth(px-ix),v=smooth(py-iy);
 const at=(a,b)=>{
  const n=Math.imul(a%scale+seed,1597334677)^Math.imul(b%scale,3812015801);
  return (Math.imul(n^(n>>>16),2246822519)>>>0)/4294967296-.5;
 };
 const top=at(ix,iy)*(1-u)+at(ix+1,iy)*u,bottom=at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u;
 return top*(1-v)+bottom*v;
}
function tileFace(canvas,color,kind,variation=0){
 if(!grain.has(variation)){
  const detail=new Float32Array(faceSize*faceSize),seed=variation*71;
  for(let y=0;y<faceSize;y++)for(let x=0;x<faceSize;x++){
   const cloud=noise(x,y,5,13+seed)+.4*noise(x,y,13,37+seed);
   detail[y*faceSize+x]=cloud*.055+noise(x,y,43,23+seed)*.045+noise(x,y,137,41+seed)*.05;
  }
  grain.set(variation,detail);
 }
 canvas.width=canvas.height=faceSize;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(faceSize,faceSize);
 const hex=color.length===4?color.slice(1).split('').map(c=>c+c).join(''):color.slice(1);
 const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)),strength=kind==='antislip'?1.35:1,detail=grain.get(variation);
 for(let i=0;i<detail.length;i++){
  const tone=1+strength*detail[i],p=i*4;
  pixels.data[p]=rgb[0]*tone;pixels.data[p+1]=rgb[1]*tone;pixels.data[p+2]=rgb[2]*tone;pixels.data[p+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 return canvas;
}
function floorOptions(work,roomId,kind){
 const styles=root.FurnishStyles||require('../core/style-core.js'),catalog=root.FurnishCatalogData||require('../data/catalog.js'),grout=root.FurnishTileGrout||require('../core/tile-grout-core.js');
 return {floorKind:kind,color:styles.surfaceColor(work,'floor',roomId)||catalog.materials[kind]?.sw,
  groutColor:grout.color(work,roomId,'floor'),sheen:styles.floorTileSheen(work,roomId,kind)};
}
const floorImages=new Map();
function sampleSources(id,folder){
 if(root.location?.protocol!=='file:')return Promise.resolve(null);
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=folder+'offline.js';
  script.onload=()=>{
   const sources=root.FurnishFloorSampleImages?.[id];
   if(sources)delete root.FurnishFloorSampleImages[id];
   script.remove();if(sources)resolve(sources);else reject(Error('离线地板贴图未注册'));
  };
  script.onerror=()=>{script.remove();reject(Error('离线地板贴图缺失'));};
  document.head.append(script);
 });
}
function sampleMaterial(THREE,work,roomId){
 if(!work.styleAppearance?.floorSamples)return null;
 const id=root.FurnishStyles.materialValue(work,'floorSamples',roomId),profile=root.FurnishProducts.styleAppearance.floorSample(id);
 if(!profile)return null;
 let entry=floorImages.get(id);
 if(!entry){
  const roles={map:'color.jpg',normalMap:'normal.jpg',roughnessMap:'roughness.jpg'},folder=`assets/materials/floors/${id}/`;
  const loads=[],sources=sampleSources(id,folder);entry={maps:{},profile,ready:null};
  for(const [role,file]of Object.entries(roles)){
   const image=new Image(),map=new THREE.Texture(image);
   map.name=id+'-'+file.slice(0,-4);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
   if(role==='map')map.colorSpace=THREE.SRGBColorSpace;
   entry.maps[role]=map;
   loads.push(sources.then(local=>new Promise(resolve=>{
    image.onload=()=>{map.needsUpdate=true;resolve(true);};
    image.onerror=()=>resolve(false);
    image.src=local?.[file]||folder+file;
   }),()=>false));
  }
  entry.ready=Promise.all(loads).then(results=>{entry.done=true;entry.failed=results.includes(false);root.dispatchEvent(new Event('furnish-floor-sample-ready'));});
  floorImages.set(id,entry);
 }
 const finish=floorCoats[id],sheen=root.FurnishStyles.floorTileSheen(work,roomId),coat=tileCoat(sheen);
 const material=new THREE.MeshPhysicalMaterial({...entry.maps,color:finish.tint,roughness:coat?.roughness??finish.roughness,
  normalScale:new THREE.Vector2(finish.normal,finish.normal),clearcoat:coat?.clearcoat??finish.coat,clearcoatRoughness:coat?.clearcoatRoughness??finish.coatRoughness});
 material.userData.floorSample=id;material.userData.floorReflectance=finish.reflectance;
 if(coat){material.roughnessMap=null;material.userData.floorTileSheen=sheen;}else material.userData.floorWindowSheen=finish.windowSheen;
 return material;
}
function pendingSamples(group){
 const ids=new Set();group?.traverse(o=>{if(o.material?.userData.floorSample)ids.add(o.material.userData.floorSample);});
 const pending=[...ids].map(id=>floorImages.get(id)).filter(item=>!item.done||item.failed);
 return pending.length?Promise.all(pending.map(async item=>{await item.ready;if(item.failed)throw Error('地板样片载入失败：'+item.profile.name);})):null;
}
function material(THREE,layout,{color='#e8e2d8',groutColor:custom,floorKind,sheen}={}){
 const tileColor=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)?color:'#e8e2d8',groutColor=custom?new THREE.Color(custom):new THREE.Color(tileColor).multiplyScalar(.9);
 const detailed=ceramic(floorKind),size=detailed?512:1024,pitch=detailed?size/2:size;
 const coat=tileCoat(sheen);
 const glazed=detailed&&floorKind!=='antislip'||!!coat,solidGloss=glazed&&sheen==='gloss';
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
 const width=pitch*layout.width/(layout.width+layout.gap),height=pitch*layout.height/(layout.height+layout.gap);
 c.fillStyle='#'+groutColor.getHexString();c.fillRect(0,0,size,size);
 if(detailed&&!solidGloss){
  const face=document.createElement('canvas');
  for(let i=0;i<4;i++)c.drawImage(tileFace(face,tileColor,floorKind,i),(i%2)*pitch,Math.floor(i/2)*pitch,width,height);
 }else{
  c.fillStyle=tileColor;
  for(let y=0;y<size;y+=pitch)for(let x=0;x<size;x+=pitch)c.fillRect(x,y,width,height);
 }
 const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;
 if(detailed){map.repeat.set(.5,.5);map.anisotropy=8;}
 const material=glazed?new THREE.MeshPhysicalMaterial({map,roughness:coat?.roughness??ceramics[floorKind]??.72,clearcoat:coat?.clearcoat??.24,clearcoatRoughness:coat?.clearcoatRoughness??.36}):
  new THREE.MeshStandardMaterial({map,roughness:detailed?ceramics[floorKind]:.72});
 if(coat)material.userData.floorTileSheen=sheen;else if(glazed)material.userData.floorWindowSheen=.95;
 material.userData.tileFinish={color:tileColor,layout:{width:layout.width,height:layout.height,gap:layout.gap},...(custom?{groutColor:custom}:{}),...(detailed?{floorKind}:{}),...(coat?{sheen}:{})};
 // Preserve the true grid pitch. A subpixel joint gets a modest screen-space
 // coverage floor instead of disappearing into texture mipmaps at room scale.
 material.onBeforeCompile=shader=>{
  shader.uniforms.furnishJoint={value:new THREE.Vector2(layout.gap/(layout.width+layout.gap),layout.gap/(layout.height+layout.gap))};
  shader.uniforms.furnishGroutColor={value:groutColor};
  shader.fragmentShader='uniform vec2 furnishJoint;\nuniform vec3 furnishGroutColor;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 tileUV=${detailed?'vMapUv*2.0':'vMapUv'};
   vec2 pixel=max(fwidth(tileUV),vec2(0.000001));
   vec2 halfJoint=max(furnishJoint*0.5,pixel*${detailed?'0.21':'0.32'});
   vec2 distanceToJoint=abs(fract(tileUV+furnishJoint*0.5+0.5)-0.5);
   vec2 joint=vec2(1.0)-smoothstep(max(vec2(0.0),halfJoint-pixel*0.4),halfJoint+pixel*0.4,distanceToJoint);
   joint*=step(vec2(0.0000001),furnishJoint);
   ${solidGloss?'':`float tone=fract(sin(dot(floor(tileUV),vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=${detailed?'0.988+0.024*tone':'0.965+0.045*tone'};`}
   float tileJoint=max(joint.x,joint.y);
   diffuseColor.rgb=mix(diffuseColor.rgb,furnishGroutColor,tileJoint*${detailed?'0.55':'0.9'});
  `);
  if(glazed)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   // A grout line interrupts the coat even when its colour is close to the tile.
   roughnessFactor=mix(${solidGloss?'roughnessFactor':'roughnessFactor+0.035*(tone-.5)'},0.82,tileJoint);
  `).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   material.clearcoat*=1.0-tileJoint;
  `);
 };
 material.customProgramCacheKey=()=> `furnish-tile-grid-v4|${detailed}|${glazed}|${solidGloss}`;return material;
}
// Old room textures have illustrative pixel joints and metre UVs, without a
// saved layout or known layer heights. Recolour only those existing pixels.
function legacyMaterial(THREE,original,{groutColor:custom}={}){
 const meta=original.userData.tileFinish,source=original.map.image,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const c=canvas.getContext('2d');c.drawImage(source,0,0);const color=custom?new THREE.Color(custom):new THREE.Color(meta.color).multiplyScalar(.9);c.fillStyle='#'+color.getHexString();c.fillRect(0,0,canvas.width,meta.groutPixels);c.fillRect(0,0,meta.groutPixels,canvas.height);
 const map=original.map.clone();map.source=new THREE.Source(canvas);map.needsUpdate=true;const m=original.clone();m.map=map;m.userData.tileFinish={...meta,...(custom?{groutColor:custom}:{})};if(!custom)delete m.userData.tileFinish.groutColor;
 m.onBeforeCompile=original.onBeforeCompile;m.customProgramCacheKey=original.customProgramCacheKey;return m;
}
function legacyCoat(THREE,map,sheen,roughness){
 const coat=tileCoat(sheen);
 if(!coat)return new THREE.MeshStandardMaterial({map,roughness});
 const m=new THREE.MeshPhysicalMaterial({map,roughness:coat.roughness,clearcoat:coat.clearcoat,clearcoatRoughness:coat.clearcoatRoughness});
 m.userData.floorTileSheen=sheen;
 m.customProgramCacheKey=()=>'furnish-legacy-coated-tile-v1';
 m.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 seam=1.0-smoothstep(vec2(0.004),vec2(0.009),fract(vMapUv));
   float tileJoint=max(seam.x,seam.y);
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,0.88,tileJoint);
  `).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   material.clearcoat*=1.0-tileJoint;
  `);
 };
 return m;
}
function groutMaterial(THREE,{color='#e8e2d8',groutColor}={}){const m=new THREE.MeshStandardMaterial({color:groutColor||new THREE.Color(color).multiplyScalar(.9),roughness:.72});m.userData.tileFinish={color,groutOnly:true,...(groutColor?{groutColor}:{})};return m;}
function uv(THREE,geometry,layout,{wx=v=>v/1000,wz=v=>v/1000}={}){
 const attr=geometry.attributes.position,out=[],a=layout.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x0=wx(layout.origin[0]),z0=wz(layout.origin[1]);
 for(let i=0;i<attr.count;i++){const x=(attr.getX(i)-x0)*1000,y=(attr.getZ(i)-z0)*1000;out.push((c*x+s*y)/(layout.width+layout.gap),(-s*x+c*y)/(layout.height+layout.gap));}
 const current=geometry.getAttribute('uv');if(current?.array.length===out.length){current.array.set(out);current.needsUpdate=true;}else geometry.setAttribute('uv',new THREE.Float32BufferAttribute(out,2));return geometry;
}
function surface(THREE,room,area,{wx=v=>v/1000,wz=v=>v/1000,material:provided,color}={}){
 const shapes=(room.polys||[room.poly]).map(poly=>{const s=new THREE.Shape();poly.forEach(([x,y],i)=>s[i?'lineTo':'moveTo'](wx(x),-wz(y)));return s;});
 const geometry=new THREE.ShapeGeometry(shapes);geometry.rotateX(-Math.PI/2);
 const sample=provided?.userData.floorSample;
 if(sample){
  const size=root.FurnishProducts.styleAppearance.floorSample(sample).repeatMm/1000;
  const positions=geometry.getAttribute('position'),uvs=geometry.getAttribute('uv');
  for(let i=0;i<uvs.count;i++)uvs.setXY(i,(positions.getX(i)-wx(0))/size,-(positions.getZ(i)-wz(0))/size);
 }else if(area.layout)uv(THREE,geometry,area.layout,{wx,wz});
 const m=provided||(typeof document==='undefined'||!area.layout?new THREE.MeshStandardMaterial({color:color||'#e8e2d8'}):material(THREE,area.layout,{color})),mesh=syncIdentity.produce("floor:generator-call-surface:"+(area.id||room.id),()=>syncIdentity.produce("floor-finish-model:site-1",()=>new THREE.Mesh(geometry,m)));
 mesh.position.y=(area.finishedZ??area.rawZ??0)/1000;mesh.receiveShadow=true;mesh.userData.floor=true;mesh.userData.floorFinishOwnMaterial=!!sample||!!area.layout||!provided||!!provided.userData.tileFinish?.legacy&&!!provided.userData.tileFinish.groutColor;mesh.userData.room=area.roomId||room.id;return mesh;
}
function layers(THREE,room,area,{wx=v=>v/1000,wz=v=>v/1000}={}){
 if(!Number.isFinite(area?.finishedZ))return null;
 const group=new THREE.Group();let bottom=area.rawZ;
 for(const [layer,height,color] of syncIdentity.items("floor-finish-model.js:generator-1",[["item-a",['base',area.baseThickness,'#aaa397']],["item-b",['tile',area.tileThickness,'#9e9485']]])){
  if(height>0){
   const shapes=(room.polys||[room.poly]).map(poly=>{const s=new THREE.Shape();poly.forEach(([x,y],i)=>s[i?'lineTo':'moveTo'](wx(x),-wz(y)));return s;});
   const geo=new THREE.ExtrudeGeometry(shapes,{depth:height/1000,bevelEnabled:false});geo.rotateX(-Math.PI/2);
   const mesh=syncIdentity.produce("floor:generator-call-layers:"+(area.id||room.id),()=>syncIdentity.produce("floor-finish-model:site-2",()=>new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:1,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}))));mesh.position.y=bottom/1000;
   // The textured production surface owns the top face. Keep layer sides and
   // undersides only; coplanar untextured caps could hide the tile grid.
   const index=geo.index,positions=geo.attributes.position,kept=[];
   for(let i=0;i<(index?.count??positions.count);i+=3){const ids=index?[index.getX(i),index.getX(i+1),index.getX(i+2)]:[i,i+1,i+2];if(!ids.every(j=>Math.abs(positions.getY(j)-height/1000)<1e-7))kept.push(...ids);}
   geo.setIndex(kept);geo.clearGroups();
   mesh.userData.floorLayer={roomId:area.roomId||room.id,layer,bottom,top:bottom+height};mesh.userData.floorFinishOwnMaterial=true;mesh.receiveShadow=true;group.add(mesh);
  }bottom+=height;
 }
 return group;
}
function stepEdges(THREE,steps,{wx=v=>v/1000,wz=v=>v/1000}={}){
 const group=new THREE.Group();for(const step of syncIdentity.records("floor-finish-model.js:generator-2",steps)){const [[x,z],[X,Z]]=step.seam,lo=step.low/1000,hi=step.high/1000,positions=[wx(x),lo,wz(z),wx(X),lo,wz(Z),wx(X),hi,wz(Z),wx(x),lo,wz(z),wx(X),hi,wz(Z),wx(x),hi,wz(z)];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
  const mesh=syncIdentity.produce("floor-finish-model:site-3",()=>new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#827564',roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})));mesh.userData.floorStep=step;mesh.userData.floorFinishOwnMaterial=true;group.add(mesh);
 }return group;
}
const api={material,legacyMaterial,legacyCoat,roomWindows,windowDivisions,tileReflection,copyTileReflection,groutMaterial,uv,surface,layers,stepEdges,ceramic,tileFace,floorOptions,sampleMaterial,pendingSamples};if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishFloorFinishModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
