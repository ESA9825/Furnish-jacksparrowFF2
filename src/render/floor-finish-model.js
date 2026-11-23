/* Production floor layer solids in metres; grid UVs use the original mm datum. */
(function(root){
'use strict';
// Stable authoring-site labels: keep existing labels when moving code; allocate new labels for new sites.
const syncIdentity=root.FurnishPartIdentity||(typeof require==='function'?require('../core/part-identity.js'):null);

const ceramics=Object.freeze({tile800:.49,tile600:.53,antislip:.78});
const ceramic=kind=>Object.hasOwn(ceramics,kind);
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
 return {floorKind:kind,color:styles.surfaceColor(work,'floor',roomId)||catalog.materials[kind]?.sw,groutColor:grout.color(work,roomId,'floor')};
}
function material(THREE,layout,{color='#e8e2d8',groutColor:custom,floorKind}={}){
 const tileColor=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)?color:'#e8e2d8',groutColor=custom?new THREE.Color(custom):new THREE.Color(tileColor).multiplyScalar(.9);
 const detailed=ceramic(floorKind),size=detailed?512:1024,pitch=detailed?size/2:size;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
 const width=pitch*layout.width/(layout.width+layout.gap),height=pitch*layout.height/(layout.height+layout.gap);
 c.fillStyle='#'+groutColor.getHexString();c.fillRect(0,0,size,size);
 if(detailed){
  const face=document.createElement('canvas');
  for(let i=0;i<4;i++)c.drawImage(tileFace(face,tileColor,floorKind,i),(i%2)*pitch,Math.floor(i/2)*pitch,width,height);
 }
 else{c.fillStyle=tileColor;c.fillRect(0,0,width,height);}
 const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;
 if(detailed){map.repeat.set(.5,.5);map.anisotropy=4;}
 const material=new THREE.MeshStandardMaterial({map,roughness:detailed?ceramics[floorKind]:.72});
 material.userData.tileFinish={color:tileColor,layout:{width:layout.width,height:layout.height,gap:layout.gap},...(custom?{groutColor:custom}:{}),...(detailed?{floorKind}:{})};
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
   float tone=fract(sin(dot(floor(tileUV),vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=${detailed?'0.988+0.024*tone':'0.965+0.045*tone'};
   diffuseColor.rgb=mix(diffuseColor.rgb,furnishGroutColor,max(joint.x,joint.y)*${detailed?'0.55':'0.9'});
  `);
 };
 material.customProgramCacheKey=()=> detailed?'furnish-ceramic-grid-v1':'furnish-tile-grid-v3';return material;
}
// Old room textures have illustrative pixel joints and metre UVs, without a
// saved layout or known layer heights. Recolour only those existing pixels.
function legacyMaterial(THREE,original,{groutColor:custom}={}){
 const meta=original.userData.tileFinish,source=original.map.image,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const c=canvas.getContext('2d');c.drawImage(source,0,0);const color=custom?new THREE.Color(custom):new THREE.Color(meta.color).multiplyScalar(.9);c.fillStyle='#'+color.getHexString();c.fillRect(0,0,canvas.width,meta.groutPixels);c.fillRect(0,0,meta.groutPixels,canvas.height);
 const map=original.map.clone();map.image=canvas;map.needsUpdate=true;const m=original.clone();m.map=map;m.userData.tileFinish={...meta,...(custom?{groutColor:custom}:{})};if(!custom)delete m.userData.tileFinish.groutColor;return m;
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
 if(area.layout)uv(THREE,geometry,area.layout,{wx,wz});
 const m=provided||(typeof document==='undefined'||!area.layout?new THREE.MeshStandardMaterial({color:color||'#e8e2d8'}):material(THREE,area.layout,{color})),mesh=syncIdentity.produce("floor:generator-call-surface:"+(area.id||room.id),()=>syncIdentity.produce("floor-finish-model:site-1",()=>new THREE.Mesh(geometry,m)));
 mesh.position.y=(area.finishedZ??area.rawZ??0)/1000;mesh.receiveShadow=true;mesh.userData.floor=true;mesh.userData.floorFinishOwnMaterial=!!area.layout||!provided||!!provided.userData.tileFinish?.legacy&&!!provided.userData.tileFinish.groutColor;mesh.userData.room=area.roomId||room.id;return mesh;
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
const api={material,legacyMaterial,groutMaterial,uv,surface,layers,stepEdges,ceramic,tileFace,floorOptions};if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishFloorFinishModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
