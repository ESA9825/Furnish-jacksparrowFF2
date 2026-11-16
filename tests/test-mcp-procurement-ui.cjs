'use strict';
process.env.FURNISH_CABINET_UI_FLOW='mcp-procurement-ui';
if(process.argv.length===2)process.argv.push('--desktop-only');
require('./test-cabinet-ui.cjs');
