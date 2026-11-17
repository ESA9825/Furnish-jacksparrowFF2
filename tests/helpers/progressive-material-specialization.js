'use strict';
// One feature audit and one set of shader transforms for production and experiments.
const P=require('../../scripts/lib/lighting-preview-patches.cjs');
const audit=require('../../src/core/progressive-view-core.js').materialFeatures.toString().replace('function materialFeatures','function auditMaterialFeatures');
const adapt=(s,marker,fn,...args)=>s.includes(marker)?s.replaceAll('globalThis.FurnishPathTracerFeatures','globalThis.__furnishMaterialAudit'):fn(s,...args);
module.exports={audit,transformMaterial:s=>adapt(s,'function sceneWgsl',P.transformMaterial),transformSurface:(s,all)=>adapt(s,'function sceneSurfaceFn',P.transformSurface,all),transformKernel:s=>adapt(s,'function sceneKernelTag',P.transformKernel)};
