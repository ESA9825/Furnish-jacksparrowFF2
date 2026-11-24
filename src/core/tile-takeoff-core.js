/* Tile layout review and takeoff from the production clipping geometry. */
(function(root){
'use strict';
const F=root.FurnishFloorFinish||require('./floor-finish-core.js');
const Z=root.FurnishZoneGeometry||require('./zone-geometry.js');
const W=root.FurnishWallTiling||require('./wall-tiling-core.js');
const E=root.FurnishTileEditor||require('./tile-editor-core.js');
const eps=1e-5;
const rings=room=>room.rings||[room.poly];
const round=n=>Number(n.toFixed(2));
const code=(prefix,index)=>prefix+String(index+1).padStart(2,'0');
const rect=([x,y,X,Y])=>[[x,y],[X,y],[X,Y],[x,Y]];
const bounds=points=>points.reduce(([x,y,X,Y],[u,v])=>[Math.min(x,u),Math.min(y,v),Math.max(X,u),Math.max(Y,v)],[Infinity,Infinity,-Infinity,-Infinity]);
const mod=(n,p)=>(n%p+p)%p;

function union(regions){
 const boundaries=regions.flatMap(rings);
 return boundaries.length?Z.outline(Z.decompose(boundaries,p=>regions.some(r=>Z.inside(p,r.poly)))):Z.outline([]);
}
function floorGroup(plan,id){
 const ids=new Set([id]),links=(plan.floorFinish?.joints||[]).filter(j=>j.active==='continuous');
 for(const id of ids)for(const j of links)if(j.roomIds.includes(id))j.roomIds.forEach(v=>ids.add(v));
 return [...ids].sort();
}
function floorRegion(plan,ids){
 const finish=plan.floorFinish,areas=ids.map(id=>finish?.areas[id]).filter(a=>a?.layout);
 if(areas.length!==ids.length)throw Error('请先启用所选区域的瓷砖排版');
 const doorways=finish.doorways.filter(a=>a.layout&&ids.includes(a.roomId));
 return {room:union([...areas,...doorways].map(a=>a.room)),layout:areas[0].layout,doorways};
}
function tilePieces(cells,layout){
 const fullArea=layout.width*layout.height;
 return cells.flatMap(cell=>{
  const {polys}=cell,shape=polys.length===1?{rings:polys}:Z.outline(polys);
  const holes=shape.rings.filter(p=>Z.signed(p)<0);
  return shape.rings.filter(p=>Z.signed(p)>0).flatMap(outer=>{
   const rings=[outer,...holes.filter(p=>Z.inside(p[0],outer))],poly=Z.ringPath(rings);
   const area=rings.reduce((sum,p)=>sum+Z.signed(p),0);
   const [x,y,X,Y]=bounds(outer.map(p=>F.transform(layout,p,true)));
   const width=X-x,height=Y-y;
   if(Math.min(width,height)<eps||area<eps)return [];
   const full=Math.abs(area-fullArea)<eps*Math.max(layout.width,layout.height);
   const rectangle=rings.length===1&&Math.abs(area-width*height)<eps*Math.max(width,height);
   const slabs=polys.filter(p=>Z.inside(center(p),poly));
   const label=center(slabs.reduce((best,p)=>Z.signed(p)>Z.signed(best)?p:best,slabs[0]||outer));
   return [{rings,area,width,height,full,rectangle,label}];
  });
 });
}
const center=poly=>poly.reduce(([x,y],[u,v])=>[x+u/poly.length,y+v/poly.length],[0,0]);
function gridPieces(room,layout,limit){
 if(!room.rings.length)return [];
 return tilePieces(F.cells(room,layout,limit),layout);
}
function summary(pieces,threshold){
 const cut=pieces.filter(p=>!p.full),narrow=cut.filter(p=>Math.min(p.width,p.height)<threshold-eps);
 return {full:pieces.length-cut.length,cut:cut.length,narrow:narrow.length,
  minimum:cut.length?Math.min(...cut.map(p=>Math.min(p.width,p.height))):null,
  area:pieces.reduce((n,p)=>n+p.area,0)/1e6};
}
function candidates(plan,id,threshold){
 const ids=floorGroup(plan,id),{room,layout}=floorRegion(plan,ids);
 if(!room.rings.length)throw Error('没有可铺贴的地面');
 // Work in lattice coordinates so centered edges also work with rotated grids.
 const [x,y,X,Y]=bounds(room.rings.flat().map(p=>F.transform(layout,p,true)));
 const pitch=[layout.width+layout.gap,layout.height+layout.gap];
 const left=[x,y],centered=[(x+X-layout.width)/2,(y+Y-layout.height)/2];
 const variants=[['当前起铺',[0,0]],['靠边起铺',left],['两侧均分',centered],['横向均分',[centered[0],0]],['纵向均分',[0,centered[1]]]];
 if(![0,90,180,270].some(a=>Math.abs(mod(layout.angle,360)-a)<eps))return compare();
 const doors=(plan.floorFinish?.joints||[]).filter(j=>j.rect&&j.roomIds.includes(id)&&j.active!=='continuous');
 doors.sort((a,b)=>length(b.rect)-length(a.rect)||a.key.localeCompare(b.key));
 if(doors[0]){
  const [a,b,c,d]=doors[0].rect,middle=F.transform(layout,[(a+c)/2,(b+d)/2],true);
  const tangent=F.transform({...layout,origin:[0,0]},c-a>=d-b?[1,0]:[0,1],true);
  const axis=Math.abs(tangent[0])>Math.abs(tangent[1])?0:1,normal=1-axis;
  const at=left.slice();at[axis]=middle[axis]-[layout.width,layout.height][axis]/2;
  at[normal]=centered[normal];
  variants.splice(2,0,['门中对砖中',at]);
 }
 return compare();
 function compare(){
  const rows=[];
  for(const [name,offset] of variants){
   const local=offset.map((v,i)=>left[i]+mod(v-left[i],pitch[i]));
   const origin=F.transform(layout,local).map(v=>Number(v.toFixed(6)));
   const grid={...layout,origin};
   if(rows.some(r=>F.sameGrid(r.layout,grid)))continue;
   const pieces=gridPieces(room,grid,12000);
   rows.push({name,layout:grid,pieces,...summary(pieces,threshold)});
  }
  return {ids,room,rows};
 }
}
const length=([x,y,X,Y])=>Math.max(X-x,Y-y);

function floorSheets(plan,targets){
 const sheets=[],seen=new Set(),finish=plan.floorFinish;
 const idsToReport=targets?targets.filter(t=>t.kind==='floor').map(t=>t.roomId):Object.keys(finish?.areas||{});
 for(const id of idsToReport){
  if(seen.has(id)||!finish?.areas[id]?.layout)continue;
  const ids=floorGroup(plan,id);ids.forEach(id=>seen.add(id));
  const {room,layout}=floorRegion(plan,ids);
  const areas=ids.map(id=>finish.areas[id]);
  const joints=finish.joints.filter(j=>j.mode!=='default'&&j.roomIds.some(r=>ids.includes(r)));
  const anchors=areas.map(a=>({label:a.room.name,point:a.room.at}));
  const pending=areas.filter(a=>a.pending).map(a=>a.room.name+' '+a.pending);
  const index=plan.rooms.findIndex(r=>ids.includes(r.id));
  sheets.push({code:code('F',index),kind:'floor',ids,title:anchors.map(a=>a.label).join('／')+' · 地面',room,joints,anchors,
   specs:[{room,layout,material:areas[0].room.mat,roomMaterialId:id,pending}]});
 }
 return sheets;
}
function wallSheets(plan,work,targets){
 const byFace=new Map((plan.wallTiling?.surfaces||[]).map(e=>[JSON.stringify(W.binding(e.face)),e]));
 if(!byFace.size||targets&&!targets.some(t=>t.kind==='wall'))return [];
 const sheets=[];
 for(const [index,target] of E.groups(work,plan).filter(t=>t.kind==='wall').entries()){
  if(targets&&!targets.some(t=>t.kind==='wall'&&E.contains(target,t.face)))continue;
  const elevations=E.members(target).map(t=>byFace.get(JSON.stringify(W.binding(t.face)))).filter(Boolean);
  if(!elevations.length)continue;
  const first=elevations[0],zero=first.dir===1?Math.min(...elevations.map(e=>e.zero)):Math.max(...elevations.map(e=>e.zero));
  const specs=[];
  for(const e of elevations)for(const p of W.patterns(e)){
   const shift=(e.zero-zero)*e.dir;
   const layout=W.grid(p);layout.origin[0]+=shift;
   // A physical band boundary still separates material even when its grid matches.
   const band=p.band?[p.band.bottom,p.band.top].join(':'):'';
   const appearance=root.FurnishStyles||require('./style-core.js');
   const finish=appearance.wallTileMaterial(work,p.face);
   const material=JSON.stringify(finish||null);
   let spec=specs.find(s=>s.band===band&&s.material===material&&F.sameGrid(s.layout,layout));
   if(!spec){spec={band,material,finish,layout,regions:[],pending:[]};specs.push(spec);}
   if(!Number.isFinite(p.originZ)){spec.pending.push('起铺绝对标高待确定');continue;}
   if(!Number.isFinite(p.position)||!Number.isFinite(p.floorZ)){spec.pending.push('墙位置或完成地面标高待确定');continue;}
   spec.regions.push(...p.sections.map(([x,z,X,Z])=>({poly:rect([x+shift,z,X+shift,Z])})));
  }
  for(const spec of specs)spec.room=union(spec.regions);
  const room=union(specs.map(s=>s.room));
  const title=(work.rooms?.[target.roomId]?.name||target.roomId)+' · '+target.label;
  sheets.push({code:code('W',index),kind:'wall',ids:[target.roomId],title,room,specs});
 }
 return sheets;
}

function report(plan,work,targets){
 const sheets=[...floorSheets(plan,targets),...wallSheets(plan,work,targets)];
 const materials=new Map(),alerts=[];
 const materialNames=(root.FurnishCatalogData||require('../data/catalog.js')).materials;
 let count=0;
 for(const sheet of sheets){
  sheet.pieces=[];
  for(const spec of sheet.specs){
   for(const pending of new Set(spec.pending||[]))alerts.push(sheet.title+'：'+pending);
   if(!spec.room.rings.length)continue;
   const {layout,finish}=spec,floor=sheet.kind==='floor',id=spec.roomMaterialId;
   const kind=work.rooms?.[id]?.mat||spec.material;
   const appearance=floor?JSON.parse(F.materialKey(work,plan.floorFinish.areas[id].room)):null;
   const label=floor?[materialNames[kind]?.name||kind,...appearance.slice(1)].filter(Boolean).join(' · '):'墙砖（'+sheet.title+(finish?.color?' '+finish.color:'')+'）';
   const key=JSON.stringify([sheet.kind,floor?appearance:[sheet.code,spec.material],layout.width,layout.height]);
   if(!materials.has(key))materials.set(key,{label,width:layout.width,height:layout.height,full:0,cut:0,area:0});
   const totals=materials.get(key);
   for(const p of gridPieces(spec.room,layout)){
    if(++count>30000)throw Error('图册超过 30000 片，请缩小选中范围');
    const piece={...p,id:sheet.code+'-'+String(sheet.pieces.length+1).padStart(3,'0'),material:label,
     stockWidth:layout.width,stockHeight:layout.height};
    sheet.pieces.push(piece);
    totals[p.full?'full':'cut']++;totals.area+=p.area/1e6;
   }
  }
  sheet.totals=summary(sheet.pieces,0);
 }
 const floorIds=new Set([...sheets.filter(s=>s.kind==='floor').flatMap(s=>s.ids),...(targets||[]).filter(t=>t.kind==='floor').map(t=>t.roomId)]);
 const joints=(plan.floorFinish?.joints||[]).filter(j=>j.mode!=='default')
  .map((j,i)=>({...j,code:code('M',i),label:[j.name||j.key,...j.roomIds.map(id=>work.rooms?.[id]?.name||id)].join(' · ')}))
  .filter(j=>!targets||j.roomIds.some(id=>floorIds.has(id)));
 const byJoint=new Map(joints.map(j=>[j.key,j]));
 for(const sheet of sheets)if(sheet.joints)sheet.joints=sheet.joints.map(j=>byJoint.get(j.key));
 for(const j of joints)if(j.pending)alerts.push((j.name||j.key)+' '+F.doorJointLabels[j.mode]+'：'+j.pending);
 return {sheets,materials:[...materials.values()],joints,alerts};
}
const api={floorGroup,floorRegion,tilePieces,summary,candidates,report,round};
if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishTileTakeoff=api;
})(globalThis);
