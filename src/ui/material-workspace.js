/* Finish samples share one temporary work snapshot in the main 3D scene. */
(function(){
'use strict';
const S=FurnishStyles,P=FurnishProducts,B=FurnishCabinetBuilder;
const swatches=[
 {label:'暖砂米',color:'#dfd4c2'},{label:'浅米灰',color:'#d5d1c8'},
 {label:'柔白',color:'#e9e6de'},{label:'烟灰',color:'#b9b8b2'}
];
const paints=[
 {label:'暖白',color:'#eee8dc'},{label:'砂岩米',color:'#dcccba'},
 {label:'雾灰',color:'#ced1cc'},{label:'浅鼠尾草',color:'#a9b4a1'}
];
const key=t=>JSON.stringify([t.kind,t.id,t.side,t.boxId,t.componentId,t.column]);
const floorSamples=P.styleAppearance.floorSamples.map(asset=>({label:asset.name,asset:asset.id}));
const veneers=P.cabinetAppearance.options.filter(s=>s.materialId).map(s=>({label:s.name,surface:s.id,asset:s.materialId}));
const panel=$('#material-panel'),button=$('#vMaterials'),tray=panel.querySelector('[data-material-samples]');
const sheenRow=panel.querySelector('[data-material-sheen]'),sheenOptions=panel.querySelector('[data-material-sheen-options]');
const lightingOptions=panel.querySelector('[data-material-light-options]');
const lightPresets={
 plan:{label:'方案光照'},morning:{label:'早晨',light:{hour:8,night:false}},midday:{label:'正午',light:{hour:12,night:false}},
 evening:{label:'傍晚',light:{hour:17.5,night:false}},night:{label:'夜间',light:{hour:21,night:true}}
};
let session=null;
function furnitureTarget(f,part,front,legacyPart){
 if(!f||f.obj||furnitureLocked(f))return null;
 if(f.cabinet?.version===2&&part?.boxId){
  const pick={boxId:part.boxId,componentId:part.componentId},{box,component}=B.selection(f,pick);
  if(front&&component&&P.cabinetAppearance.frontKinds.includes(component.kind)&&component.kind!=='multiDoor')return {kind:'front',id:f.id,...pick};
  if(!front&&box&&(!pick.componentId||component&&P.cabinetAppearance.componentKinds.includes(component.kind)&&!P.cabinetAppearance.frontKinds.includes(component.kind)))return {kind:'board',id:f.id,...pick};
 }
 if(front&&f.cabinet?.version===1&&Number.isInteger(legacyPart?.column)&&f.cabinet.columns[legacyPart.column])return {kind:'legacyFront',id:f.id,column:legacyPart.column};
 if(front)return null;
 if(f.kitchen||f.cabinet)return {kind:'cabinet',id:f.id};
 if(P.styleRole(f))return {kind:'furniture',id:f.id};
 return null;
}
function samples(target){
 if(target.kind==='floor')return [{label:'跟随方案'},...swatches,...floorSamples];
 if(target.kind==='wall')return [{label:'恢复默认'},...paints];
 if(['front','board','cabinet'].includes(target.kind))return [...swatches,...veneers];
 return swatches;
}
function caption(t){
 if(!t)return '点选场景中的表面';
 if(t.kind==='floor')return nm(state.rooms[t.id]?.name||t.id)+' · 地面';
 if(t.kind==='wall')return '墙面';
 const suffix={front:' · 门板／抽面',legacyFront:' · 分区门板／抽面',board:' · 柜箱／板件',cabinet:' · 柜身',furniture:''};
 return (getF(t.id)?.name||t.id)+suffix[t.kind];
}
function active(){
 return !!session&&session.plan===PLAN.id&&session.base===state&&session.version===store.updatedAt;
}
function dirty(){return active()&&session.edits.size>0;}
function lighting(){return active()?lightPresets[session.light].light:undefined;}
function work(value=state){
 return active()&&value===state&&session.preview?session.preview:value;
}
function currentSample(target){
 if(!target)return null;
 const draft=work();
 if(target.kind==='floor'){
  const asset=S.materialValue(draft,'floorSamples',target.id),color=S.materialValue(draft,'floorOverrides',target.id);
  return asset?{asset}:color?{color}:{label:'跟随方案'};
 }
 if(target.kind==='wall'){
  const color=S.materialValue(draft,'wallPaint',S.wallKey(target.id,target.side));
  return color?{color}:{label:'恢复默认'};
 }
 const f=draft.furniture.find(f=>f.id===target.id);
 if(!f)return null;
 const config=f.kitchen??f.cabinet;
 if(target.kind==='cabinet')return {color:config?.appearance?.bodyColor,surface:config?.appearance?.bodySurface};
 if(target.kind==='legacyFront')return {color:f.cabinet.columns[target.column]?.doorColor};
 if(target.kind==='front'||target.kind==='board'){
  const {box,component}=B.selection(f,target),p=component??box;
  return p?{color:p.color,surface:p.surface}:null;
 }
 return {color:f.color};
}
function change(next,t,v){
 if(t.kind==='floor'){
  if(!state.rooms[t.id]||FurnishLayers.locked(state,'floor:'+t.id))throw Error('地面所在图层已锁定');
  if(Object.hasOwn(v,'label')){
   S.editMaterial(next,'floorSamples',t.id,v.asset);
   S.editSurface(next,'floor',t.id,v.color);
  }
  if(Object.hasOwn(v,'sheen'))S.editMaterial(next,'floorTileSheens',t.id,v.sheen);
  return;
 }
 if(t.kind==='wall'){
  if(FurnishLayers.locked(state,'wallPaint:'+t.id))throw Error('墙面所在图层已锁定');
  S.editMaterial(next,'wallPaint',S.wallKey(t.id,t.side),v.color);
  return;
 }
 const i=next.furniture.findIndex(f=>f.id===t.id),f=next.furniture[i];
 if(!f||furnitureLocked(f))throw Error('家具已锁定或移除');
 if(t.kind==='furniture'){next.furniture[i]={...f,color:v.color};return;}
 if(t.kind==='legacyFront'){
  const result=structuredClone(f),C=FurnishCabinet;
  result.cabinet.columns[t.column]=C.withDoorSetting(result.cabinet.columns[t.column],'doorColor',v.color);
  C.validate(result);next.furniture[i]=result;
  return;
 }
 if(t.kind==='front'||t.kind==='board'){
  const patch={surface:v.surface||'solid',color:v.color||P.cabinetAppearance.veneer(v.surface).baseColorTintSrgb||'#ffffff'};
  next.furniture[i]=B.update(f,t,patch);
  return;
 }
 const result=P.cabinetAppearance.withBodySurface(f,v.surface||'solid'),config=result.kitchen??result.cabinet;
 if(v.color){
  config.appearance.bodyColor=v.color;
  if(config.version===3)config.bodyColor=v.color;
 }
 next.furniture[i]=result;
}
function render(){
 panel.hidden=!session;
 button.setAttribute('aria-pressed',String(!!session));
 $('#stage').classList.toggle('material-editing',!!session);
 if(!session)return;
 const t=session.target,choices=t?samples(t):[],picked=currentSample(t);
 const draft=work(),hasTile=t?.kind==='floor'&&P.styleAppearance.supportsTileSheen(draft.rooms[t.id]?.mat,picked?.asset);
 sheenRow.hidden=!hasTile;
 if(hasTile){
  const selected=S.floorTileSheen(draft,t.id)||'';
  for(const option of sheenOptions.children)option.setAttribute('aria-pressed',String(option.dataset.sheen===selected));
 }
 for(const option of lightingOptions.children)option.setAttribute('aria-pressed',String(option.dataset.light===session.light));
 panel.querySelector('[data-material-target]').textContent=caption(t);
 panel.querySelector('[data-material-count]').textContent=dirty()?session.edits.size+' 处待应用':'';
 panel.querySelector('[data-material-apply]').disabled=!dirty();
 const signature=JSON.stringify([t,picked]);
 if(tray.dataset.signature===signature)return;
 tray.dataset.signature=signature;tray.replaceChildren();
 choices.forEach((sample,i)=>{
  const el=document.createElement('button');
  el.type='button';el.className='material-sample';el.dataset.materialSample=i;el.draggable=true;
  const pressed=sample.asset?sample.asset===picked?.asset||sample.surface&&sample.surface===picked?.surface:sample.color?sample.color===picked?.color&&(!picked.surface||picked.surface==='solid'):sample.label===picked?.label;
  el.setAttribute('aria-pressed',String(!!pressed));
  const chip=document.createElement('span');chip.className='material-sample-chip';
  if(sample.asset){
   const source=sample.surface?globalThis.FurnishWoodVeneerTextures?.[sample.asset]?.baseColor:undefined;
   if(source||!sample.surface)chip.style.backgroundImage='url("'+(source||'assets/materials/floors/'+sample.asset+'/color.jpg')+'")';
   else chip.style.backgroundColor='#937050';
  }else if(sample.color)chip.style.backgroundColor=sample.color;
  const label=document.createElement('span');label.textContent=sample.label;
  el.append(chip,label);el.onclick=()=>stage(t,sample);
  el.addEventListener('dragstart',event=>{
   event.dataTransfer.setData('application/x-furnish-material',JSON.stringify([t.kind,i]));
   event.dataTransfer.effectAllowed='copy';
  });
  tray.append(el);
 });
}
function choose(target){
 if(!active())return;
 if(!target){panel.querySelector('[data-material-message]').textContent='请点选可编辑的地面、墙面或家具表面';return;}
 session.target=target;
 panel.querySelector('[data-material-message]').textContent=target.kind==='floor'?'地面外观用于三维搭配，施工铺贴和采购沿用项目设置。':'';
 render();View3D.sync();
}
function stage(target,sample){
 if(!active()||!target)return;
 const edits=new Map(session.edits),id=key(target),previous=edits.get(id)?.sample;
 edits.set(id,{target,sample:target.kind==='floor'?{...previous,...(sample.label?{asset:sample.asset,color:sample.color}:{}),...sample}:sample});
 const preview={...state,styleAppearance:state.styleAppearance?structuredClone(state.styleAppearance):undefined,furniture:state.furniture.slice()};
 try{
  for(const edit of edits.values())change(preview,edit.target,edit.sample);
  session.edits=edits;session.preview=preview;choose(target);
 }catch(err){toast(err.message);}
}
function drop(event,target){
 if(!active()||!target)return;
 try{
  const [kind,i]=JSON.parse(event.dataTransfer.getData('application/x-furnish-material'));
  const drag=Object.hasOwn({floor:1,wall:1,front:1,legacyFront:1,board:1,cabinet:1,furniture:1},kind)&&samples({kind})[i];
  const sample=drag&&samples(target).find(v=>v.label===drag.label);
  if(sample)stage(target,sample);else choose(target);
 }catch{/* Unrelated drags use their original handlers. */}
}
function close(){
 if(!session)return;
 session=null;render();View3D.sync();
}
function afterRender(){if(session&&(!active()||!is3D()))close();}
async function open(target){
 if(active()){if(target)choose(target);else close();return;}
 if(!$('#dlg').hidden||FurnishElectricalUI.active()||FurnishCatalog.active()||FurnishWorkflowTools.styleId()){
  toast('请先结束当前编辑或预览');return;
 }
 if(!is3D())await setView('3d');
 if(!is3D())return;
 if($('#vMeasure').getAttribute('aria-pressed')==='true')$('#vMeasure').click();
 session={base:state,plan:PLAN.id,version:store.updatedAt,target:null,edits:new Map(),preview:null,light:'plan'};
 if(target)choose(target);
 else if(ui.sel?.kind==='room'&&state.rooms[ui.sel.id]&&!FurnishLayers.locked(state,'floor:'+ui.sel.id))choose({kind:'floor',id:ui.sel.id});
 else choose(null);
 render();View3D.sync();
}
function apply(){
 if(!dirty())return;
 const result=session.preview,original=session;
 session=null;render();
 try{
  mutate(()=>{
   if(result.styleAppearance===undefined)delete state.styleAppearance;else state.styleAppearance=result.styleAppearance;
   state.furniture=result.furniture;
  },{sceneFirst:true,appearanceEdit:true});
  toast('材质已应用，可一次撤销');
 }catch(err){session=original;if(!active())session=null;render();View3D.sync();toast(err.message);}
}
button.onclick=()=>open();
for(const option of [{id:'',name:'原砖面'},...P.styleAppearance.tileSheens]){
 const el=document.createElement('button');el.type='button';el.className='btn';el.dataset.sheen=option.id;el.textContent=option.name;
 if(option.description)el.title=option.description;
 el.onclick=()=>{if(active()&&!sheenRow.hidden&&el.getAttribute('aria-pressed')!=='true')stage(session.target,{sheen:option.id||undefined});};
 sheenOptions.append(el);
}
for(const [id,preset] of Object.entries(lightPresets)){
 const el=document.createElement('button');el.type='button';el.className='btn';el.dataset.light=id;el.textContent=preset.label;
 el.onclick=()=>{if(active()&&session.light!==id){session.light=id;render();View3D.sync();}};
 lightingOptions.append(el);
}
panel.querySelector('[data-material-close]').onclick=close;
panel.querySelector('[data-material-apply]').onclick=apply;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active()){e.stopImmediatePropagation();close();button.focus();}},true);
window.FurnishMaterialUI={open,close,active,dirty,lighting,choose,drop,work,afterRender,furnitureTarget,target:()=>active()?session.target:null};
})();
