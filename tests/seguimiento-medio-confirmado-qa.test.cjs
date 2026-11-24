'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
const orderId='621bd292-2153-4160-9e85-375978e10352';
for(const [storeId,branch] of [['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']]){
 const staff={storeId,role:'agendador',userId:'trabajador-qa-123'};
 function mock(changed=false){
  const calls=[],row={id:orderId,store_id:storeId,branch,estado:'aceptada',
   codigo_pedido:'QA-100',total_indicado:18000,
   datos:{pagoPreferido:'transferencia',pagoDeclaracion:'cliente_no_verificado'}};
  const db={query:async(sql,args)=>{
   calls.push({sql,args});
   if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos'))return [row];
   if(sql.startsWith('UPDATE public.'))return changed?[]:[{id:orderId,branch,total_indicado:18000}];
   throw Error('SQL de prueba inesperada');
  }};
  return {db,calls,row};
 }
 test(storeId+' forma de pago: confirma preferencia sólo con validación de personal, sin marcar cobro',async()=>{
  const q=mock();
  const result=await P.confirmPreferred({db:q.db,storeId,orderId,staff,metodo:'transferencia',totalValidado:18000});
  assert.equal(result.ok,true);
  assert.equal(result.repeated,false);
  assert.equal(result.montoTransferencia,18000);
  assert.equal(q.calls.length,2);
  const {sql,args}=q.calls[1];
  assert.match(sql,/WHERE s\.id=\$1::uuid AND s\.branch=\$3/);
  assert.match(sql,/s\.estado='aceptada'/);
  assert.match(sql,/s\.total_indicado=\$4::integer/);
  assert.match(sql,/s\.datos=\$5::jsonb/);
  assert.match(sql,/s\.datos->>'pagoDeclaracion'='cliente_no_verificado'/);
  assert.match(sql,/NOT\(s\.datos \? 'medioPago'\)/);
  assert.match(sql,/NOT EXISTS \(SELECT 1/);
  assert.match(sql,/medioPagoConfirmadoPor/);
  assert.doesNotMatch(sql,/UPDATE public\..*(caja|ventas|timbres)/i);
  assert.equal(args[1],storeId);
  assert.equal(args[2],branch);
  assert.equal(args[3],18000);
  assert.equal(args[5],'transferencia');
  assert.equal(args[6],staff.userId);
 });
 test(storeId+' impide registrar forma de pago cuando cambió el pedido',async()=>{
  const f=mock(true);
  await assert.rejects(()=>P.confirmPreferred({db:f.db,storeId,orderId,staff,metodo:'transferencia',totalValidado:18000}),{status:409});
 });
 test(storeId+' permite cambiar transferencia declarada por efectivo sin marcar pago recibido',async()=>{
  const f=mock();
  const result=await P.confirmPreferred({db:f.db,storeId,orderId,staff,metodo:'efectivo',totalValidado:18000});
  assert.equal(result.ok,true);
  assert.equal(result.montoTransferencia,0);
  assert.equal(f.calls.length,2);
  const {sql,args}=f.calls[1];
  assert.match(sql,/medioPagoPreferenciaOriginal/);
  assert.doesNotMatch(sql,/s\\.datos->>'pagoPreferido'=\\$6/);
  assert.equal(args[5],'efectivo');
  assert.equal(JSON.parse(args[4]).pagoPreferido,'transferencia');
 });
 test(storeId+' exige trabajador de la misma tienda',async()=>{
  const f=mock();
  await assert.rejects(()=>P.confirmPreferred({db:f.db,storeId,orderId,
   staff:{...staff,storeId:'otra'},metodo:'transferencia',totalValidado:18000}),{status:403});
  assert.equal(f.calls.length,0);
 });
}
test('endpoint se limita al panel autorizado en QA y no confirma abonos bancarios',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const c=fs.readFileSync(path.join(__dirname,'../api/seguimiento-personal-tres-qa.js'),'utf8');
 assert.match(c,/ENV\.config\(\)/);
 assert.match(c,/AUTH\.authorized/);
 assert.match(c,/action==='confirmar_medio_de_pago'/);
 assert.match(c,/PAY\.confirmPreferred/);
 assert.doesNotMatch(c,/confirmar_medio_de_pago[\s\S]*?estadoPago:'confirmada'/);
});

