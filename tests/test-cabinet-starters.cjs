'use strict';
const assert=require('node:assert/strict');
const Builder=require('../src/core/cabinet-builder-core.js');
const Project=require('../src/core/project-core.js');

const plan={id:'test',bounds:{x:0,y:0,w:10000,h:10000},rooms:[],walls:[],doors:[],windows:[],markers:[],ceilingHeight:3000};
const expected={
 wardrobe:{size:[1200,600,2200],parts:[['rail','shelf','multiDoor'],['drawers','shelf','shelf','shelf','shelf','multiDoor']]},
 sideboard:{size:[1200,420,900],parts:[['shelf','multiDoor'],['drawers','shelf']]},
 linen:{size:[600,450,1800],parts:[['shelf','shelf','shelf','shelf','multiDoor']]},
};
assert.deepEqual(Builder.starters.map(item=>item.id),Object.keys(expected));
for(const {id} of Builder.starters){
 const sample=Builder.starter(id);
 const furniture={...sample,id,cx:5000,cy:5000,rot:0};
 assert.deepEqual([furniture.w,furniture.d,furniture.h],expected[id].size);
 assert.deepEqual(furniture.cabinet.boxes.map(box=>box.components.map(part=>part.kind)),expected[id].parts);
 assert.deepEqual(Project.spaceCheck(plan,[furniture],{focusIds:[id]}),[]);
 const packed=Project.pack({planId:plan.id,current:{furniture:[furniture]},designs:[],catalog:[]});
 assert.deepEqual(Project.unpack(packed).current.furniture,[furniture]);
 const original=Builder.create({id:'existing',cx:5000,cy:5000,rot:0,mountHeight:20});
 const joined=Builder.insert(original,sample.cabinet,{x:original.w,y:original.h/2}).furniture;
 assert.deepEqual(joined.cabinet.boxes[0],original.cabinet.boxes[0]);
 assert.equal(joined.cabinet.boxes.length,1+sample.cabinet.boxes.length);
 assert.equal(joined.mountHeight,original.mountHeight);
 assert.deepEqual(Builder.starter(id),sample);
}
assert.throws(()=>Builder.starter('unknown'),/找不到柜体搭配/);
console.log('PASS three cabinet starters, isolated spatial check, join without modifying existing box, and project round-trip');
