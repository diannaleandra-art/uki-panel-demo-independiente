'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const OP=require('../lib/seguimiento-operacion-unificada-qa.cjs');
const LINKS=require('../lib/seguimiento-enlaces-seguros-v1.cjs');
const TOKEN_SECRET='b'.repeat(64);
const CHAT_SECRET='c'.repeat(64);
const id='621bd292-2153-4160-9e85-375978e10352';
const NOW=1795500000;
const cases=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
function mockDb(storeId,branch){
 const meta=S.TABLES[storeId];
 const row={id,branch,store_id:storeId,codigo_pedido:'P-201',estado:'aceptada',total_indicado:18000,
  request_key:'private_strong_request_key_12345678901234567890',
  datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:6000}]}};
 const state={row,link:null,payment:null,chats:[],calls:[]};
 const query=async(query,params=[])=>{
  state.calls.push({query,params});
  // Todas las consultas de lectura y escritura deben conservar rama y sucursal.
  if(query.startsWith('SELECT request_key FROM '+meta.source)){
   assert.deepEqual(params,meta.uki?[id,branch]:[id,branch,storeId]);
   return [{request_key:row.request_key}];
  }
  if(query.startsWith('SELECT EXTRACT(EPOCH FROM s.creado_en)')){
   assert.deepEqual(params,meta.uki?[id,row.request_key,branch]:[id,row.request_key,branch,storeId]);
   return [{issued_at:NOW}];
  }
  if(query.startsWith('SELECT token_hash::text AS token_hash')){
   assert.deepEqual(params,[id,storeId,branch]);
   return state.link?[{token_hash:state.link.tokenHash,estado:state.link.status,
    expires_at:state.link.expiresAtSeconds,revocado_en:state.link.revokedAt}]:[];
  }
  if(query.includes(' FROM '+meta.source+' WHERE id=')){
   assert.deepEqual(params,meta.uki?[id,branch]:[id,branch,storeId]);
   return [{...row,store_id:meta.uki?null:storeId}];
  }
  if(query.startsWith('INSERT INTO '+meta.link)){
   assert.equal(params[0],id);
   assert.equal(params[1],storeId);
   assert.equal(params[2],branch);
   if(state.link)return [];
   state.link={tokenHash:params[3],expiresAtSeconds:params[5],storeId,orderId:id,status:'active',revokedAt:null};
   return [{solicitud_id:id}];
  }
  if(query.includes(' FROM '+meta.link+' WHERE')){
   assert.deepEqual(params,[id,storeId,branch]);
   return state.link?[{...state.link}]:[];
  }
  if(query.startsWith('SELECT estado_pago,monto_transferencia')){
   assert.deepEqual(params,meta.uki?[id,storeId,branch]:[id,storeId]);
   return state.payment?[{...state.payment}]:[];
  }
  if(query.startsWith('INSERT INTO '+meta.payment)){
   assert.equal(params[0],id);
   assert.equal(params[1],storeId);
   const amount=meta.uki?params[3]:params[2];
   assert.equal(amount,12000);
   if(query.includes("'avisada'"))state.payment={monto_transferencia:12000,estado_pago:'avisada'};
   if(query.includes("'confirmada'"))state.payment={monto_transferencia:12000,estado_pago:'confirmada'};
   return [{estado_pago:state.payment.estado_pago}];
  }
  if(query.startsWith('SELECT COUNT(*)::integer AS n FROM '+meta.messages)){
   assert.equal(params[0],id);assert.equal(params[1],storeId);
   return [{n:0}];
  }
  if(query.startsWith('INSERT INTO '+meta.messages)){
   assert.equal(params[0],id);assert.equal(params[1],storeId);
   const sender=meta.uki?params[3]:params[2];
   const ciphertext=meta.uki?params[4]:params[3];
   const nonce=meta.uki?params[5]:params[4];
   state.chats.push({remitente:sender,mensaje_cifrado:ciphertext,nonce,creado_en:'2026-11-24'});
   return [{id:state.chats.length}];
  }
  if(query.startsWith('SELECT remitente,mensaje_cifrado')){
   assert.deepEqual(params,meta.uki?[id,storeId,branch]:[id,storeId]);
   return [...state.chats].reverse();
  }
  throw Error('SQL no contemplado en simulación: '+query.slice(0,80));
 };
 return {query,state};
}
for(const [storeId,branch] of cases){
 test(storeId+' · aceptación → enlace → mensaje → transferencia confirmada manualmente',async()=>{
  const db=mockDb(storeId,branch);
  const staff={storeId,userId:'worker-test-42',role:'agendador'};
  const bank={storeId,verified:true,datos:{banco:'Santander',titular:'Titular QA',rut:'11111111-1',tipo:'Corriente',cuenta:'999',correo:'demo@example.com'}};
  const created=await S.issueAccepted({db,storeId,orderId:id,staff,secret:TOKEN_SECRET,nowSeconds:NOW});
  assert.equal(created.orderId,id);
  const checked=await S.verifyCustomer({db,token:created.token,secret:TOKEN_SECRET,nowSeconds:NOW+1});
  assert.equal(checked.order.storeId,storeId);
  assert.equal(checked.order.montoTransferencia,12000);
  await S.sendMessage({db,order:checked.order,from:'cliente',body:'¿Cuánto falta?',chatSecret:CHAT_SECRET});
  await S.sendMessage({db,order:checked.order,from:'agendador',body:'Ya se está preparando',staff,chatSecret:CHAT_SECRET});
  const original=await S.snapshot({db,order:checked.order,bank,chatSecret:CHAT_SECRET});
  assert.equal(original.estadoPago,'pendiente');
  assert.equal(original.mensajes.length,2);
  assert.equal(original.mensajes[0].texto,'¿Cuánto falta?');
  assert.equal(original.mensajes[1].texto,'Ya se está preparando');
  await S.clientNotice({db,order:checked.order,bank});
  const notified=await S.snapshot({db,order:checked.order,bank,chatSecret:CHAT_SECRET});
  assert.equal(notified.estadoPago,'avisada');
  assert.match(notified.descripcionPago,/verificar/);
  await assert.rejects(()=>S.staffConfirm({db,order:checked.order,staff,bank,seenBankCredit:false,receivedAmount:12000}),/verificar/);
  await assert.rejects(()=>S.staffConfirm({db,order:checked.order,staff,bank,seenBankCredit:true,receivedAmount:18000}),/monto/);
  const confirmed=await S.staffConfirm({db,order:checked.order,staff,bank,seenBankCredit:true,receivedAmount:12000});
  assert.equal(confirmed.status,'confirmada');
  assert.equal(db.state.payment.estado_pago,'confirmada');
  assert.equal((await S.clientNotice({db,order:checked.order,bank})).repeated,true);
  const view=await S.snapshot({db,order:checked.order,bank,chatSecret:CHAT_SECRET});
  assert.equal(view.estadoPago,'confirmada');
  assert.equal(view.mensajes.length,2);
  db.state.link.status='revoked';
  await assert.rejects(()=>S.verifyCustomer({db,token:created.token,secret:TOKEN_SECRET,nowSeconds:NOW+1}),/revocado/);
 });
}
test('lectura de datos históricos incompletos nunca autoriza transferencias ni cobros',async()=>{
 const m=mockDb('uki:serena','serena');
 m.state.row.datos={whatsapp_confirmado:true};
 const order=await S.loadOne(m,'uki:serena',id);
 assert.equal(order.montoTransferencia,null);
 assert.equal(order.pagoSinDeterminar,true);
 const bank={storeId:'uki:serena',verified:true,datos:{banco:'Santander'}};
 assert.equal(OP.view({order,paymentStatus:'pendiente',bank}).estadoPago,'requiere_revision');
 await assert.rejects(()=>S.clientNotice({db:m,order,bank}),/todavía no está disponible/);
 await assert.rejects(()=>S.staffConfirm({db:m,order,bank,staff:{storeId:'uki:serena',role:'agendador',userId:'worker-test'},receivedAmount:18000,seenBankCredit:true}),/verificar abono/);
});
test('No se entrega enlace si el pedido no está aceptado o el personal no pertenece a la sucursal',async()=>{
 const m=mockDb('uki:arica','arica');
 await assert.rejects(()=>S.issueAccepted({db:m,storeId:'uki:arica',orderId:id,staff:{storeId:'uki:serena',role:'agendador',userId:'worker-test'},secret:TOKEN_SECRET,nowSeconds:NOW}),/personal sin permiso/);
 assert.equal(m.state.link,null);
 m.state.row.estado='pendiente';
 await assert.rejects(()=>S.issueAccepted({db:m,storeId:'uki:arica',orderId:id,staff:{storeId:'uki:arica',role:'agendador',userId:'worker-test'},secret:TOKEN_SECRET,nowSeconds:NOW}),/Pedido sin aceptación/);
 assert.equal(m.state.link,null);
});
test('Los enlaces y mensajes no se pueden trasladar a otra sucursal',async()=>{
 const origin=mockDb('uki:arica','arica');
 // La firma obliga a buscar EXCLUSIVAMENTE Arica, aunque el servidor use
 // una conexión con solicitudes de ambas sucursales. Si no está su huella,
 // el acceso debe rechazarse, sin reinterpretar el enlace como Serena.
 const other={query:async(query,params)=>{
  assert.match(query,/uki_seguimiento_enlaces_qa_v1/);
  assert.deepEqual(params,[id,'uki:arica','arica']);
  return [];
 }};
 const created=await S.issueAccepted({db:origin,storeId:'uki:arica',orderId:id,staff:{storeId:'uki:arica',role:'duenos',userId:'owner-qa'},secret:TOKEN_SECRET,nowSeconds:NOW});
 await assert.rejects(()=>S.verifyCustomer({db:other,token:created.token,secret:TOKEN_SECRET,nowSeconds:NOW+3}),/revocado/);
 const link=LINKS.verifyLink(created.token,TOKEN_SECRET,{atSeconds:NOW+1});
 assert.equal(link.storeId,'uki:arica');
});
