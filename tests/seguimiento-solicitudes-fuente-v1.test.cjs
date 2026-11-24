'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {paymentFromSavedData,prepareStoredRequest}=require('../lib/seguimiento-solicitudes-fuente-v1.cjs');
const id='621bd292-2153-4160-9e85-375978e10352';
const row=(branch='serena')=>({id,store_id:'romo:serena',branch,estado:'aceptada',
 total_indicado:16000,datos:{medioPago:'transferencia'}});
test('Romo: sólo usa transferencia guardada como dato estructurado',()=>{
 const s=prepareStoredRequest({storeId:'romo:serena',row:row()});
 assert.equal(s.montoTransferencia,16000);
 assert.equal(s.estadoPedido,'aceptada');
 assert.equal(s.seguimientoPreparacionDisponible,false);
 assert.equal(prepareStoredRequest({storeId:'romo:serena',row:{...row(),store_id:'uki:serena'}}),null);
});
test('Uki Arica y La Serena no inventan medio de pago histórico',()=>{
 for(const [storeId,branch] of [['uki:arica','arica'],['uki:serena','serena']]){
  const r={...row(branch),datos:{origen:'carta-normal',whatsapp_confirmado:false}};
  const s=prepareStoredRequest({storeId,row:r});
  assert.equal(s.montoTransferencia,null);
  assert.equal(s.metodoPago,null);
  assert.equal(s.requiereVerificacionPago,true);
  assert.equal(prepareStoredRequest({storeId,row:{...r,branch:branch==='arica'?'serena':'arica'}}),null);
 }
});
test('pago mixto sólo contabiliza componente transferencia verificado',()=>{
 const data={pagos:[{medio:'transferencia',monto:9000},{medio:'débito',monto:7000}]};
 const s=prepareStoredRequest({storeId:'uki:serena',row:{...row(),datos:data}});
 assert.equal(s.metodoPago,'mixto');
 assert.equal(s.montoTransferencia,9000);
 assert.equal(paymentFromSavedData({pagos:[{medio:'transferencia',monto:9000}]},16000),null);
 assert.equal(paymentFromSavedData({pagos:'transferencia',medioPago:'transferencia'},16000),null);
});
test('mensaje, comanda o comprobante de cliente no demuestran transferencia',()=>{
 const s=prepareStoredRequest({storeId:'uki:arica',row:{
  ...row('arica'),datos:{mensaje:'Transferí 16000',whatsapp_confirmado:true}
 }});
 assert.equal(s.requiereVerificacionPago,true);
 assert.equal(s.montoTransferencia,null);
 assert.equal(prepareStoredRequest({storeId:'uki:arica',row:{...row('arica'),estado:'en_camino'}}),null);
});


test('Romo: la transferencia elegida por el cliente no es una validación de personal',()=>{
 const source={...row(),datos:{origen:'carta-normal',medioPago:'transferencia',
  cotizacion:{payment:'transferencia'}}};
 const pedido=prepareStoredRequest({storeId:'romo:serena',row:source});
 assert.equal(pedido.montoTransferencia,null);
 assert.equal(pedido.requiereVerificacionPago,true);
 assert.equal(pedido.metodoPago,null);
});
test('Carta digital: sólo después de validar trabajador, fecha y total se autoriza el método',()=>{
 const datos={origen:'carta-normal',medioPago:'transferencia',
  medioPagoConfirmadoPor:'qa-worker-123',medioPagoConfirmadoTotal:16000,
  medioPagoConfirmadoEn:'2026-11-24T12:00:00Z'};
 const pedido=prepareStoredRequest({storeId:'romo:serena',row:{...row(),datos}});
 assert.equal(pedido.montoTransferencia,16000);
 assert.equal(pedido.requiereVerificacionPago,false);
 assert.equal(paymentFromSavedData({...datos,medioPagoConfirmadoTotal:15000},16000),null);
 assert.equal(paymentFromSavedData({...datos,medioPagoConfirmadoPor:''},16000),null);
 assert.equal(paymentFromSavedData({...datos,medioPagoConfirmadoEn:'invalida'},16000),null);
});
test('Los desgloses mixtos que llegaron desde la carta también requieren personal',()=>{
 const pagos=[{medio:'transferencia',monto:8000},{medio:'efectivo',monto:8000}];
 assert.equal(paymentFromSavedData({origen:'carta-normal',pagos},16000),null);
 assert.equal(paymentFromSavedData({origen:'carta-normal',pagos,
  medioPagoConfirmadoPor:'qa-worker-123',medioPagoConfirmadoTotal:16000,
  medioPagoConfirmadoEn:'2026-11-24T12:00:00Z'},16000).transferAmount,8000);
});
