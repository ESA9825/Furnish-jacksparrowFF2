/* Atomic larger local saves; localStorage remains the compatible quick cache. */
(function(root){
 'use strict';let db=null;
 const opened=new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(Error('IndexedDB unavailable'));const request=root.indexedDB.open('furnish-project-storage',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>{db=request.result;db.onversionchange=()=>db.close();resolve(db);};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Local storage upgrade is blocked'));});
 function read(key){return opened.then(database=>new Promise((resolve,reject)=>{const tx=database.transaction('workspace','readonly'),request=tx.objectStore('workspace').get(key);request.onsuccess=()=>{try{resolve(request.result?JSON.parse(request.result):null);}catch(e){reject(e);}};request.onerror=()=>reject(request.error);}));}
 const ready=read('store'),historyReady=read('history');ready.catch(()=>{});historyReady.catch(()=>{});let queue=opened;
 let waiting=null;
 function writeKey(key,json,{clear=false,coalesce=false}={}){
  if(coalesce&&waiting?.key===key){waiting.json=json;return waiting.task;}
  const entry={key,json};
  const task=queue.catch(()=>opened).then(()=>new Promise((resolve,reject)=>{
   if(waiting===entry)waiting=null;
   const tx=db.transaction('workspace','readwrite'),objects=tx.objectStore('workspace');
   try{if(clear)objects.clear();else objects.put(entry.json,key);}
   catch(error){tx.abort();reject(error);return;}
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Local save aborted'));
  }));
  waiting=coalesce?entry:null;entry.task=task;queue=task;return task;
 }
 // Browser quick storage is only suitable for small projects. The exact
 // snapshot still goes to IndexedDB and, in desktop mode, the formal file.
 function writeQuick(key,json,{skipLarge=false}={}){
  if(skipLarge&&json.length>=5*1024*1024)return false;
  root.localStorage.setItem(key,json);return true;
 }
 const writeSerialized=(json,options)=>writeKey('store',json,options),write=value=>writeSerialized(JSON.stringify(value)),writeHistory=(value,json=JSON.stringify(value))=>writeKey('history',json),clear=()=>writeKey('',null,{clear:true});
 root.FurnishStorage={ready,historyReady,write,writeQuick,writeSerialized,writeHistory,clear};
})(window);
