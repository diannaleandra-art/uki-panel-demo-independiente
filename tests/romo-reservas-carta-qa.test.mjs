import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {reservarSolicitudRomoQA,liberarSolicitudRomoQA}
 from '../lib/romo-reservas-carta-qa.mjs';
const STORE='romo:serena';
const id='00000000-0000-4000-8000-000000000001';
const tokenA='00000000-0000-4000-8000-000000000002';
const tokenB='00000000-0000-4000-8000-000000000003';
const owner={userId:'fixture_owner',brand:'romo',role:'duenos',branches:['serena']};
function mock(){
 const state={reserved:'',pending:true,actor:null},calls=[];
 return {state,calls,async query(sql,params){
  calls.push({sql,params});
  assert.match(sql,/public\.romo_solicitudes_carta_v1/);
  assert.doesNotMatch(sql,/public\.uki_|romo_estado_operativo_v1/);
  if(params[0]!==id||params[1]!==STORE||!state.pending)return [];
  if(sql.includes("SET reserva_token_hash=$3")){
   if(state.reserved&&state.reserved!==params[2])return [];
   state.reserved=params[2];state.actor=params[3];
   return [{id,reserva_hasta:'QA 30 minutos'}];
  }
  if(sql.includes("SET reserva_token_hash=''")){
   if(state.reserved!==params[2])return [];
   state.reserved='';return [{id}];
  }
  throw Error('SQL no esperado');
 }};
}
test('un solo teléfono reserva; otro no toma la solicitud',async()=>{
 const db=mock();
 const result=await reservarSolicitudRomoQA({db,identity:owner,id,claimToken:tokenA});
 assert.equal(result.estado,'reservada');
 assert.equal(result.countsAsSale,false);
 assert.equal(db.state.reserved,createHash('sha256')
  .update('romo-carta-reserva-v1:'+tokenA).digest('hex'));
 await assert.rejects(reservarSolicitudRomoQA({
  db,identity:owner,id,claimToken:tokenB
 }),e=>e.code==='ROMO_RESERVA_CONFLICT');
 assert.equal(db.state.actor,owner.userId);
});
test('liberar requiere el mismo token, luego puede reservar otro',async()=>{
 const db=mock();
 await reservarSolicitudRomoQA({db,identity:owner,id,claimToken:tokenA});
 await assert.rejects(liberarSolicitudRomoQA({
  db,identity:owner,id,claimToken:tokenB
 }),e=>e.code==='ROMO_RESERVA_CONFLICT');
 const done=await liberarSolicitudRomoQA({db,identity:owner,id,claimToken:tokenA});
 assert.equal(done.liberada,true);
 assert.equal((await reservarSolicitudRomoQA({
  db,identity:owner,id,claimToken:tokenB
 })).estado,'reservada');
});
test('no admite identidades Uki, ID o token falsificados',async()=>{
 const db=mock();
 await assert.rejects(reservarSolicitudRomoQA({
  db,identity:{...owner,brand:'uki'},id,claimToken:tokenA
 }));
 await assert.rejects(reservarSolicitudRomoQA({
  db,identity:owner,id:'invalido',claimToken:tokenA
 }));
 await assert.rejects(liberarSolicitudRomoQA({
  db,identity:owner,id,claimToken:'no-es-uuid'
 }));
 assert.equal(db.calls.length,0);
});
test('reservar no marca aceptado ni registra caja',()=>{
 const src=readFileSync(new URL('../lib/romo-reservas-carta-qa.mjs',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(src,/ROMO_ACEPTACION_NO_CONECTADA=true/);
 assert.doesNotMatch(src,/SET estado='aceptada'|INSERT INTO public\.romo_estado_operativo_v1/);
 assert.match(api,/if\(body\.estado==='aceptada'\)/);
 assert.match(api,/ROMO_CARTA_SOLICITUDES_EDIT_LIVE_ENABLED/);
});
