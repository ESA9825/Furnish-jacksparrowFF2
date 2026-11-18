/* Offline answer contract shared by the standalone form and Furnish. */
(function(root){
'use strict';
const SCHEMA='furnish.wardrobe-questionnaire', VERSION=1;
const groups=[
{id:'people',num:'01',title:'谁在用，平时怎么整理？',hint:'不用先懂柜体参数，按日常习惯回答。',questions:[
{id:'caseName',title:'答卷编号或称呼',type:'text',required:true,hint:'用于区分答卷即可，不必填写真实姓名。',placeholder:'例如：1601主卧 / A家庭'},
{id:'users',title:'使用人数与分区',options:['一人使用','两人，个人区为主','多人共用','个人区＋共用区','尚未确定']},
{id:'habit',title:'平时更愿意怎样整理衣物？',options:['尽量挂起来','偏好折叠收纳','挂叠结合','希望设计者建议']},
{id:'pain',title:'目前最想改善什么？',type:'multi',options:['衣服太挤','不好找','叠衣容易乱','抽屉不够','拿不到高处','弯腰不方便','其他'],hint:'可多选，并补充最困扰你的具体情况。'},
{id:'access',title:'取放需求',type:'multi',options:['常用物品不登高取用','尽量少弯腰','需要坐姿取用','儿童自己拿','无特殊要求','暂不清楚'],exclusive:['无特殊要求','暂不清楚']}
]},
{id:'capacity',num:'02',title:'衣柜里，需要放下什么？',hint:'容量按希望在这个柜中存放的总量填写，包含计划增加的衣物；不要重复加增长量。数量不清楚可留空，并在说明中写估计范围。',questions:[
{id:'inventory',title:'物品类别',type:'multi',options:['短上衣 / 衬衫','长裙 / 长大衣','裤子','针织 / 叠放衣物','内衣袜子等小件','包袋','被褥','行李箱','其他']},
{id:'shortCount',title:'短挂衣物目标件数',type:'number',unit:'件',max:100000},
{id:'longCount',title:'长挂衣物目标件数',type:'number',unit:'件',max:100000},
{id:'shortRail',title:'短挂衣物占杆长',type:'measurement',unit:'mm',hint:'有现成衣物时挂成一排测量。与件数是同一批衣物的两种描述，不相加。'},
{id:'longRail',title:'长挂衣物占杆长',type:'measurement',unit:'mm'},
{id:'longest',title:'最长衣物挂好后的垂落长度',type:'measurement',unit:'mm',hint:'注明从衣架挂钩还是杆位量起；不是挂杆离地高度。'},
{id:'items',title:'叠放衣物、收纳盒及大件明细',type:'textarea',placeholder:'例如：毛衣约3叠；被褥2床；行李箱宽500×深300×高750mm（实测）。不清楚可说明。'},
{id:'season',title:'换季与未来变化',type:'multi',options:['换季衣物也放这里','换季另有存放处','未来物量预计增加','使用人数可能变化','儿童成长需要调整','暂不清楚'],exclusive:['暂不清楚']}
]},
{id:'region',num:'03',title:'衣柜准备放在哪里？',hint:'填写完成面尺寸，单位统一为毫米（1cm＝10mm）。不确定就留空。此问卷不绘制或修改 Furnish 中的方案。',questions:[
{id:'location',title:'房间、墙面与范围描述',type:'textarea',required:true,placeholder:'例如：主卧进门左手墙，从门套到窗帘旁；或填写“位置暂未确定”。'},
{id:'planRef',title:'已有方案或位置编号（选填）',type:'text',placeholder:'例如：Furnish方案名、柜体编号。无需填写文件完整路径。'},
{id:'width',title:'可用完成面净宽',type:'measurement',unit:'mm'},
{id:'height',title:'可用完成面净高',type:'measurement',unit:'mm'},
{id:'depth',title:'可接受的柜体总深',type:'measurement',unit:'mm',hint:'属于空间限制，不等于衣柜闭门后的内部净深。'},
{id:'obstacles',title:'附近有哪些需要避让或保留？',type:'multi',options:['房门 / 门套','窗 / 窗帘','床 / 床头柜','梁 / 吊顶','插座 / 开关','管道 / 检修口','踢脚线','其他家具','暂无已知障碍','尚未核实'],exclusive:['暂无已知障碍','尚未核实']},
{id:'regionNotes',title:'现场及保留项说明',type:'textarea',placeholder:'说明障碍的位置、高度，以及必须保留的柜体或配件。照片、平面图可作为附件与答卷一起发送。'},
{id:'reach',title:'本人舒适取放范围（选填）',type:'text',placeholder:'例如：站地可取挂杆上沿约1600mm，已试取；或待现场确认。'}
]},
{id:'preferences',num:'04',title:'哪些必须满足，哪些可以商量？',hint:'所有选择都可留空。外观偏好不会覆盖必需容量、取放和现场限制。',questions:[
{id:'door',title:'柜门偏好',options:['平开门','滑门','开放式','希望比较后再定']},
{id:'priority',title:'最重视的事项',type:'multi',maxChoices:3,options:['储物容量','取放便利','少花时间整理','控制预算','外观搭配','未来便于调整'],hint:'最多选3项；如有先后顺序，请写在补充说明里。'},
{id:'must',title:'必须满足的要求',type:'textarea',placeholder:'例如：保留一处长裙区；常用衣物必须站地拿到；不得移动现有插座。'},
{id:'tradeoff',title:'空间或预算不足时，愿意怎样取舍？',type:'multi',options:['减少复杂配件','部分物品放到别处','减少展示区','调整柜门形式','缩减非必需容量','先比较方案再决定']},
{id:'budget',title:'预算范围与口径（选填）',type:'text',placeholder:'例如：目标8000–12000元，含柜体、五金和安装；或暂未确定。'},
{id:'style',title:'外观偏好',type:'multi',options:['暖白 / 浅色','原木 / 木色','胡桃木 / 深木色','与现有装修一致','需要设计者建议','其他']},
{id:'special',title:'有无特殊用途？',type:'multi',options:['灯带','穿衣镜','首饰 / 配饰','保险箱','猫通道','其他','没有'],exclusive:['没有']},
{id:'extra',title:'还有什么希望设计者知道？',type:'textarea',placeholder:'可以描述喜欢或不喜欢的方案、特殊使用习惯，以及上面没有覆盖的要求。'}
]}
];
const questions=groups.flatMap(g=>g.questions);
function validate(answers,complete){const errors=[];for(const q of questions){const a=answers[q.id],v=a.value;if(q.required&&complete&&!v)errors.push(q.title+'：请填写，未知可明确说明。');if(q.type==='multi'){if(q.maxChoices&&v.length>q.maxChoices)errors.push(q.title+'：最多选择'+q.maxChoices+'项。');if(v.length>1&&v.some(x=>q.exclusive?.includes(x)))errors.push(q.title+'：选项存在冲突。');}if(q.type==='number'||q.type==='measurement'){if(v!==null&&(!Number.isFinite(v)||v<(q.type==='measurement'?0.1:0)||v>(q.max||100000)||(q.type==='number'&&!Number.isInteger(v))))errors.push(q.title+'：请输入有效'+(q.type==='number'?'整数':'正数')+'，或留空。');if(v!==null&&q.type==='measurement'&&a.source==='unknown'&&complete)errors.push(q.title+'：请选择该尺寸的依据，或将尺寸留空。');}}return errors;}
function summary(answers,state){const lines=['Furnish 衣柜需求答卷 · v1',state==='complete'?'状态：已导出答卷（仍需设计与现场复核）':'状态：草稿','说明：未填不代表没有；估计值不能作为施工尺寸。'];for(const g of groups){lines.push('\n'+g.num+' '+g.title);for(const q of g.questions){const a=answers[q.id];let value=Array.isArray(a.value)?a.value.join('、'):a.value;lines.push(q.title+'：'+(value===null||value===''?'未填写 / 待确认':value+(q.unit?' '+q.unit:''))+(a.source?' ['+({unknown:'依据待确认',estimated:'估计',measured:'实测',drawing:'图纸标注'}[a.source])+']':''));if(a.note)lines.push('  补充：'+a.note);}}lines.push('\n附件提示：位置图、现场照片可另外发送；本答卷未附带图像。','本文件不是 Furnish 项目文件，不可作为项目导入。');return lines.join('\n');}
function parseImport(text){const p=JSON.parse(text);if(p.format!==SCHEMA||p.version!==VERSION||!['draft','complete'].includes(p.status)||!p.answers||typeof p.answers!=='object'||Array.isArray(p.answers))throw Error('不是受支持的衣柜答卷 v1 文件。');const answers={};for(const q of questions){if(!Object.hasOwn(p.answers,q.id))throw Error('答卷缺少字段：'+q.title);const a=p.answers[q.id];if(!a||typeof a!=='object'||typeof a.note!=='string'||a.note.length>4000)throw Error('补充说明格式不正确：'+q.title);const v=a.value;if(q.options){if(q.type==='multi'){if(!Array.isArray(v)||v.length>q.options.length||new Set(v).size!==v.length||v.some(x=>!q.options.includes(x)))throw Error('选项无效：'+q.title);}else if(v!==null&&!q.options.includes(v))throw Error('选项无效：'+q.title);}else if(q.type==='number'||q.type==='measurement'){if(v!==null&&typeof v!=='number')throw Error('数值格式无效：'+q.title);}else if(typeof v!=='string'||v.length>4000)throw Error('文字格式无效：'+q.title);answers[q.id]={value:v,note:a.note};if(q.type==='measurement'){if(!['unknown','estimated','measured','drawing'].includes(a.source))throw Error('尺寸依据无效：'+q.title);answers[q.id].source=a.source;}}const errors=validate(answers,false);if(errors.length)throw Error(errors.join('\n'));return answers;}

function parse(text){if(typeof text!=='string'||text.length>2*1024*1024)throw Error('答卷内容无效或超过2MB');const payload=JSON.parse(text),answers=parseImport(text);return {format:SCHEMA,version:VERSION,status:payload.status,answers,summary:summary(answers,payload.status)};}
const api={SCHEMA,VERSION,groups,questions,validate,summary,parseImport,parse};root.FurnishWardrobeQuestionnaire=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
