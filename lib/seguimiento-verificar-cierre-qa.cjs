'use strict';
/**
 * Guardia de consulta para cerrar un pedido EN QA. Se consulta siempre la base
 * de la sucursal. No escribe caja ni pedido, no autoriza pagos por sí misma.
 *
 * No confundir con un bloqueo transaccional de producción: ese requiere que
 * la verificación y el guardado del pedido sean una sola operación en servidor.
 */
const S=require('./seguimiento-qa-servidor-v1.cjs');
const {store}=require('./seguimiento-tres-sucursales-v1.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function verdict({order,paymentState,requiereTransferencia=false}={}){
 if(!order||!store(order.storeId)||order.estado!=='aceptada')
  return {permitido:false,razon:'Pedido no aceptado o de otra sucursal'};
 if(order.pagoSinDeterminar===true||
    !Number.isSafeInteger(order.montoTransferencia)||order.montoTransferencia<0)
  return {permitido:false,razon:'El medio o monto de transferencia requiere revisión'};
 if(order.montoTransferencia===0)
  return requiereTransferencia?
   {permitido:false,razon:'El panel informa transferencia pero el pedido registrado no coincide; revisa el pago'}:
   {permitido:true,razon:'Este pedido no registra transferencia; se aplican los controles habituales de caja'};
 // No permitir que se cambie el método mostrado a efectivo/tarjeta para
 // saltar una transferencia que sigue registrada en la fuente del servidor.
 if(requiereTransferencia!==true)
  return {permitido:false,razon:'La solicitud registra transferencia, pero el panel muestra otro medio. Revisa y guarda el medio correcto antes de cerrar'};
 if(paymentState!=='confirmada')
  return {permitido:false,razon:paymentState==='avisada'?
   'El cliente avisó que transfirió. Revisa el abono antes de finalizar':
   'Transferencia pendiente de verificación en el banco'};
 return {permitido:true,razon:'Transferencia verificada por personal autorizado'};
}
async function check({db,storeId,orderId,requiereTransferencia=false,legacyBefore=null}={}){
 if(!db||typeof db.query!=='function'||!S.TABLES[storeId]||
    typeof orderId!=='string'||!UUID.test(orderId))
  return {permitido:false,razon:'No se pudo identificar el pedido y su sucursal'};
 const order=await S.loadOne(db,storeId,orderId);
 if(!order)return {permitido:false,razon:'Pedido no encontrado en su sucursal'};
 // Compatibilidad exclusivamente para pedidos anteriores al lanzamiento.
 // Nunca se concede la excepción por un error de red, un enlace vencido
 // o revocado, ni cuando existe una constancia de transferencia.
 const cutoff=typeof legacyBefore==='string'?Date.parse(legacyBefore):NaN;
 if(Number.isFinite(cutoff)&&cutoff<=Date.now()&&order.estado==='aceptada'){
  const m=S.TABLES[storeId];
  const rows=await db.query(
   'SELECT s.id FROM '+m.source+' s WHERE s.id=$1::uuid AND s.branch=$3'+
   (m.uki?" AND $2::text='uki:'||s.branch":' AND s.store_id=$2')+
   " AND s.estado='aceptada' AND s.creado_en<$4::timestamptz"+
   ' AND NOT EXISTS (SELECT 1 FROM '+m.link+' l WHERE l.solicitud_id=s.id)'+
   ' AND NOT EXISTS (SELECT 1 FROM '+m.payment+' t WHERE t.solicitud_id=s.id) LIMIT 1',
   [orderId,storeId,m.branch,new Date(cutoff).toISOString()]);
  if(Array.isArray(rows)&&rows.length===1&&String(rows[0].id)===orderId){
   const declaraTransferencia=order.pagoDeclarado==='transferencia'||order.montoTransferencia>0;
   if(!requiereTransferencia&&declaraTransferencia)
    return {permitido:false,razon:'El pedido anterior declara transferencia; revisa el medio real antes de finalizar'};
   return {permitido:!requiereTransferencia,sinEnlaceAnterior:true,
    requiereConfirmacionManual:requiereTransferencia,
    razon:requiereTransferencia?'Confirma el abono exacto en el pedido habitual':'Pedido anterior al seguimiento: conserva el control habitual de caja'};
  }
 }
 const paymentState=await S.paymentState(db,order);
 const result=verdict({order,paymentState,requiereTransferencia});
 // Solo exponer el total y el importe ya consultados a personal autorizado.
 return result.permitido?{...result,total:order.total,montoTransferencia:order.montoTransferencia}:result;
}
module.exports={verdict,check};
