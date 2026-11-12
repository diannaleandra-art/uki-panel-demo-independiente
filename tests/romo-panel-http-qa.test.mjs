import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {procesarAreaPanelRomoQA} from '../lib/romo-panel-http-qa.mjs';
const STORE='romo:serena';
const original=JSON.parse(readFileSync(new URL('../data/romo-carta-origen-aprobado-20261112.json',import.meta.url),'utf8')).catalog;
const owner={userId:'duenos_test_UID',brand:'romo',role:'duenos',branches:['serena']};
const inventoryUser={userId:'inventario_UID',brand:'romo',role:'inventario',branches:['serena']};
function db(){
 let catalog=structuredClone(original),inventario=null,queries=[];
 return {queries,async query(sql,args){
  queries.push({sql,args});
  if(sql.startsWith('SELECT ')&&sql.includes('public.romo_catalogo_v1'))
   return [{revision:catalog.revision,contenido:structuredClone(catalog)}];
  if(sql.startsWith('UPDATE public.romo_catalogo_v1')){
   const rev=Number(args[3]);
   if(catalog.revision!==rev)return [];
   catalog=JSON.parse(args[1]);
   return [{revision:catalog.revision}];
  }
  if(sql.startsWith('SELECT ')&&sql.includes('public.romo_inventario_v1'))
   return inventario?[{revision:inventario.revision,contenido:structuredClone(inventario.contenido)}]:[];
  if(sql.startsWith('INSERT INTO public.romo_inventario_v1')){
   if(inventario)return [];
   inventario={revision:1,contenido:JSON.parse(args[1])};
   return [{revision:1}];
  }
  throw Error('Consulta de otra tabla o mutación no simulada');
 }};
}
const send=(params)=>procesarAreaPanelRomoQA(params);
test('Romo lee su catálogo verdadero de borrador sin hacer ventas ni compartir datos Uki',async()=>{
 const store=db();
 const result=await send({area:'catalog',method:'GET',db:store,identity:owner});
 assert.equal(result.storeId,STORE);
 assert.equal(result.revision,1);
 assert.equal(result.catalog.products.length,7);
 assert.equal(result.catalog.promotions.length,3);
 assert.equal(result.catalog.ingredients.length,40);
 assert.ok(result.catalog.products.every(p=>p.visible===false));
 assert.equal(result.ventasHabilitadas,false);
 assert.ok(store.queries.every(q=>!q.sql.includes('uki_')));
});
test('Sin dueño verificado Romo no puede editar carta aunque conozca el precio',async()=>{
 const store=db();
 await assert.rejects(send({area:'catalog',method:'POST',db:store,identity:inventoryUser,
  body:{storeId:STORE,section:'productos',action:'editar-precio',data:{
   sku:'romo:piezas:24',price:8500,expectedRevision:1,expectedVersion:1}}}),/permiso/);
 assert.equal(store.queries.length,0);
});
test('Romo guarda modificación de precio con revisión, sin tocar otros locales',async()=>{
 const store=db();
 const response=await send({area:'catalog',method:'POST',db:store,identity:owner,
  body:{storeId:STORE,section:'productos',action:'editar-precio',data:{
   sku:'romo:piezas:24',price:8500,expectedRevision:1,expectedVersion:1}}});
 assert.equal(response.revision,2);
 const refreshed=await send({area:'catalog',method:'GET',db:store,identity:owner});
 assert.equal(refreshed.catalog.products[0].price,8500);
 assert.equal(refreshed.catalog.products[0].visible,false);
 assert.equal(response.ventasHabilitadas,false);
});
test('No se reescribe precio desde teléfono con revisión antigua',async()=>{
 const store=db();
 const body={storeId:STORE,section:'productos',action:'editar-precio',data:{
  sku:'romo:piezas:24',price:8500,expectedRevision:1,expectedVersion:1}};
 await send({area:'catalog',method:'POST',db:store,identity:owner,body});
 await assert.rejects(send({area:'catalog',method:'POST',db:store,identity:owner,body}),/desactualizada|revisión/i);
});
test('Inventario tiene consulta propia vacía y no recurre a los datos de Uki',async()=>{
 const store=db();
 const result=await send({area:'inventory',method:'GET',db:store,identity:inventoryUser});
 assert.equal(result.storeId,STORE);
 assert.equal(result.revision,0);
 assert.deepEqual(result.inventory.items,[]);
 assert.ok(store.queries.every(q=>q.sql.includes('romo_inventario_v1')));
});
test('No se admiten sucursales cruzadas, identidad de Uki ni campos de sesión inyectados',async()=>{
 const store=db();
 await assert.rejects(send({area:'catalog',method:'POST',db:store,identity:owner,
  body:{storeId:'uki:arica',section:'productos',action:'editar-precio',data:{}}}),/inválido/);
 await assert.rejects(send({area:'inventory',method:'POST',db:store,identity:inventoryUser,
  body:{storeId:STORE,action:'create',payload:{expectedRevision:0,identity:owner}}}),/no autorizados/);
 await assert.rejects(send({area:'catalog',method:'GET',db:store,
  identity:{...owner,brand:'uki'}}),/no autorizada/);
});
test('API única mantiene doble interruptor apagado para cada área comercial',()=>{
 const src=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
 assert.match(src,/ROMO_PANEL_AREAS_LIVE_ENABLED/);
 assert.match(src,/ROMO_PANEL_AREAS_WRITE_LIVE_ENABLED/);
 assert.match(src,/ROMO_OPERATIVO_LIVE_ENABLED/);
 assert.match(src,/resolveRomoIdentity/);
 assert.match(src,/procesarAreaPanelRomoQA/);
});
