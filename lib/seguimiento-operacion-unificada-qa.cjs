'use strict';
/* Reglas del seguimiento: mismas tres sucursales, caja y pagos independientes. */
const {store,transferDue,bankDetailsFor,validMoney,validateChatMessage}=require('./seguimiento-tres-sucursales-v1.cjs');
const {prepareStoredRequest}=require('./seguimiento-solicitudes-fuente-v1.cjs');
function normalizeOrder(storeId,row){
 const order=prepareStoredRequest({storeId,row});
 if(!order)return null;
 return Object.freeze({
  storeId,orderId:order.orderId,branch:order.branch,
  estado:order.estadoPedido,estadoTexto:order.descripcionPedido,
  metodoPago:order.metodoPago,montoTransferencia:order.montoTransferencia,
  pagoSinDeterminar:order.requiereVerificacionPago,
  pagoDeclarado:order.requiereVerificacionPago&&row.datos?.pagoDeclaracion==='cliente_no_verificado'&&
   ['transferencia','efectivo','debito','credito','edenred','junaeb','otro'].includes(row.datos.pagoPreferido)?
   row.datos.pagoPreferido:null,
  codigo:String(row.codigo_pedido||'').slice(0,60),
  total:order.totalRegistrado
 });
}
function canIssueLink(storeId,row,staff){
 const order=normalizeOrder(storeId,row);
 return !!order&&order.estado==='aceptada'&&
  !!staff&&staff.storeId===storeId&&
  ['duenos','agendador'].includes(staff.role)&&
  typeof staff.userId==='string'&&staff.userId.length>=5;
}
function canClientNotify({order,paymentStatus,bank}={}){
 return !!order&&order.estado==='aceptada'&&
  Number.isSafeInteger(order.montoTransferencia)&&order.montoTransferencia>0&&
  bank&&bank.storeId===order.storeId&&bank.verified===true&&
  paymentStatus==='pendiente';
}
function canStaffConfirm({order,staff,bank,seenBankCredit,receivedAmount,transferStatus}={}){
 return !!order&&order.estado==='aceptada'&&
  !!staff&&staff.storeId===order.storeId&&
  ['duenos','agendador'].includes(staff.role)&&
  typeof staff.userId==='string'&&staff.userId.length>=5&&
  bank?.verified===true&&bank.storeId===order.storeId&&
  seenBankCredit===true&&
  Number.isSafeInteger(order.montoTransferencia)&&order.montoTransferencia>0&&
  receivedAmount===order.montoTransferencia&&
  ['avisada','pendiente'].includes(transferStatus);
}
function canSendMessage({order,sender,body,staff}={}){
 if(!order||order.estado!=='aceptada')return false;
 if(sender==='agendador'&&(!staff||staff.storeId!==order.storeId||
    !['duenos','agendador'].includes(staff.role)))return false;
 return !!validateChatMessage({storeId:order.storeId,scope:sender,body});
}
function view({order,paymentStatus,bank,messages=[]}={}){
 if(!order)return null;
 const transfer=Number.isSafeInteger(order.montoTransferencia)&&order.montoTransferencia>0;
 const bankOk=!!bank&&bank.verified===true&&bank.storeId===order.storeId&&transfer&&order.estado==='aceptada'&&paymentStatus!=='requiere_revision';
 const status=paymentStatus==='confirmada'?'Transferencia verificada manualmente':
  paymentStatus==='avisada'?'Transferencia por verificar':
  paymentStatus==='requiere_revision'?'Transferencia requiere revisión del local':
  'Transferencia pendiente';
 return {
  storeId:order.storeId,codigoPedido:order.codigo,estadoPedido:order.estado,
  descripcionPedido:order.estadoTexto,metodoPago:order.metodoPago,
  montoTransferencia:order.montoTransferencia,
  estadoPago:order.pagoSinDeterminar?'requiere_revision':transfer?paymentStatus:'sin_transferencia',
  descripcionPago:order.pagoSinDeterminar?'Medio de pago por verificar':transfer?status:'Sin transferencia registrada',
  datosBancarios:bankOk?bank.datos:null,
  datosBancariosVerificados:bankOk,datosBancariosSucursal:bankOk?order.storeId:null,
  chatHabilitado:order.estado==='aceptada',
  mensajes:messages.slice(-30),
  nota:'Ya transferí sólo avisa. El local debe verificar el abono; no registra una venta.'
 };
}
module.exports={normalizeOrder,canIssueLink,canClientNotify,canStaffConfirm,canSendMessage,view};
