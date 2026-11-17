/* Injected only by the comparison host; never loaded by the production page. */
(async()=>{
 if(window.__furnishProbeRunning)return;window.__furnishProbeRunning=true;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,timeout=60000){const end=Date.now()+timeout;while(Date.now()<end){try{if(fn())return;}catch{}await sleep(100);}throw Error('Comparison timeout: '+fn);}
 async function report(value){window.__furnishProbeResult=value;if(window.__FURNISH_COMPARE_REPORT)window.__FURNISH_COMPARE_REPORT(value);else if(window.__TAURI_INTERNALS__)await window.__TAURI_INTERNALS__.invoke('probe_result',{value});await sleep(1800);}
 try{
  await until(()=>window.FurnishRepository&&typeof repositoryBooting!=='undefined'&&!repositoryBooting&&!document.querySelector('#repository-loading')?.getClientRects().length);
  const reloaded=sessionStorage.getItem('furnish-compare-edit');
  if(reloaded){
   const e=JSON.parse(reloaded);if(state.furniture.find(f=>f.id===e.id)?.color!==e.color)throw Error('Save/refresh mismatch');
   sessionStorage.removeItem('furnish-compare-edit');
   await report({stage:'refresh',passed:true,planId:PLAN.id,furniture:state.furniture.length});
  }else{
   const f=state.furniture.find(f=>!f.locked);if(!f)throw Error('No editable furniture');
   const old=f.color,id=f.id,color=old==='#73918a'?'#73918b':'#73918a';
   mutate(()=>{state.furniture.find(f=>f.id===id).color=color;});
   undo();if(state.furniture.find(f=>f.id===id).color!==old)throw Error('Undo failed');
   redo();if(state.furniture.find(f=>f.id===id).color!==color)throw Error('Redo failed');
   await FurnishRepository.flush();sessionStorage.setItem('furnish-compare-edit',JSON.stringify({id,color}));location.reload();return;
  }
  await sleep(2500);await report({stage:'2d',passed:true,ua:navigator.userAgent,webgpu:!!navigator.gpu,viewport:[innerWidth,innerHeight]});
  localStorage.setItem('furnish-observation-v1','smooth');
  await setView('3d');await until(()=>!switching&&viewMode==='3d'&&!!document.querySelector('#view3d canvas'));
  const select=document.querySelector('#progressive-mode');if(select){select.value='smooth';select.dispatchEvent(new Event('change'));}
  await sleep(5000);await report({stage:'3d-smooth',passed:true,canvas:!!document.querySelector('#view3d canvas')});
  if(select){select.value='detail';select.dispatchEvent(new Event('change'));}
  const detailStart=performance.now();let detailTimedOut=false;
  try{await until(()=>document.querySelector('#progressive-controls')?.dataset.state==='fallback'||document.querySelector('#progressive-status')?.textContent.includes('已收敛'),120000);}catch{detailTimedOut=true;}
  await sleep(2000);await report({stage:'3d-detail',passed:true,status:document.querySelector('#progressive-status')?.textContent,frame:!!document.querySelector('#progressive-frame'),elapsedMs:performance.now()-detailStart,timedOut:detailTimedOut,converged:!!document.querySelector('#progressive-status')?.textContent.includes('已收敛')});
  await setView('2d');await sleep(4000);await report({stage:'return-2d',passed:true,frame:!!document.querySelector('#progressive-frame')});
  await FurnishRepository.flush();
  if(window.__TAURI_INTERNALS__)await window.__TAURI_INTERNALS__.invoke('request_close');else window.close();
 }catch(error){await report({stage:'error',passed:false,error:error.message,stack:error.stack});}
})();
