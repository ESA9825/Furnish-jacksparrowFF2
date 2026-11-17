process.env.FURNISH_CABINET_UI_FLOW='progressive-ceiling-ui';
process.env.FURNISH_TEST_PROJECT||=require('../scripts/workspace-files.cjs').create(require('node:path').resolve(__dirname,'..')).info().file;
if(process.argv.length===2)process.argv.push('--desktop-only');
require('./test-cabinet-ui.cjs');
