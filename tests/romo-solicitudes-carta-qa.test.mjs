import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararSolicitudRomoQA,hashSolicitanteRomoQA,ingresarSolicitudRomoQA,leerSolicitudesRomoQA}
 from '../lib/romo-solicitudes-carta-qa.mjs';
import {readFileSync} from 'node:fs';
const order={storeId:'romo:serena',key:'solicitudRomo123456',
 codigoPedido:'RMO-001',cliente:'Cliente Romo',telefono:'+56912345678',
 mensaje:'RMO-001 · Cliente Romo · 24 piezas, una salsa de soya · Delivery.',
 totalIndicado:8000};
const salt='solo_prueba_romo_never_live_123456';
const owner={userId:'owner_fixture',brand:'romo',role:'duenos',branches:['serena']};
const other={userId:'another_fixture',brand:'uki',role:'duenos',branches:['serena']};
function simulated(){
 const rows=new Map(),calls=[];
 return {calls,rows,async query(sql,params){
  calls.push({sql,params});
  assert.match(sql,/public\.romo_solicitudes_carta_v1/);
  assert.doesNotMatch(sql,/uki_carta|uki_mesas/);
  if(sql.startsWith('SELECT id,store_id,codigo_pedido,cliente,telefono,mensaje,total_indicado,estado FROM ')){
   const r=rows.get(params[0]);return r?[r]:[];
  }
  if(sql.startsWith('SELECT COUNT(*)'))return [{n:0}];
  if(sql.startsWith('INSERT INTO ')){
   const [store_id,key,codigo_pedido,cliente,telefono,mensaje,total_indicado,ip_hash]=params;
   if(rows.has(key))return [];
   rows.set(key,{id:'fixture-id',store_id,codigo_pedido,cliente,telefono,mensaje,
    total_indicado,ip_hash,estado:'pendiente',whatsapp_confirmado:false});
   return [{id:'fixture-id',estado:'pendiente'}];
  }
  if(sql.includes('ORDER BY creado_en DESC LIMIT 100'))
   return [...rows.values()];
  throw Error('SQL inesperado');
 }};
}
test('solicitud de carta nunca es venta, pago ni timbre',()=>{
 const x=prepararSolicitudRomoQA(order);
 assert.equal(x.estado,'pendiente');
 assert.equal(x.whatsappConfirmado,false);
 assert.equal(x.countsAsSale,undefined);
 assert.ok(!Object.hasOwn(x,'paid'));
});
test('repetir una solicitud no duplica el ingreso, no toca caja',async()=>{
 const db=simulated();
 const first=await ingresarSolicitudRomoQA({db,request:order,ip:'192.0.2.1',salt});
 const again=await ingresarSolicitudRomoQA({db,request:order,ip:'192.0.2.1',salt});
 assert.equal(first.repetido,false);assert.equal(again.repetido,true);
 assert.equal(first.countsAsSale,false);assert.equal(again.countsAsSale,false);
 assert.equal(db.rows.size,1);
 assert.equal(db.calls.filter(x=>x.sql.startsWith('INSERT INTO ')).length,1);
});
test('solicitudes de Uki y campos contables del navegador se rechazan',()=>{
 for(const bad of [
  {...order,storeId:'uki:serena'},
  {...order,paid:true},
  {...order,estado:'aceptada'},
  {...order,whatsappConfirmado:true},
  {...order,requestId:'otra'},
  {...order,totalIndicado:-1}
 ])assert.throws(()=>prepararSolicitudRomoQA(bad));
});
test('reutilización de clave distinta causa conflicto, no otro pedido',async()=>{
 const db=simulated();
 await ingresarSolicitudRomoQA({db,request:order,ip:'192.0.2.1',salt});
 await assert.rejects(ingresarSolicitudRomoQA({db,request:{...order,mensaje:order.mensaje+' extra'},
  ip:'192.0.2.1',salt}),e=>e.code==='ROMO_ORDER_DUPLICATE');
 assert.equal(db.rows.size,1);
});
test('la misma clave no puede reutilizarse cambiando monto, cliente ni telefono',async()=>{
 const db=simulated();
 await ingresarSolicitudRomoQA({db,request:order,ip:'192.0.2.1',salt});
 for(const changed of [
  {...order,totalIndicado:1},
  {...order,cliente:'Otra Persona'},
  {...order,telefono:'+56999999999'}
 ]){
  await assert.rejects(ingresarSolicitudRomoQA({
   db,request:changed,ip:'192.0.2.1',salt
  }),e=>e.code==='ROMO_ORDER_DUPLICATE');
 }
 assert.equal(db.rows.size,1);
 assert.equal(db.calls.filter(x=>x.sql.startsWith('INSERT INTO ')).length,1);
});
test('bandeja solo puede leer personal Romo autorizado',async()=>{
 const db=simulated();
 await ingresarSolicitudRomoQA({db,request:order,ip:'192.0.2.1',salt});
 assert.equal((await leerSolicitudesRomoQA({db,identity:owner})).orders.length,1);
 await assert.rejects(leerSolicitudesRomoQA({db,identity:other}),/Romo|permiso/);
});
test('hash usa sal, nunca registra IP directa',()=>{
 const hash=hashSolicitanteRomoQA('192.0.2.1',salt);
 assert.match(hash,/^[0-9a-f]{64}$/);
 assert.notEqual(hash,hashSolicitanteRomoQA('192.0.2.1',salt+'otra'));
});
test('API cerrada por defecto, JWT obligatorio para GET y POST público solo pendiente',()=>{
 const s=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(s,/ROMO_CARTA_SOLICITUDES_LIVE_ENABLED/);
 assert.match(s,/resolveRomoIdentity/);
 assert.match(s,/ingresarSolicitudRomoQA/);
 assert.match(s,/leerSolicitudesRomoQA/);
 assert.doesNotMatch(s,/UPDATE public\.romo_estado_operativo|INSERT INTO public\.uki_/);
});
