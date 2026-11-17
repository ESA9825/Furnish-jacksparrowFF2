/* A single parametric 90-degree carcass. Physical v2 parts are derived, never saved. */
(function(root){
 'use strict';
 const cp=v=>JSON.parse(JSON.stringify(v)),P=()=>root.FurnishProducts||require('./product-rules.js'),B=()=>root.FurnishCabinetBuilder||require('./cabinet-builder-core.js'),Z=()=>root.FurnishZoneGeometry||require('./zone-geometry.js');
 const is=f=>f?.cabinet?.version===3&&f.cabinet.shape==='corner90',rule=()=>P().cabinetBuilder.corner90;
 const keys=(o,list)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!list.includes(k)))throw Error('L型转角柜字段无效');};
 const num=(v,a,b,label)=>{if(!Number.isFinite(v)||v<a||v>b)throw Error(label+'须为 '+a+'–'+b+' mm');};
 function defaults(){return cp(rule().defaults);}
 function create(base={}){const r=rule();return validate({...base,type:'cabinet',name:base.name||'90° L型转角柜',w:r.outer.default,d:r.outer.default,h:r.height.default,color:base.color||'#e9e5de',mountHeight:base.mountHeight??0,cabinet:{version:3,shape:'corner90',...defaults()}});}
 function config(f){if(!is(f))throw Error('请选择90° L型转角柜');return f.cabinet;}
 function validate(f){
  const c=config(f),r=rule();if(f.name!==undefined&&(typeof f.name!=='string'||!f.name.trim()||f.name.length>80)||f.color!==undefined&&!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(f.color))throw Error('名称或门面颜色无效');if(f.type!=='cabinet'||f.obj)throw Error('L型转角柜须为参数柜体');keys(c,['version','shape',...Object.keys(r.defaults)]);
  for(const k of ['w','d'])num(f[k],r.outer.min,r.outer.max,'转角柜外长');num(f.h,r.height.min,r.height.max,'柜体高度');num(f.mountHeight??0,0,20000,'柜底离地');
  for(const k of ['depthA','depthB'])num(c[k],r.depth.min,r.depth.max,'柜深');num(c.thickness,12,30,'板厚');num(c.backThickness,0,50,'背厚');num(c.plinth,0,250,'踢脚高');num(c.railWidth,r.rail.min,r.rail.max,'顶撑宽');num(c.shelfSetback,0,100,'层板前退');
  if(!['left','right'].includes(c.hand)||!['one','split'].includes(c.panelMode)||!['solid','rails'].includes(c.top)||!['one','split'].includes(c.shelfMode)||!/^#[\da-f]{6}$/i.test(c.bodyColor)||!['legs','solid'].includes(c.base))throw Error('转角柜构造选项无效');
  if(c.base==='legs'&&c.plinth>0&&c.plinth<P().cabinetService.leg.minHeight)throw Error('调节脚高度至少40mm');
  if(c.depthA>=f.d||c.depthB>=f.w||f.w-c.depthB<r.opening.min||f.d-c.depthA<r.opening.min)throw Error('两段转角净前沿须至少 '+r.opening.min+' mm');
  if(Math.min(c.depthA,c.depthB)<Math.max(c.backThickness,c.thickness)+c.thickness+2*c.shelfSetback+50||f.h-c.plinth-2*c.thickness<100)throw Error('柜腔净宽深或净高不足');
  if(c.top==='rails'&&c.railWidth*2>Math.min(c.depthA,c.depthB)-c.thickness)throw Error('顶撑过宽，请减小宽度或改用整板顶');
  if(!Array.isArray(c.shelves)||c.shelves.length>r.shelves.max)throw Error('层板数量无效');const ids=new Set();let prior=c.plinth+c.thickness;
  for(const s of c.shelves){keys(s,['id','bottom','removable']);if(typeof s.id!=='string'||!/^shelf[1-9][0-9]*$/.test(s.id)||ids.has(s.id)||typeof s.removable!=='boolean')throw Error('层板身份或构造无效');ids.add(s.id);num(s.bottom,prior+r.shelves.minGap,f.h-c.thickness-r.shelves.minGap-c.thickness,'层板板底');prior=s.bottom+c.thickness;}
  const d=c.door;keys(d,Object.keys(r.defaults.door));if(typeof d.enabled!=='boolean'||typeof d.open!=='boolean'||d.hardware!=='layout'||!['fold-first','simultaneous'].includes(d.sequence))throw Error('目前仅支持布局演示门铰配置');
  for(const k of ['gap','jointGap','edgeGap'])num(d[k],0,10,'门缝');num(d.maxAngle,1,180,'主门限位角度');num(d.foldAngle,0,120,'折门限位角度');num(d.foldShare,.05,.95,'先折比例');num(d.progress,0,1,'开合进度');
  const sizes=door(f);for(const w of [sizes.primaryWidth,sizes.secondaryWidth])num(w,60,1200,'联动门宽');if(sizes.height<60)throw Error('门高不足60mm');return f;
 }
 function edit(f,values){if(f.locked)throw Error('柜体已锁定');const n=cp(f),c=n.cabinet;for(const [key,value]of Object.entries(values)){if(['w','d','h','mountHeight','name','color'].includes(key))n[key]=cp(value);else if(key.startsWith('door.')&&Object.hasOwn(c.door,key.slice(5)))c.door[key.slice(5)]=cp(value);else if(Object.hasOwn(rule().defaults,key))c[key]=cp(value);else throw Error('转角柜编辑字段无效');}return validate(n);}
 function resize(f,next){const n={...cp(f),...Object.fromEntries(['w','d','h','cx','cy','rot','flip','mountHeight','resizeAnchor','color'].filter(k=>Object.hasOwn(next,k)).map(k=>[k,next[k]]))};return validate(n);}
 function door(f){const c=config(f),d=c.door,t=c.thickness,sign=c.hand==='right'?-1:1;return {id:'corner-fold',kind:'foldDoor',bay:'left',x:sign*(f.w/2-d.gap),z:-f.d/2+c.depthA,bottom:c.plinth+d.gap,height:f.h-c.plinth-2*d.gap,primaryWidth:f.w-c.depthB-d.gap-d.jointGap,secondaryWidth:f.d-c.depthA-d.edgeGap-d.gap,side:sign===1?'left':'right',jointGap:d.jointGap,edgeGap:d.edgeGap,maxAngle:d.maxAngle,foldAngle:d.foldAngle,sequence:d.sequence,foldShare:d.foldShare,open:d.open,progress:d.progress,color:f.color||'#e9e5de'};}
 function points(f,{inside=false,setback=0}={}){const c=config(f),t=c.thickness,b=c.backThickness,g=inside?1:0,x0=-f.w/2+(inside?b+g:0),z0=-f.d/2+(inside?b+g:0),x1=f.w/2-(inside?t+g:0),z1=f.d/2-(inside?t+g:0),x=-f.w/2+c.depthB-t-setback,z=-f.d/2+c.depthA-t-setback,poly=[[x0,z0],[x1,z0],[x1,z],[x,z],[x,z1],[x0,z1]];return c.hand==='right'?poly.map(([x,z])=>[-x,z]).reverse():poly;}
 function outline(f){const c=config(f),x=-f.w/2+c.depthB,z=-f.d/2+c.depthA,p=[[-f.w/2,-f.d/2],[f.w/2,-f.d/2],[f.w/2,z],[x,z],[x,f.d/2],[-f.w/2,f.d/2]];return c.hand==='right'?p.map(([x,z])=>[-x,z]).reverse():p;}
 function supports(f,overhang=0){const c=config(f),x0=-f.w/2,z0=-f.d/2,x1=f.w/2,z1=f.d/2,ix=x0+c.depthB,iz=z0+c.depthA,sign=c.hand==='right'?-1:1,flip=p=>[p[0]*sign,p[1]],poly=[[x0,z0],[x1,z0],[x1,iz+overhang],[ix+overhang,iz+overhang],[ix+overhang,z1],[x0,z1]].map(flip);if(sign<0)poly.reverse();return [{poly,front:[[ix+overhang,iz+overhang],[x1,iz+overhang]].map(flip),normal:[0,1]},{poly,front:[[ix+overhang,iz+overhang],[ix+overhang,z1]].map(flip),normal:[sign,0]}];}
 function dimensions(f){return {left:-f.w/2,right:f.w/2,back:-f.d/2,front:f.d/2,bottom:0,top:f.h,w:f.w,d:f.d,h:f.h};}
 function clearances(f){const c=config(f),t=c.thickness,levels=[{bottom:c.plinth+t,top:c.shelves[0]?.bottom??f.h-t},...c.shelves.map((s,i)=>({bottom:s.bottom+t,top:c.shelves[i+1]?.bottom??f.h-t}))];return {openingA:f.w-c.depthB,openingB:f.d-c.depthA,depthA:c.depthA-c.backThickness-t,depthB:c.depthB-c.backThickness-t,levels:levels.map(l=>({...l,height:l.top-l.bottom})),doors:door(f)};}
 function materialPanel(f,id,name,poly,bottom,height,section,{removable=false,color}={}){
  const c=config(f),parts=[{geometry:{kind:'shape',shape:{commands:[...poly.map(([x,z],i)=>[i?'L':'M',x,z]),['Z']],holes:[]},depth:height,angle:Math.PI/2,curveSegments:1},position:[0,bottom+height,0],material:{color:color||c.bodyColor},metadata:{cabinetSection:section}}],xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]),lo=[Math.min(...xs),bottom,Math.min(...zs)],hi=[Math.max(...xs),bottom+height,Math.max(...zs)],p={id,kind:'board',name,w:hi[0]-lo[0],h:height,d:hi[2]-lo[2],x:(lo[0]+hi[0])/2,y:bottom+height/2,z:(lo[2]+hi[2])/2,...(removable?{removable:true}:{})};
  p.profile={version:1,box:{w:f.w,d:f.d,h:f.h,thickness:c.thickness,base:c.plinth},bay:{left:-f.w/2+c.thickness,right:f.w/2-c.thickness},baseline:{color:f.color,...Object.fromEntries(['w','h','d','x','y','z'].map(k=>[k,p[k]]))},bounds:{lo,hi},parts};if(section==='panel'){p.kind='shelf';p.bay='left';p.at=(bottom-c.plinth-c.thickness)/(f.h-c.plinth-2*c.thickness);p.front=f.d/2-hi[2];p.back=lo[2]+f.d/2;p.removable=removable;for(const k of ['name','w','h','d','x','y','z'])delete p[k];Object.assign(p.profile.baseline,{at:p.at,front:p.front,back:p.back});}return p;
 }
 const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 function derived(f){
  validate(f);const c=config(f),t=c.thickness,b=c.backThickness,x0=-f.w/2,x1=f.w/2,z0=-f.d/2,z1=f.d/2,ix=x0+c.depthB-t,iz=z0+c.depthA-t,sign=c.hand==='right'?-1:1,mirror=poly=>sign===-1?poly.map(([x,z])=>[-x,z]).reverse():poly,parts=[];
  const add=(id,name,poly,y,h,section,options)=>parts.push(materialPanel(f,id,name,poly,y,h,section,options));
  const horizontal=(id,name,y,mode,options)=>{const poly=points(f,{inside:id.startsWith('shelf'),setback:id.startsWith('shelf')?c.shelfSetback:0});if(mode==='one')add(id,name,poly,y,t,id.startsWith('shelf')?'panel':id,options);else{const zs=poly.map(p=>p[1]),cut=iz-(id.startsWith('shelf')?c.shelfSetback:0),max=Math.max(...zs)+1,min=Math.min(...zs)-1,left=Math.min(...poly.map(p=>p[0]))-1,right=Math.max(...poly.map(p=>p[0]))+1;for(const [suffix,mask]of [['a',rect(left,min,right,cut)],['b',rect(left,cut,right,max)]]){const Z=()=>root.FurnishZoneGeometry||require('./zone-geometry.js'),pieces=Z().decompose([poly,mask],p=>Z().inside(p,poly)&&Z().inside(p,mask)),rings=Z().outline(pieces).rings;if(rings.length!==1)throw Error('分段板件轮廓无效');add(id+'-'+suffix,name+' · '+suffix.toUpperCase()+'段',rings[0],y,t,id.startsWith('shelf')?'panel':id,options);}}};
  horizontal('bottom','L形底板',c.plinth,c.panelMode);
  if(c.top==='solid')horizontal('top','L形顶板',f.h-t,c.panelMode);else{const w=c.railWidth;for(const [i,p]of [rect(x0,z0,x1,z0+w),rect(x0,z0+w,x0+w,z1),rect(ix,iz-w,x1,iz),rect(ix-w,iz,ix,z1)].entries())add('rail'+(i+1),'顶部承托横撑 '+(i+1),mirror(p),f.h-t,t,'top');}
  const wallBottom=c.plinth+t,wallHeight=f.h-t-wallBottom;
  for(const [id,name,p]of [['end-a','A边端侧板',rect(x1-t,z0,x1,iz)],['end-b','B边端侧板',rect(x0,z1-t,ix,z1)]])add(id,name,mirror(p),wallBottom,wallHeight,'side');
  if(b){add('back-a','A边背板',mirror(rect(x0+b,z0,x1-t,z0+b)),wallBottom,wallHeight,'back');add('back-b','B边背板',mirror(rect(x0,z0,x0+b,z1-t)),wallBottom,wallHeight,'back');}
  for(const s of c.shelves)horizontal(s.id,'L形'+(s.removable?'活动':'固定')+'层板',s.bottom,c.shelfMode,{removable:s.removable});
  if(c.panelMode==='split'&&c.plinth>=4){const x=x0+(c.depthB-t)/2;add('joint-bottom','底板接缝连接片（布局示意）',mirror(rect(x-15,iz-40,x+15,iz+40)),c.plinth-2,2,'connector',{color:'#777777'});}
  if(c.plinth){const r=P().cabinetService,off=Math.max(r.leg.edge,r.leg.pad/2),fx=x0+c.depthB-40-r.plinth.thickness-r.leg.pad/2,fz=z0+c.depthA-40-r.plinth.thickness-r.leg.pad/2,centers=[[x0+off,z0+off],[x1-off,z0+off],[x1-off,fz],[fx,fz],[fx,z1-off],[x0+off,z1-off]],unique=centers.filter((p,i)=>!centers.slice(0,i).some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<r.leg.pad));
   if(c.base==='legs'){for(const [i,[x,z]]of unique.entries())for(const [j,[radius,y,h]]of [[r.leg.pad/2,0,8],[r.leg.diameter/2,8,c.plinth-16],[r.leg.pad/2,c.plinth-8,8]].entries()){if(h<=0)continue;const poly=Array.from({length:12},(_,k)=>[x+radius*Math.cos(k*Math.PI/6),z+radius*Math.sin(k*Math.PI/6)]);add('leg'+(i+1)+'-'+j,'调节脚 '+(i+1)+' · '+['脚垫','调节柱','承托盘'][j],mirror(poly),y,h,'hardware',{color:'#161616'});}}
   else add('base-solid','L形底座',points(f),0,c.plinth,'plinth',{color:f.color});
   if(c.base==='legs'){const recess=40,px=x0+c.depthB-recess,pz=z0+c.depthA-recess,pt=r.plinth.thickness;add('plinth-a','A边可拆踢脚',mirror(rect(px+pt/2,pz-pt/2,x1,pz+pt/2)),2,c.plinth-4,'plinth',{color:f.color});add('plinth-b','B边可拆踢脚',mirror(rect(px-pt/2,pz-pt/2,px+pt/2,z1)),2,c.plinth-4,'plinth',{color:f.color});}
  }
  if(c.door.enabled)parts.push(door(f));return {...cp(f),cabinet:{version:2,boxes:[{id:'corner90',w:f.w,d:f.d,h:f.h,thickness:t,backThickness:b,bottom:true,top:c.top==='solid',frontBand:true,carcass:false,baseLevel:c.plinth,components:parts}]}};
 }
 function setOpening(f,open,progress=1){if(!config(f).door.enabled)throw Error('该柜未安装联动门');return edit(f,{'door.open':open,'door.progress':open?progress:0});}
 function spatial(f){const c=cp(config(f));delete c.bodyColor;for(const s of c.shelves)delete s.removable;return {...c,geometryVersion:rule().version,serviceRule:P().cabinetService.version,foldDoorRule:P().cabinetBuilder.foldDoor.version};}
 function preset(f,name=f.name){if(typeof name!=='string'||!name.trim()||name.length>80)throw Error('组件名称须为1–80字');return validate({type:'cabinet',name:name.trim(),w:f.w,d:f.d,h:f.h,color:f.color,mountHeight:0,cx:0,cy:0,rot:0,flip:false,price:0,cabinet:specification(f)});}
 function specification(f){const c=cp(config(f));c.door.open=false;c.door.progress=1;return c;}
 const api={is,defaults,create,validate,edit,resize,door,points,outline,supports,dimensions,clearances,derived,setOpening,spatial,specification,preset};root.FurnishCornerCabinet=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
