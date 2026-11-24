/* Finish samples share one temporary work snapshot in the main 3D scene. */
(function(){
'use strict';
const S=FurnishStyles,P=FurnishProducts,B=FurnishCabinetBuilder;
const G=FurnishTileGrout,T=FurnishWallTiling,F=FurnishFloorFinish,L=FurnishLayers;
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
const filter=panel.querySelector('[data-material-tile-kind]'),groutRow=panel.querySelector('[data-material-grout]');
const groutInput=panel.querySelector('[data-material-grout-color]'),groutAuto=panel.querySelector('[data-material-grout-auto]');
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
 if(target.kind==='wallTile'||target.kind==='tiles')return [{label:'跟随方案'},...swatches];
 if(target.kind==='wall')return [{label:'恢复默认'},...paints];
 if(['front','board','cabinet'].includes(target.kind))return [...swatches,...veneers];
 return swatches;
}
function caption(t){
 if(!t)return '点选场景中的表面';
 if(t.kind==='floor')return nm(state.rooms[t.id]?.name||t.id)+' · 地面';
 if(t.kind==='wallTile')return nm(state.rooms[t.face.roomId]?.name||t.face.roomId)+' · 墙砖';
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
function tileTargets(){
 const plan=tilePlan(),ids=session.roomIds;
 const inScope=id=>!ids||ids.has(id);
 const floors=plan.rooms.filter(r=>r.counted!==false&&inScope(r.id)&&F.tiled(state.rooms[r.id]?.mat||r.mat)).map(r=>({kind:'floor',id:r.id}));
 const walls=(plan.wallTiling?.surfaces||[]).filter(e=>inScope(e.face.roomId)).map(e=>({kind:'wallTile',id:L.faceKey(e.face),face:T.binding(e.face)}))
  .filter(t=>!session.wallKeys||session.wallKeys.has(t.id));
 return session.tileKind==='floor'?floors:session.tileKind==='wall'?walls:[...floors,...walls];
}
const tilePlan=()=>session.planGeometry??=FurnishProject.effectivePlan(PLAN,state);
const locked=t=>L.locked(state,t.kind==='floor'?'floor:'+t.id:t.id);
const groutTarget=t=>t?.kind==='wallTile'||t?.kind==='floor'&&F.tiled(state.rooms[t.id]?.mat);
const groutValue=(draft,t)=>G.color(draft,t.face?.roomId??t.id,t.face?'wall':'floor',t.face);
function hasSheen(draft,t,batch){
 return t.kind==='wallTile'||t.kind==='floor'&&P.styleAppearance.supportsTileSheen(draft.rooms[t.id]?.mat,batch?undefined:S.materialValue(draft,'floorSamples',t.id));
}
const tileSheen=(draft,t)=>t.kind==='wallTile'?S.wallTileMaterial(draft,t.face)?.sheen:S.floorTileSheen(draft,t.id);
function common(values){const value=values[0];return {value,mixed:values.some(v=>v!==value)};}
function currentSample(target){
 if(!target)return null;
 const draft=work();
 if(target.kind==='floor'){
  const asset=S.materialValue(draft,'floorSamples',target.id),color=S.materialValue(draft,'floorOverrides',target.id);
  return asset?{asset}:color?{color}:{label:'跟随方案'};
 }
 if(target.kind==='wallTile'){
  const color=S.wallTileMaterial(draft,target.face)?.color;
  return color?{color}:{label:'跟随方案'};
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
  if(!state.rooms[t.id]||locked(t))throw Error('地面所在图层已锁定');
  if(Object.hasOwn(v,'label')){
   S.editMaterial(next,'floorSamples',t.id,v.asset);
   S.editSurface(next,'floor',t.id,v.color);
  }
  if(Object.hasOwn(v,'sheen')){
   if(v.sheen&&v.useTile&&!hasSheen(next,t,false))S.editMaterial(next,'floorSamples',t.id,undefined);
   S.editMaterial(next,'floorTileSheens',t.id,v.sheen);
  }
  return;
 }
 if(t.kind==='wallTile'){
  if(locked(t))throw Error('墙砖所在图层已锁定');
  const look={...S.wallTileMaterial(next,t.face)};
  for(const [field,has] of [['color',Object.hasOwn(v,'label')],['sheen',Object.hasOwn(v,'sheen')]]){
   if(has){if(v[field])look[field]=v[field];else delete look[field];}
  }
  S.editMaterial(next,'wallTileMaterials',t.id,Object.keys(look).length?look:undefined);
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
 const batch=session.mode==='tiles',t=session.target,all=batch?tileTargets():[],available=all.filter(t=>!locked(t));
 const subjects=batch?available:t?[t]:[],draft=work();
 const choiceTarget=batch?{kind:'tiles'}:t,choices=subjects.length?samples(choiceTarget):[];
 const selectedSamples=common(subjects.map(t=>JSON.stringify(currentSample(t))));
 const picked=selectedSamples.mixed||!selectedSamples.value?null:JSON.parse(selectedSamples.value);
 const sheenTiles=subjects.filter(t=>hasSheen(draft,t,batch)),sheen=common(sheenTiles.map(t=>tileSheen(draft,t)));
 sheenRow.hidden=!sheenTiles.length;
 for(const option of sheenOptions.children)option.setAttribute('aria-pressed',String(!sheen.mixed&&option.dataset.sheen===(sheen.value||'')));
 const groutTiles=subjects.filter(groutTarget),grout=common(groutTiles.map(t=>groutValue(draft,t)));
 groutRow.hidden=!groutTiles.length;
 groutAuto.setAttribute('aria-pressed',String(!grout.mixed&&grout.value===undefined));
 groutInput.value=grout.value||'#d0c9bd';
 panel.querySelector('[data-material-grout-state]').textContent=grout.mixed?'多种颜色':grout.value||'';
 panel.querySelector('[data-material-tile-filter]').hidden=!batch;filter.value=session.tileKind;
 panel.querySelector('[data-material-tile-count]').textContent=batch?`${available.filter(t=>t.kind==='floor').length} 处地砖 · ${available.filter(t=>t.kind==='wallTile').length} 面墙砖${all.length>available.length?' · '+(all.length-available.length)+' 处已锁定':''}`:'';
 for(const option of panel.querySelectorAll('[data-material-mode]'))option.setAttribute('aria-pressed',String(option.dataset.materialMode===session.mode));
 for(const option of lightingOptions.children)option.setAttribute('aria-pressed',String(option.dataset.light===session.light));
 const batchTitle=session.roomIds?.size===1?nm(state.rooms[[...session.roomIds][0]]?.name||'所选房间')+' · 瓷砖':session.roomIds?'所选房间 · 瓷砖':'批量更换瓷砖';
 panel.querySelector('[data-material-target]').textContent=batch?batchTitle:caption(t);
 panel.querySelector('[data-material-count]').textContent=dirty()?session.edits.size+' 处待应用':'';
 panel.querySelector('[data-material-apply]').disabled=!dirty();
 const signature=JSON.stringify([choiceTarget,batch&&[session.tileKind,available.length],picked]);
 if(tray.dataset.signature===signature)return;
 tray.dataset.signature=signature;tray.replaceChildren();
 choices.forEach((sample,i)=>{
  const el=document.createElement('button');
  el.type='button';el.className='material-sample';el.dataset.materialSample=i;el.draggable=!batch;
  const pressed=sample.asset?sample.asset===picked?.asset||sample.surface&&sample.surface===picked?.surface:sample.color?sample.color===picked?.color&&(!picked.surface||picked.surface==='solid'):sample.label===picked?.label;
  el.setAttribute('aria-pressed',String(!!pressed));
  const chip=document.createElement('span');chip.className='material-sample-chip';
  if(sample.asset){
   const source=sample.surface?globalThis.FurnishWoodVeneerTextures?.[sample.asset]?.baseColor:undefined;
   if(source||!sample.surface)chip.style.backgroundImage='url("'+(source||'assets/materials/floors/'+sample.asset+'/color.jpg')+'")';
   else chip.style.backgroundColor='#937050';
  }else if(sample.color)chip.style.backgroundColor=sample.color;
  const label=document.createElement('span');label.textContent=sample.label;
  el.append(chip,label);el.onclick=()=>batch?stageMany(tileTargets().filter(t=>!locked(t)),sample):stage(t,sample);
  el.addEventListener('dragstart',event=>{
   if(batch){event.preventDefault();return;}
   event.dataTransfer.setData('application/x-furnish-material',JSON.stringify([t.kind,i]));
   event.dataTransfer.effectAllowed='copy';
  });
  tray.append(el);
 });
}
function choose(target){
 if(!active()||session.mode==='tiles')return;
 if(!target){panel.querySelector('[data-material-message]').textContent='请点选可编辑的地面、墙面或家具表面';return;}
 session.target=target;
 panel.querySelector('[data-material-message]').textContent=target.kind==='floor'?'地面外观用于三维搭配，施工铺贴和采购沿用项目设置。':'';
 render();View3D.sync();
}
function stage(target,sample){
 if(target)stageMany([target],sample);
}
function stageMany(targets,sample){
 if(!active()||!targets.length)return;
 const edits=new Map(session.edits);
 for(const target of targets){
  const id=key(target),previous=edits.get(id)?.sample;
  const merged=target.kind==='floor'||target.kind==='wallTile'?{...previous,...(sample.label?{asset:sample.asset,color:sample.color}:{}),...sample}:sample;
  edits.set(id,{target,sample:merged});
 }
 let preview={...state,styleAppearance:state.styleAppearance?structuredClone(state.styleAppearance):undefined,furniture:state.furniture.slice()};
 try{
  const grout=[];
  for(const {target,sample} of edits.values()){
   if(Object.hasOwn(sample,'grout')&&groutValue(state,target)!==sample.grout)grout.push({roomId:target.face?.roomId??target.id,face:target.face,value:sample.grout,groups:['grout']});
   if(!Object.hasOwn(sample,'grout')||Object.hasOwn(sample,'label')||Object.hasOwn(sample,'sheen'))change(preview,target,sample);
  }
  if(grout.length){
   preview=G.editSurfaces(preview,tilePlan(),grout);
   if(state.tilePresets?.bindings?.length)preview.tilePresets=FurnishTilePresets.unsubscribe({tilePresets:state.tilePresets},grout).tilePresets;
  }
  session.edits=edits;session.preview=preview;
  if(session.mode==='surface')choose(targets[0]);else{render();View3D.sync();}
 }catch(err){toast(err.message);}
}
function drop(event,target){
 if(!active()||session.mode==='tiles'||!target)return;
 try{
  const [kind,i]=JSON.parse(event.dataTransfer.getData('application/x-furnish-material'));
  const drag=Object.hasOwn({floor:1,wall:1,wallTile:1,front:1,legacyFront:1,board:1,cabinet:1,furniture:1},kind)&&samples({kind})[i];
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
 if(active()){if(target){session.mode='surface';choose(target);}else close();return;}
 if(!$('#dlg').hidden||FurnishElectricalUI.active()||FurnishCatalog.active()||FurnishWorkflowTools.styleId()){
  toast('请先结束当前编辑或预览');return;
 }
 if(!is3D())await setView('3d');
 if(!is3D())return;
 if($('#vMeasure').getAttribute('aria-pressed')==='true')$('#vMeasure').click();
 session={base:state,plan:PLAN.id,version:store.updatedAt,target:null,edits:new Map(),preview:null,light:'plan',mode:'surface',tileKind:'all'};
 if(target)choose(target);
 else if(ui.sel?.kind==='room'&&state.rooms[ui.sel.id]&&!FurnishLayers.locked(state,'floor:'+ui.sel.id))choose({kind:'floor',id:ui.sel.id});
 else choose(null);
 render();View3D.sync();
}
async function openTiles({ids,kinds,faces}={}){
 if(!active())await open();
 if(!active())return;
 session.roomIds=ids?new Set(ids):null;session.wallKeys=faces?new Set(faces.map(L.faceKey)):null;
 session.tileKind=kinds?.length===1?kinds[0]:'all';setMode('tiles');
}
function setMode(mode){
 if(!active())return;
 session.mode=mode;
 panel.querySelector('[data-material-message]').textContent='';
 render();View3D.sync();
}
function stageGrout(value){
 if(!active())return;
 const tiles=session.mode==='tiles'?tileTargets().filter(t=>!locked(t)):[session.target].filter(t=>groutTarget(t)&&!locked(t));
 stageMany(tiles.filter(t=>groutValue(work(),t)!==value),{grout:value});
}
function apply(){
 if(!dirty())return;
 const result=session.preview,original=session;
 session=null;render();
 try{
  mutate(()=>{
   if(result.styleAppearance===undefined)delete state.styleAppearance;else state.styleAppearance=result.styleAppearance;
   if(result.tileGrout===undefined)delete state.tileGrout;else state.tileGrout=result.tileGrout;
   if(result.tilePresets===undefined)delete state.tilePresets;else state.tilePresets=result.tilePresets;
   state.furniture=result.furniture;
  },{sceneFirst:true,appearanceEdit:true});
  toast('材质已应用，可一次撤销');
 }catch(err){session=original;if(!active())session=null;render();View3D.sync();toast(err.message);}
}
button.onclick=()=>open();
for(const el of panel.querySelectorAll('[data-material-mode]'))el.onclick=()=>el.dataset.materialMode==='tiles'?openTiles():setMode('surface');
filter.onchange=()=>{if(active()){session.tileKind=filter.value;render();}};
groutAuto.onclick=()=>stageGrout(undefined);
panel.querySelector('[data-material-grout-use]').onclick=()=>stageGrout(groutInput.value);
for(const option of [{id:'',name:'原砖面'},...P.styleAppearance.tileSheens]){
 const el=document.createElement('button');el.type='button';el.className='btn';el.dataset.sheen=option.id;el.textContent=option.name;
 if(option.description)el.title=option.description;
 el.onclick=()=>{
  if(!active()||sheenRow.hidden||el.getAttribute('aria-pressed')==='true')return;
  const batch=session.mode==='tiles',tiles=batch?tileTargets().filter(t=>!locked(t)):[session.target];
  stageMany(tiles.filter(t=>hasSheen(work(),t,batch)),{sheen:option.id||undefined,useTile:batch});
 };
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
window.FurnishMaterialUI={open,openTiles,close,active,dirty,lighting,choose,drop,work,afterRender,furnitureTarget,target:()=>active()&&session.mode==='surface'?session.target:null};
})();
