/* Resolve the closed placement and travel of tableware in a real drawer. */
(function(root){
'use strict';
const kitchen=()=>root.FurnishKitchen||require('./kitchen-core.js');
const products=()=>root.FurnishProducts||require('./product-rules.js');
const cabinetMotion=()=>root.FurnishCabinetMotion||require('./cabinet-motion.js');
const trays=new Map([['906.213.59','drawer'],['803.430.04','innerTray'],['703.429.72','innerTray']]);
const supportTolerance=2; // The saved items sit 1 mm above the production floor.
const cached=new WeakMap();

function floors(host){
 const K=kitchen();
 if(host?.obj||!host?.kitchen?.modules?.some(m=>m.structure?.cabinet?.boxes?.some(b=>b.components.some(c=>c.innerTray))))return [];
 const key=JSON.stringify([host.cx,host.cy,host.rot,host.flip,host.w,host.d,host.h,host.mountHeight,host.kitchen]);
 const known=cached.get(host);
 if(known?.key===key)return known.floors;
 const found=[];
 for(const module of K.cabinetLayout(host)){
  const boxes=module.structure?.cabinet?.boxes;
  if(!boxes?.some(b=>b.components.some(p=>p.innerTray)))continue;
  const part=K.moduleFurniture(host,module);
  const owners=new Set(boxes.flatMap(b=>b.components.filter(p=>p.innerTray&&!p.removed).map(p=>b.id+'/'+p.id)));
  for(const board of cabinetMotion().boards(part,{includeStatic:true})){
   const {motion,metadata}=board,builder=metadata.cabinetBuilder;
   if(motion?.axis!=='z'||!builder||!owners.has(builder.boxId+'/'+builder.componentId))continue;
   const kind=metadata.cabinetInnerTrayFloor?'innerTray':metadata.cabinetDrawerBoard==='bottom'&&!metadata.cabinetPart?.innerTray?'drawer':null;
   if(!kind)continue;
   const xs=board.poly.map(v=>v[0]),zs=board.poly.map(v=>v[1]);
   const top=board.top+K.baseElevation(host)+K.moduleMountHeight(host,module);
   const [x,y]=K.world(part,0,board.phase*motion.travel);
   found.push({kind,part,hostId:host.id,module:module.index,boxId:builder.boxId,componentId:builder.componentId,
    limits:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],top,dx:x-part.cx,dy:y-part.cy});
  }
 }
 cached.set(host,{key,floors:found});
 return found;
}

function attachment(f,furniture,plan){
 const kind=f?.type==='custom'&&f.obj&&f.brand==='宜家/IKEA'&&!f.pose3D?trays.get(f.model):null;
 if(!kind||!Array.isArray(furniture))return null;
 const P=products(),z=P.vertical(f);
 if(!z)return null;
 const ownFloor=plan?P.floorBase(plan,f,furniture):{known:true,z:0};
 if(!ownFloor.known)return null;
 const K=kitchen(),G=root.FurnishGeometry||require('./layout-geometry.js'),outline=G.corners(f);
 const matches=[];
 for(const host of furniture){
  const boards=floors(host);
  if(!boards.length)continue;
  const datum=plan?P.floorBase(plan,host,furniture):{known:true,z:0};
  if(!datum.known)continue;
  for(const floor of boards){
   const gap=z.bottom+ownFloor.z-floor.top-datum.z;
   if(floor.kind!==kind||gap< -1e-6||gap>supportTolerance)continue;
   const [x0,y0,x1,y1]=floor.limits;
   if(outline.every(point=>{
    const [x,y]=K.local(floor.part,...point);
    return x>=x0&&x<=x1&&y>=y0&&y<=y1;
   }))matches.push(floor);
  }
 }
 return matches.length===1?matches[0]:null;
}

function pose(f,furniture,plan){
 const a=attachment(f,furniture,plan);
 return a&&(a.dx||a.dy)?{...f,cx:f.cx+a.dx,cy:f.cy+a.dy}:f;
}
function motions(furniture,plan){
 const result=new Map();
 for(const f of furniture){
  const a=attachment(f,furniture,plan);
  if(a&&(a.dx||a.dy))result.set(f.id,a);
 }
 return result;
}
const api={attachment,pose,motions};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FurnishDrawerContents=api;
})(globalThis);
