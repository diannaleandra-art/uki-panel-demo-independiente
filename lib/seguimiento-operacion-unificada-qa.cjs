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
  // Mostrar la elección inicial en la bandeja, pero sin atribuirle
  // validación de importe, abono ni pago.
  pagoDeclarado:order.requiereVerificacionPago?
   (['transferencia','efectivo','debito','credito','edenred','junaeb','otro'].includes(row.datos?.pagoPreferido)?
    row.datos.pagoPreferido:
    row.datos?.origen==='carta-normal'&&
    ['transferencia','efectivo','debito','credito','edenred','junaeb','otro'].includes(row.datos?.medioPago)?
    row.datos.medioPago:null):null,
  codigo:String(row.codigo_pedido||'').slice(0,60),
  total:order.totalRegistrado,
  // Instantánea del dato de pago realmente guardado. Se compara contra
  // Neon EN LA MISMA escritura para impedir confirmaciones de datos antiguos.
  seguimientoGuardado:row.datos?.seguimientoGuardado||null,
  snapshotDatos:JSON.stringify(row.datos)
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
 return !!order&&['pendiente','aceptada'].includes(order.estado)&&
  Number.isSafeInteger(order.montoTransferencia)&&order.montoTransferencia>0&&
  !!bank&&bank.storeId===order.storeId&&bank.verified===true&&
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
/*
 * Protección de cierre NORMAL de un pedido. No actúa sobre una caja global.
 * Esta validación debe integrarse en la MISMA transacción que guarde
 * "Entregado/finalizado": una comprobación visual por sí sola no es suficiente.
 * Rechazo, devolución y rectificación tienen rutas auditadas distintas.
 */
function canFinishNormally({order,transferStatus,paidRecorded,allMethodsReconciled}={}){
 if(!order||!store(order.storeId)||order.estado!=='aceptada'||order.pagoSinDeterminar||
    paidRecorded!==true||allMethodsReconciled!==true)return false;
 if(!Number.isSafeInteger(order.montoTransferencia)||order.montoTransferencia<0)return false;
 if(order.montoTransferencia>0&&transferStatus!=='confirmada')return false;
 return true;
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
 const saved=order.seguimientoGuardado;
 const validSaved=order.estado==='aceptada'&&!!saved&&Number.isSafeInteger(saved.revision)&&saved.revision>0&&
  typeof saved.pagado==='boolean'&&saved.total===order.total&&saved.montoTransferencia===order.montoTransferencia&&
  !order.pagoSinDeterminar&&['Pendiente','Entregado','Cancelado'].includes(saved.estado)&&
  (saved.estado==='Cancelado'||!transfer||(!saved.pagado&&saved.estado!=='Entregado')||paymentStatus==='confirmada');
 const customerState=validSaved&&saved.estado==='Entregado'?'entregada':validSaved&&saved.estado==='Cancelado'?'cancelada':order.estado;
 const bankOk=!!bank&&bank.verified===true&&bank.storeId===order.storeId&&transfer&&['pendiente','aceptada'].includes(customerState)&&!['requiere_revision','confirmada'].includes(paymentStatus);
 const status=paymentStatus==='confirmada'?'Transferencia verificada manualmente':
  paymentStatus==='avisada'?'Transferencia por verificar':
  paymentStatus==='requiere_revision'?'Transferencia requiere revisión del local':
  'Transferencia pendiente';
 return {
  storeId:order.storeId,codigoPedido:order.codigo,estadoPedido:customerState,
  descripcionPedido:customerState==='entregada'?'Pedido entregado':customerState==='cancelada'?'Pedido cancelado':order.estadoTexto,
  pagoRegistrado:!!(validSaved&&saved.pagado&&saved.estado!=='Cancelado'),metodoPago:order.metodoPago,
  // Solo presenta la elección original; NO confirma un medio ni un abono.
  pagoDeclarado:order.pagoDeclarado,
  montoTransferencia:order.montoTransferencia,
  estadoPago:order.pagoSinDeterminar?'requiere_revision':transfer?paymentStatus:'sin_transferencia',
  descripcionPago:order.pagoSinDeterminar?'Medio de pago por verificar':transfer?status:'Sin transferencia registrada',
  datosBancarios:bankOk?bank.datos:null,
  datosBancariosVerificados:bankOk,datosBancariosSucursal:bankOk?order.storeId:null,
  // La carta muestra «Ya transferí» únicamente si el servidor lo autoriza.
  puedeAvisarTransferencia:customerState===order.estado&&canClientNotify({order,paymentStatus,bank}),
  chatHabilitado:order.estado==='aceptada',
  mensajes:messages.slice(-30),
  nota:'Ya transferí sólo avisa. El local debe verificar el abono; no registra una venta.'
 };
}
module.exports={normalizeOrder,canIssueLink,canClientNotify,canStaffConfirm,canFinishNormally,canSendMessage,view};
