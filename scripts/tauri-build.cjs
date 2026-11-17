'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),target=path.join(root,'output/tauri-build.noindex');
const env={...process.env,CARGO_TARGET_DIR:target};
const result=spawnSync(process.env.FURNISH_CARGO||'cargo',['build','--locked','--release','--manifest-path',path.join(root,'desktop-tauri/Cargo.toml')],{stdio:'inherit',env});
if(result.error)console.error('Tauri 构建需要 Rust / Cargo：'+result.error.message);
process.exitCode=result.status??1;
if(result.status===0&&process.platform==='darwin'){
 const binary=path.join(target,'release/furnish-tauri'),hash=crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
 const bundle=path.join(target,'app-'+hash.slice(0,16)+'.noindex','Furnish Tauri Compare.app'),contents=path.join(bundle,'Contents');
 if(!fs.existsSync(bundle)){
  fs.mkdirSync(path.join(contents,'MacOS'),{recursive:true});fs.copyFileSync(binary,path.join(contents,'MacOS/furnish-tauri'));fs.chmodSync(path.join(contents,'MacOS/furnish-tauri'),0o755);
  fs.writeFileSync(path.join(contents,'Info.plist'),'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>furnish-tauri</string><key>CFBundleIdentifier</key><string>local.furnish.tauri.compare</string><key>CFBundleName</key><string>Furnish Tauri Compare</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>0.1.0</string><key>LSMinimumSystemVersion</key><string>14.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>');
  execFileSync('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',bundle],{stdio:'pipe'});
 }
 execFileSync('/usr/bin/codesign',['--verify','--strict',bundle],{stdio:'pipe'});
 fs.writeFileSync(path.join(target,'current-app.json'),JSON.stringify({bundle,sha256:hash},null,2));console.log(bundle);
}
