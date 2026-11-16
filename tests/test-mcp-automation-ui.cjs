'use strict';
process.env.FURNISH_CABINET_UI_FLOW='mcp-automation-ui';
if(process.argv.length===2)process.argv.push('--desktop-only');
require('./test-cabinet-ui.cjs');
