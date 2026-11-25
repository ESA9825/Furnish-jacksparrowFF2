/* Appearance of architectural swing doors. Lengths are supplied in mm. */
(function(root){
'use strict';
const mm=v=>v/1000;
function part(mesh,name){
 mesh.name=name;
 mesh.userData.interiorDoorPart=name;
 return mesh;
}
function glassTexture(THREE,data,width,height,repeats){
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(...repeats);
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 return texture;
}
function glassPane(THREE,kind,width,height){
 const P=root.FurnishProducts||require('../core/product-rules.js');
 const A=root.FurnishArtGlassModel||require('./art-glass-model.js');
 const {pitch}=P.artGlassPatterns[kind],size=128;
 const normal=glassTexture(THREE,A.normalPixels(kind,size),size,size,[width/pitch,height/pitch]);
 const material=new THREE.MeshPhysicalMaterial({
  color:'#e4e9e5',metalness:0,roughness:kind==='mist'?.67:.45,transmission:.72,
  ior:1.5,thickness:.008,normalMap:normal
 });
 if(kind==='reeded'){
  // A subtle tint variation keeps the ribs readable even with diffuse room lighting.
  const pixels=new Uint8Array(size*4);
  for(let i=0;i<size;i++){
   const c=Math.round(255-57*Math.pow(.5+.5*Math.cos(2*Math.PI*i/size),3));
   pixels.set([c,c,c,255],i*4);
  }
  material.map=glassTexture(THREE,pixels,size,1,[width/pitch,1]);
  material.map.colorSpace=THREE.SRGBColorSpace;
 }
 const mesh=part(new THREE.Mesh(new THREE.BoxGeometry(mm(width),mm(height),.008),material),'glass');
 mesh.userData.artGlassOwnMaterial=true;
 return mesh;
}
function buildLeaf(THREE,{length,height,offset,finish,box,rbox,mat}){
 const group=new THREE.Group(),glass=finish.leaf.glass,panel=finish.leaf.shape==='panel';
 const bottom=7,end=length-4,w=end-4,h=height-bottom-4,z=mm(offset);
 const cladding=mat(finish.leafColor,{roughness:glass?.38:.57,metalness:glass?.28:0});
 const slab=(name,width,tall,thickness,x,y,material=cladding)=>group.add(part(box(mm(width),mm(tall),mm(thickness),material,mm(x),mm(y),z),name));
 if(h<=0||w<=0)return group;
 if(glass||panel){
  const stile=Math.min(glass?37:82,w*.22),rail=Math.min(glass?34:112,h*.2);
  const centerW=w-2*stile,centerH=h-2*rail;
  slab('hinge-stile',stile,h,40,4+stile/2,bottom);
  slab('latch-stile',stile,h,40,end-stile/2,bottom);
  slab('bottom-rail',centerW,rail,40,length/2,bottom);
  slab('top-rail',centerW,rail,40,length/2,bottom+h-rail);
  if(glass){
   const pane=glassPane(THREE,glass,centerW,centerH);
   pane.position.set(mm(length/2),mm(bottom+h/2),z);
   group.add(pane);
  }else{
   const grooveColor='#'+new THREE.Color(finish.leafColor).multiplyScalar(.64).getHexString();
   slab('panel-seat',centerW,centerH,14,length/2,bottom+rail,mat(grooveColor,{roughness:.68}));
   slab('recessed-panel',centerW-6,centerH-6,26,length/2,bottom+rail+3);
  }
 }else slab('slab',w,h,40,length/2,bottom);
 const handleY=1000;
 if(height<handleY+30)return group;
 const x=mm(end-(glass?19:53)),y=mm(handleY),lever=mm(Math.min(104,w*.34));
 const hardware=mat(glass?'#242628':'#484b4e',{roughness:.32,metalness:.55});
 for(const side of [-1,1]){
  const face=side<0?'back':'front',edge=z+side*.020,width=glass?.027:.041;
  group.add(part(rbox(width,glass?.083:.047,.006,hardware,x,y-(glass?.0415:.0235),edge+side*.003,.003),face+'-escutcheon'));
  const stem=part(new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.031,16),hardware),face+'-spindle');
  stem.rotation.x=Math.PI/2;stem.position.set(x,y,edge+side*.021);
  group.add(stem);
  group.add(part(rbox(lever,.016,.018,hardware,x-lever/2+.008,y-.008,edge+side*.036,.004),face+'-lever'));
 }
 return group;
}
function buildCasing(THREE,d,{plan,height,top,finish,wx,wz,box,mat}){
 const group=new THREE.Group(),{profile,single}=finish.casing;
 if(!profile||top<=0)return group;
 const axis=Math.abs(d.c[0])>.5?0:1,normal=1-axis,rect=d.rect;
 const lo=rect[axis],hi=rect[axis+2],middle=(lo+hi)/2,wallDepth=rect[normal+2]-rect[normal];
 const trimSide=-(d._base?.o??d.o)[normal],body=mat(finish.casingColor,{roughness:.6});
 const position=(along,across)=>axis===0?[wx(along),wz(across)]:[wx(across),wz(along)];
 function board(name,span,tall,depth,along,y,across){
  if(tall<=0||depth<=0)return;
  const [x,z]=position(along,across);
  group.add(part(box(mm(axis===0?span:depth),mm(tall),mm(axis===0?depth:span),body,x,mm(y),z),name));
 }
 const faceAt=(side,a,b)=>{
  const raw=rect[normal+(side>0?2:0)];
  const depths=(plan.wallFinish?.bands||[]).filter(e=>e.normal===normal&&e.side===side&&Math.abs(e.rect[normal+(side<0?2:0)]-raw)<1e-6&&e.rect[axis]<b&&e.rect[axis+2]>a)
   .map(e=>e.tileThickness+e.bondThickness);
  return raw+side*(Math.max(0,...depths)+.35);
 };
 const faceWidth=profile[0][0],head=Math.min(height,top);
 const low=faceAt(-1,lo-faceWidth,lo),high=faceAt(1,lo-faceWidth,lo);
 const lowRight=faceAt(-1,hi,hi+faceWidth),highRight=faceAt(1,hi,hi+faceWidth);
 board('jamb-low',1,head,high-low,lo,0,(low+high)/2);
 board('jamb-high',1,head,highRight-lowRight,hi,0,(lowRight+highRight)/2);
 if(top>=height)board('jamb-head',hi-lo,1,wallDepth,middle,height-1,rect[normal]+wallDepth/2);
 for(const side of single?[trimSide]:[-1,1]){
  const tag=side<0?'low-face':'high-face',hasHead=top>height;
  let reveal=0;
  for(const [i,[width,thickness]] of profile.entries()){
   const depth=reveal+thickness/2,left=side<0?low:high,right=side<0?lowRight:highRight;
   board(tag+'-low-'+i,width,head,thickness,lo-width/2,0,left+side*depth);
   board(tag+'-high-'+i,width,head,thickness,hi+width/2,0,right+side*depth);
   if(hasHead)board(tag+'-head-'+i,hi-lo+2*width,Math.min(width,top-height),thickness,middle,height,faceAt(side,lo-width,hi+width)+side*depth);
   reveal+=thickness;
  }
 }
 return group;
}
const api={buildLeaf,buildCasing};
if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishInteriorDoorModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
