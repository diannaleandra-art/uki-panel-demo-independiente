'use strict';
/*
 * Prueba de un pedido COMPLETO por sucursal, 100 % simulada.
 * Desde solicitud pendiente + enlace de la misma carta, pasando por chat,
 * aviso del cliente, confirmación manual de banco y bloqueo de finalización.
 * NO se conecta a Neon, Santander, Firestore, caja ni sitios comerciales.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const PAY=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
const TX=require('../lib/seguimiento-finalizacion-atomica-qa.cjs');
const id='621bd292-2153-4160-9e85-375978e10352';
const requestKey='QA_strong_request_key_12345678901234567890123456';
const NOW=1795500000;
const secret='a'.repeat(64),chatSecret='b'.repeat(64);
const stores=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];

function build(storeId,branch){
 const meta=S.TABLES[storeId];
 const datos=storeId==='romo:serena'?
  {origen:'carta-normal',medioPago:'transferencia',cotizacion:{payment:'transferencia'}}:
  {origen:'carta-normal',pagoPreferido:'transferencia',pagoDeclaracion:'cliente_no_verificado'};
 const row={
  id,store_id:storeId,branch,codigo_pedido:'QA-SUSHI-2026',
  request_key:requestKey,estado:'pendiente',creado_en:new Date(NOW*1000).toISOString(),
  total_indicado:18000,datos
 };
 const state={row,link:null,payment:null,messages:[],ledger:null,queries:[]};
 const db={query:async(sql,args=[])=>{
  state.queries.push({sql,args});
  const m=meta;
  if(sql.startsWith('SELECT EXTRACT(EPOCH FROM s.creado_en)')){
   assert.deepEqual(args,m.uki?[id,requestKey,branch]:[id,requestKey,branch,storeId]);
   return row.estado==='rechazada'?[]:[{issued_at:NOW}];
  }
  if(sql.startsWith('SELECT request_key FROM '+m.source))
   return row.estado==='aceptada'?[{request_key:row.request_key}]:[];
  if(sql.startsWith('INSERT INTO '+m.link)){
   assert.deepEqual(args.slice(0,3),[id,storeId,branch]);
   if(row.estado==='rechazada'||state.link)return [];
   state.link={tokenHash:args[3],status:'active',expiresAtSeconds:args[5],
    revokedAt:null,storeId,orderId:id};
   return [{solicitud_id:id}];
  }
  if(sql.startsWith('SELECT token_hash::text AS token_hash'))
   return state.link?[{token_hash:state.link.tokenHash,estado:state.link.status,
    expires_at:state.link.expiresAtSeconds,revocado_en:state.link.revokedAt}]:[];
  if(sql.startsWith('SELECT token_hash::text AS "tokenHash"'))
   return state.link?[{...state.link}]:[];
  if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos')||
     sql.startsWith('SELECT id,branch,estado,datos,total_indicado,codigo_pedido')){
   assert.deepEqual(args,m.uki?[id,branch]:[id,branch,storeId]);
   return [{...row,store_id:m.uki?null:storeId}];
  }
  if(sql.startsWith('UPDATE '+m.source+' s SET datos=')){
   assert.equal(args[0],id);assert.equal(args[1],storeId);
   assert.equal(args[2],branch);assert.equal(args[3],18000);
   assert.equal(args[4],JSON.stringify(row.datos));
   assert.equal(row.estado,'aceptada');
   if(row.datos.medioPagoConfirmadoPor)return [];
   row.datos={...row.datos,medioPago:args[5],medioPagoConfirmadoPor:args[6],
    medioPagoConfirmadoTotal:18000,
    medioPagoConfirmadoEn:new Date(NOW*1000).toISOString(),
    medioPagoPreferenciaOriginal:row.datos.pagoPreferido||row.datos.medioPago||
     row.datos.cotizacion?.payment||null};
   return [{id,branch,total_indicado:18000,datos:row.datos}];
  }
  if(sql.startsWith('SELECT estado_pago,monto_transferencia'))
   return state.payment?[{...state.payment}]:[];
  if(sql.startsWith('INSERT INTO '+m.payment)){
   const index=m.uki?3:2;
   assert.equal(args[0],id);assert.equal(args[1],storeId);
   assert.equal(args[index],18000);
   assert.equal(args.at(-2),18000);
   assert.equal(args.at(-1),JSON.stringify(row.datos));
   assert.equal(row.estado,'aceptada');
   const confirmed=sql.includes('abono_verificado_en');
   if(confirmed&&state.payment?.estado_pago==='confirmada')return [];
   if(!confirmed&&state.payment?.estado_pago==='confirmada')return [];
   state.payment={estado_pago:confirmed?'confirmada':'avisada',
    monto_transferencia:18000,confirmada_en:confirmed?new Date().toISOString():null};
   return [{estado_pago:state.payment.estado_pago}];
  }
  if(sql.startsWith('SELECT COUNT(*)::integer AS n FROM '+m.messages))
   return [{n:state.messages.filter(x=>x.remitente===args[m.uki?3:2]).length}];
  if(sql.startsWith('INSERT INTO '+m.messages)){
   if(row.estado!=='aceptada')return [];
   const i=m.uki?3:2;
   state.messages.push({remitente:args[i],mensaje_cifrado:args[i+1],
    nonce:args[i+2],creado_en:new Date().toISOString()});
   return [{id:state.messages.length}];
  }
  if(sql.startsWith('SELECT remitente,mensaje_cifrado'))
   return [...state.messages].reverse();
  if(sql.startsWith('WITH source_order AS')){
   assert.match(sql,/FOR UPDATE OF s/);
   assert.match(sql,/t\.estado_pago='confirmada'/);
   assert.match(sql,/prior\.estado='pagado'/);
   assert.deepEqual(args.slice(0,3),[id,storeId,branch]);
   assert.equal(args[3],18000);assert.equal(args[4],JSON.stringify(row.datos));
   assert.equal(args[5],18000);
   if(row.estado!=='aceptada'||state.payment?.estado_pago!=='confirmada'||
      state.payment.monto_transferencia!==args[5])return [];
   if(args[6]==='confirmar_cobro'){
    if(state.ledger)return [];
    state.ledger={estado:'pagado',revision:1};
    return [{estado:'pagado',revision:1,solicitud_id:id}];
   }
   if(args[6]==='entregar'&&state.ledger?.estado==='pagado'){
    state.ledger={estado:'entregado',revision:2};
    return [{estado:'entregado',revision:2,solicitud_id:id}];
   }
   return [];
  }
  throw Error('SQL no prevista en simulación: '+sql.slice(0,100));
 }};
 return {db,state};
}
for(const [storeId,branch] of stores){
 test(storeId+' · carta → pedido → aviso → chat → banco → cierre protegido',async()=>{
  const {db,state}=build(storeId,branch);
  const staff={storeId,role:'agendador',userId:'trabajador-qa-1234'};
  const bank={storeId,verified:true,datos:{banco:'Santander de PRUEBA',
   titular:'Cuenta ficticia',rut:'11.111.111-1',tipo:'Corriente',
   cuenta:'NO-REAL',correo:'qa@example.com'}};
  // 1. El cliente registra el pedido en la carta: no es venta.
  const created=await S.issueForRegistered({db,storeId,orderId:id,
   requestKey,secret,nowSeconds:NOW});
  assert.equal(created.storeId,storeId);
  const repeat=await S.issueForRegistered({db,storeId,orderId:id,
   requestKey,secret,nowSeconds:NOW+1});
  assert.equal(repeat.token,created.token,'El enlace guardado no cambia');
  let opened=await S.verifyCustomer({db,token:created.token,secret,nowSeconds:NOW+1});
  let view=await S.snapshot({db,order:opened.order,bank,chatSecret});
  assert.equal(view.estadoPedido,'pendiente');
  assert.equal(view.pagoDeclarado,'transferencia');
  assert.equal(view.estadoPago,'requiere_revision');
  assert.equal(view.puedeAvisarTransferencia,false);
  assert.equal(view.chatHabilitado,false);
  assert.equal(view.datosBancarios,null);
  await assert.rejects(()=>S.clientNotice({db,order:opened.order,bank}),{code:409});
  await assert.rejects(()=>S.sendMessage({db,order:opened.order,from:'cliente',
   body:'Mensaje antes de aceptación',chatSecret}),{code:400});
  // 2. La agendadora acepta el pedido en el panel habitual.
  state.row.estado='aceptada';
  const accepted=await S.issueAccepted({db,storeId,orderId:id,
   staff,secret,nowSeconds:NOW+1});
  assert.equal(accepted.token,created.token,'La aceptación no cambia el enlace del cliente');
  await assert.rejects(()=>TX.commit({db,storeId,orderId:id,action:'confirmar_cobro',
   staff,restoPagoVerificado:true}),{status:409});
  // 3. Se guarda el medio definitivo, NO el cobro.
  const savedMethod=await PAY.confirmPreferred({db,storeId,orderId:id,
   staff,metodo:'transferencia',totalValidado:18000});
  assert.equal(savedMethod.ok,true);
  assert.equal(savedMethod.montoTransferencia,18000);
  assert.equal(state.ledger,null);
  assert.equal(state.payment,null);
  opened=await S.verifyCustomer({db,token:created.token,secret,nowSeconds:NOW+1});
  view=await S.snapshot({db,order:opened.order,bank,chatSecret});
  assert.equal(view.estadoPago,'pendiente');
  assert.equal(view.montoTransferencia,18000);
  assert.equal(view.puedeAvisarTransferencia,true);
  assert.equal(view.chatHabilitado,true);
  assert.equal(view.datosBancariosSucursal,storeId);
  // 4. Chat del pedido, no una conversación ni cuenta compartida.
  await S.sendMessage({db,order:opened.order,from:'cliente',body:'¿Está listo?',
   chatSecret});
  await S.sendMessage({db,order:opened.order,from:'agendador',
   body:'En preparación',staff,chatSecret});
  view=await S.snapshot({db,order:opened.order,bank,chatSecret});
  assert.deepEqual(view.mensajes.map(x=>x.texto),['¿Está listo?','En preparación']);
  // 5. El aviso del cliente NO acredita ninguna transferencia.
  const notice=await S.clientNotice({db,order:opened.order,bank});
  assert.equal(notice.status,'avisada');
  view=await S.snapshot({db,order:opened.order,bank,chatSecret});
  assert.equal(view.estadoPago,'avisada');
  assert.equal(view.puedeAvisarTransferencia,false);
  await assert.rejects(()=>TX.commit({db,storeId,orderId:id,action:'confirmar_cobro',
   staff,restoPagoVerificado:true}),{status:409});
  await assert.rejects(()=>TX.commit({db,storeId,orderId:id,action:'entregar',
   staff,restoPagoVerificado:true}),{status:409});
  assert.equal(state.ledger,null,'La caja no se modificó por el aviso');
  await assert.rejects(()=>S.staffConfirm({db,order:opened.order,
   staff,bank,seenBankCredit:false,receivedAmount:18000}),{code:409});
  await assert.rejects(()=>S.staffConfirm({db,order:opened.order,
   staff,bank,seenBankCredit:true,receivedAmount:17000}),{code:409});
  // 6. El único botón de personal simula que vio el monto exacto en banco.
  const confirmation=await S.staffConfirm({db,order:opened.order,staff,bank,
   seenBankCredit:true,receivedAmount:18000});
  assert.equal(confirmation.status,'confirmada');
  assert.equal(state.ledger,null,'Verificar banco no duplica caja');
  assert.equal((await S.clientNotice({db,order:opened.order,bank})).repeated,true);
  view=await S.snapshot({db,order:opened.order,bank,chatSecret});
  assert.equal(view.estadoPago,'confirmada');
  // 7. Solo después: pagado y luego entregado. En el libro de PRUEBAS.
  await assert.rejects(()=>TX.commit({db,storeId,orderId:id,action:'entregar',
   staff,restoPagoVerificado:true}),{status:409});
  const paid=await TX.commit({db,storeId,orderId:id,action:'confirmar_cobro',
   staff,restoPagoVerificado:true});
  assert.equal(paid.estado,'pagado');
  const delivered=await TX.commit({db,storeId,orderId:id,action:'entregar',
   staff,restoPagoVerificado:true});
  assert.equal(delivered.estado,'entregado');
  assert.equal(delivered.revision,2);
  assert.ok(state.queries.every(x=>!/\b(?:UPDATE|INSERT INTO)\s+public\.\w*(?:caja|ventas|timbres)\b/i.test(x.sql)),
   'Jamás se escribe caja, ventas o timbres comerciales');
 });
}
test('el pedido y el token de una sucursal no se reinterpretan como otro local',async()=>{
 const a=build('uki:arica','arica'),b=build('uki:serena','serena');
 const link=await S.issueForRegistered({db:a.db,storeId:'uki:arica',
  orderId:id,requestKey,secret,nowSeconds:NOW});
 await assert.rejects(()=>S.verifyCustomer({db:b.db,token:link.token,
  secret,nowSeconds:NOW+1}),{code:403});
});
