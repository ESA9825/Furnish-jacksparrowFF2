'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {inPoly}=require('../src/core/layout-geometry.js');
require('../src/render/interior-daylight.js');

(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const T=await import(JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports.three);
 const scene=new T.Scene(),archFloor=new T.Group(),archUp=new T.Group(),furnG=new T.Group();
 scene.add(archFloor,archUp,furnG);
 const id='area_fmv3qb1oi4',poly=[[0,0],[3800,0],[3800,5000],[0,5000]];
 const mainBedroom='area_fmv3p1fkz7',balcony='area_fmv3p2ig914';
 const plan={id:'custom_mv37igji',
  winRefs:['cad_window_9_3','cad_window_11_5:front','cad_window_8_2','cad_window_6_0'],
  wins:[
   {rect:[500,-240,3400,0],sill:.65,head:2.3},
   {rect:[5300,-700,7200,-480],sill:.647,head:2.295},
   {rect:[5600,5000,7100,5240],sill:.955,head:2.307},
   {rect:[8130,1000,8370,1800],sill:.9,head:2.2}
  ],
  rooms:[{id,poly},{id:balcony,poly:[[0,0],[3800,0],[3800,800],[0,800]]},
   {id:'area_fmv3qb1oi5',poly:[[3800,0],[4500,0],[4500,5000],[3800,5000]]},
   {id:mainBedroom,poly:[[5000,0],[7500,0],[7500,5000],[5000,5000]]},
   {id:'bay_cad_window_11_5',poly:[[5300,-480],[7200,-480],[7200,0],[5300,0]]},
   {id:'area_fmv3qcck717',poly:[[8370,800],[10370,800],[10370,3000],[8370,3000]]}
  ]};
 const material=new T.MeshStandardMaterial({color:'#73604a',roughness:.48});
 const floorMaterial=material.clone();
 floorMaterial.map=new T.Texture();
 floorMaterial.userData.tileFinish={layout:{width:800,height:800,gap:2}};
 const floor=new T.Mesh(new T.PlaneGeometry(3.8,5),floorMaterial);
 floor.rotation.x=-Math.PI/2;
 floor.position.set(1.9,.06,2.5);
 floor.userData={floor:true,room:id};
 archFloor.add(floor);
 const paint=new T.MeshStandardMaterial({color:'#f4f0e8',roughness:.92});
 const wall=new T.Mesh(new T.BoxGeometry(1.2,2.8,.2),[paint,paint,paint,paint,paint,paint]);
 wall.position.set(.6,1.4,-.1);wall.userData.recessWall=true;archUp.add(wall);
 const lintel=new T.Mesh(new T.BoxGeometry(.9,.7,.2),paint);
 lintel.position.set(1.65,2.45,-.1);lintel.userData.recessWall=true;archUp.add(lintel);
 const model=new T.Group(),foot=new T.Mesh(new T.BoxGeometry(.05,.5,.05),material);
 foot.position.y=.25;
 model.position.set(1,.06,2);
 model.userData={fid:'chair',floorBase:{roomId:id,known:true,z:60}};
 model.add(foot);furnG.add(model);
 const pilot=FurnishInteriorDaylight.create(T,scene,{wx:n=>n/1000,wz:n=>n/1000,inside:inPoly});
 const begin=p=>pilot.begin(p,archFloor,archUp,furnG,[{id:'chair',type:'chair'}]);
 pilot.setLight(1);
 begin(plan);pilot.contacts();
 const [sky,patch]=pilot.overlay.children;
 assert.ok(sky.visible&&sky.isInstancedMesh&&patch.isInstancedMesh);
 assert.equal(sky.count,4);
 assert.equal(patch.count,1);
 assert.notEqual(foot.material,material);
 assert.equal(foot.material.color.getHex(),material.color.getHex());
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <aomap_fragment>'};
 foot.material.onBeforeCompile(shader);
 const floorShader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <roughnessmap_fragment>\n#include <aomap_fragment>'};
 floor.material.onBeforeCompile(floorShader);
 assert.notEqual(floor.material,foot.material,'Surface-specific hooks never replace generic shared materials');
 assert.match(floorShader.fragmentShader,/floorContact/);
 assert.match(floorShader.fragmentShader,/finishTileUV/,'Saved layouts receive actual tile shading');
 assert.equal(floor.material.roughness,floorMaterial.roughness);
 assert.equal(floor.material.map,floorMaterial.map);
 const finish=shader.uniforms.furnishFinishField.value.image;
 const finishBounds=shader.uniforms.furnishFinishBounds.value;
 const contact=(x,z)=>{
  const col=Math.floor((x-finishBounds.x)*finishBounds.z*finish.width);
  const row=Math.floor((z-finishBounds.y)*finishBounds.w*finish.height);
  return finish.data[(col+row*finish.width)*4];
 };
 assert.ok(contact(.6,.025)>100,'Floor receives a narrow contact term in front of the physical wall');
 assert.equal(contact(.6,.30),0);
 assert.equal(contact(1.65,.025),0,'An elevated lintel does not shade the doorway floor');
 const wallShader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <roughnessmap_fragment>\n#include <aomap_fragment>'};
 wall.material[0].onBeforeCompile(wallShader);
 assert.match(wallShader.fragmentShader,/plaster/);
 const {width,height,data}=shader.uniforms.furnishDaylightMap.value.image;
 const bounds=shader.uniforms.furnishDaylightBounds.value;
 const sample=(x,y)=>{
  const col=Math.floor((x/1000-bounds.x)*bounds.z*width),row=Math.floor((y/1000-bounds.y)*bounds.w*height);
  return Array.from(data.slice(4*(col+width*row),4*(col+width*row)+4));
 };
 assert.ok(sample(1900,350)[0]>sample(1900,4000)[0],'Daylight falls off into the living room');
 assert.equal(sample(1900,-140)[0],0,'The daylight map fades beyond the exterior boundary');
 assert.ok(sample(3740,2300)[0]<sample(3150,2300)[0],'Living daylight fades at the hall transition');
 assert.deepEqual(sample(4100,2300),[0,0,0,0],'The hall receives no invented window');
 assert.deepEqual(sample(6250,2400).slice(2),[2,3],'Both physical master bedroom apertures contribute');
 assert.ok(sample(6250,200)[0]>sample(6250,4400)[0],'Bay light reaches the sleep area');
 assert.ok(sample(6250,4400)[1]>sample(6250,200)[1],'The opposite window lights the reading end');
 assert.deepEqual(sample(9200,1400).slice(2),[4,0],'A side-wall aperture lights its own kitchen');
 const shapes=shader.uniforms.furnishWindowShapes.value;
 assert.deepEqual(shapes.slice(2).map(shape=>shape.toArray().slice(2)),[[0,1],[0,-1],[1,0],[0,0],[0,0],[0,0]]);
 const sources=shader.uniforms.furnishDaylightSources.value;
 assert.ok(Math.abs(sources[2].y-1.471)<1e-9&&sources[2].z===-.48);
 assert.equal(sources[3].z,5);
 assert.equal(sources[1].w,1);
 assert.equal(sources[2].w,0);
 pilot.setLight(.8,{position:[0,.3,-1],warm:.7});
 assert.ok(shader.uniforms.furnishSkyTint.value.z<1);
 const skyTint=new T.Color();
 sky.getColorAt(0,skyTint);assert.ok(skyTint.b<1);
 sky.getColorAt(1,skyTint);assert.equal(skyTint.b,1);
 assert.equal(shader.uniforms.furnishDaylightStrength.value,.8);
 const transform=new T.Matrix4();
 patch.getMatrixAt(0,transform);
 assert.ok(Math.abs(transform.elements[13]-.0625)<1e-6);
 model.position.x+=.5;
 pilot.contacts();patch.getMatrixAt(0,transform);
 assert.equal(transform.elements[12],1.5);
 furnG.visible=false;pilot.contacts();assert.equal(patch.count,0);
 furnG.visible=true;pilot.contacts();assert.equal(patch.count,1);
 floor.visible=false;pilot.contacts();assert.equal(patch.count,0);
 floor.visible=true;pilot.contacts();assert.equal(patch.count,1);
 model.position.y+=.3;pilot.contacts();assert.equal(patch.count,0);
 archUp.visible=false;pilot.contacts();assert.equal(shader.uniforms.furnishWallContact.value,0);
 archUp.visible=true;pilot.contacts();assert.equal(shader.uniforms.furnishWallContact.value,1);
 const cabinet=new T.Group();
 cabinet.position.set(2,.06,3);
 cabinet.userData={fid:'cabinet',floorBase:{roomId:id,known:true,z:60}};
 const base=new T.Mesh(new T.BoxGeometry(.82,.08,.4),material);
 base.position.y=.04;cabinet.add(base);
 const door=new T.Mesh(new T.BoxGeometry(.82,.64,.02),paint);
 door.position.set(0,.4,.2);door.userData.cabinetDoorSize={width:820,height:640};
 cabinet.add(door);furnG.add(cabinet);
 pilot.begin(plan,archFloor,archUp,furnG,[{id:'chair',type:'chair'},{id:'cabinet',type:'cabinet'}]);
 pilot.contacts();
 assert.equal(patch.count,3);
 patch.getMatrixAt(0,transform);
 assert.ok(Math.abs(transform.elements[14]-3.218)<1e-6,'Cabinet contact stays on the actual front edge');
 const cabinetShader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <roughnessmap_fragment>\n#include <aomap_fragment>'};
 door.material.onBeforeCompile(cabinetShader);
 assert.match(cabinetShader.fragmentShader,/lacquer/);
 cabinet.position.y+=.1;pilot.contacts();assert.equal(patch.count,0);
 pilot.setLight(0);assert.equal(sky.visible,false);
 assert.equal(shader.uniforms.furnishDaylightStrength.value,0);
 begin({...plan,id:'other'});
 assert.equal(pilot.overlay.children.length,0);
 assert.equal(foot.material,material);
 begin({...plan,winRefs:[]});
 assert.equal(pilot.overlay.children.length,1);
 assert.equal(foot.material,material);
 console.log('PASS scoped window preview, surface material preservation, floor contact, movement, visibility, elevation and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
