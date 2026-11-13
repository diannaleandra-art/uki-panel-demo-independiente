import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 emitirComprobanteRomoQA,aceptarConComprobanteRomoQA,ROMO_COMPROBANTE_SIN_ACTIVAR
} from '../lib/romo-comprobante-guardado-qa.mjs';

const STORE='romo:serena';
const id='00000000-0000-4000-8000-000000000001';
const claimToken='00000000-0000-4000-8000-000000000002';
const otherToken='00000000-0000-4000-8000-000000000003';
const pedidoId='1234';
const secret='qa-only-key-not-used-in-real-vercel-123456789';
const now=1794527000000;
const owner={userId:'owner_fixture',brand:'romo',role:'duenos',branches:['serena']};
const staff={userId:'staff_fixture',brand:'romo',role:'agendador',branches:['serena']};
const hash=t=>createHash('sha256').update('romo-carta-reserva-v1:'+t).digest('hex');
function fake(){
 const state={revision:3,updatedBy:owner.userId,estado:'pendiente',
  reserveHash:hash(claimToken),pedidoInterno:null};
 const calls=[];
 return {state,calls,async query(sql,args){
  calls.push({sql,args});
  if(sql.startsWith('SELECT revision, actualizado_por FROM public.romo_estado_operativo_v1')){
   assert.deepEqual(args,[STORE]);
   return [{revision:state.revision,actualizado_por:state.updatedBy}];
  }
  if(sql.startsWith("UPDATE public.romo_solicitudes_carta_v1")){
   assert.match(sql,/reserva_token_hash=\$3/);
   assert.match(sql,/estado='pendiente'/);
   assert.match(sql,/EXISTS \(SELECT 1 FROM public\.romo_estado_operativo_v1/);
   assert.deepEqual(args,[id,STORE,hash(claimToken),pedidoId,owner.userId,3]);
   if(state.estado!=='pendiente'||state.reserveHash!==args[2]||
      state.revision!==args[5]||state.updatedBy!==args[4])return [];
   state.estado='aceptada';state.pedidoInterno=args[3];
   return [{id,estado:'aceptada',pedido_interno:args[3]}];
  }
  throw Error('SQL ajeno a Romo');
 }};
}
const inputs=db=>({db,identity:owner,requestId:id,claimToken,
 pedidoId,secret,now});
const persist={storeId:STORE,revision:3};
test('comprobante se emite SOLO cuando Neon confirma revisión y actor',async()=>{
 const db=fake();
 assert.equal(ROMO_COMPROBANTE_SIN_ACTIVAR,true);
 const issued=await emitirComprobanteRomoQA({...inputs(db),savedResult:persist});
 assert.match(issued.comprobante,/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
 assert.equal(issued.storeId,STORE);
 assert.equal(issued.revision,3);
 assert.equal(issued.expiresAt-now,300000);
 assert.equal(db.calls.length,1);
});
test('comprobante con revisión falsa o sin guardado real se rechaza',async()=>{
 const db=fake();
 await assert.rejects(emitirComprobanteRomoQA({
  ...inputs(db),savedResult:{storeId:STORE,revision:2}
 }),/No se confirmó/);
 await assert.rejects(emitirComprobanteRomoQA({
  ...inputs(db),savedResult:{storeId:'uki:serena',revision:3}
 }),/tras guardar/);
 await assert.rejects(emitirComprobanteRomoQA({
  ...inputs(db),savedResult:null
 }),/tras guardar/);
 assert.equal(db.calls.filter(x=>x.sql.startsWith('UPDATE ')).length,0);
});
test('aceptación valida firma, reserva, revisión y confirma sin sumar ventas',async()=>{
 const db=fake();
 const signed=await emitirComprobanteRomoQA({...inputs(db),savedResult:persist});
 const final=await aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante
 });
 assert.equal(final.estado,'aceptada');
 assert.equal(final.pedidoInterno,pedidoId);
 assert.equal(final.countsAsSale,false);
 assert.equal(final.whatsappConfirmado,false);
 assert.equal(db.state.pedidoInterno,pedidoId);
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante
 }),e=>e.code==='ROMO_ACEPTACION_CONFLICT');
});
test('comprobante alterado, clave distinta o pedido ajeno no aceptan',async()=>{
 const db=fake();
 const signed=await emitirComprobanteRomoQA({...inputs(db),savedResult:persist});
 const [body,mac]=signed.comprobante.split('.');
 for(const changes of [
  {comprobante:body+'.x'+mac},
  {comprobante:signed.comprobante,secret:'different-secret-from-test-123456789'},
  {comprobante:signed.comprobante,pedidoId:'7777'},
  {comprobante:signed.comprobante,claimToken:otherToken},
  {comprobante:signed.comprobante,requestId:'00000000-0000-4000-8000-000000000004'}
 ]){
  await assert.rejects(aceptarConComprobanteRomoQA({
   ...inputs(db),comprobante:signed.comprobante,...changes
  }));
 }
 assert.equal(db.state.estado,'pendiente');
 assert.equal(db.calls.filter(x=>x.sql.startsWith('UPDATE ')).length,0);
});
test('comprobante caducado, revisión posterior o actor diferente bloquea',async()=>{
 const db=fake();
 const signed=await emitirComprobanteRomoQA({...inputs(db),savedResult:persist});
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante,now:now+301000
 }),/no corresponde/);
 db.state.revision=4;
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante
 }),/No se confirmó/);
 db.state.revision=3;db.state.updatedBy=staff.userId;
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante
 }),/No se confirmó/);
 assert.equal(db.state.estado,'pendiente');
});
test('otro empleado, identidad Uki y contraseña en lugar de firma no aceptan',async()=>{
 const db=fake();
 const signed=await emitirComprobanteRomoQA({...inputs(db),savedResult:persist});
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante,identity:staff
 }),/no corresponde/);
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:signed.comprobante,identity:{...owner,brand:'uki'}
 }),/Romo|permiso/);
 await assert.rejects(aceptarConComprobanteRomoQA({
  ...inputs(db),comprobante:'mi-password'
 }));
 assert.equal(db.state.estado,'pendiente');
});
test('API real exige dos flags, y comprobante no expone el pedido cifrado',()=>{
 const orderApi=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 const stateApi=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
 assert.match(orderApi,/ROMO_CARTA_ACEPTACION_LIVE_ENABLED/);
 assert.match(orderApi,/ROMO_COMPROBANTE_GUARDADO_LIVE_ENABLED/);
 assert.match(orderApi,/aceptarConComprobanteRomoQA/);
 assert.match(stateApi,/ROMO_COMPROBANTE_GUARDADO_LIVE_ENABLED/);
 assert.match(stateApi,/emitirComprobanteRomoQA/);
 const proofModule=readFileSync(new URL('../lib/romo-comprobante-guardado-qa.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(proofModule,/INSERT INTO public\.uki_|FROM public\.uki_/);
 assert.doesNotMatch(proofModule,/snapshot\s+FROM/);
});
