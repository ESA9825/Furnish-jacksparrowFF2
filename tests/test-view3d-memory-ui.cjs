process.env.FURNISH_CABINET_UI_FLOW='view3d-memory-ui';
if(!process.argv.includes('--desktop-only')&&!process.argv.includes('--http-only'))process.argv.push('--desktop-only');
require('./test-cabinet-ui.cjs');
