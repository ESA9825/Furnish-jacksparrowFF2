const assert=require('node:assert/strict'),D=require('../src/core/design-core.js'),P=require('../src/core/project-core.js');
const work={furniture:[],rooms:{},scene3d:D.sceneSettings({hour:16,night:true})};
let designs=D.manageDesign([],'p1','create',{name:'A',work,now:1});
work.scene3d.hour=12;assert.equal(designs[0].work.scene3d.hour,16);
const original=JSON.stringify(designs);
assert.throws(()=>D.manageDesign(designs,'p1','create',{name:' A ',work}),/同名/);assert.equal(JSON.stringify(designs),original);
designs=D.manageDesign(designs,'p1','duplicate',{id:designs[0].id,name:'B',now:1});assert.notEqual(designs[0].id,designs[1].id);
designs[1].work.scene3d.hour=8;assert.equal(designs[0].work.scene3d.hour,16);
designs=D.manageDesign(designs,'p1','rename',{id:designs[0].id,name:'方案 A',note:'采光优先'});assert.equal(designs[0].work.designNote,'采光优先');
designs=D.manageDesign(designs,'p1','update',{id:designs[0].id,work});assert.equal(designs[0].work.scene3d.hour,12);
assert.throws(()=>D.manageDesign(designs,'p2','delete',{id:designs[0].id}),/不存在/);
assert.throws(()=>D.manageDesign(designs,'p1','rename',{id:designs[0].id,name:'B'}),/同名/);
assert.throws(()=>D.manageDesign(designs,'p1','create',{name:'broken',work:{furniture:[{}]}}),/家具/);
const payload=P.unpack(P.pack({planId:'p1',current:work,designs,catalog:[]}));assert.deepEqual(payload.current.scene3d,work.scene3d);
assert.throws(()=>P.validateWork({...work,scene3d:{...work.scene3d,hour:100}}),/三维/);
assert.deepEqual(D.sceneSettings({hour:100,night:'yes'}),D.sceneSettings());
designs=D.manageDesign(designs,'p1','delete',{id:designs[0].id});assert.equal(designs.length,1);assert.equal(designs[0].name,'B');

const history=designs[0];
const legacy={name:'Legacy history',planId:'p1',work};
const keep={...history,name:'Unselected history'};
const active={...history,id:'active',name:'Active design',editable:true};
const spare={...history,id:'spare',name:'Another editable design',editable:true};
const other={...history,name:'Other plan history',planId:'p2'};
const workspace={designs:[history,legacy,keep,active,spare,other],activeDesigns:{p1:active.id,p2:'unrelated'}};
const beforeDeletion=JSON.stringify(workspace);
const afterDeletion=D.deleteDesignRecords(workspace,'p1',[legacy,history,history],false);
assert.deepEqual(afterDeletion,{designs:[keep,active,spare,other]});
assert.equal(JSON.stringify(workspace),beforeDeletion);
assert.deepEqual(D.deleteDesignRecords(afterDeletion,'p1',[keep],false),{designs:[active,spare,other]});
assert.throws(()=>D.deleteDesignRecords(workspace,'p1',[],false),/请选择/);
for(const invalid of [active,other,{...history}]){
 assert.throws(()=>D.deleteDesignRecords(workspace,'p1',[legacy,invalid],false),/已变化/);
 assert.equal(JSON.stringify(workspace),beforeDeletion);
}
assert.throws(()=>D.deleteDesignRecords(afterDeletion,'p1',[legacy],false),/已变化/);
assert.throws(()=>D.deleteDesignRecords(workspace,'p1',[spare,history],true),/已变化/);
assert.deepEqual(D.deleteDesignRecords(workspace,'p1',[spare],true),{designs:[history,legacy,keep,active,other]});
assert.deepEqual(D.deleteDesignRecords(workspace,'p1',[active,spare],true),{
 designs:[history,legacy,keep,other],activeDesigns:{p2:'unrelated'},
});
assert.equal(JSON.stringify(workspace),beforeDeletion);

// A distance edit cannot move furniture to another room through a solid divider.
const plan={walls:[[-100,0,0,3000],[1900,0,2100,3000],[4000,0,4100,3000]],rooms:[{poly:[[0,0],[1900,0],[1900,3000],[0,3000]]},{poly:[[2100,0],[4000,0],[4000,3000],[2100,3000]]}],wins:[]};
const item={id:'f',cx:1000,cy:1000,w:400,d:400,rot:30};
assert.throws(()=>D.placeAtGap(plan,item,'left',2700),/路径被墙体阻挡/);
console.log('Design management, scene persistence and swept placement checks passed');
