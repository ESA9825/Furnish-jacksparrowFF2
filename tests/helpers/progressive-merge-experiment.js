'use strict';
// Test-only candidate. Retains every triangle; no production geometry is edited.
module.exports=`
function mergeStaticOpaque(scene){
 const groups=new Map();let before=0,trianglesBefore=0;scene.updateMatrixWorld(true);const boundsBefore=new T.Box3().setFromObject(scene);
 scene.traverse(o=>{if(!o.isMesh)return;before++;trianglesBefore+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;const m=o.material,g=o.geometry;
  if(o.isSkinnedMesh||o.isInstancedMesh||o.children.length||Array.isArray(m)||!m||!g||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length||m.transparent||m.opacity!==1||m.transmission>0||m.thickness>0||m.alphaTest>0||(m.normalMap&&m.normalMapType===T.ObjectSpaceNormalMap)||m.emissive?.getHex()||o.userData.furnishAreaEmitter||o.visibleToShadowRays===false)return;
  for(let p=o;p;p=p.parent)if(!p.visible)return;
  const e=o.matrixWorld.elements,a=new T.Vector3(e[0],e[1],e[2]),b=new T.Vector3(e[4],e[5],e[6]),c=new T.Vector3(e[8],e[9],e[10]),l=a.length();
  if(o.matrixWorld.determinant()<=0||Math.abs(b.length()-l)>1e-6||Math.abs(c.length()-l)>1e-6||Math.abs(a.dot(b))>1e-6||Math.abs(a.dot(c))>1e-6||Math.abs(b.dot(c))>1e-6)return;
  const attrs=Object.keys(g.attributes).sort().map(k=>{const x=g.attributes[k];return [k,x.itemSize,x.normalized,x.array?.constructor.name||x.data?.array.constructor.name];});
  if(!g.boundingBox)g.computeBoundingBox();const center=g.boundingBox.getCenter(new T.Vector3()).applyMatrix4(o.matrixWorld);const cell=[Math.floor(center.x/3),Math.floor(center.y/3),Math.floor(center.z/3)];const key=JSON.stringify([m.uuid,cell,!!g.index,attrs]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);
 });
 let removed=0,batches=0;
 for(const objects of groups.values()){if(objects.length<2)continue;const gs=objects.map(o=>o.geometry.clone().applyMatrix4(o.matrixWorld)),g=mergeGeometries(gs,false);for(const x of gs)x.dispose();if(!g)throw Error('opaque batch merge failed');const mesh=new T.Mesh(g,objects[0].material);scene.add(mesh);for(const o of objects)o.removeFromParent();removed+=objects.length;batches++;}
 scene.updateMatrixWorld(true);let trianglesAfter=0;scene.traverse(o=>{if(o.isMesh)trianglesAfter+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});const boundsAfter=new T.Box3().setFromObject(scene);globalThis.__perf.merge={before,removed,batches,after:before-removed+batches,trianglesBefore,trianglesAfter,boundsMaxDelta:Math.max(boundsBefore.min.distanceTo(boundsAfter.min),boundsBefore.max.distanceTo(boundsAfter.max))};if(trianglesBefore!==trianglesAfter)throw Error("batch changed triangles");
}
`;
