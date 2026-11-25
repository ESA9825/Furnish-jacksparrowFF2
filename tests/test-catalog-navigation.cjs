const assert=require('node:assert/strict'),C=require('../src/data/catalog.js');
const source=C.browseLibrary(),before=JSON.stringify(source),nav=C.navigation(source),all=source.flatMap(g=>g.items),rows=nav.flatMap(g=>g.children.flatMap(c=>c.items));
assert.equal(rows.length,all.length);assert.equal(new Set(rows).size,all.length);
for(const it of all)assert.equal(rows.filter(v=>v===it).length,1);
assert.equal(JSON.stringify(source),before);
const leaf=id=>nav.flatMap(g=>g.children).find(c=>c.id===id)?.items||[];
assert.equal(nav.at(-1).id,'auxiliary');assert.equal(leaf('auxiliary/blocks')[0][0],'block');
assert(leaf('decor/lighting').some(it=>it[0]==='panel_light_300x600'));
assert(leaf('decor/lighting').some(it=>it[0]==='downlight_philips_dl269'));
assert(leaf('cabinetry/custom').some(it=>it[0]==='counter'&&C.itemUses(it).includes('laundry')));
assert(leaf('cabinetry/custom').some(it=>it[0]==='counter'&&C.itemUses(it).includes('kitchen')));
assert(leaf('fixtures/sinks').some(it=>C.itemUses(it).includes('laundry')));
assert(leaf('fixtures/sinks').some(it=>it[0]==='sink_arrow_680'));
assert.deepEqual(leaf('other/drying').map(it=>it[0]),['dryingrack','crank_hotata_y024_2m','drying_rack_hotata_y024','drying_rack_hotata_y024_2m']);
assert(leaf('cabinetry/storage').every(it=>!['pipebox','vanity','counter'].includes(it[0])));
const custom=['custom','旧自定义',800,400,'#fff',0,undefined,'c1'],unknown=['new-type','新条目',600,600];
const extra=C.navigation([{cat:'未来目录',items:[custom,unknown]}]).flatMap(g=>g.children);
assert.deepEqual(extra.find(c=>c.id==='other/custom').items,[custom]);
assert.deepEqual(extra.find(c=>c.id==='other/general').items,[unknown]);
assert.deepEqual(C.navigation([]),[]);
assert.equal(C.navigation([{cat:'灯具',items:[unknown]}])[0].children[0].id,'decor/lighting');
const kettle=leaf('appliances/cooking').find(it=>it[0]==='kettle_mijia_mjjysh01ym');
for(const query of ['热水壶','电水壶','电热水壶','電熱水壺']){
 assert(C.matches(kettle,{query:'米家 '+query,use:'kitchen',maxWidth:273}));
 assert(!C.matches(kettle,{query,use:'bedroom'}));
}
assert(!C.matches(kettle,{query:'热水器'}));
assert(C.matches(custom,{query:'热水壶'},{name:'自定义電水壺'}));
const bedding=leaf('furniture/beds').filter(it=>C.matches(it,{query:'半夏床品组合',use:'bedroom'}));
assert.equal(bedding.length,1);
const [set]=bedding;
assert(C.isAssemblyItem(set));
assert.deepEqual(C.assemblyMembers(set).map(({item,dy,mountHeight})=>[item[0],dy,mountHeight]),[
 ['bed_yeswood_y17b02',0,0],
 ['bed_mattress_y17b02',0,400],
 ['bed_pillow_atour_pro4',-775,560],
 ['bed_duvet_y17b02',240,410]
]);
for(const {item} of C.assemblyMembers(set)){
 assert.equal(C.findItem(item[0],item[1]),item);
 assert(!C.isAssemblyItem(item));
}
assert(!C.matches(set,{maxWidth:1260}));
for(const g of nav)assert(g.children.length&&g.children.every(c=>c.items.length));
console.log('PASS unique taxonomy, source specs, room uses, search aliases, custom fallbacks and the four-piece bedding set');
