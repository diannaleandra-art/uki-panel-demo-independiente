import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararSolicitudRomoQA,hashSolicitanteRomoQA,ingresarSolicitudRomoQA,leerSolicitudesRomoQA,rechazarSolicitudRomoQA}
 from '../lib/romo-solicitudes-carta-qa.mjs';
import {readFileSync} from 'node:fs';
const order={storeId:'romo:serena',key:'solicitudRomo123456',
 codigoPedido:'RMO-001',cliente:'Cliente Romo',telefono:'+56912345678',
 mensaje:'RMO-001 · Cliente Romo · 24 piezas, una salsa de soya · Delivery.',
 totalIndicado:8000};
const salt='solo_prueba_romo_never_live_123456';
const owner={userId:'owner_fixture',brand:'romo',role:'duenos',branches:['serena']};
const other={userId:'another_fixture',brand:'uki',role:'duenos',branches:['serena']};
const fixtureId='00000000-0000-4000-8000-000000000001';
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
   rows.set(key,{id:fixtureId,store_id,codigo_pedido,cliente,telefono,mensaje,
    total_indicado,ip_hash,estado:'pendiente',whatsapp_confirmado:false});
   return [{id:fixtureId,estado:'pendiente'}];
  }
  if(sql.startsWith('UPDATE public.romo_solicitudes_carta_v1')){
   const [store,id,motivo,actor]=params;
   const record=[...rows.values()].find(x=>x.id===id&&x.store_id===store&&x.estado==='pendiente');
   if(!record)return [];
   record.estado='rechazada';record.motivo_rechazo=motivo;record.actualizado_por=actor;
   return [{id,estado:'rechazada',motivo_rechazo:motivo,actualizado_por:actor}];
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
test('rechazo exige motivo, identidad Romo y conserva autor de la decisión',async()=>{
 const db=simulated();
 await ingresarSolicitudRomoQA({db,request:order,ip:'192.0.2.1',salt});
 const done=await rechazarSolicitudRomoQA({
  db,identity:owner,id:fixtureId,motivo:'Cliente solicitó cancelar el pedido'
 });
 assert.equal(done.estado,'rechazada');
 assert.equal(done.actualizadoPor,owner.userId);
 assert.equal(done.countsAsSale,false);
 assert.equal(db.rows.get(order.key).motivo_rechazo,'Cliente solicitó cancelar el pedido');
 assert.equal(db.rows.get(order.key).actualizado_por,owner.userId);
 await assert.rejects(rechazarSolicitudRomoQA({
  db,identity:owner,id:fixtureId,motivo:'Otro motivo de rechazo'
 }),e=>e.code==='ROMO_DECISION_CONFLICT');
 assert.equal(db.calls.filter(x=>x.sql.startsWith('UPDATE ')).length,2);
});
test('sin motivo, con ID ajeno o rol Uki no permite cambiar solicitud',async()=>{
 const db=simulated();
 await assert.rejects(rechazarSolicitudRomoQA({
  db,identity:owner,id:fixtureId,motivo:'no'
 }),/Motivo/);
 await assert.rejects(rechazarSolicitudRomoQA({
  db,identity:owner,id:'arica',motivo:'Pedido rechazado'
 }),/Identificador/);
 await assert.rejects(rechazarSolicitudRomoQA({
  db,identity:other,id:fixtureId,motivo:'Pedido rechazado'
 }),/Romo|permiso/);
 assert.equal(db.calls.length,0);
});
test('hash usa sal, nunca registra IP directa',()=>{
 const hash=hashSolicitanteRomoQA('192.0.2.1',salt);
 assert.match(hash,/^[0-9a-f]{64}$/);
 assert.notEqual(hash,hashSolicitanteRomoQA('192.0.2.1',salt+'otra'));
});
test('migración de bandeja obliga a revocar permisos heredados de Neon',()=>{
 const src=readFileSync(new URL('../sql/20261112_romo_solicitudes_carta_v1_QA_NO_EJECUTAR.sql',import.meta.url),'utf8');
 assert.match(src,/REVOKE ALL PRIVILEGES ON TABLE public\.romo_solicitudes_carta_v1 FROM romos_app_service, PUBLIC/);
 assert.doesNotMatch(src,/^GRANT\s+/mi);
 assert.match(src,/actualizado_por text CHECK/);
 assert.doesNotMatch(src,/DROP TABLE|TRUNCATE TABLE/);
});
test('API cerrada por defecto, JWT obligatorio para GET y POST público solo pendiente',()=>{
 const s=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(s,/ROMO_CARTA_SOLICITUDES_LIVE_ENABLED/);
 assert.match(s,/resolveRomoIdentity/);
 assert.match(s,/ingresarSolicitudRomoQA/);
 assert.match(s,/leerSolicitudesRomoQA/);
 assert.match(s,/ROMO_CARTA_SOLICITUDES_EDIT_LIVE_ENABLED/);
 assert.match(s,/rechazarSolicitudRomoQA/);
 assert.doesNotMatch(s,/UPDATE public\.romo_estado_operativo|INSERT INTO public\.uki_/);
});
