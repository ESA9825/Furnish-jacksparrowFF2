/* Comparison instrumentation around the unchanged production Electron entry. */
'use strict';
const fs=require('node:fs'),{app}=require('electron');
app.on('window-all-closed',()=>app.quit());
const probe=fs.readFileSync(process.env.FURNISH_TAURI_PROBE,'utf8');
app.on('web-contents-created',(_event,contents)=>{
 contents.on('console-message',(event,...args)=>{const message=event.message||args[1];if(message?.startsWith('FURNISH_PROBE='))process.stdout.write(message+'\n');});
 contents.on('did-finish-load',()=>{if(!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(contents.getURL()))return;contents.executeJavaScript("window.__FURNISH_COMPARE_REPORT=value=>console.log('FURNISH_PROBE='+JSON.stringify(value));\n"+probe).catch(e=>console.error(e));});
});
require('../../desktop/main.cjs');
