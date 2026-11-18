/* Keep the distributable form self-contained; no build step is required to run it. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'tools/wardrobe-questionnaire/index.html'),source=fs.readFileSync(path.join(root,'src/core/wardrobe-questionnaire-core.js'),'utf8'),html=fs.readFileSync(file,'utf8'),next=html.replace(/<!-- questionnaire-core:start -->[\s\S]*?<!-- questionnaire-core:end -->/,'<!-- questionnaire-core:start -->\n<script>\n'+source+'</script>\n<!-- questionnaire-core:end -->');
if(process.argv.includes('--check'))assert.equal(html,next,'Embedded questionnaire contract differs from shared core');else fs.writeFileSync(file,next);
