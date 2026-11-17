process.env.FURNISH_CABINET_UI_FLOW='progressive-scene-equivalence-ui';
process.env.FURNISH_TEST_PROJECT||=require('../scripts/workspace-files.cjs').create(require('node:path').resolve(__dirname,'..')).info({inspect:false}).file;
require('./test-cabinet-ui.cjs');
