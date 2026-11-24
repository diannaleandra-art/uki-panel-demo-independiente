'use strict';
/* Adaptador SOLO LECTURA. No sustituye cotización real, cobro o estado del panel. */
const shared=require('./seguimiento-tres-sucursales-v1.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS=Object.freeze({
 pendiente:'Esperando confirmación del local',
 aceptada:'Pedido aceptado',
 rechazada:'Solicitud rechazada'
});
function paymentFromSavedData(data,total){
 if(!shared.validMoney(total)||total===0)return null;
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 if(Object.prototype.hasOwnProperty.call(data,'pagos')){
  if(!Array.isArray(data.pagos))return null;
  const transfer=shared.transferDue(data.pagos,total);
  if(transfer===null)return null;
  return {source:'detalle_guardado',transferAmount:transfer,method:data.pagos.length===1?
   shared.normalizeMethod(data.pagos[0]?.medio):'mixto'};
 }
 const method=shared.normalizeMethod(data.medioPago);
 if(!method)return null;
 return {source:'medio_guardado',transferAmount:method==='transferencia'?total:0,method};
}
function prepareStoredRequest({storeId,row}={}){
 const store=shared.store(storeId);
 if(!store||!row||typeof row!=='object'||Array.isArray(row)||
  typeof row.id!=='string'||!UUID.test(row.id)||
  row.branch!==store.branch||!Object.prototype.hasOwnProperty.call(STATUS,row.estado)||
  !Number.isSafeInteger(row.total_indicado)||row.total_indicado<=0||
  row.total_indicado>100000000)return null;
 if(storeId==='romo:serena'&&row.store_id!=='romo:serena')return null;
 // No extraer medios de pago de WhatsApp, comanda, notas ni texto libre.
 const payment=paymentFromSavedData(row.datos,row.total_indicado);
 return Object.freeze({
  storeId,orderId:row.id.toLowerCase(),branch:store.branch,
  estadoPedido:row.estado,descripcionPedido:STATUS[row.estado],
  totalRegistrado:row.total_indicado,
  metodoPago:payment?.method||null,
  montoTransferencia:payment?.transferAmount??null,
  fuentePago:payment?.source||null,
  requiereVerificacionPago:payment===null,
  seguimientoPreparacionDisponible:false,
  mensajeEstado:'Preparación y reparto requieren el estado confirmado del panel; no se infieren de la carta.'
 });
}
module.exports={paymentFromSavedData,prepareStoredRequest};
