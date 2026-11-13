import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarSolicitudesPendientesRomoQA,ROMO_PANEL_BANDEJA_HABILITADA_QA}
 from '../firebase/uki-romo-solicitudes-panel-qa.mjs';
const row={id:'00000000-0000-4000-8000-000000000001',store_id:'romo:serena',
 codigo_pedido:'RMO-128',estado:'pendiente',total_indicado:8000};
test('Romo Pedidos está apagado por defecto en el panel habitual',async()=>{
 let auth=0,network=0;
 await assert.rejects(consultarSolicitudesPendientesRomoQA({
  getToken:async()=>{auth++;return 't'.repeat(100)},
  fetchFn:async()=>{network++;return{}}
 }),/no está activada/);
 assert.equal(ROMO_PANEL_BANDEJA_HABILITADA_QA,false);
 assert.deepEqual([auth,network],[0,0]);
});
test('La misma vista Pedidos consulta sólo la bandeja Romo con Google autorizado',async()=>{
 let calls=0;
 const r=await consultarSolicitudesPendientesRomoQA({enabled:true,
  getToken:async()=> 't'.repeat(120),
  fetchFn:async(url,opt)=>{
   calls++;
   assert.equal(url,'https://uki-sushi-inventario.vercel.app/api/romo-solicitudes-carta-qa');
   assert.equal(opt.method,'GET');
   assert.equal(opt.headers.Authorization,'Bearer '+'t'.repeat(120));
   return {ok:true,json:async()=>({
    ok:true,storeId:'romo:serena',soloSolicitudes:true,orders:[row]})};
  }
 });
 assert.equal(calls,1);assert.equal(r.orders.length,1);
 assert.equal(r.orders[0].store_id,'romo:serena');
});
test('No muestra solicitudes de Uki ni toma permisos de otro local',async()=>{
 for(const payload of [
  {ok:true,storeId:'uki:serena',soloSolicitudes:true,orders:[row]},
  {ok:true,storeId:'romo:serena',soloSolicitudes:true,orders:[{...row,store_id:'uki:arica'}]},
  {ok:true,storeId:'romo:serena',soloSolicitudes:true,orders:[{...row,estado:'entregado'}]}
 ])await assert.rejects(consultarSolicitudesPendientesRomoQA({
  enabled:true,getToken:async()=> 't'.repeat(120),
  fetchFn:async()=>({ok:true,json:async()=>payload})
 }),/Romo/);
});
test('No acepta endpoint Ucr de Uki aunque el usuario ya tenga acceso',async()=>{
 let calls=0;
 await assert.rejects(consultarSolicitudesPendientesRomoQA({
  enabled:true,endpoint:'https://uki-sushi-pedidos.vercel.app/api/carta-solicitudes-live',
  getToken:async()=>{calls++;return 't'.repeat(120)},
  fetchFn:async()=>{calls++;return {ok:true}}
 }),/no está activada/);
 assert.equal(calls,0);
});