test('confirmacion previa solo es reutilizable si el total y la preferencia siguen iguales',async()=>{
 const storeId='uki:arica',branch='arica',staff={storeId,role:'agendador',userId:'trabajador-qa-123'};
 const base={id:orderId,store_id:storeId,branch,estado:'aceptada',codigo_pedido:'QA',
  total_indicado:18000,
  datos:{pagoPreferido:'transferencia',pagoDeclaracion:'cliente_no_verificado',
   medioPago:'transferencia',medioPagoPreferenciaOriginal:'transferencia',medioPagoConfirmadoPor:staff.userId,medioPagoConfirmadoTotal:18000}};
 let calls=0;
 const db={query:async(sql)=>{calls++;if(sql.startsWith('SELECT'))return [base];throw Error('No se debe actualizar de nuevo')}};
 const repeated=await P.confirmPreferred({db,storeId,orderId,staff,metodo:'transferencia'});
 assert.equal(repeated.repeated,true);
 assert.equal(calls,1);
 base.total_indicado=19000;
 await assert.rejects(()=>P.confirmPreferred({db,storeId,orderId,staff,metodo:'transferencia'}),{status:409});
 base.total_indicado=18000;base.datos.pagoPreferido='efectivo';
 await assert.rejects(()=>P.confirmPreferred({db,storeId,orderId,staff,metodo:'transferencia'}),{status:409});
 assert.equal(calls,3);
});


test('Romo: agendadora corrige el medio elegido en carta, sin registrar pago ni alterar cotización',async()=>{
 const storeId='romo:serena',staff={storeId,role:'agendador',userId:'worker-test-qa-321'};
 const datos={origen:'carta-normal',medioPago:'transferencia',
  cotizacion:{payment:'transferencia'},detalleVerificado:[{nombre:'Sushi QA',cantidad:1}]};
 const row={id:orderId,store_id:storeId,branch:'serena',estado:'aceptada',codigo_pedido:'QA',
  total_indicado:16000,datos};
 const queries=[];
 const db={query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos'))return [row];
  if(sql.startsWith('UPDATE public.romo_solicitudes_carta_v1'))return [{id:orderId}];
  throw Error('SQL inesperada');
 }};
 const result=await P.confirmPreferred({db,storeId,orderId,staff,metodo:'efectivo'});
 assert.equal(result.ok,true);
 assert.equal(result.montoTransferencia,0);
 assert.equal(queries.length,2);
 const {sql,args}=queries[1];
 assert.match(sql,/s\.datos->>'origen'='carta-normal'/);
 assert.match(sql,/medioPagoPreferenciaOriginal/);
 assert.match(sql,/medioPagoConfirmadoPor/);
 assert.match(sql,/medioPagoConfirmadoTotal/);
 assert.match(sql,/NOT EXISTS/);
 assert.equal(args[3],16000);
 assert.equal(args[5],'efectivo');
 assert.equal(JSON.parse(args[4]).medioPago,'transferencia');
 assert.equal(JSON.parse(args[4]).cotizacion.payment,'transferencia');
});

test('sin importe comprobado o con importe distinto, jamás valida el medio en ninguno de los locales',async()=>{
 for(const [storeId,branch] of [['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']]){
  const staff={storeId,role:'agendador',userId:'worker-test-qa'};
  let called=0;
  const row={id:orderId,store_id:storeId,branch,estado:'aceptada',codigo_pedido:'QA-100',
   total_indicado:18000,datos:{origen:'carta-normal',medioPago:'transferencia',pagoPreferido:'transferencia'}};
  const db={query:async()=>{called++;return [row]}};
  await assert.rejects(()=>P.confirmPreferred({db,storeId,orderId,staff,metodo:'transferencia'}),{status:400});
  await assert.rejects(()=>P.confirmPreferred({db,storeId,orderId,staff,metodo:'transferencia',totalValidado:19000}),{status:409});
  assert.equal(called,1);
 }
});
