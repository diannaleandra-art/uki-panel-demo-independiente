'use strict';
/*
 * Guardado financiero AUTORITATIVO para QA, no para el snapshot cifrado.
 * Una única sentencia SQL registra pagado/entregado y verifica EN EL MISMO
 * statement el estado bancario confirmado, monto, pedido y sucursal.
 * Aún NO sincroniza la caja comercial: NO activar antes de migrar su fuente
 * de verdad y cerrar todas las rutas de escritura antigua.
 */
const S=require('./seguimiento-qa-servidor-v1.cjs');
const OP=require('./seguimiento-operacion-unificada-qa.cjs');
const LEDGERS=Object.freeze({
 'uki:arica':'public.uki_seguimiento_finalizacion_qa_v1',
 'uki:serena':'public.uki_seguimiento_finalizacion_qa_v1',
 'romo:serena':'public.romo_seguimiento_finalizacion_qa_v1'
});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['confirmar_cobro','entregar']);
const fail=(status,message)=>Object.assign(new Error(message),{status});
function sqlFor(storeId){
 const m=S.TABLES[storeId],ledger=LEDGERS[storeId];
 if(!m||!ledger)return null;
 const sourceCheck=m.uki?'':' AND s.store_id=$2';
 const paymentCheck=m.uki?' AND t.branch=$3':'';
 return (
  'WITH source_order AS ( '+
  ' SELECT s.id FROM '+m.source+' s '+
  " WHERE s.id=$1::uuid AND s.branch=$3 AND s.estado='aceptada'"+
  sourceCheck+' AND s.total_indicado=$4::integer AND s.datos=$5::jsonb '+
  ' FOR UPDATE OF s '+
  '), bank_verified AS ( '+
  ' SELECT ($6::integer=0 OR EXISTS ( '+
  ' SELECT 1 FROM '+m.payment+' t '+
  ' WHERE t.solicitud_id=$1::uuid AND t.store_id=$2'+paymentCheck+
  " AND t.estado_pago='confirmada' AND t.monto_transferencia=$6"+
  ' AND t.confirmada_en IS NOT NULL AND t.abono_verificado_en IS NOT NULL '+
  " AND length(trim(t.confirmada_por))>=2"+
  ' )) AS verified '+
  '), guarded_write AS ( '+
  ' INSERT INTO '+ledger+
  ' (solicitud_id,store_id,branch,total_pedido,monto_transferencia,estado,'+
  ' pago_confirmado_por,pago_confirmado_en,entregado_por,entregado_en) '+
  " SELECT s.id,$2,$3,$4,$6,CASE WHEN $7='confirmar_cobro' THEN 'pagado' ELSE 'entregado' END,"+
  ' $8,now(),'+
  " CASE WHEN $7='entregar' THEN $8 ELSE NULL END,"+
  " CASE WHEN $7='entregar' THEN now() ELSE NULL END"+
  ' FROM source_order s CROSS JOIN bank_verified b '+
  ' WHERE b.verified AND ( '+ 
  " $7='confirmar_cobro' OR EXISTS( SELECT 1 FROM "+ledger+
  ' prior WHERE prior.solicitud_id=s.id AND prior.store_id=$2 '+
  " AND prior.branch=$3 AND prior.estado='pagado'"+
  ' AND prior.total_pedido=$4 AND prior.monto_transferencia=$6 ) ) '+
  ' ON CONFLICT (solicitud_id) DO UPDATE SET '+
  ' estado=EXCLUDED.estado, entregado_por=EXCLUDED.entregado_por,'+
  ' entregado_en=EXCLUDED.entregado_en, revision='+ledger+'.revision+1 '+
  ' WHERE '+ledger+'.store_id=$2 AND '+ledger+'.branch=$3 '+
  ' AND '+ledger+'.total_pedido=$4 AND '+ledger+'.monto_transferencia=$6 '+
  " AND "+ledger+".estado='pagado' AND EXCLUDED.estado='entregado'"+
  ' RETURNING estado,revision,solicitud_id '+
  ') SELECT estado,revision,solicitud_id FROM guarded_write'
 );
}
async function loadSource(db,storeId,orderId){
 const m=S.TABLES[storeId];
 if(!m||!UUID.test(orderId))return null;
 const query='SELECT id,branch,estado,datos,total_indicado,codigo_pedido,'+
  (m.uki?'NULL::text AS store_id':'store_id')+
  ' FROM '+m.source+' WHERE id=$1::uuid AND branch=$2'+
  (m.uki?'':' AND store_id=$3')+' LIMIT 1';
 const rows=await db.query(query,m.uki?[orderId,m.branch]:[orderId,m.branch,storeId]);
 if(rows.length!==1)return null;
 return rows[0];
}
async function commit({db,storeId,orderId,action,staff,restoPagoVerificado=false}={}){
 const m=S.TABLES[storeId];
 if(!m||!LEDGERS[storeId]||!UUID.test(String(orderId||''))||!ACTIONS.has(action))
  throw fail(400,'Pedido o acción inválida');
 if(!db||typeof db.query!=='function'||!staff||staff.storeId!==storeId||
    !['duenos','agendador'].includes(staff.role)||
    typeof staff.userId!=='string'||staff.userId.length<3)
  throw fail(403,'Personal sin permiso para confirmar cobros');
 // El resto de los medios mantiene su revisión habitual por la agendadora.
 if(restoPagoVerificado!==true)throw fail(409,'Revisa también los demás medios de pago');
 const row=await loadSource(db,storeId,orderId);
 const order=row?OP.normalizeOrder(storeId,row):null;
 if(!order||order.estado!=='aceptada'||order.pagoSinDeterminar||
    !Number.isSafeInteger(order.montoTransferencia)||order.montoTransferencia<0)
  throw fail(409,'Medio o monto de pago no verificado en el pedido');
 const total=order.total,transfer=order.montoTransferencia;
 const body=typeof row.datos==='string'?JSON.parse(row.datos):row.datos;
 // Siempre se vuelve a validar fuente, suma y estado bancario en SQL.
 const args=[orderId,storeId,m.branch,total,JSON.stringify(body),transfer,action,staff.userId];
 const saved=await db.query(sqlFor(storeId),args);
 if(!Array.isArray(saved)||saved.length!==1)
  throw fail(409,'Transferencia sin comprobar, pedido modificado o acción ya registrada');
 if(saved[0].estado!==(action==='confirmar_cobro'?'pagado':'entregado'))
  throw fail(503,'Guardado no confirmado');
 return Object.freeze({
  ok:true,soloQA:true,storeId,orderId,estado:saved[0].estado,
  revision:Number(saved[0].revision),nota:'Registro QA en servidor. Sin modificar caja comercial.'
 });
}
module.exports={LEDGERS,sqlFor,loadSource,commit};
