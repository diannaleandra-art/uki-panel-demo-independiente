'use strict';
/*
 * SOLO QA: confirma la forma de pago elegida POR EL PERSONAL de esta sucursal,
 * sin marcar "pagado" ni tocar caja. Se invocaría desde el guardado habitual,
 * NO desde una pantalla nueva. No ejecutar sobre pedidos comerciales.
 */
const S=require('./seguimiento-qa-servidor-v1.cjs');
const METHODS=new Set(['transferencia','efectivo','debito','credito','edenred','junaeb','otro']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const fail=(status,message)=>Object.assign(new Error(message),{status,code:status});
function queryFor(storeId){
 const m=S.TABLES[storeId];
 if(!m)return null;
 // Una sola UPDATE atómica, con controles de estado, id, local, importe,
 // datos originales y ausencia de cobros/confirmaciones previas.
 return 'UPDATE '+m.source+' s SET datos=s.datos||jsonb_build_object('+
  "'medioPago',$6::text,'medioPagoConfirmadoPor',$7::text,'medioPagoConfirmadoTotal',$4::integer,'medioPagoPreferenciaOriginal',COALESCE(s.datos->>'pagoPreferido',s.datos->>'medioPago',s.datos->'cotizacion'->>'payment'),'medioPagoConfirmadoEn',now()),"+
  'actualizado_en=now()'+
  ' WHERE s.id=$1::uuid AND s.branch=$3'+(m.uki?'':' AND s.store_id=$2')+
  " AND s.estado='aceptada' AND s.total_indicado=$4::integer"+
  ' AND s.datos=$5::jsonb'+
  // El personal puede corregir el medio inicialmente elegido por el cliente.
  // La preferencia original permanece intacta como dato de auditoría.
  " AND (s.datos->>'pagoDeclaracion'='cliente_no_verificado'"+
  " OR s.datos->>'origen'='carta-normal')"+
  " AND NOT(s.datos ? 'pagos')"+
  " AND (NOT(s.datos ? 'medioPago') OR ("+
  " s.datos->>'origen'='carta-normal'"+
  " AND NOT(s.datos ? 'medioPagoConfirmadoPor')"+
  " AND NOT(s.datos ? 'medioPagoConfirmadoTotal')))"+
  ' AND NOT EXISTS (SELECT 1 FROM '+m.payment+' t WHERE t.solicitud_id=s.id'+
  ' AND t.store_id=$2'+(m.uki?' AND t.branch=$3':'')+
  " AND t.estado_pago='confirmada')"+
  (m.live?
   ' AND EXISTS (SELECT 1 FROM '+m.link+' l WHERE l.solicitud_id=s.id AND l.store_id=$2 AND l.branch=$3 AND l.estado=\'active\')':
   ' AND NOT EXISTS (SELECT 1 FROM '+
  (m.uki?'public.uki_seguimiento_finalizacion_qa_v1':'public.romo_seguimiento_finalizacion_qa_v1')+
  ' f WHERE f.solicitud_id=s.id AND f.store_id=$2'+
  (m.uki?' AND f.branch=$3':'')+')')+
  ' RETURNING id,branch,total_indicado,datos';
}
async function confirmPreferred({db,storeId,orderId,staff,metodo,totalValidado}={}){
 const m=S.TABLES[storeId];
 if(!m||!db||typeof db.query!=='function'||!UUID.test(String(orderId||''))||
  !staff||staff.storeId!==storeId||
  !['duenos','agendador'].includes(staff.role)||
  typeof staff.userId!=='string'||staff.userId.length<5)
  throw fail(403,'Personal o pedido no autorizado');
 if(!METHODS.has(metodo)||!Number.isSafeInteger(totalValidado)||totalValidado<=0||totalValidado>100000000)
  throw fail(400,'Medio o importe no válido');
 const order=await S.loadOne(db,storeId,orderId);
 if(!order||order.estado!=='aceptada'||!Number.isSafeInteger(order.total)||
  order.total<1||order.total>100000000||typeof order.snapshotDatos!=='string'||
  order.total!==totalValidado)
  throw fail(409,'Primero acepta y revisa el importe del pedido');
 let stored;try{stored=JSON.parse(order.snapshotDatos)}catch{throw fail(409,'Información del pedido incompleta')}
 if(stored?.medioPago===metodo&&
  (stored?.medioPagoPreferenciaOriginal??null)===
   (stored?.pagoPreferido??stored?.cotizacion?.payment??stored?.medioPagoPreferenciaOriginal??null)&&
  stored?.medioPagoConfirmadoPor===staff.userId&&
  stored?.medioPagoConfirmadoTotal===order.total&&
  order.metodoPago===metodo&&!order.pagoSinDeterminar)
  return {ok:true,repeated:true,storeId,metodo,nota:'Confirmación previa del mismo responsable; no modifica pago'};
 if(!order.pagoSinDeterminar||
  (stored?.pagoDeclaracion!=='cliente_no_verificado'&&stored?.origen!=='carta-normal')||
  Object.hasOwn(stored,'pagos')||
  (Object.hasOwn(stored,'medioPago')&&
   (stored?.origen!=='carta-normal'||Object.hasOwn(stored,'medioPagoConfirmadoPor')||
    Object.hasOwn(stored,'medioPagoConfirmadoTotal'))))
  throw fail(409,'La forma de pago cambió; revísala en el pedido habitual');
 const rows=await db.query(queryFor(storeId),[
  orderId,storeId,m.branch,order.total,order.snapshotDatos,metodo,staff.userId
 ]);
 if(!Array.isArray(rows)||rows.length!==1)
  throw fail(409,'El pedido o la forma de pago cambió. Actualiza antes de guardar');
 return {ok:true,repeated:false,storeId,metodo,
  montoTransferencia:metodo==='transferencia'?order.total:0,
  nota:'Forma de pago validada por personal. No se ha confirmado ni cobrado el abono'};
}
// El medio y distribución declarados por personal no son una confirmación
// de dinero recibido. Reutiliza el pedido original y jamás escribe en caja.
const {normalizeMethod,transferDue}=require('./seguimiento-tres-sucursales-v1.cjs');
function normalizarDistribucion(pagos,total){
 if(!Array.isArray(pagos)||pagos.length<1||pagos.length>8||
    !Number.isSafeInteger(total)||total<1||total>100000000)return null;
 const sum=new Map();
 for(const p of pagos){
  if(!p||Object.keys(p).sort().join('|')!=='medio|monto')return null;
  const medio=normalizeMethod(p.medio),monto=p.monto;
  if(!medio||!Number.isSafeInteger(monto)||monto<1||monto>total)return null;
  sum.set(medio,(sum.get(medio)||0)+monto);
 }
 const result=[...sum].sort(([x],[y])=>x.localeCompare(y)).map(([medio,monto])=>({medio,monto}));
 return transferDue(result,total)!==null?result:null;
}
function queryDistribution(storeId){
 const m=S.TABLES[storeId];
 if(!m)return null;
 // Los avisos y abonos ya registrados no pueden reciclarse para un importe distinto.
 return 'UPDATE '+m.source+' s SET datos=s.datos||jsonb_build_object('+
  "'pagos',$6::jsonb,'medioPago',$7::text,'medioPagoConfirmadoPor',$8::text,'medioPagoConfirmadoTotal',$4::integer,"+
  "'medioPagoPreferenciaOriginal',COALESCE(s.datos->>'medioPagoPreferenciaOriginal',s.datos->>'pagoPreferido',s.datos->>'medioPago',s.datos->'cotizacion'->>'payment'),"+
  "'medioPagoConfirmadoEn',now()),actualizado_en=now()"+
  ' WHERE s.id=$1::uuid AND s.branch=$3'+(m.uki?" AND $2::text='uki:'||s.branch":' AND s.store_id=$2')+
  " AND s.estado='aceptada' AND s.total_indicado=$4::integer AND s.datos=$5::jsonb"+
  " AND (s.datos->>'origen'='carta-normal' OR s.datos->>'pagoDeclaracion'='cliente_no_verificado')"+
  ' AND EXISTS (SELECT 1 FROM '+m.link+' l WHERE l.solicitud_id=s.id AND l.store_id=$2 AND l.branch=$3'+
  " AND l.estado='active' AND l.revocado_en IS NULL AND l.vence_en>now())"+
  ' AND NOT EXISTS (SELECT 1 FROM '+m.payment+' t WHERE t.solicitud_id=s.id)'+
  (m.live?'':' AND NOT EXISTS (SELECT 1 FROM '+(m.uki?'public.uki_seguimiento_finalizacion_qa_v1':'public.romo_seguimiento_finalizacion_qa_v1')+' f WHERE f.solicitud_id=s.id)')+
  ' RETURNING id,branch,total_indicado,datos';
}
async function confirmDistribution({db,storeId,orderId,staff,pagos,totalValidado}={}){
 const m=S.TABLES[storeId];
 if(!m||!db||typeof db.query!=='function'||!UUID.test(String(orderId||''))||
  !staff||staff.storeId!==storeId||!['duenos','agendador'].includes(staff.role)||
  typeof staff.userId!=='string'||staff.userId.length<5)
  throw fail(403,'Personal o pedido no autorizado');
 const distribution=normalizarDistribucion(pagos,totalValidado);
 if(!distribution)throw fail(400,'La suma de los medios de pago debe coincidir con el pedido');
 const method=distribution.length===1?distribution[0].medio:'mixto';
 const amount=transferDue(distribution,totalValidado);
 const order=await S.loadOne(db,storeId,orderId);
 if(!order||order.estado!=='aceptada'||order.total!==totalValidado||typeof order.snapshotDatos!=='string')
  throw fail(409,'Revisa la aceptación y el total del pedido');
 let old;try{old=JSON.parse(order.snapshotDatos)}catch{throw fail(409,'Pedido no disponible')}
 if(old?.origen!=='carta-normal'&&old?.pagoDeclaracion!=='cliente_no_verificado')
  throw fail(409,'La solicitud no corresponde a la carta habitual');
 const previous=!order.pagoSinDeterminar?(Array.isArray(old.pagos)?normalizarDistribucion(old.pagos,order.total):
  normalizarDistribucion([{medio:old.medioPago,monto:order.total}],order.total)):null;
 if(previous&&JSON.stringify(previous)===JSON.stringify(distribution))
  return {ok:true,repeated:true,storeId,metodo:method,montoTransferencia:amount};
 if(previous&&order.montoTransferencia>0&&amount===0)
  throw fail(409,'No se puede eliminar una transferencia ya registrada sin revisión autorizada');
 const saved=await db.query(queryDistribution(storeId),[orderId,storeId,m.branch,order.total,
  order.snapshotDatos,JSON.stringify(distribution),method,staff.userId]);
 if(!Array.isArray(saved)||saved.length!==1)throw fail(409,'La distribución cambió o tiene un aviso/abono anterior. Revisa el pedido antes de continuar');
 return {ok:true,repeated:false,storeId,metodo:method,montoTransferencia:amount,
  nota:'Distribución validada. No confirma abono ni registra dinero'};
}
module.exports={confirmPreferred,queryFor,METHODS,normalizarDistribucion,queryDistribution,confirmDistribution};
