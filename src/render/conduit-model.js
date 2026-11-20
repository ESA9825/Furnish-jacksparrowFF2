/* Sweep a real hollow PVC-U section along the room's electrical path. */
(function(root){
 'use strict';
 const sides=16,epsilon=1e-7,maxSleeves=128;
 const ringAngles=Array.from({length:sides},(_,i)=>2*Math.PI*i/sides);

 function hollowGeometry(T){
  const positions=[],indices=[];
  function add(samples,normal,outer,inner,{capStart=true,capEnd=true}={}){
   const first=positions.length/3;
   for(const {point,tangent,frame=normal} of samples){
    const cross=tangent.clone().cross(frame);
    for(const r of [outer,inner]){
     for(const angle of ringAngles){
      positions.push(...point.clone().addScaledVector(frame,r*Math.cos(angle)).addScaledVector(cross,r*Math.sin(angle)).toArray());
     }
    }
   }
   for(let k=0;k<samples.length;k++){
    const outerStart=first+k*2*sides,innerStart=outerStart+sides;
    for(let j=0;j<sides;j++){
     const next=(j+1)%sides,o=outerStart+j,p=outerStart+next,i=innerStart+j,h=innerStart+next;
     if(k+1<samples.length){
      const step=2*sides;
      indices.push(o,p,o+step,p,p+step,o+step);
      indices.push(i,i+step,h,h,i+step,h+step);
     }
     if(k===0&&capStart)indices.push(o,i,p,p,i,h);
     if(k===samples.length-1&&capEnd)indices.push(o,p,i,p,h,i);
    }
   }
  }
  function finish(){
   const geometry=new T.BufferGeometry();
   geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   geometry.setIndex(indices);
   geometry.computeVertexNormals();
   return geometry;
  }
  return {add,finish};
 }

 function simplify(input){
  const result=[];
  for(const point of input){
   const previous=result.at(-1);
   if(previous?.distanceToSquared(point)<epsilon**2)continue;
   if(result.length>1){
    const inwards=previous.clone().sub(result.at(-2)).normalize(),outwards=point.clone().sub(previous).normalize();
    if(inwards.dot(outwards)>1-1e-10)result.pop();
   }
   result.push(point);
  }
  return result;
 }

 function build(T,input,profile,{kind,editing=false}={}){
  const group=new T.Group();
  group.name='PVC-U conduit';
  const points=simplify(input);
  const radius=profile.diameter/2000,inner=radius-profile.wall/1000,sweep=profile.bendRadius/1000;
  const segments=points.slice(1).map((p,i)=>{
   const delta=p.clone().sub(points[i]),length=delta.length();
   return {length,tangent:delta.divideScalar(length)};
  });
  const corners=points.map((point,i)=>{
   if(i===0||i===points.length-1)return null;
   const incoming=segments[i-1].tangent,outgoing=segments[i].tangent;
   const normal=incoming.clone().cross(outgoing),angle=Math.acos(T.MathUtils.clamp(incoming.dot(outgoing),-1,1));
   const trim=sweep*Math.tan(angle/2);
   return {point,incoming,normal:normal.normalize(),angle,trim,
    blocked:trim>Math.min(segments[i-1].length,segments[i].length)+epsilon||normal.lengthSq()<epsilon};
  });
  segments.forEach(({length},i)=>{
   const start=corners[i],end=corners[i+1];
   if(start&&!start.blocked&&end&&!end.blocked&&start.trim+end.trim>length+epsilon){
    start.overlap=true;
    end.overlap=true;
   }
  });
  for(const corner of corners)if(corner?.overlap)corner.blocked=true;
  const pipe=hollowGeometry(T),couplers=hollowGeometry(T),warnings=[];
  const y=new T.Vector3(0,1,0),x=new T.Vector3(1,0,0);
  const frame=dir=>dir.clone().cross(Math.abs(dir.y)<.95?y:x).normalize();
  const useColor=kind==='network'?(editing?'#478fd8':'#7aaed5'):(editing?'#d98959':'#d7a084');
  let sleeveCount=0,straightCount=0,bendCount=0;
  segments.forEach(({tangent,length},i)=>{
   const a=corners[i],b=corners[i+1],start=a&&!a.blocked?a.trim:0,end=b&&!b.blocked?b.trim:0;
   const gap=Math.min(radius*2,Math.max(0,length-start-end)/3);
   const from=start+(a?.blocked?gap:0),to=length-end-(b?.blocked?gap:0);
   if(to-from<=epsilon)return;
   const normal=frame(tangent);
   const sample=offset=>({point:points[i].clone().addScaledVector(tangent,offset),tangent});
   const startFrame=a&&!a.blocked?a.normal:normal,endFrame=b&&!b.blocked?b.normal:normal;
   const twist=Math.atan2(tangent.dot(startFrame.clone().cross(endFrame)),startFrame.dot(endFrame));
   // Index the last circle to the adjacent bend with the smallest mesh twist.
   const step=ringAngles[1],aligned=endFrame.clone().applyAxisAngle(tangent,-Math.round(twist/step)*step);
   pipe.add([{...sample(from),frame:startFrame},{...sample(to),frame:aligned}],normal,radius,inner,
    {capStart:!a||a.blocked,capEnd:!b||b.blocked});
   straightCount++;
   const half=profile.sleeveLength/2000,stock=profile.stockLength/1000;
   for(let seam=from+stock;seam+half<to&&sleeveCount<maxSleeves;seam+=stock){
    couplers.add([sample(seam-half),sample(seam+half)],normal,profile.sleeveDiameter/2000,radius+.00005);
    sleeveCount++;
   }
  });
  for(let i=1;i<corners.length-1;i++){
   const corner=corners[i];
   const {point,incoming,normal,angle,trim,blocked}=corner;
   if(blocked){warnings.push(point);continue;}
   const start=point.clone().addScaledVector(incoming,-trim),inwards=normal.clone().cross(incoming);
   const steps=Math.max(2,Math.ceil(angle/(Math.PI/24)));
   const samples=Array.from({length:steps+1},(_,i)=>{
    const a=angle*i/steps,cos=Math.cos(a),sin=Math.sin(a);
    return {
     point:start.clone().addScaledVector(incoming,sweep*sin).addScaledVector(inwards,sweep*(1-cos)),
     tangent:incoming.clone().multiplyScalar(cos).addScaledVector(inwards,sin)
    };
   });
   const capAt=(adjacent,length)=>(!adjacent||adjacent.blocked)&&length-trim<=epsilon;
   pipe.add(samples,normal,radius,inner,{capStart:capAt(corners[i-1],segments[i-1].length),capEnd:capAt(corners[i+1],segments[i].length)});
   bendCount++;
  }
  if(straightCount||bendCount)group.add(new T.Mesh(pipe.finish(),new T.MeshStandardMaterial({color:useColor,roughness:.55})));
  if(sleeveCount)group.add(new T.Mesh(couplers.finish(),new T.MeshStandardMaterial({color:'#e7e8e3',roughness:.58})));
  if(warnings.length){
   const delta=3*radius;
   const positions=warnings.flatMap(p=>[
    p.x-delta,p.y,p.z,p.x+delta,p.y,p.z,
    p.x,p.y-delta,p.z,p.x,p.y+delta,p.z,
    p.x,p.y,p.z-delta,p.x,p.y,p.z+delta
   ]);
   const marks=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3));
   const warn=new T.LineSegments(marks,new T.LineBasicMaterial({color:'#d36b16',depthTest:false,depthWrite:false,transparent:true}));
   warn.renderOrder=60;
   group.add(warn);
  }
  Object.assign(group.userData,{diameter:profile.diameter,straightCount,bendCount,sleeveCount,warnings:warnings.length});
  return group;
 }
 const api={build};
 root.FurnishConduitModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
