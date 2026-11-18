'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const B=require('../src/core/cabinet-builder-core.js'),P=require('../src/core/cabinet-component-profiles.js'),M=require('../src/core/cabinet-motion.js'),D=require('../src/core/design-core.js'),Project=require('../src/core/project-core.js'),Z=require('../src/core/zone-geometry.js');
const clone=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function fixture(){
 const commands=[['M',-280,0],['L',280,0],['L',280,600],['L',-280,600],['Z']],hole=[['M',-175,18],['L',-175,243]];
 for(let i=1;i<=96;i++){const a=Math.PI-i*Math.PI/96;hole.push(['L',175*Math.cos(a),243+175*Math.sin(a)]);}hole.push(['L',175,18],['Z']);
 const p={id:'arch',kind:'board',name:'连续侧拱',w:18,h:600,d:560,x:291,y:300,z:0};
 p.profile={version:1,box:{w:600,d:600,h:600,thickness:18,base:0},bay:{left:-282,right:282},baseline:{w:18,h:600,d:560,x:291,y:300,z:0,color:'#e8e0d2'},bounds:{lo:[282,0,-280],hi:[300,600,280]},parts:[{geometry:{kind:'shape',axis:'x',angle:0,depth:18,curveSegments:48,shape:{commands,holes:[{commands:hole,holes:[]}]}},position:[282,0,0],material:{color:'#e8e0d2'},metadata:{cabinetSide:'right'}}]};
 return B.validate({id:'side-shape',type:'cabinet',name:'侧拱',color:'#e8e0d2',w:600,d:600,h:600,cx:1000,cy:2000,rot:0,mountHeight:123,cabinet:{version:2,boxes:[{id:'box1',w:600,d:600,h:600,thickness:18,backThickness:0,bottom:false,top:false,carcass:false,components:[p]}]}});
}
(async()=>{
 const source=fixture(),p=source.cabinet.boxes[0].components[0],saved=JSON.stringify(source);
 for(const rot of [0,37,90,270])for(const flip of [false,true]){
  const f={...clone(source),rot,flip},parts=M.solidParts(f),world=(x,y,z)=>{x*=flip?-1:1;const a=rot*Math.PI/180;return [f.cx+x*Math.cos(a)-z*Math.sin(a),f.cy+x*Math.sin(a)+z*Math.cos(a),y+123];},hit=(x,y,z)=>{const q=world(x,y,z);return parts.some(s=>Z.inside(q.slice(0,2),M.section(s,{bottom:q[2]-.01,top:q[2]+.01})));};
  assert(!hit(291,200,0),'cat opening remains physically empty');assert(!hit(291,417,0),'arch crown is empty below its boundary');assert(hit(291,419,0),'arch crown material exists above boundary');assert(hit(291,200,250),'continuous hinge mounting strip exists');assert(hit(291,10,0),'bottom bridge exists');
  near(Math.min(...parts.flatMap(s=>s.vertices.map(v=>v[1]))),123);near(Math.max(...parts.flatMap(s=>s.vertices.map(v=>v[1]))),723);
  const packed=Project.pack({planId:'side',current:{furniture:[f]},designs:[{name:'copy',work:{furniture:[f]}}],catalog:[{...f,price:0}]});assert.equal(packed.version,95);assert.deepEqual(Project.unpack(packed).current.furniture[0],f);assert.deepEqual(D.restoreFurniture([f],{makeId:()=> 'id',colorFor:()=> '#fff'}),[f]);
 }
 const resized=B.resize(source,{h:720,d:660,w:720});const v=P.bounds(P.transformed(resized.cabinet.boxes[0],resized.cabinet.boxes[0].components[0]));near(v.hi[0]-v.lo[0],18);near(v.hi[1]-v.lo[1],720);near(v.hi[2]-v.lo[2],616);assert.equal(JSON.stringify(source),saved);
 const thicker=B.update(source,{boxId:'box1'},{thickness:20}),tv=P.bounds(P.transformed(thicker.cabinet.boxes[0],thicker.cabinet.boxes[0].components[0]));near(tv.hi[0]-tv.lo[0],20);assert(P.equivalent(source,clone(source)));assert(!P.equivalent(source,thicker));assert.deepEqual(Project.unpack(Project.pack({planId:'side',current:{furniture:[thicker]},designs:[],catalog:[]})).current.furniture[0],thicker);
 const bad=clone(p.profile);bad.parts[0].geometry.axis='y';assert.throws(()=>P.validate(bad),/侧向挤出/);const nested=clone(p.profile);nested.parts[0].geometry.shape.holes[0].holes=[clone(nested.parts[0].geometry.shape.holes[0])];assert.throws(()=>P.validate(nested),/侧向挤出/);const moving=clone(p.profile);moving.parts[0].motion={axis:'y'};assert.throws(()=>P.validate(moving),/侧向挤出/);
 const imports=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports,T=await import(imports.three),box=(w,h,d,color,x,y,z)=>{const n=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color}));n.position.set(x,y+h/2,z);return n;},model=require('../src/render/cabinet-model.js').buildRaw(T,source,box),meshes=[];model.traverse(n=>{if(n.isMesh)meshes.push(n);});assert.equal(meshes.length,1,'one continuous physical panel, no segmented strips');assert(!meshes[0].children.some(n=>n.userData.cabinetOutline),'no black frame or curved-edge segmentation lines');near(new T.Box3().setFromObject(model).getSize(new T.Vector3()).x,.018);
 const captured=P.capture(source);assert.equal(captured[0].geometry.axis,'x');const rounded=v=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e8)/1e8:x));assert.deepEqual(rounded(captured[0].geometry.shape),rounded(p.profile.parts[0].geometry.shape));
 console.log('PASS continuous side extrusion: real Three panel and opening, numeric height sections, rotation/mirror/elevation, resize, capture, v95 project/named/catalog/restore and invalid axes/motion');
})().catch(e=>{console.error(e);process.exitCode=1;});
