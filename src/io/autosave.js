/* Cache-first autosave coordination; storage and UI are supplied by the caller. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.FurnishAutosave = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  function create({writeCache, dropHistoryCache, writeStore, isCurrent, onChange, onFailure, now = Date.now}){
    // Motion edits may yield to the scene first. Keep one latest workspace,
    // while normal saves and lifecycle flushes still serialize synchronously.
    let generation = 0, queued = null, timer = null;
    function cancelQueued(){clearTimeout(timer);timer=null;const job=queued;queued=null;return job;}
    function flush(){const job=cancelQueued();if(!job)return; if(!isCurrent(job.value,job.version)){job.resolve({cached:false,durable:false});return;}const task=save(job.value);task.then(job.resolve);return task;}
    function invalidate(){ generation++;const job=cancelQueued();job?.resolve({cached:false,durable:false}); }
    function save(value,{defer=false}={}){
      if(defer){
        ++generation;
        if(!queued){let resolve;const promise=new Promise(r=>resolve=r);queued={promise,resolve};}
        Object.assign(queued,{value,version:value.updatedAt});
        onChange({error:false,pending:true,savedAt:0});
        clearTimeout(timer);timer=setTimeout(flush,120);return queued.promise;
      }
      const waiting=cancelQueued();
      const token = ++generation, version = value.updatedAt;
      const json = JSON.stringify(value), savedAt = now();
      let cached = false;
      try { cached = writeCache(json)!==false; }
      catch(e){
        try { dropHistoryCache(); cached = writeCache(json)!==false; }
        catch(retryError) { /* The durable store can still save this version. */ }
      }
      const current = () => token === generation && isCurrent(value, version);
      const publish = (error, pending) => {
        if(current()) onChange({error, pending, savedAt});
      };
      publish(false, !cached);
      // Share the same immutable snapshot with both durable destinations.
      let task;
      try { task = writeStore(value,json); }
      catch(e) { task = Promise.reject(e); }
      const result = Promise.resolve(task).then(() => {
        publish(false, false);
        return {cached, durable:true};
      }, error => {
        publish(!cached, false);
        if(!cached && current()) onFailure(error);
        return {cached, durable:false};
      });
      if(waiting)result.then(waiting.resolve);
      return result;
    }
    return {save, invalidate, flush};
  }
  return {create};
});
