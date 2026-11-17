process.env.FURNISH_CABINET_UI_FLOW='progressive-deep-gpu-ui';
process.env.FURNISH_TEST_PROJECT||=require('../scripts/workspace-files.cjs').create(require('node:path').resolve(__dirname,'..')).info().file;
if(!process.env.FURNISH_PERF_CAMERA_FILE)throw Error('Set FURNISH_PERF_CAMERA_FILE to a fixed camera JSON');
if(process.argv.length===2)process.argv.push('--desktop-only');
require('./test-cabinet-ui.cjs');
