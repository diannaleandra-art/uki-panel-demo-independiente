import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRomoInventory,normalizeRomoInventory,readRomoInventory,saveRomoInventory,RomoInventoryConflict}
 from '../lib/romo-inventario-integracion-qa.mjs';
const worker={userId:'worker_qa',brand:'romo',role:'inventario',branches:['serena']};
const sample=()=>({...emptyRomoInventory(),items:[
 {id:'arroz',name:'Arroz',unit:'kg',recibido:10,hay:7,minimo:8,disponible:true}
]});
test('inventario del local Romo no se mezcla con sucursal Uki',()=>{
 const normalized=normalizeRomoInventory(sample());
 assert.equal(normalized.items[0].hay,7);
 assert.deepEqual(Object.keys(normalized.items[0]).sort(),['disponible','hay','id','minimo','name','recibido','unit'].sort());
 assert.throws(()=>normalizeRomoInventory({...sample(),sucursal:'uki:serena'}));
});
test('permite el registro trabajador autorizado sin permitir caja ni cambiar inventario Uki',async()=>{
 let current=0,stored=null;
 const db={query:async(sql,params)=>{
  assert.match(sql,/public\.romo_inventario_v1/);
  assert.equal(params[0],'romo:serena');
  if(sql.startsWith('SELECT'))return current?[{revision:current,contenido:stored}]:[];
  if(sql.startsWith('INSERT')){
   if(current)return [];
   current=1;stored=JSON.parse(params[1]);return [{revision:current}];
  }
  if(sql.startsWith('UPDATE')){
   if(params[1]!==current)return [];
   current++;stored=JSON.parse(params[2]);return [{revision:current}];
  }
  throw Error('SQL no esperado');
 }};
 const empty=await readRomoInventory({db,identity:worker});
 assert.equal(empty.revision,0);
 const initial=await saveRomoInventory({db,identity:worker,expectedRevision:0,inventory:sample()});
 assert.equal(initial.revision,1);
 assert.equal((await readRomoInventory({db,identity:worker})).inventory.items[0].name,'Arroz');
 await assert.rejects(saveRomoInventory({db,identity:worker,expectedRevision:0,inventory:sample()}),RomoInventoryConflict);
 assert.equal((await saveRomoInventory({db,identity:worker,expectedRevision:1,inventory:sample()})).revision,2);
 await assert.rejects(saveRomoInventory({db,identity:{...worker,brand:'uki'},expectedRevision:2,inventory:sample()}));
});
