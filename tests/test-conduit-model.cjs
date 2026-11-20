'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Model=require('../src/render/conduit-model.js'),E=require('../src/core/electrical-core.js');

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const T=await import(JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports.three);
 const build=(path,diameter)=>Model.build(T,path.map(v=>new T.Vector3(...v)),E.conduitProfile(diameter),{kind:'network'});
 const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
 for(const diameter of E.conduitDiameters){
  const {wall,sleeveDiameter,sleeveLength}=E.conduitProfile(diameter);
  const {children:[pipe,sleeve],userData}=build([[0,0,0],[2,0,0],[4,0,0]],diameter);
  assert.deepEqual(userData,{diameter,straightCount:1,bendCount:0,sleeveCount:1,warnings:0});
  for(const [model,outer,inner] of [[pipe,diameter/2000,(diameter/2-wall)/1000],[sleeve,sleeveDiameter/2000,diameter/2000+.00005]]){
   const {position,normal}=model.geometry.attributes;
   for(let i=0;i<position.count;i++){
    close(Math.hypot(position.getY(i),position.getZ(i)),i%32<16?outer:inner);
    close(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i)),1);
   }
  }
  sleeve.geometry.computeBoundingBox();
  close(sleeve.geometry.boundingBox.getCenter(new T.Vector3()).x,3);
  close(sleeve.geometry.boundingBox.getSize(new T.Vector3()).x,sleeveLength/1000);
 }
 const rise=[[0,0,0],[.5,0,0],[.5,.5,0]];
 const bend=build(rise,20);
 assert.equal(bend.userData.bendCount,1);
 assert.equal(bend.userData.warnings,0);
 const position=bend.children[0].geometry.attributes.position;
 const averageRing=i=>{
  const point=new T.Vector3();
  for(let j=0;j<16;j++)point.add(new T.Vector3().fromBufferAttribute(position,i+j));
  return point.divideScalar(16);
 };
 // Two straight spans occupy the first 128 vertices, followed by the arc rings.
 close(averageRing(128).distanceTo(new T.Vector3(.44,0,0)),0);
 close(averageRing(position.count-32).distanceTo(new T.Vector3(.5,.06,0)),0);
 close(averageRing(128+6*32).distanceTo(new T.Vector3(.44+.06*Math.SQRT1_2,.06*(1-Math.SQRT1_2),0)),0);
 const rotate=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),.62);
 assert.equal(build(rise.map(p=>new T.Vector3(...p).applyQuaternion(rotate).toArray()),20).userData.bendCount,1);
 const short=build([[0,0,0],[.05,0,0],[.05,.5,0]],20);
 assert.equal(short.userData.bendCount,0);
 assert.equal(short.userData.warnings,1);
 assert(short.children[1].isLineSegments);
 const tangent=build([[0,0,0],[.06,0,0],[.06,.06,0]],20);
 assert.equal(tangent.userData.bendCount,1);
 assert.equal(tangent.userData.straightCount,0);
 assert(tangent.children[0].geometry.index.count>0);
 const overlapping=build([[0,0,0],[.5,0,0],[.5,.1,0],[1,.1,0]],20);
 assert.equal(overlapping.userData.warnings,2);
 assert.equal(build([[0,0,0],[.5,0,0],[.5,.12,0],[1,.12,0]],20).userData.bendCount,2);
 assert.equal(build([[0,0,0],[.5,0,0],[0,0,0]],20).userData.warnings,1);
 console.log('PASS conduit mesh outside diameter, hollow wall, 3 m sleeve, 90° tangent and radius, rotation, and blocked bends');
})().catch(e=>{console.error(e);process.exitCode=1;});
