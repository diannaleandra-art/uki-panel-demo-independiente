import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coordinarGuardadoYAceptacionRomoQA} from '../firebase/uki-romo-guardar-confirmar-qa.mjs';
const branch='Romo’s Sushi La Serena';
const id='00000000-0000-4000-8000-000000000001';
const claim='00000000-0000-4000-8000-000000000002';
const link={requestId:id,claimToken:claim,pedidoId:'1234'};
const state={suc:branch,pedidos:[{
 id:1234,suc:branch,cartaSolicitudRemotaId:id,cartaReservaToken:claim,
 productos:[{nombre:'Sushi 24 piezas',cantidad:1,precioUnit:8000}]
}]};
function ready({badSave=false,badReceipt=false,receiptExpired=false,
 badAccept=false,badServer=false}={}){
 const calls=[];
 const guardarEstadoCifrado=async obj=>{
  calls.push({type:'save',data:obj});
  if(badSave)throw Error('Neon desconectado');
  if(badReceipt)return {revision:3};
  return {revision:3,comprobante:'proof_'.repeat(17),
   expiresAt:Date.now()+(receiptExpired?-10000:300000)};
 };
 const confirmarEnBandeja=async obj=>{
  calls.push({type:'accept',data:obj});
  if(badAccept)throw Error('Otro agendador modificó Romo');
  return badServer?
   {storeId:'uki:serena',estado:'aceptada',pedidoInterno:'1234',countsAsSale:false,whatsappConfirmado:false}:
   {storeId:'romo:serena',estado:'aceptada',pedidoInterno:'1234',countsAsSale:false,whatsappConfirmado:false};
 };
 return {calls,guardarEstadoCifrado,confirmarEnBandeja};
}
test('pedido Uki reutilizado en Romo: guardar antes de aceptar, sin ventas duplicadas',async()=>{
 const f=ready();
 const done=await coordinarGuardadoYAceptacionRomoQA({
  estado:state,revision:2,solicitudCarta:link,...f
 });
 assert.equal(done.estado,'aceptada');
 assert.equal(done.revision,3);
 assert.equal(done.cuentaVentaAdicional,false);
 assert.equal(done.requiereConciliacion,false);
 assert.deepEqual(f.calls.map(x=>x.type),['save','accept']);
 assert.equal(f.calls[0].data.solicitudCarta.requestId,id);
 assert.deepEqual(Object.keys(f.calls[1].data).sort(),
  ['claimToken','comprobante','estado','id','pedidoId','storeId']);
 assert.equal(JSON.stringify(f.calls[1].data).includes('Sushi'),false);
});
test('si falta el pedido real, nada se guarda ni se acepta',async()=>{
 const f=ready();
 await assert.rejects(coordinarGuardadoYAceptacionRomoQA({
  estado:{suc:branch,pedidos:[]},revision:2,solicitudCarta:link,...f
 }),/Primero debes guardar/);
 assert.equal(f.calls.length,0);
});
test('si falla el guardado, no se acepta ni se afirma que existe venta',async()=>{
 const f=ready({badSave:true});
 const done=await coordinarGuardadoYAceptacionRomoQA({
  estado:state,revision:2,solicitudCarta:link,...f
 });
 assert.equal(done.estado,'guardado_no_confirmado');
 assert.equal(done.aceptada,false);
 assert.equal(done.requiereConciliacion,true);
 assert.deepEqual(f.calls.map(x=>x.type),['save']);
});
test('sin comprobante o ya vencido, nunca hay PATCH aceptar',async()=>{
 for(const opts of [{badReceipt:true},{receiptExpired:true}]){
  const f=ready(opts);
  const done=await coordinarGuardadoYAceptacionRomoQA({
   estado:state,revision:2,solicitudCarta:link,...f
  });
  assert.equal(done.estado,'respaldo_pendiente_de_conciliar');
  assert.equal(done.aceptada,false);
  assert.equal(f.calls.length,1);
 }
});
test('si otro teléfono bloquea la aceptación, NO se vuelve a guardar otro pedido',async()=>{
 const f=ready({badAccept:true});
 const done=await coordinarGuardadoYAceptacionRomoQA({
  estado:state,revision:2,solicitudCarta:link,...f
 });
 assert.equal(done.estado,'respaldo_guardado_solicitud_pendiente');
 assert.equal(done.requiereConciliacion,true);
 assert.deepEqual(f.calls.map(x=>x.type),['save','accept']);
});
test('una respuesta de Uki no puede confirmar el pedido de Romo',async()=>{
 const f=ready({badServer:true});
 const done=await coordinarGuardadoYAceptacionRomoQA({
  estado:state,revision:2,solicitudCarta:link,...f
 });
 assert.equal(done.aceptada,false);
 assert.equal(done.estado,'respaldo_guardado_solicitud_pendiente');
});
test('botón real del panel mantiene bloqueo QA y nunca usa reserva Firebase de Uki para Romo',()=>{
 const main=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(main,/async function ndGuardar\(\)/);
 assert.match(main,/if\(S\.suc===ROMO_SUCURSAL_QA&&!window\.ukiRomoConfirmacionDisponibleQA\?\.\(\)\)/);
 const start=main.indexOf('async function ndGuardar()');
 const core=main.slice(start,start+2000);
 assert.ok(core.indexOf('ukiRomoConfirmacionDisponibleQA')>=0);
 assert.ok(core.indexOf('ukiRomoConfirmacionDisponibleQA')<core.indexOf('ukiQRComprobandoCobro'));
 assert.match(main,/if\(ukiCartaRemotaActiva&&S\.suc!==ROMO_SUCURSAL_QA\)/);
 const module=readFileSync(new URL('../firebase/uki-romo-guardar-confirmar-qa.mjs',import.meta.url),'utf8');
 assert.match(module,/window\.ukiRomoConfirmacionDisponibleQA=\(\)=>false/);
});
