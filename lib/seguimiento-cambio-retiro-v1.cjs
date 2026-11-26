'use strict';
// Corrección operativa antes del cobro: no rectifica un abono, no escribe caja.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/i;
const fail=(code,message)=>Object.assign(Error(message),{code});
// Los importes originales de cierta carta histórica solo están en la comanda.
// No aceptar un valor de envío declarado exclusivamente por el navegador.
function importesDeliveryOriginal(mensaje){
 if(typeof mensaje!=='string'||mensaje.length>40000)return null;
 const money=(label)=>{
  const p=new RegExp('^[ \\t]*'+label+'[ \\t]*:[ \\t]*\\$?[ \\t]*([0-9][0-9.,]*)[ \\t]*\\r?$','gim');
  const matches=[...mensaje.matchAll(p)];
  return matches.length===1&&/^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+)$/.test(matches[0][1])?
   Number(matches[0][1].replace(/[^\d]/g,'')):null;
 };
 const modalidad=[...mensaje.matchAll(/^[ \t]*\*?ENTREGA\*?[ \t]*\r?\n[ \t]*(Delivery|Retiro|Consumo en local)[ \t]*\r?$/gim)];
 if(modalidad.length!==1||modalidad[0][1].toLowerCase()!=='delivery')return null;
 const productos=money('Total[ \\t]+productos'),delivery=money('Delivery'),total=money('(?:Total[ \\t]+con[ \\t]+delivery|Total[ \\t]+pedido|Total)');
 if(![productos,delivery,total].every(n=>Number.isSafeInteger(n)&&n>0&&n<=100000000)||productos+delivery!==total)return null;
 return {productos,delivery,total};
}
function plan({order,actor,body,detail}){
 const {id,pedidoInterno,totalAnterior,delivery,totalValidado}=body;
 if(!order||order.orderId!==id||!UUID.test(id)||actor?.storeId!==order.storeId||
  !['duenos','agendador'].includes(actor.role)||typeof actor.userId!=='string'||actor.userId.length<5||
  !/^[1-9][0-9]{0,11}$/.test(String(pedidoInterno)))throw fail(403,'Identidad de pedido no autorizada.');
 if(![totalAnterior,delivery,totalValidado].every(Number.isSafeInteger)||totalAnterior>100000000||delivery<=0||
  totalValidado<=0||totalAnterior!==totalValidado+delivery||!detail)
  throw fail(400,'El nuevo total debe ser el original menos el delivery.');
 let data;try{data=JSON.parse(order.snapshotDatos)}catch{throw fail(409,'Datos del pedido incompletos.')}
 if(order.estado!=='aceptada'||data.origen!=='carta-normal'||data.seguimientoGuardado?.pagado===true||
  ['Entregado','Cancelado'].includes(data.seguimientoGuardado?.estado)||order.enCamino===true)
  throw fail(409,'Solo se puede cambiar a retiro un pedido aceptado antes del cobro y del despacho.');
 const before=data.cambioRetiroSinAbonoV1;
 if(before){
  const repeated=before.pedidoInterno===String(pedidoInterno)&&before.totalAnterior===totalAnterior&&
   before.delivery===delivery&&before.totalNuevo===totalValidado&&before.montoTransferencia===detail.montoTransferencia&&
   JSON.stringify(data.pagos)===JSON.stringify(detail.pagos)&&order.total===totalValidado;
  if(!repeated)throw fail(409,'Ya existe una corrección de retiro distinta; actualiza el pedido.');
  return {repeated:true,receipt:before};
 }
 if(order.modalidad&&order.modalidad!=='delivery')throw fail(409,'La solicitud no tiene modalidad delivery.');
 if(data.subtotal!==totalValidado||data.reparto!==delivery)throw fail(409,'La cotización original no coincide con este cambio de retiro.');
 if(order.total!==totalAnterior)throw fail(409,'El total original cambió. Actualiza el pedido.');
 return {repeated:false,receipt:{pedidoInterno:String(pedidoInterno),totalAnterior,delivery,totalNuevo:totalValidado,
  montoTransferencia:detail.montoTransferencia,pagoAnterior:{medio:data.medioPago??null,pagos:data.pagos??null,totalConfirmado:data.medioPagoConfirmadoTotal??null},por:actor.userId,en:new Date().toISOString()}};
}
async function apply({db,meta,order,actor,body,detail}){
 const p=plan({order,actor,body,detail});
 const id=body.id,storeId=order.storeId,internal=String(body.pedidoInterno);
 const identity=await db.query("SELECT pedido_interno,mensaje FROM "+meta.source+" WHERE id=$1::uuid AND branch=$2 AND pedido_interno=$3 AND store_id=$4 AND estado='aceptada' LIMIT 1",[id,meta.branch,internal,storeId]);
 if(identity.length!==1||identity[0].pedido_interno!==internal)throw fail(409,'La carta no corresponde al pedido interno.');
 const original=importesDeliveryOriginal(identity[0].mensaje);
 if(!original||original.total!==body.totalAnterior||original.delivery!==body.delivery||original.productos!==body.totalValidado)
  throw fail(409,'El valor del envío no coincide con el pedido original de la carta.');
 if(p.repeated)return {ok:true,storeId,orderId:id,repeated:true,cambioRetiro:p.receipt};
 const method=detail.montoOtroLocal>0?(detail.pagos.length?'mixto':'otro'):detail.pagos.length===1?detail.pagos[0].medio:'mixto';
 const rows=await db.query("UPDATE "+meta.source+" s SET total_indicado=$4,datos=s.datos||jsonb_build_object('modalidad','retiro','cambioRetiroSinAbonoV1',$5::jsonb,'pagos',$6::jsonb,'medioPago',$7::text,'medioPagoConfirmadoPor',$8::text,'medioPagoConfirmadoTotal',$4::integer,'medioPagoConfirmadoEn',now(),'montoOtroLocalSeguimiento',$9::integer,'propinaTransferenciaSeguimiento',$10::integer),actualizado_en=now()"+
 " WHERE s.id=$1::uuid AND s.branch=$2 AND s.store_id=$13 AND s.pedido_interno=$3 AND s.estado='aceptada' AND s.total_indicado=$11 AND s.datos=$12::jsonb"+
 " AND s.mensaje=$14 AND NOT EXISTS(SELECT 1 FROM "+meta.payment+" t WHERE t.solicitud_id=s.id AND t.store_id=$13 ) RETURNING id",
 [id,meta.branch,internal,body.totalValidado,JSON.stringify(p.receipt),JSON.stringify(detail.pagos),method,actor.userId,detail.montoOtroLocal,detail.propinaTransferencia,body.totalAnterior,order.snapshotDatos,storeId,identity[0].mensaje]);
 if(rows.length!==1)throw fail(409,'Hay una transferencia avisada, registrada o un cambio simultáneo. Revisa el abono antes de editar.');
 return {ok:true,storeId,orderId:id,repeated:false,cambioRetiro:p.receipt};
}
module.exports={plan,apply,importesDeliveryOriginal};
