/* Questionnaire -> alternative canonical component cabinets. Pure, offline and deterministic. */
(function(root){
'use strict';
const B=()=>root.FurnishCabinetBuilder||require('./cabinet-builder-core.js'),Q=()=>root.FurnishWardrobeQuestionnaire||require('./wardrobe-questionnaire-core.js'),P=()=>root.FurnishProducts||require('./product-rules.js');
const defaults=Object.freeze({shortDrop:900,longDrop:1500,railPerItem:40,reachHeight:null,topMargin:80,bottomMargin:50,thickness:18,backThickness:18});
const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(label+'须为 '+min+'–'+max+' mm');return v;};
function region(value){const out={};for(const [key,min,max,label]of [['cx',-100000,100000,'中心X'],['cy',-100000,100000,'中心Y'],['w',600,6000,'区域宽'],['d',300,1200,'区域深'],['h',1800,3200,'柜体高'],['mountHeight',0,20000,'底部离地'],['rot',-360,360,'朝向']])out[key]=number(value[key],min,max,label);out.flip=value.flip===true;return out;}
function options(value={}){const o={...defaults,...value};for(const [key,min,max]of [['shortDrop',500,1600],['longDrop',600,2400],['railPerItem',10,150],['topMargin',30,200],['bottomMargin',20,150],['thickness',12,30],['backThickness',0,50]])number(o[key],min,max,key);if(o.reachHeight!==null)number(o.reachHeight,500,3000,'舒适杆心最高离地');return o;}
function demand(answer,o){const a=answer.answers,v=key=>a[key].value;return {short:v('shortRail')??(v('shortCount')===null?null:v('shortCount')*o.railPerItem),long:v('longRail')??(v('longCount')===null?null:v('longCount')*o.railPerItem),longDrop:v('longest')??o.longDrop,avoidHigh:v('access').some(x=>['常用物品不登高取用','需要坐姿取用','儿童自己拿'].includes(x)),open:v('door')==='开放式',sliding:v('door')==='滑门',fold:v('habit')==='偏好折叠收纳'};}
function generate(payload,area,settings={}){
 const answer=Q().parse(JSON.stringify(payload)),r=region(area),o=options(settings),needs=demand(answer,o),v=key=>answer.answers[key].value;
 const count=Math.max(2,Math.ceil(r.w/900)),longNeeded=needs.long!==0,recipes=[
 {id:'capacity',name:'挂衣与容量优先',note:'尽可能利用短挂的上下空间，保留长挂区域。',roles:Array.from({length:count},(_,i)=>i===count-1?(longNeeded?'long':'fold'):i===0?'double':'shortDrawers')},
 {id:'access',name:'取放便利优先',note:'减少高处挂衣，增加可达范围内的抽屉和层板。',roles:Array.from({length:count},(_,i)=>i===count-1?(longNeeded?'long':'fold'):i===0?'shortDrawers':'fold')},
 {id:'flexible',name:'少配件、便于调整',note:'以单挂和活动层板为主，减少抽屉五金。',roles:Array.from({length:count},(_,i)=>i===count-1?(longNeeded?'long':'fold'):i===0?'short':'fold')}
 ];
 const siteConflicts=[];
 const common=['尺寸和配件为可调整的布局草案，不是加工或承重结论。','需按现场复核墙面、收口、门窗、窗帘及安装余量。','自由说明、多人分配、大件、预算与特殊用途需逐项人工核对，未自动判定满足。'];
 if(answer.status==='draft')common.push('导入的是草稿答卷，尚有未确认信息。');
 if(needs.short===null||needs.long===null)common.push('部分挂衣目标容量未知，不以0处理，也不宣称容量满足。');
 if(v('shortRail')===null&&v('shortCount')!==null||v('longRail')===null&&v('longCount')!==null)common.push('件数按 '+o.railPerItem+' mm/件估算；请用本人衣物实测占杆长替换。');
 if(v('longest')===null)common.push('最长衣物未知，长挂按暂定 '+o.longDrop+' mm垂落长度生成。');
 if(r.d<550)common.push('当前柜深较浅，需用实际衣架和厚衣验证闭门净深，挂衣容量为条件估算。');
 if(needs.sliding)common.push('当前生成器仅支持平开／开放结构；滑门要求尚未实现，不自动替换为已满足。');
 if(needs.avoidHigh&&o.reachHeight===null)common.push('有可达性要求但未提供本人舒适杆心最高离地，上杆不计入必需日常容量。');
 for(const key of ['width','height','depth']){const val=v(key);if(val!==null&&(key==='width'?r.w:key==='height'?r.h+r.mountHeight:r.d)>val+.001)siteConflicts.push('指定区域超过答卷中的'+Q().questions.find(q=>q.id===key).title+'，需确认依据与取舍。');}
 for(const key of ['shortRail','longRail','longest'])if(v(key)!==null&&['unknown','estimated'].includes(answer.answers[key].source))common.push(Q().questions.find(q=>q.id===key).title+'采用估计或依据未确认的值，须实测复核。');
 const candidates=recipes.map(recipe=>{
  const pending=[...common],blockers=[...siteConflicts],zones=[];let f=B().empty({id:'wardrobe_candidate',cx:r.cx,cy:r.cy,rot:r.rot,flip:r.flip,mountHeight:r.mountHeight});f.name=recipe.name;
  for(let i=0;i<count;i++){
   const box={...B().box(),w:r.w/count,d:r.d,h:r.h,thickness:o.thickness,backThickness:o.backThickness},added=B().addBox(f,{target:i?'box'+i:undefined,params:box});f=added.furniture;const boxId=added.selected.boxId,b=f.cabinet.boxes[i],base=b.thickness,top=b.h-b.thickness,inner=top-base;let serial=0;
   const add=(kind,level,patch={})=>{const part={...B().defaultPart(kind,b),...patch};if(level!==null)part.at=(level-base)/inner;part.id='p'+i+'_'+(++serial);b.components.push(part);return part;};
   if(!needs.open)add('door',null,{mode:b.w>650?'double':i%2?'right':'left'});
   const width=b.w-2*b.thickness-2*P().cabinetBuilder.rail.endGap.default;
   let role=recipe.roles[i];if(role==='double'&&needs.avoidHigh)role='short';
   const rail=(level,drop,floor,label)=>{
    const isReachable=o.reachHeight!==null?level+r.mountHeight<=o.reachHeight:!needs.avoidHigh;
    const available=level-floor-o.bottomMargin;
    const fits=available>=drop-1e-6;
    if(level>top-o.topMargin||level<base+40){blockers.push(label+'杆位超出可用柜腔');return;}
    add('rail',level);zones.push({boxId,kind:label,rail:width,level:level+r.mountHeight,drop,available,reachable:isReachable,fits});
    if(!fits)blockers.push(label+'净高不足：可用 '+Math.round(available)+'，需要 '+drop+' mm（另计底部余量）');
    if(!isReachable)pending.push(label+'杆心离地 '+Math.round(level+r.mountHeight)+' mm，未确认可达，不计入日常有效容量。');
   };
   const accessible=Math.min(top-o.topMargin,o.reachHeight===null?1650:o.reachHeight-r.mountHeight);
   if(role==='long')rail(o.reachHeight===null&&!needs.avoidHigh?Math.max(accessible,base+needs.longDrop+o.bottomMargin):accessible,needs.longDrop,base,'长挂');
   else if(role==='double'){
    const low=base+o.shortDrop+o.bottomMargin,high=low+o.shortDrop+o.bottomMargin;
    if(high<=top-o.topMargin){rail(low,o.shortDrop,base,'短挂');rail(high,o.shortDrop,low,'短挂');}
    else{rail(accessible,o.shortDrop,base,'短挂');pending.push('柜高不足双挂，已改为单挂；容量按实际单杆计算。');}
   }else if(role==='fold'){
    const layers=Math.max(2,Math.floor(inner/360));for(let layer=1;layer<layers;layer++)add('shelf',base+inner*layer/layers);
    zones.push({boxId,kind:'叠放',shelves:layers-1,netWidth:b.w-2*b.thickness,netDepth:B().frontDepth(b)-b.backThickness});
   }else{
    const drawerTop=role==='shortDrawers'?base+400:base;
    if(role==='shortDrawers')add('drawers',null,{heights:[160,240]});
    rail(accessible,o.shortDrop,drawerTop,'短挂');
    const shelfLevel=accessible+60;if(shelfLevel+b.thickness/2<top-100)add('shelf',shelfLevel);
   }
  }
  f=B().fit(f);try{B().validate(f);}catch(e){blockers.push('生产结构校验：'+e.message);}
  const rails=zones.filter(z=>z.rail!==undefined),short=rails.filter(z=>z.kind==='短挂'&&z.fits&&z.reachable).reduce((n,z)=>n+z.rail,0),long=rails.filter(z=>z.kind==='长挂'&&z.fits&&z.reachable).reduce((n,z)=>n+z.rail,0);
  const capacity={short,long,shortTarget:needs.short,longTarget:needs.long,shortDeficit:needs.short===null?null:Math.max(0,needs.short-short),longDeficit:needs.long===null?null:Math.max(0,needs.long-long),drawers:f.cabinet.boxes.reduce((n,b)=>n+b.components.filter(p=>p.kind==='drawers').reduce((n,p)=>n+p.heights.length,0),0),shelves:f.cabinet.boxes.reduce((n,b)=>n+b.components.filter(p=>p.kind==='shelf').length,0)};
  if(capacity.shortDeficit>0)blockers.push('短挂杆长缺少 '+Math.ceil(capacity.shortDeficit)+' mm');if(capacity.longDeficit>0)blockers.push('长挂杆长缺少 '+Math.ceil(capacity.longDeficit)+' mm');
  return {...recipe,furniture:f,zones,capacity,pending:[...new Set(pending)],blockers:[...new Set(blockers)]};
 });
 if(needs.fold)candidates.sort((a,b)=>b.capacity.shelves-a.capacity.shelves);
 return {answer,region:r,settings:o,candidates};
}
// Always rebuild the work from the live snapshot; candidates are never the stored plan.
function proposedWork(work,candidate,newId,{replaceId=null}={}){if(!candidate?.furniture)throw Error('请先选择候选方案');const next=JSON.parse(JSON.stringify(work));let f=JSON.parse(JSON.stringify(candidate.furniture));if(replaceId){const original=next.furniture.find(v=>v.id===replaceId);if(!original||original.locked||original.type!=='cabinet'||original.kitchen||next.furniture.some(v=>v.laundryHostId===replaceId))throw Error('只能替换未锁定、无关联设备的普通柜体');const spec={...f};delete spec.id;const D=root.FurnishDesign||require('./design-core.js');f={...D.replaceFurniture(original,spec,{anchor:'center'}),cx:f.cx,cy:f.cy,rot:f.rot,flip:f.flip,mountHeight:f.mountHeight};next.furniture=next.furniture.map(v=>v.id===replaceId?f:v);}else{f.id=newId;if(typeof newId!=='string'||!newId||next.furniture.some(v=>v.id===newId))throw Error('候选家具ID无效或重复');next.furniture.push(f);}B().validate(f);return next;}
function assess(plan,work,candidate,newId,opts={}){const Project=root.FurnishProject||require('./project-core.js'),next=proposedWork(work,candidate,newId,opts);Project.validateWork(next);const id=opts.replaceId||newId,issues=Project.spaceCheck(plan,next.furniture,{focusIds:[id],passage:work.spaceThreshold||800,scanPassages:false});return {work:next,issues,blocking:issues.filter(v=>!v.pending&&!['front','passage','clearance'].includes(v.kind))};}

const api={defaults,region,options,demand,generate,proposedWork,assess};root.FurnishWardrobePlanner=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
