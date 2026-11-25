'use strict';
/*
 * QA aislada: para una solicitud de carta Romo aceptada, valida el abono y
 * guarda la revisión CIFRADA y el estado informativo EN LA MISMA sentencia.
 * No agrega una segunda venta ni descifra la caja. No reemplaza las otras
 * rutas comerciales: la migración autoritativa sigue pendiente.
 */
const S=require('./seguimiento-qa-servidor-v1.cjs');
const STORE='romo:serena';
const fail=(status,message)=>Object.assign(new Error(message),{status,code:status});
function sqlFor(){
 return "WITH pedido AS MATERIALIZED ("+
 " SELECT s.id FROM public.romo_solicitudes_carta_v1 s"+
 " WHERE s.id=$1::uuid AND s.store_id=$2 AND s.branch='serena' AND s.estado='aceptada'"+
 " AND s.total_indicado=$3::integer AND s.datos=$4::jsonb"+
 " AND COALESCE((s.datos->'seguimientoGuardado'->>'revision')::bigint,0)<=$5::bigint"+
 " AND (($9::text='Pendiente' AND COALESCE(s.datos->'seguimientoGuardado'->>'pagado','false')='false'"+
 " AND COALESCE(s.datos->'seguimientoGuardado'->>'estado','Pendiente')='Pendiente')"+
 " OR ($9::text='Entregado' AND s.datos->'seguimientoGuardado'->>'estado'='Pendiente'"+
 " AND s.datos->'seguimientoGuardado'->>'pagado'='true'"+
 " AND s.datos->'seguimientoGuardado'->>'total'=$3::text"+
 " AND s.datos->'seguimientoGuardado'->>'montoTransferencia'=$8::text))"+
 " FOR UPDATE OF s"+
 "), abono AS MATERIALIZED ("+
 " SELECT t.solicitud_id FROM public.romo_seguimiento_transferencia_v1 t JOIN pedido p ON p.id=t.solicitud_id"+
 " WHERE t.store_id=$2 AND t.estado_pago='confirmada' AND t.monto_transferencia=$8::integer"+
 " AND t.confirmada_en IS NOT NULL AND t.abono_verificado_en IS NOT NULL"+
 " AND length(trim(t.confirmada_por))>=2 AND t.confirmada_por NOT LIKE 'QA_SIMULACION:%'"+
 " FOR SHARE OF t"+
 "), elegible AS ("+
 " SELECT p.id FROM pedido p WHERE $8::integer=0 OR EXISTS(SELECT 1 FROM abono a WHERE a.solicitud_id=p.id)"+
 "), caja AS ("+
 " UPDATE public.romo_estado_operativo_v1 v SET revision=v.revision+1,snapshot=$6::jsonb,"+
 " actualizado_por=$7,actualizado_en=now() FROM elegible e"+
 " WHERE v.store_id=$2 AND v.revision=$5::bigint RETURNING v.revision,e.id"+
 "), estado AS ("+
 " UPDATE public.romo_solicitudes_carta_v1 s SET datos=s.datos||jsonb_build_object('seguimientoGuardado',"+
 " jsonb_build_object('revision',c.revision,'estado',$9::text,'pagado',true,'total',$3::integer,"+
 " 'montoTransferencia',$8::integer,'por',$7::text)),actualizado_en=now()"+
 " FROM caja c WHERE s.id=c.id AND s.store_id=$2 AND s.branch='serena' RETURNING s.id,c.revision"+
 ") SELECT id,revision FROM estado";
}
async function save({db,staff,orderId,action,expectedRevision,snapshot,restoPagoVerificado}={}){
 if(!db||typeof db.query!=='function'||!staff||staff.storeId!==STORE||
    staff.revisionOnly===true||!['duenos','agendador'].includes(staff.role)||
    typeof staff.userId!=='string'||!staff.userId||staff.userId.startsWith('QA_SIMULACION:'))
  throw fail(403,'Personal Romo no autorizado');
 if(!['confirmar_cobro','entregar'].includes(action)||restoPagoVerificado!==true||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=1000000000)
  throw fail(400,'Revisa la revisión y el pago del pedido');
 const order=await S.loadOne(db,STORE,orderId);
 if(!order||order.estado!=='aceptada'||order.pagoSinDeterminar||
    !Number.isSafeInteger(order.total)||order.total<1||
    !Number.isSafeInteger(order.montoTransferencia)||order.montoTransferencia<0||
    typeof order.snapshotDatos!=='string')
  throw fail(409,'Pedido Romo sin importe y medio validados');
 // Un nuevo número de revisión tampoco permite repetir el mismo cobro.
 if(action==='confirmar_cobro'&&(order.seguimientoGuardado?.pagado===true||
    ['Entregado','Cancelado'].includes(order.seguimientoGuardado?.estado)))
  throw fail(409,'El pedido ya tiene pago o finalización registrados');
 // Entrega no puede convertirse en un primer cobro.
 if(action==='entregar'){
  const saved=order.seguimientoGuardado;
  if(!saved||saved.pagado!==true||saved.total!==order.total||
     saved.montoTransferencia!==order.montoTransferencia||saved.estado!=='Pendiente')
   throw fail(409,'Registra primero el pago habitual');
 }
 const vault=await import('./romo-estado-cifrado-persistencia-qa.mjs');
 const encrypted=vault.validarSobreCifradoRomoQA(snapshot);
 const rows=await db.query(sqlFor(),[order.orderId,STORE,order.total,order.snapshotDatos,
  expectedRevision,encrypted,staff.userId,order.montoTransferencia,action==='entregar'?'Entregado':'Pendiente']);
 if(!Array.isArray(rows)||rows.length!==1||Number(rows[0].revision)!==expectedRevision+1)
  throw fail(409,'No se guardó: revisión, pedido o transferencia sin verificar');
 return {ok:true,soloQA:true,storeId:STORE,orderId:order.orderId,revision:Number(rows[0].revision),
  estado:action==='entregar'?'entregado':'pagado',nota:'Caja cifrada y seguimiento guardados conjuntamente en QA'};
}
module.exports={sqlFor,save};
