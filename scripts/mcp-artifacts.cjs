/* Desktop-owned exports only; callers cannot select filesystem paths. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const formats={project:['application/json','furnish.json'],quote_csv:['text/csv','csv'],plan_svg:['image/svg+xml','svg'],plan_png:['image/png','png'],scene_glb:['model/gltf-binary','glb'],report_html:['text/html','html']};
function writeArtifact(root,requestId,artifact){
 const spec=formats[artifact?.format];if(!spec||artifact.mimeType!==spec[0]||!['utf8','base64'].includes(artifact.encoding)||typeof artifact.content!=='string')throw Error('Invalid export artifact');
 const maxBytes=artifact.format==='scene_glb'?256*1024*1024:30e6;
 if(artifact.content.length>Math.ceil(maxBytes/3)*4)throw Error('Export input exceeds its format limit');
 if(artifact.encoding==='base64'&&(artifact.content.length%4||Buffer.from(artifact.content,'base64').toString('base64')!==artifact.content))throw Error('Invalid artifact encoding');
 const data=Buffer.from(artifact.content,artifact.encoding);if(!data.length||data.length>maxBytes)throw Error('Export must contain 1–'+maxBytes+' bytes');
 root=fs.realpathSync(root);const local=path.join(root,'.local'),directory=path.join(local,'mcp-exports');
 for(const dir of [local,directory]){if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Export directory must not be a symbolic link');fs.mkdirSync(dir,{recursive:true});}
 const sha256=crypto.createHash('sha256').update(data).digest('hex'),key=crypto.createHash('sha256').update(String(requestId)).digest('hex').slice(0,16),file=path.join(directory,key+'-'+sha256.slice(0,16)+'.'+spec[1]);
 try{fs.writeFileSync(file,data,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST'||fs.lstatSync(file).isSymbolicLink()||!fs.readFileSync(file).equals(data))throw e;}
 return {format:artifact.format,file,mimeType:spec[0],bytes:data.length,sha256};
}
module.exports={writeArtifact,formats};
