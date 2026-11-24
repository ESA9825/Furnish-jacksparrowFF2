/* Self-contained tile diagrams and print/CSV delivery. */
(function(root){
'use strict';
const H=root.FurnishTileTakeoff||require('../core/tile-takeoff-core.js');
const F=root.FurnishFloorFinish||require('../core/floor-finish-core.js');
const round=H.round;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const path=(rings,sign)=>rings.map(p=>'M'+p.map(([x,y])=>x+','+sign*y).join('L')+'Z').join('');
const mark=(x,y,label,size,color='#302821')=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}" fill="${color}" stroke="#fff" stroke-width="${size*.12}" paint-order="stroke">${escape(label)}</text>`;
const line=(x,y,X,Y,attrs='')=>`<path d="M${x},${y}L${X},${Y}" fill="none" ${attrs}/>`;
function diagram({room,pieces,kind,title,joints=[],anchors=[]},{threshold=0,numbered=false,guides=[]}={}){
 const rings=room.rings,sign=kind==='wall'?-1:1;
 if(!rings.length)return '';
 const [x,y,X,Y]=rings.flat().reduce(([x,y,X,Y],[a,b])=>[Math.min(x,a),Math.min(y,sign*b),Math.max(X,a),Math.max(Y,sign*b)],[Infinity,Infinity,-Infinity,-Infinity]);
 const span=Math.max(X-x,Y-y),pad=span*(numbered?.12:.035),font=span*.019;
 const tiles=pieces.map(p=>{
  const narrow=!p.full&&Math.min(p.width,p.height)<threshold-1e-5;
  const fill=narrow?'#ec9980':p.full?'#e9e2d7':p.rectangle?'#e8c99d':'#d6b6a5';
  const size=Math.min(font,Math.max(p.width,p.height)/4);
  const label=numbered?mark(p.label[0],sign*p.label[1],p.id,size):'';
  const tip=p.id?[p.id,round(p.width)+' × '+round(p.height)+' mm'].join(' · '):round(Math.min(p.width,p.height))+' mm';
  return `<path data-takeoff-piece="${escape(p.id||'')}" ${narrow?'data-takeoff-narrow':''} d="${path(p.rings,sign)}" fill="${fill}" fill-rule="evenodd" stroke="#837365" stroke-width=".65" vector-effect="non-scaling-stroke"><title>${escape(tip)}</title></path>${label}`;
 }).join('');
 const features=joints.filter(j=>j.rect&&!j.pending).map(j=>{
  const [a,b,A,B]=j.rect;
  const geometry=j.active==='threshold'?`<path d="${path(j.thresholdRings,1)}" fill="#aa9b87" fill-rule="evenodd" stroke="#675645" vector-effect="non-scaling-stroke"/>`:
   j.active==='strip'?j.seams.map(([[a,b],[A,B]])=>line(a,b,A,B,'stroke="#675645" stroke-width="2" stroke-dasharray="4 2" vector-effect="non-scaling-stroke"')).join(''):'';
  return geometry+(geometry&&j.code?mark((a+A)/2,(b+B)/2,j.code,font,'#473a29'):'');
 }).join('');
 const dimension=(a,b,A,B,label)=>line(a,b,A,B,'stroke="#817266" stroke-width=".75" vector-effect="non-scaling-stroke"')+mark((a+A)/2,(b+B)/2,label,font*1.15);
 const dims=numbered?dimension(x,y-pad*.35,X,y-pad*.35,round(X-x)+' mm')+dimension(X+pad*.29,y,X+pad*.29,Y,round(Y-y)+' mm'):'';
 const start=guides.length===1?guides[0]:null;
 const startMark=start&&start[0]>=x&&start[0]<=X&&sign*start[1]>=y&&sign*start[1]<=Y
  ?`<circle cx="${start[0]}" cy="${sign*start[1]}" r="${span*.008}" fill="#255d52" stroke="#fff" vector-effect="non-scaling-stroke"/>`:'';
 const rooms=numbered&&anchors.length>1?anchors.filter(a=>a.point).map(({label,point})=>mark(point[0],point[1]-font*3.3,label,font*1.3,'#255d52')).join(''):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(title)}" viewBox="${x-pad} ${y-pad} ${X-x+2*pad} ${Y-y+2*pad}"><path d="${path(rings,sign)}" fill="#fbf7f0" fill-rule="evenodd" stroke="#675645" stroke-width="1" vector-effect="non-scaling-stroke"/>${tiles}${features}${rooms}${dims}${startMark}</svg>`;
}
const type=p=>p.full?'整砖':p.rectangle?'矩形切砖':'异形切砖';
function jointSize(j){
 if(!j.rect)return '';
 const [x,y,X,Y]=j.rect;
 const l=Math.max(X-x,Y-y),w=Math.min(X-x,Y-y);
 return j.mode==='threshold'?`${round(l)} × ${round(w)} mm 洞口`:j.mode==='strip'?`${round(j.seams.reduce((n,[a,b])=>n+Math.hypot(a[0]-b[0],a[1]-b[1]),0))} mm`:'';
}
function table(head,rows){
 const row=(cells,tag)=>'<tr>'+cells.map(v=>'<'+tag+'>'+escape(v)+'</'+tag+'>').join('')+'</tr>';
 return '<table><thead>'+row(head,'th')+'</thead><tbody>'+rows.map(v=>row(v,'td')).join('')+'</tbody></table>';
}
function html(report,title){
 const material=table(['材料／表面','规格 (mm)','整砖','切砖','净砖面 (m²)'],report.materials.map(m=>[m.label,m.width+' × '+m.height,m.full,m.cut,round(m.area)]));
 const joints=report.joints.length?'<h2>门洞衔接</h2>'+table(['编号','位置','做法','参考尺寸','核对'],report.joints.map(j=>[j.code,j.label,F.doorJointLabels[j.mode],jointSize(j),j.pending|| (j.mode==='strip'?'压边条型材及安装高度现场确定':'')])):'';
 const sheets=report.sheets.map(s=>{
  const layouts=s.specs.filter(v=>v.room.rings.length).map(spec=>{
   const {layout:l}=spec;
   return `${l.width} × ${l.height} mm，缝 ${l.gap} mm，方向 ${round(l.angle)}°，${s.kind==='floor'?'原图 X / Y':'沿墙 / 绝对标高'} ${l.origin.map(round).join(' / ')} mm`;
  });
  const diagramHtml=diagram(s,{numbered:true,guides:s.specs.filter(v=>v.room.rings.length).map(v=>v.layout.origin)});
  const rows=s.pieces.filter(p=>!p.full).map(p=>[p.id,type(p),round(p.width)+' × '+round(p.height),round(p.area/1e6)]);
  return `<section><h2>${escape(s.code+' · '+s.title)}</h2><p>整砖 ${s.totals.full} 片 · 切砖 ${s.totals.cut} 片</p>${layouts.map(l=>'<p>'+escape(l)+'</p>').join('')}${diagramHtml||'<p>起铺或完成面数据待确定。</p>'}${rows.length?table(['编号','类型','外接尺寸 (mm)','净砖面 (m²)'],rows):''}</section>`;
 }).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>
 body{font:15px/1.55 system-ui,sans-serif;color:#302821;background:#f7f3ed;margin:0}main{max-width:960px;margin:auto;padding:28px}section{padding:18px 0;border-top:1px solid #c8b9ad;margin-top:24px}svg{display:block;width:100%;max-height:660px;background:#fff;margin:12px 0}p{margin:6px 0}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{padding:5px 8px;border-bottom:1px solid #d6c9bf;text-align:left}th{background:#eae0d4}button{padding:8px 14px}@page{size:A4;margin:12mm}@media print{body{background:white}main{padding:0}button{display:none}section{break-before:page;margin:0}svg{max-height:128mm}tr{break-inside:avoid}thead{display:table-header-group}}
 </style></head><body><main><button onclick="print()">打印或保存 PDF</button><h1>${escape(title)}</h1>
 <p>图中米白为整砖，浅黄为矩形切砖，浅棕为异形切砖。切砖尺寸为沿砖轴的外接尺寸，异形轮廓参照图面。</p>
 <p>片数为图上铺贴件数。采购时另核对实际砖材、施工损耗和备砖；压边条用量按图示长度。</p>
 ${report.alerts.length?'<h2>待核对</h2><ul>'+report.alerts.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ul>':''}
 <h2>瓷砖用量</h2>${material}${joints}${sheets}</main></body></html>`;
}
const csvField=value=>{
 const text=String(value??''),safe=/^\s*[=+@-]/.test(text)&&typeof value==='string'?"'"+text:text;
 return '"'+safe.replaceAll('"','""')+'"';
};
function csv(report){
 const rows=[['图号','铺贴面','编号','类型','材料','原砖宽 (mm)','原砖高 (mm)','外接宽 (mm)','外接高 (mm)','整砖数','切砖数','净砖面 (m²)','备注']];
 for(const m of report.materials)rows.push(['','','','材料汇总',m.label,m.width,m.height,'','',m.full,m.cut,Number(m.area.toFixed(6)),'']);
 for(const sheet of report.sheets)for(const p of sheet.pieces)rows.push([sheet.code,sheet.title,p.id,type(p),p.material,p.stockWidth,p.stockHeight,round(p.width),round(p.height),'','',Number((p.area/1e6).toFixed(6)),'']);
 for(const j of report.joints)rows.push(['',j.label,j.code,F.doorJointLabels[j.mode],'','','','','','','','',[jointSize(j),j.pending].filter(Boolean).join(' · ')]);
 for(const note of report.alerts)rows.push(['','','','待核对','','','','','','','','',note]);
 return '\ufeff'+rows.map(r=>r.map(csvField).join(',')).join('\r\n');
}
const api={diagram,html,csv};if(typeof module==='object'&&module.exports)module.exports=api;else root.FurnishTileTakeoffDrawing=api;
})(globalThis);
