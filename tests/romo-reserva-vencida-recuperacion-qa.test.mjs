import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recuperarReservaRomo} from '../lib/romo-solicitudes-carta-qa.mjs';

const ID='812fc037-2895-4ca8-9953-62bac5c1b058';
const duenio={userId:'dueno_qa',role:'duenos',brand:'romo',branches:['serena']};
const options={
 identity:duenio,id:ID,nombreResponsable:'Responsable Romo',
 motivo:'Verificado manualmente sin pedido guardado',
 confirmoSinPedido:true
};
const code=readFileSync(new URL('../lib/romo-solicitudes-carta-qa.mjs',import.meta.url),'utf8');

test('El SQL de recuperación coincide con pedido_interno TEXT NOT NULL DEFAULT vacío en Neon',()=>{
 const sql=code.slice(code.indexOf('export async function recuperarReservaRomo'),code.indexOf('export async function rechazarSolicitudRomo'));
 assert.match(sql,/AND pedido_interno='' RETURNING id/);
 assert.doesNotMatch(sql,/pedido_interno IS NULL/);
 assert.match(sql,/reserva_hasta<=now\(\)/);
 assert.match(sql,/reserva_token_hash<>''/);
 assert.match(sql,/estado='pendiente'/);
 assert.match(sql,/branch='serena'/);
 assert.match(sql,/ON CONFLICT|jsonb_set/); // Conserva constancia de recuperación en datos.
});

test('Dueños recuperan únicamente reserva vencida sin pedido; no se crea venta',async()=>{
 let calls=0;
 const db={query:async(sql,params)=>{
  calls++;
  assert.match(sql,/pedido_interno=''/);
  assert.equal(params[0],ID);
  assert.equal(params[1],'romo:serena');
  assert.equal(params[4],duenio.userId);
  return [{id:ID}];
 }};
 const result=await recuperarReservaRomo({...options,db});
 assert.equal(calls,1);
 assert.equal(result.reservaLiberada,true);
 assert.equal(result.estado,'pendiente');
 assert.equal(result.storeId,'romo:serena');
 assert.equal(result.id,ID);
 assert.equal(result.countsAsSale,undefined);
});

test('Nunca recupera por silencio si hay pedido registrado, reserva cambiada o vigente',async()=>{
 const db={query:async()=>[]};
 await assert.rejects(
  ()=>recuperarReservaRomo({...options,db}),
  error=>error.status===409&&/reserva cambió|pedido registrado/i.test(error.message)
 );
});
test('No permite recuperar a trabajador ni sin comprobación y responsable',async()=>{
 const db={query:async()=>{throw Error('No debe escribir')}};
 await assert.rejects(
  ()=>recuperarReservaRomo({...options,db,identity:{...duenio,role:'agendador'}}),
  /Solo dueños/
 );
 await assert.rejects(
  ()=>recuperarReservaRomo({...options,db,confirmoSinPedido:false}),
  /comprobar pedido/
 );
 await assert.rejects(
  ()=>recuperarReservaRomo({...options,db,nombreResponsable:''}),
  /comprobar pedido/
 );
});
