/* Portable presentation data and change detection; no DOM or separate save channel. */
(function(root){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const fields={need:'需求',approach:'设计做法',basis:'依据／来源',tradeoff:'取舍',instruction:'施工交底'};
 const audiences={both:'用户与装修公司',owner:'用户',contractor:'装修公司'};
 const limits={pages:24,issues:100,image:700000,images:6000000};
 const fail=message=>{throw Error('方案讲解：'+message);};
 function text(v,max,label,required=false){if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(label+'无效');}
 function keys(v,allowed){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('存在未知或无效字段');}
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function date(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v)||!Number.isFinite(Date.parse(v)))fail('记录时间无效');}
 function key(v){if(typeof v!=='string'||!/^p1-[a-f0-9]{16}$/.test(v))fail('方案指纹无效');}
 function camera(v){
  keys(v,['mode','position','target','horizontalFov','focusIds']);
  if(!['orbit','walk'].includes(v.mode)||!finite(v.horizontalFov)||v.horizontalFov<1||v.horizontalFov>120.001)fail('视角无效');
  for(const p of [v.position,v.target]){keys(p,['x','y','z']);if(!['x','y','z'].every(k=>finite(p[k])&&Math.abs(p[k])<=1e8))fail('视角坐标无效');}
  if(Math.hypot(...['x','y','z'].map(k=>v.position[k]-v.target[k]))<0.001)fail('视点与目标重合');
  if(v.focusIds!==undefined&&(!Array.isArray(v.focusIds)||v.focusIds.length>100||v.focusIds.some(id=>typeof id!=='string'||id.length>200)))fail('取景对象无效');
 }
 function validate(v){
  if(v===undefined)return;
  keys(v,['version','title','overview','pages','issues','release']);if(v.version!==1)fail('不支持的格式');
  text(v.title,100,'标题');text(v.overview,3000,'设计目标');
  if(!Array.isArray(v.pages)||v.pages.length>limits.pages||!Array.isArray(v.issues)||v.issues.length>limits.issues)fail('页数或事项数量超限');
  const ids=new Set();let bytes=0;
  for(const p of v.pages){
   keys(p,['id','title','audience','roomId','furnitureIds',...Object.keys(fields),'capture']);
   text(p.id,200,'页编号',true);if(ids.has(p.id))fail('页编号重复');ids.add(p.id);text(p.title,100,'页标题',true);
   if(!Object.hasOwn(audiences,p.audience))fail('阅读对象无效');text(p.roomId,200,'房间编号');
   if(!Array.isArray(p.furnitureIds)||p.furnitureIds.length>100||new Set(p.furnitureIds).size!==p.furnitureIds.length||p.furnitureIds.some(id=>typeof id!=='string'||!id||id.length>200))fail('关联家具编号无效');
   for(const field of Object.keys(fields))text(p[field],3000,fields[field]);
   if(p.capture!==undefined){const c=p.capture;keys(c,['kind','image','sourceKey','createdAt','camera','scene']);
    if(!['2d','3d'].includes(c.kind))fail('图片类型无效');key(c.sourceKey);date(c.createdAt);
    if(typeof c.image!=='string'||c.image.length>limits.image||c.image.length<60||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(c.image)||!/^data:image\/(?:jpeg;base64,\/9j\/|png;base64,iVBORw0KGgo)/.test(c.image))fail('图片须为受限的内嵌 PNG/JPEG');
    bytes+=c.image.length;if(c.kind==='3d'){camera(c.camera);keys(c.scene,['hour','cut','furn','labels','night','lamps','wallNumbers','clearances','solar']);
     try{(root.FurnishDesign||require('./design-core.js')).validateSceneSettings(c.scene);}catch(e){fail(e.message);}
    }else if(c.camera!==undefined||c.scene!==undefined)fail('平面图不包含三维视角');
   }
  }
  if(bytes>limits.images)fail('讲解图片总量超过 6 MB，请减少或重新采集');
  ids.clear();for(const i of v.issues){keys(i,['id','text','assignee','basis','status','reviewKey']);text(i.id,200,'事项编号',true);if(ids.has(i.id))fail('事项编号重复');ids.add(i.id);text(i.text,2000,'待确认事项',true);text(i.assignee,200,'责任方');text(i.basis,2000,'确认依据');if(!['pending','confirmed'].includes(i.status))fail('确认状态无效');if(i.reviewKey!==undefined)key(i.reviewKey);if(i.status==='confirmed'&&(!i.reviewKey||!i.basis.trim()))fail('确认事项须记录依据');}
  if(v.release!==undefined){keys(v.release,['label','createdAt','sourceKey']);text(v.release.label,80,'交付版本',true);date(v.release.createdAt);key(v.release.sourceKey);}
 }
 function canonical(v){if(Array.isArray(v))return v.map(canonical);if(object(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
 function fingerprint(v){const s=JSON.stringify(canonical(v))??'undefined';let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return 'p1-'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
 function sourceKey(plan,work){const {presentation,scene3d,...source}=work;return fingerprint({plan,work:source});}
 function documentKey(plan,work){const {release,...content}=work.presentation||empty();return fingerprint({source:sourceKey(plan,work),content});}
 function empty(){return {version:1,title:'',overview:'',pages:[],issues:[]};}
 function data(work){return clone(work.presentation||empty());}
 function page(id){return {id,title:'新的设计讲解',audience:'both',roomId:'',furnitureIds:[],need:'',approach:'',basis:'',tradeoff:'',instruction:''};}
 function pageState(p,plan,work){const missing=[...(p.roomId&&!plan.rooms?.some(r=>r.id===p.roomId)?['关联房间已不存在']:[]),...p.furnitureIds.filter(id=>!work.furniture.some(f=>f.id===id)).map(id=>'关联家具已不存在：'+id)];return {missing,stale:!!p.capture&&(p.capture.sourceKey!==sourceKey(plan,work)||missing.length>0)};}
 function issueState(i,plan,work){return i.status==='confirmed'&&i.reviewKey===sourceKey(plan,work)?'已确认':i.status==='confirmed'?'方案已变更，需重新确认':'待确认';}
 function releaseState(plan,work){const r=work.presentation?.release;return !r?'尚未记录交付版本':r.sourceKey===documentKey(plan,work)?'与记录版本一致':'内容已变更，需记录新版本';}
 const api={fields,audiences,limits,validate,camera,empty,data,page,fingerprint,sourceKey,documentKey,pageState,issueState,releaseState};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishPresentation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
