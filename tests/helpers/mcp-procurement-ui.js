'use strict';
module.exports=async(p,V)=>{
 const assert=require('node:assert/strict'),path=require('node:path'),Mcp=require('../../scripts/furnish-mcp.cjs');
 const call=(name,args={})=>V.mode==='desktop'?Mcp.callDesktop(path.join(V.artifact(''),'workspace'),name,args):p.evaluate(({name,args})=>FurnishMcp.execute(name,args),{name,args});
 const read=()=>call('get_current_plan',{includeDetails:true});let seq=0;
 const args=c=>({planId:c.plan.id,revision:c.revision,requestId:'procurement-'+(++seq)});
 let c=await read();await call('copy_design',{...args(c),name:'MCP procurement isolated'});c=await read();
 const id=c.furniture.find(f=>!f.locked).id,before=c.work,source='https://www.xiaohongshu.com/explore/public-example?xsec_token=sample-preserve&xsec_source=pc_search';
 const input={...args(c),updates:[{ids:[id],values:{brand:'验收品牌',model:'验收型号',sourceUrl:source,priceDate:'2026-11-17',purchaseNote:'页面默认显示价199元；规格和实际成交价待核对'}}]};
 const done=await call('configure_product_info',input);assert(done.applied&&done.persisted);assert.deepEqual(await call('configure_product_info',input),done);
 let info=(await call('get_product_info',{ids:[id]})).items[0];assert.equal(info.sourceUrl,source);assert.equal(info.purchaseNote,input.updates[0].values.purchaseNote);assert.equal(info.price,before.furniture.find(f=>f.id===id).price??null,'research must not promote displayed price to confirmed price');
 for(const values of [{price:-1},{price:'199'},{sourceUrl:'javascript:alert(1)'},{priceDate:'2026-02-30'},{purchaseStatus:'paid'},{arbitrary:1}]){
  const prior=await read();await assert.rejects(async()=>call('configure_product_info',{...args(prior),updates:[{ids:[id],values}]}));assert.equal((await read()).revision,prior.revision);
 }
 c=await read();await call('configure_product_info',{...args(c),updates:[{ids:[id],values:{price:0,purchaseStatus:'confirmed'}}]});assert.equal((await call('get_product_info',{ids:[id]})).items[0].price,0);
 c=await read();await call('configure_product_info',{...args(c),updates:[{ids:[id],values:{price:null,brand:''}}]});info=(await call('get_product_info',{ids:[id]})).items[0];assert.equal(info.price,null);assert.equal(info.brand,'');
 const ledger=await call('get_procurement'),item=ledger.items.find(i=>i.kind==='furniture'&&i.target===id);
 const order={id:'mcp-order-fixture',number:'TEST-1',date:'2026-11-17',vendor:'测试商家',note:'隔离验收',shipping:0,discount:0,paid:0,lines:[{kind:item.kind,target:item.target,name:item.name,signature:item.signature,unit:item.unit,quantity:1,received:0,unitPrice:100}]};
 c=await read();await call('configure_procurement',{...args(c),orders:[order]});let s=await call('get_procurement');assert.equal(s.orders.find(o=>o.id===order.id).lines[0].received,0);
 c=await read();const bad=JSON.parse(JSON.stringify(order));bad.lines[0].received=2;await assert.rejects(async()=>call('configure_procurement',{...args(c),orders:[bad]}));assert.equal((await read()).revision,c.revision);
 order.paid=50;order.lines[0].received=1;c=await read();await call('configure_procurement',{...args(c),orders:[order],pricing:{...s.pricing,floorWaste:0,materials:{...s.pricing.materials,wood:0}}});
 s=await call('get_procurement');assert.equal(s.orders.find(o=>o.id===order.id).paid,50);assert.equal(s.items.find(i=>i.target===id).received,1);assert.equal(s.pricing.floorWaste,0);
 const work=(await read()).work;await p.evaluate(()=>undo());assert.notDeepEqual((await read()).work,work);await p.evaluate(()=>redo());assert.deepEqual((await read()).work,work);
 const packed=await p.evaluate(()=>FurnishProject.unpack(FurnishProject.pack({planId:PLAN.id,current:state,designs:store.designs.filter(d=>d.planId===PLAN.id),catalog:store.custom||[]})).current);assert.deepEqual(packed.purchaseOrders,work.purchaseOrders);assert.deepEqual(packed.pricing,work.pricing);
 await p.evaluate(()=>repositoryClient.flush());await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!repositoryBooting);s=await call('get_procurement');assert.equal(s.orders.find(o=>o.id===order.id).paid,50);assert.equal((await call('get_product_info',{ids:[id]})).items[0].sourceUrl,source);
 c=await read();await call('configure_procurement',{...args(c),removeOrderIds:[order.id]});assert(!(await call('get_procurement')).orders.some(o=>o.id===order.id));
 assert.equal((await read()).furniture.find(f=>f.id===id).cx,before.furniture.find(f=>f.id===id).cx);
 await p.evaluate(()=>{window.procurementOriginalFlush=repositoryClient.flush;let count=0;repositoryClient.flush=async()=>{if(++count===2)throw Error('fixture procurement save conflict');return window.procurementOriginalFlush.call(repositoryClient);};});
 c=await read();const conflictArgs={...args(c),updates:[{ids:[id],values:{purchaseNote:'Applied in isolated memory, save receipt failed'}}]},conflict=await call('configure_product_info',conflictArgs);assert(conflict.applied);assert.equal(conflict.persisted,false);assert.match(conflict.saveError,/fixture procurement save conflict/);assert.deepEqual(await call('configure_product_info',conflictArgs),conflict);
 await p.evaluate(async()=>{repositoryClient.flush=window.procurementOriginalFlush;delete window.procurementOriginalFlush;await repositoryClient.flush();});
 await V.screenshot('procurement');return {passed:true,checks:['source URL parameters and unconfirmed price semantics','zero and null / clearing metadata','invalid batch atomic rejection','orders / receipt / paid / pricing / explicit removal','undo redo reload and project round trip','idempotent retry and original geometry retained']};
};
