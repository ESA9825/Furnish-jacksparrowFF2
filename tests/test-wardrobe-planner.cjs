'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Q=require('../src/core/wardrobe-questionnaire-core.js'),W=require('../src/core/wardrobe-planner-core.js'),B=require('../src/core/cabinet-builder-core.js'),P=require('../src/core/project-core.js'),D=require('../src/core/design-core.js'),Model=require('../src/render/cabinet-model.js');
function answer(values={}){const answers=Object.fromEntries(Q.questions.map(q=>[q.id,{value:q.options?(q.type==='multi'?[]:null):['number','measurement'].includes(q.type)?null:'',note:'',...(q.type==='measurement'?{source:'unknown'}:{})}]));for(const [k,v]of Object.entries(values))answers[k].value=v;answers.caseName.value='测试答卷';answers.location.value='主卧';return {format:Q.SCHEMA,version:1,status:'complete',answers};}
const area={cx:4000,cy:4000,w:2700,d:600,h:2400,mountHeight:100,rot:0,flip:false},plan={rooms:[{id:'r',name:'房间',poly:[[0,0],[10000,0],[10000,10000],[0,10000]],ceilingHeight:3000}],walls:[],doors:[],wins:[],ceilingHeight:3000};
(async()=>{
 const markup=fs.readFileSync(require.resolve('../index.html'),'utf8'),imports=JSON.parse(markup.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports,T=await import(imports.three),box=(w,h,d,color,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color}));m.position.set(x,y+h/2,z);return m;};
 const a=answer({shortCount:20,longCount:5,longest:1350});a.answers.longest.source='measured';const original=JSON.stringify(a);let count=0;
 for(const rot of [0,90,37])for(const flip of [false,true])for(const width of [1800,2700]){
  const result=W.generate(a,{...area,rot,flip,w:width});assert.equal(result.candidates.length,3);assert.equal(new Set(result.candidates.map(c=>JSON.stringify(c.furniture.cabinet))).size,3);
  for(const c of result.candidates){B.validate(c.furniture);assert.equal(c.furniture.w,width);assert.equal(c.furniture.mountHeight,100);assert.equal(c.furniture.rot,rot);assert.equal(c.furniture.flip,flip);
   const model=Model.build(T,c.furniture,box);model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model);assert(Math.abs((bounds.max.x-bounds.min.x)*1000-width)<.01);assert(Math.abs((bounds.max.y-bounds.min.y)*1000-area.h)<.01);
   const rods=B.railParts(c.furniture);assert.equal(rods.length,c.zones.filter(z=>z.rail!==undefined).length);for(const z of c.zones.filter(z=>z.rail!==undefined)){const rod=rods.find(r=>r.boxId===z.boxId&&Math.abs(r.bottom+r.h/2+100-z.level)<.01);assert(rod);assert(Math.abs(rod.w-z.rail)<.001);}
   const next=W.proposedWork({furniture:[]},c,'new');assert.equal(next.furniture.length,1);P.validateWork(next);const packed=P.pack({planId:'test',current:next,designs:[{id:'named',name:'候选',work:next}],catalog:[]}),restored=P.unpack(packed);assert.deepEqual(restored.current.furniture[0].cabinet,c.furniture.cabinet);assert.deepEqual(P.unpack(P.pack(restored)).current.furniture,restored.current.furniture);count++;
  }
 }
 assert.equal(JSON.stringify(a),original,'Never mutate answer');
 const unknown=W.generate(answer(),area).candidates[0];assert.equal(unknown.capacity.shortTarget,null);assert(unknown.pending.some(x=>x.includes('未知')));
 const zero=W.generate(answer({shortCount:0,longCount:0}),area).candidates[0];assert.equal(zero.capacity.longTarget,0);assert.equal(zero.capacity.longDeficit,0);
 const overload=W.generate(answer({shortRail:9000,longCount:0}),area).candidates;assert(overload.every(c=>c.blockers.some(x=>x.includes('短挂杆长缺少'))));
 const reachable=W.generate(answer({access:['常用物品不登高取用'],shortCount:10,longCount:0}),area);assert(reachable.candidates.every(c=>c.capacity.short===0));assert(reachable.candidates.every(c=>c.pending.some(x=>x.includes('可达'))));
 const tooLow=W.generate(a,area,{reachHeight:1100});assert(tooLow.candidates.every(c=>c.blockers.length));
 const conflict=W.generate(answer({width:2000}),area);assert(conflict.candidates.every(c=>c.blockers.some(x=>x.includes('超过答卷'))));
 const limited=W.generate(answer({door:'滑门'}),area);assert(limited.candidates.every(c=>c.pending.some(x=>x.includes('滑门'))));
 const base=W.generate(a,area).candidates[0],work={furniture:[]};const assessment=W.assess(plan,work,base,'new');assert.equal(assessment.blocking.length,0);assert.deepEqual(work,{furniture:[]});
 const other={id:'obstacle',type:'block',name:'障碍',cx:area.cx,cy:area.cy,w:500,d:500,h:2000,mountHeight:0,rot:0,color:'#fff'};assert(W.assess(plan,{furniture:[other]},base,'new').blocking.length);
 const originalCab={...base.furniture,id:'old',name:'原柜',layerId:'furniture'};const replaced=W.proposedWork({furniture:[originalCab,other]},base,'ignored',{replaceId:'old'});assert.equal(replaced.furniture.length,2);assert.equal(replaced.furniture[0].id,'old');assert.deepEqual(replaced.furniture[1],other);
 assert.throws(()=>W.proposedWork({furniture:[{...originalCab,locked:true}]},base,'new',{replaceId:'old'}),/未锁定/);
 assert.throws(()=>W.generate(a,{...area,w:NaN}),/区域宽/);assert.throws(()=>W.generate(a,{...area,mountHeight:-1}),/离地/);
 const bad=answer();bad.answers.shortCount.value=-1;assert.throws(()=>Q.parse(JSON.stringify(bad)),/整数/);assert.throws(()=>Q.parse('{"format":"other"}'),/受支持/);
 assert(D.pasteFurniture({cx:area.cx,cy:area.cy,items:[base.furniture]},{x:5000,y:5000},{x:0,y:0,w:10000,h:10000},()=> 'copy').items[0].cabinet);
 const embedded=fs.readFileSync(require.resolve('../tools/wardrobe-questionnaire/index.html'),'utf8');assert(embedded.includes(fs.readFileSync(require.resolve('../src/core/wardrobe-questionnaire-core.js'),'utf8')));
 console.log('PASS wardrobe planner: '+count+' production candidates; transforms, capacity, uncertainty, reach, collisions, replacement and project round trips');
})().catch(e=>{console.error(e);process.exitCode=1;});
