/* Read structural meshes from production builders; no second furniture template.
 * Numeric Three adapter, mm at the boundary. Rounded primitives retain a small
 * conservative edge box; curved buffer meshes retain their production vertices. */
(function(root){
 'use strict';
 const adapter=()=>root.FurnishModelSolidRecorder||(typeof require==='function'?require('./model-solid-recorder.js'):null);
 const labels={'motor-housing':'窗帘电机','curtain-rail':'窗帘导轨',leg:'凳腿','seat-apron':'座框','seat-end':'端框','shelf-end':'层架端撑','shoe-rod':'鞋架横杆',cushion:'软包',piping:'包边',strap:'织带','strap-top':'上织带','top-substrate':'木台面','white-stone':'岩板','leg-wing':'弯曲腿板','side-inlay':'桌腿中脊','leg-inner-cleat':'内侧横撑','leg-mount-block':'固定块','leg-fastener':'连接件',shelf:'层板','drawer-front':'抽屉前板','drawer-back':'抽屉背板','drawer-bottom':'抽屉底板','drawer-side':'抽屉侧板','finger-rebate':'指扣','shelf-seam':'拼缝'};
 const rule=f=>(root.FurnishProducts||require('./product-rules.js')).definition(f)?.solidModel;
 const supported=f=>!!f&&!f.obj&&!!rule(f);
 // Dense meshes vary widely in size. Limit both retained records and their
 // estimated array storage. Per-instance reuse must not pin evicted meshes.
 function meshCache(maxEntries,maxBytes){
  const entries=new Map();
  let bytes=0;
  return {
   get(key){
    const entry=entries.get(key);
    if(entry){entries.delete(key);entries.set(key,entry);}
    return entry;
   },
   set(key,entry){
    if(entry.bytes>maxBytes)return;
    if(entries.has(key)){bytes-=entries.get(key).bytes;entries.delete(key);}
    entries.set(key,entry);bytes+=entry.bytes;
    while(entries.size>maxEntries||bytes>maxBytes){
     const oldest=entries.keys().next().value;
     bytes-=entries.get(oldest).bytes;
     entries.delete(oldest);
    }
   }
  };
 }
 const MiB=1024*1024;
 const cache=meshCache(32,32*MiB),worldCache=meshCache(128,64*MiB);
 const instanceCache=typeof WeakRef==='function'?new WeakMap():null;
 function remember(f,key,local,worldKey,world){
  if(instanceCache)instanceCache.set(f,{key,local:local&&new WeakRef(local),worldKey,world:new WeakRef(world)});
 }
 function estimateBytes(records){
  // Estimate array headers, vertex triples, face arrays and reference slots.
  // Counting shared arrays here deliberately keeps the budget conservative.
  return records.reduce((total,{vertices,faces})=>total+192+vertices.length*56+
   faces.reduce((bytes,face)=>bytes+32+face.length*8,0),0);
 }
 // Use exact coordinates as keys, including the sign of zero.
 const negativeZero=Symbol('negative zero');
 const coordinateKey=value=>Object.is(value,-0)?negativeZero:value;
 function meshVertices(data,toWorld){
  const byX=new Map(),vertices=[];
  for(let i=0;i<data.length;i+=3){
   const x=data[i],y=data[i+1],z=data[i+2],kx=coordinateKey(x),ky=coordinateKey(y),kz=coordinateKey(z);
   let byY=byX.get(kx);
   if(!byY){byY=new Map();byX.set(kx,byY);}
   let byZ=byY.get(ky);
   if(!byZ){byZ=new Map();byY.set(ky,byZ);}
   let vertex=byZ.get(kz);
   if(!vertex){vertex=toWorld([x,y,z]).map(value=>value*1000);byZ.set(kz,vertex);}
   vertices.push(vertex);
  }
  return vertices;
 }
 function parts(f,{furniture=[],plan}={}){
  if(!supported(f))return null;
  if(f.pose3D){const R=root.FurnishProductPose||require('./product-pose.js');return R.parts(f,parts(R.source(f),{furniture,plan}));}
  const r=rule(f),products=root.FurnishProducts||require('./product-rules.js'),corner=r.sliding?products.slidingCorner(f,furniture,plan):null,key=JSON.stringify([r,products.definition(f)?.washerGeometryVersion,corner,f.slidingStackSide,f.slidingOpen,f.slidingTrackOrder,f.floorTrack,f.type,f.w,f.d,f.h,f.mountHeight,f.deskLampVisible,...(products.family(f,'wall-panel')?[products.value(f,'panelVariant')]:[]),f.bottomPhysical,...(products.definition(f)?.garden?.stepped?[products.gardenLayout(f)]:[]),f.windowSurroundSides,f.windowSurroundThickness,f.curtainOpen,f.blindAngle,f.shadeMode,f.manifoldLoops,f.manifoldLengths,f.foldingTablePose,f.paperArray,f.stoolCount,f.stoolPitch,f.foldingChairFolded,f.petTrayOpen,f.sofaBedOpen,f.teaBarUpperOpen,f.teaBarLowerOpen,f.dishwasherDoorOpen,f.hoodPanelOpen,f.sideTableUpperOpen,f.sideTableLowerOpen,f.washerDoorAngle,f.washerDoorSide,f.hoodGeometry,f.fridgeLeftAngle,f.fridgeRightAngle,f.fridgeUpperExtension,f.fridgeLowerExtension,...(r.positionSeed?[f.cx,f.cy]:[])]);
  // A world hit already contains the production vertices. Consult it before
  // rebuilding a local record evicted from the smaller geometry LRU.
  const worldKey=JSON.stringify([key,f.cx,f.cy,f.rot,f.flip]);
  const instance=instanceCache?.get(f);
  const hit=worldCache.get(worldKey)||(instance?.worldKey===worldKey?instance.world.deref():null);
  if(hit){
   if(instance?.worldKey!==worldKey)remember(f,key,cache.get(key),worldKey,hit);
   return hit.parts;
  }
  let local=cache.get(key)||(instance?.key===key?instance.local?.deref():null);
  if(!local){
   const model=root[r.global]||(typeof require==='function'?require('../render/'+r.module+'-model.js'):null);if(!model)throw Error('家具实体模型未加载：'+r.global);
   const {T,Box,Rounded,transform}=adapter(),built=model.build(T,products.elevationSource(f),r.sliding?{corner}:r.rounded?Rounded:Box);
   const records=[];
   built.traverse(node=>{
    const g=node.geometry;
    if(!g||node.userData.coveringPart==='fabric-panel')return;
    const data=g.attributes.position.array,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<data.length;i++){
     const axis=i%3;
     min[axis]=Math.min(min[axis],data[i]);
     max[axis]=Math.max(max[axis],data[i]);
    }
    if(min.some((v,i)=>max[i]-v<1e-10))return;
    const vertices=meshVertices(data,transform(node)),name=node.userData.coveringPart||Object.entries(node.userData).find(([key,v])=>key.endsWith('Part')&&typeof v==='string')?.[1]||'结构';
    const add=(vs,faces)=>records.push({vertices:vs,faces,boardName:labels[name]||'结构件',partRole:name,actualBoard:true});
    if(g.userData.bentBoard){
     // Separate the inward bend into narrow convex strips, preserving the void.
     const {rows,cols}=g.userData.bentBoard,offset=rows*cols;
     for(let j=0;j<cols-1;j+=4){const end=Math.min(j+4,cols-1),vs=[];for(let y=0;y<rows;y++)for(const i of [y*cols+j,y*cols+end,offset+y*cols+end,offset+y*cols+j])vs.push(vertices[i]);const faces=[];for(let y=1;y<rows;y++)for(let i=0;i<4;i++)faces.push([(y-1)*4+i,(y-1)*4+(i+1)%4,y*4+(i+1)%4,y*4+i]);faces.push([0,1,2,3],Array.from({length:4},(_,i)=>(rows-1)*4+i));add(vs,faces);}
    }else if(g.solidPieces){for(const piece of g.solidPieces)add(piece.indices.map(i=>vertices[i]),piece.faces);}
    else if(g.faces)add(vertices,g.faces);
    else{const index=g.index||[];add(vertices,Array.from({length:index.length/3},(_,i)=>index.slice(i*3,i*3+3)));}
   });
   local={parts:records,bytes:estimateBytes(records)};
   cache.set(key,local);
  }
  // Repeated plan labels, clearances and collisions share immutable world
  // records. Use the production key plus every world transform input.
  const M=root.FurnishCabinetMotion||require('./cabinet-motion.js'),angle=(f.rot||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const base=(r.base==='mountHeight'?products.value(f,'mountHeight'):0)+products.elevationDelta(f);
  // Records are immutable. Share repeated triples without changing vertex order,
  // face indices, double precision or the public arrays' cardinality.
  const transformed=new WeakMap();
  const result=local.parts.map((r,i)=>{
   let bottom=Infinity,top=-Infinity;
   const vertices=r.vertices.map(point=>{
    let vertex=transformed.get(point);
    if(!vertex){
     let [x,y,z]=point;
     x*=f.flip?-1:1;
     vertex=[(f.cx||0)+x*c-z*s,y+base,(f.cy||0)+x*s+z*c];
     transformed.set(point,vertex);
    }
    bottom=Math.min(bottom,vertex[1]);
    top=Math.max(top,vertex[1]);
    return vertex;
   });
   // The uncut footprint only needs each shared vertex once. Retain
   // the original list for degenerate records and every height-clipped section.
   const unique=new Set(vertices),projection=unique.size>1?[...unique]:vertices;
   return {...r,vertices,boardKey:'furniture:'+i,p:M.section({vertices:projection},null),vertical:{bottom,top,source:'production-mesh'}};
  });
  const world={parts:result,bytes:local.bytes+result.reduce((bytes,part)=>bytes+part.p.length*48,0)};
  worldCache.set(worldKey,world);
  remember(f,key,local,worldKey,world);
  return result;
 }
 const api={supported,parts};root.FurnishFurnitureSolids=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
