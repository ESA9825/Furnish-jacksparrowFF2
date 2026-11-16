'use strict';
function inspect(report){
 const p=report.profile;if(!p||p.backend!=='MuTracer')throw Error('MuTracer audit missing');
 const lostBump=p.materials.filter(m=>m.bumpMap&&!m.converted.bumpMap).length;
 const clearcoat=p.materials.filter(m=>m.clearcoat>0),glass=p.materials.filter(m=>m.transmission>0);
 const mismatches=[];for(const m of p.materials){for(const [a,b] of [['clearcoat','coatWeight'],['transmission','transmissionWeight'],['ior','specularIor'],['roughness','specularRoughness']]){if(m[a]!==undefined&&m.converted[b]!==undefined&&Math.abs(m[a]-m.converted[b])>1e-6)mismatches.push({property:a,source:m[a],converted:m.converted[b]});}}
 const projectionMax=Math.max(...p.projection.requested.map((v,i)=>Math.abs(v-p.projection.actual[i]))),transformMax=Math.max(...p.projection.requestedTransform.map((v,i)=>Math.abs(v-p.projection.transform[i])));
 const geometry=p.geometry?{meshCountEqual:p.geometry.sourceMeshes===p.meshCount,triangleCountEqual:p.geometry.sourceTriangles===p.geometry.convertedTriangles}:null;
 return {compatible:false,reason:lostBump?'native conversion omits source bumpMap; visual equivalence is not established':'visual equivalence requires image validation',lostBumpMaterials:lostBump,sourceMaterialCount:p.materials.length,clearcoatMaterials:clearcoat.length,transmissiveMaterials:glass.length,numericMismatches:mismatches,projectionMax,transformMax,geometry,textureScale:p.diagnostics?.materialTextures?.scale,diagnostics:p.diagnostics};
}
module.exports={inspect};
