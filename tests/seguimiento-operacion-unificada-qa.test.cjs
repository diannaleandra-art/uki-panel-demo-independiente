'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../lib/seguimiento-operacion-unificada-qa.cjs');
const chat=require('../lib/seguimiento-chat-cifrado-v1.cjs');
const secret='9'.repeat(64),id='621bd292-2153-4160-9e85-375978e10352';
const row={id,branch:'serena',store_id:'romo:serena',estado:'aceptada',codigo_pedido:'S-901',total_indicado:18000,datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:6000}]}};
for(const [storeId,branch] of [['romo:serena','serena'],['uki:serena','serena'],['uki:arica','arica']]){
 test(storeId+' validacion de estado, transferencia, chat y sucursal',()=>{
  const o=p.normalizeOrder(storeId,{...row,branch});
  assert.equal(o.montoTransferencia,12000);
  assert.equal(o.estado,'aceptada');
  const staff={storeId,role:'agendador',userId:'worker-99'};
  const bank={storeId,verified:true,datos:{banco:'Santander',titular:'Demo',cuenta:'123'}};
  assert.equal(p.canIssueLink(storeId,{...row,branch},staff),true);
  assert.equal(p.canIssueLink(storeId,{...row,branch},{...staff,storeId:'otro'}),false);
  assert.equal(p.canClientNotify({order:o,paymentStatus:'pendiente',bank}),true);
  assert.equal(p.canClientNotify({order:o,paymentStatus:'avisada',bank}),false);
  assert.equal(p.canStaffConfirm({order:o,staff,bank,seenBankCredit:true,receivedAmount:12000,transferStatus:'avisada'}),true);
  assert.equal(p.canStaffConfirm({order:o,staff,bank,seenBankCredit:true,receivedAmount:18000,transferStatus:'avisada'}),false);
  assert.equal(p.canStaffConfirm({order:o,staff,bank,seenBankCredit:false,receivedAmount:12000,transferStatus:'avisada'}),false);
  assert.equal(p.canSendMessage({order:o,sender:'cliente',body:'Hola'}),true);
  assert.equal(p.canSendMessage({order:o,sender:'agendador',body:'Listo',staff}),true);
  assert.equal(p.canSendMessage({order:o,sender:'agendador',body:'Listo'}),false);
  assert.equal(p.view({order:o,paymentStatus:'avisada',bank}).estadoPago,'avisada');
  assert.equal(p.view({order:o,paymentStatus:'pendiente',bank}).puedeAvisarTransferencia,true);
  assert.equal(p.view({order:o,paymentStatus:'avisada',bank}).puedeAvisarTransferencia,false);
  assert.equal(p.view({order:o,paymentStatus:'pendiente',bank:{...bank,storeId:'otro'}}).puedeAvisarTransferencia,false);
  assert.equal(p.view({order:o,paymentStatus:'avisada',bank:{...bank,storeId:'otro'}}).datosBancarios,null);
  const sealed=chat.seal({storeId,orderId:id,from:'cliente',body:'¿Está listo?'},secret);
  assert.ok(sealed);
  assert.equal(chat.unseal({storeId,orderId:id,from:'cliente',ciphertext:sealed.mensaje_cifrado,nonce:sealed.nonce},secret),'¿Está listo?');
  assert.equal(chat.unseal({storeId,orderId:id,from:'agendador',ciphertext:sealed.mensaje_cifrado,nonce:sealed.nonce},secret),null);
  const otherStore=storeId==='uki:arica'?'romo:serena':'uki:arica';
  assert.equal(chat.unseal({storeId:otherStore,orderId:id,from:'cliente',ciphertext:sealed.mensaje_cifrado,nonce:sealed.nonce},secret),null);
 });
}
test('no inferir transferencias de texto libre ni de datos incompletos',()=>{
 const o=p.normalizeOrder('uki:serena',{...row,datos:{whatsapp_confirmado:true},store_id:'otro'});
 assert.equal(o.montoTransferencia,null);
 assert.equal(o.pagoSinDeterminar,true);
 assert.equal(p.canClientNotify({order:o,paymentStatus:'pendiente',bank:{storeId:'uki:serena',verified:true}}),false);
 assert.equal(chat.seal({storeId:'uki:serena',orderId:id,from:'cliente',body:'x'.repeat(801)},secret),null);
});


for(const [storeId,branch] of [['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']]){
 test(storeId+' muestra transferencia seleccionada, pero no habilita banco ni aviso antes de validar el medio',()=>{
  const data=storeId==='romo:serena'?
   {origen:'carta-normal',medioPago:'transferencia',cotizacion:{payment:'transferencia'}}:
   {origen:'carta-normal',pagoPreferido:'transferencia',pagoDeclaracion:'cliente_no_verificado'};
  const order=p.normalizeOrder(storeId,{
   id,branch,store_id:storeId,estado:'pendiente',total_indicado:18000,
   codigo_pedido:'QA-TEST',datos:data
  });
  assert.equal(order.pagoSinDeterminar,true);
  assert.equal(order.metodoPago,null);
  assert.equal(order.pagoDeclarado,'transferencia');
  const view=p.view({order,paymentStatus:'pendiente',
   bank:{storeId,verified:true,datos:{banco:'Demo QA',cuenta:'NO MOSTRAR'}}});
  assert.equal(view.pagoDeclarado,'transferencia');
  assert.equal(view.metodoPago,null);
  assert.equal(view.estadoPago,'requiere_revision');
  assert.equal(view.datosBancarios,null);
  assert.equal(view.datosBancariosVerificados,false);
  assert.equal(view.puedeAvisarTransferencia,false);
  assert.equal(view.chatHabilitado,false);
 });
}
