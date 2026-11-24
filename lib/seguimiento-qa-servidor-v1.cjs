'use strict';
/*
 * Servidor de seguimiento QA para las tres sucursales. Toda lectura exige
 * token firmado + huella persistida. No modifica cajas, ventas ni timbres.
 * NO utilizar con datos comerciales sin DB aislada y pruebas manuales.
 */
const LINKS=require('./seguimiento-enlaces-seguros-v1.cjs');
const OP=require('./seguimiento-operacion-unificada-qa.cjs');
const CHAT=require('./seguimiento-chat-cifrado-v1.cjs');
const {createHmac,timingSafeEqual}=require('node:crypto');
const TABLES=Object.freeze({
 'uki:arica':Object.freeze({
  branch:'arica',source:'public.uki_carta_solicitudes_live',
  link:'public.uki_seguimiento_enlaces_qa_v1',
  payment:'public.uki_seguimiento_transferencias_qa_v1',
  messages:'public.uki_seguimiento_chat_cifrado_qa_v1',uki:true}),
 'uki:serena':Object.freeze({
  branch:'serena',source:'public.uki_carta_solicitudes_live',
  link:'public.uki_seguimiento_enlaces_qa_v1',
  payment:'public.uki_seguimiento_transferencias_qa_v1',
  messages:'public.uki_seguimiento_chat_cifrado_qa_v1',uki:true}),
 'romo:serena':Object.freeze({
  branch:'serena',source:'public.romo_solicitudes_carta_v1',
  link:'public.romo_seguimiento_enlaces_qa_v1',
  payment:'public.romo_seguimiento_transferencia_v1',
  messages:'public.romo_seguimiento_chat_cifrado_v1',uki:false})
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(code,message)=>Object.assign(new Error(message),{code});
function params(m,id,storeId){return m.uki?[id,storeId,m.branch]:[id,storeId];}
function scope(m,alias=''){return m.uki?' AND '+alias+'branch=$3':'';}
function columns(m){return m.uki?'(solicitud_id,store_id,branch,':'(solicitud_id,store_id,';}
function values(m){return m.uki?'($1::uuid,$2,$3,':'($1::uuid,$2,';}
async function loadOne(db,storeId,orderId){
 const m=TABLES[storeId];
 if(!m||typeof orderId!=='string'||!UUID.test(orderId))return null;
 const rows=await db.query(
  'SELECT id,branch,codigo_pedido,estado,total_indicado,datos,'+
   (m.uki?'NULL::text AS store_id':'store_id')+
  ' FROM '+m.source+' WHERE id=$1::uuid AND branch=$2'+(m.uki?'':' AND store_id=$3')+' LIMIT 1',
  m.uki?[orderId,m.branch]:[orderId,m.branch,storeId]);
 return rows.length===1?OP.normalizeOrder(storeId,rows[0]):null;
}
async function issueAccepted({db,storeId,orderId,staff,secret,nowSeconds}={}){
 const m=TABLES[storeId];if(!m)throw fail(400,'Sucursal inválida');
 const order=await loadOne(db,storeId,orderId);
 if(!order||order.estado!=='aceptada'||!staff||staff.storeId!==storeId||
    !['duenos','agendador'].includes(staff.role)||!staff.userId)
  throw fail(403,'Pedido sin aceptación o personal sin permiso');
 // Se reconstruye el MISMO enlace ya entregado al cliente al registrarse.
 // Nunca se rotará la URL que el cliente guardó al aceptar o reenviar.
 const rows=await db.query('SELECT request_key FROM '+m.source+
  ' WHERE id=$1::uuid AND branch=$2'+(m.uki?'':' AND store_id=$3')+
  " AND estado='aceptada' LIMIT 1",
  m.uki?[orderId,m.branch]:[orderId,m.branch,storeId]);
 if(rows.length!==1)throw fail(404,'Solicitud aceptada no encontrada');
 return issueForRegistered({db,storeId,orderId,
  requestKey:rows[0].request_key,secret,nowSeconds});
}
/*
 * Creación inicial de enlace desde el servidor que acaba de registrar
 * una solicitud. Devuelve token al cliente SOLO si la clave de solicitud
 * larga coincide con la fila real. Así puede dejar la página abierta
 * mientras el local aún no ha aceptado el pedido.
 * No exponer esta función como endpoint GET por folio o teléfono.
 */
async function issueForRegistered({db,storeId,orderId,requestKey,secret,nowSeconds}={}){
 const m=TABLES[storeId];
 if(!m||typeof orderId!=='string'||!UUID.test(orderId)||
  typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{32,100}$/.test(requestKey)||
  typeof secret!=='string'||!/^[0-9a-f]{64}$/i.test(secret))
  throw fail(400,'Solicitud no verificable para seguimiento');
 // El token sale siempre del MISMO registro de solicitud y su clave privada.
 // Ante reintentos, no cambia el enlace que el cliente ya guardó.
 const scopeWhere='s.id=$1::uuid AND s.request_key=$2 AND s.branch=$3'+
  (m.uki?'':' AND s.store_id=$4')+
  " AND s.estado IN ('pendiente','aceptada')";
 const rows=await db.query(
  'SELECT EXTRACT(EPOCH FROM s.creado_en)::bigint AS issued_at FROM '+
  m.source+' s WHERE '+scopeWhere+' LIMIT 1',
  m.uki?[orderId,requestKey,m.branch]:[orderId,requestKey,m.branch,storeId]);
 if(rows.length!==1)throw fail(403,'No se confirmó la solicitud original');
 const issuedAtSeconds=Number(rows[0].issued_at);
 const nonceBytes=createHmac('sha256',Buffer.from(secret,'hex'))
  .update('seguimiento/solicitud/v1/'+storeId+'/'+orderId.toLowerCase()+'/'+requestKey)
  .digest().subarray(0,18);
 const issued=LINKS.issueLink({storeId,orderId,issuedAtSeconds,nonceBytes},secret);
 const check=LINKS.verifyLink(issued.token,secret,{atSeconds:nowSeconds});
 if(!check)throw fail(409,'El enlace de esta solicitud venció; pide uno nuevo al local');
 const params=[orderId,storeId,m.branch,issued.tokenHash,
  issued.issuedAtSeconds,issued.expiresAtSeconds,requestKey];
 const sql='INSERT INTO '+m.link+
  ' (solicitud_id,store_id,branch,token_hash,emitido_en,vence_en,estado,revocado_en) '+
  'SELECT s.id,$2,$3,$4,to_timestamp($5),to_timestamp($6),'+
  "'active',NULL FROM "+m.source+' s WHERE s.id=$1::uuid'+
  ' AND s.request_key=$7 AND s.branch=$3'+
  (m.uki?'':' AND s.store_id=$2')+
  " AND s.estado IN ('pendiente','aceptada')"+
  ' ON CONFLICT (solicitud_id) DO NOTHING RETURNING solicitud_id';
 const saved=await db.query(sql,params);
 if(!saved.length){
  // Si otro dispositivo ya emitió el MISMO enlace, se devuelve.
  // Si una clave distinta emitió un enlace, jamás invalidarlo silenciosamente.
  const existing=await db.query(
   'SELECT token_hash::text AS token_hash,estado,'+
   ' EXTRACT(EPOCH FROM vence_en)::bigint AS expires_at,revocado_en'+
   ' FROM '+m.link+
   ' WHERE solicitud_id=$1::uuid AND store_id=$2 AND branch=$3 LIMIT 1',
   [orderId,storeId,m.branch]);
  const x=existing[0],actualHash=String(x?.token_hash||'');
  if(!x||!/^[0-9a-f]{64}$/i.test(actualHash)||
   !timingSafeEqual(Buffer.from(actualHash,'hex'),Buffer.from(issued.tokenHash,'hex'))||
   x.estado!=='active'||x.revocado_en!=null||
   Number(x.expires_at)!==issued.expiresAtSeconds)
   throw fail(409,'Este pedido ya tiene otro enlace. No se modificó el enlace anterior');
 }
 return {storeId,orderId,token:issued.token,expiresAtSeconds:issued.expiresAtSeconds};
}
async function verifyCustomer({db,token,secret,nowSeconds}={}){
 const validated=LINKS.verifyLink(token,secret,{atSeconds:nowSeconds});
 if(!validated)throw fail(403,'Enlace inválido o vencido');
 const m=TABLES[validated.storeId];
 if(!m)throw fail(403,'Enlace inválido');
 const records=await db.query(
  'SELECT token_hash::text AS "tokenHash",estado AS status,'+
  'EXTRACT(EPOCH FROM vence_en)::bigint AS "expiresAtSeconds",'+
  'revocado_en AS "revokedAt",store_id AS "storeId",solicitud_id::text AS "orderId"'+
  ' FROM '+m.link+' WHERE solicitud_id=$1::uuid AND store_id=$2 AND branch=$3 LIMIT 1',
  [validated.orderId,validated.storeId,m.branch]);
 const record=records[0];
 if(!record||!LINKS.matchesPersistedLink(validated,{
  ...record,expiresAtSeconds:Number(record.expiresAtSeconds)
 },{atSeconds:nowSeconds}))throw fail(403,'Enlace inválido o revocado');
 const order=await loadOne(db,validated.storeId,validated.orderId);
 if(!order)throw fail(404,'Pedido no disponible');
 return {order,meta:m};
}
async function paymentState(db,order){
 const m=TABLES[order.storeId];
 const found=await db.query(
  'SELECT estado_pago,monto_transferencia,cliente_aviso_en,confirmada_en FROM '+m.payment+
  ' WHERE solicitud_id=$1::uuid AND store_id=$2'+scope(m)+' LIMIT 1',
  params(m,order.orderId,order.storeId));
 const row=found[0];
 // Si cambió el total o el medio de pago, nunca se reutiliza una confirmación anterior.
 if(row&&row.monto_transferencia!==order.montoTransferencia)return 'requiere_revision';
 return row?.estado_pago||'pendiente';
}
async function messages(db,order,chatSecret){
 if(!chatSecret||!CHAT.key(chatSecret,order.storeId))return [];
 const m=TABLES[order.storeId];
 const entries=await db.query(
  'SELECT remitente,mensaje_cifrado,nonce,creado_en FROM '+m.messages+
  ' WHERE solicitud_id=$1::uuid AND store_id=$2'+scope(m)+
  ' ORDER BY creado_en DESC,id DESC LIMIT 30',
  params(m,order.orderId,order.storeId));
 return entries.reverse().map(x=>({
  remitente:x.remitente,
  texto:CHAT.unseal({storeId:order.storeId,orderId:order.orderId,from:x.remitente,
   ciphertext:x.mensaje_cifrado,nonce:x.nonce},chatSecret),
  creadoEn:x.creado_en
 })).filter(x=>x.texto!==null);
}
async function snapshot({db,order,bank,chatSecret}={}){
 const state=await paymentState(db,order);
 return OP.view({order,paymentStatus:state,bank,messages:
  await messages(db,order,chatSecret)});
}
async function clientNotice({db,order,bank}={}){
 const m=TABLES[order?.storeId];
 if(!m)throw fail(400,'Sucursal inválida');
 const current=await paymentState(db,order);
 if(!OP.canClientNotify({order,paymentStatus:current,bank})){
  if(current==='avisada'||current==='confirmada')return {status:current,repeated:true};
  throw fail(409,'La transferencia todavía no está disponible para aviso');
 }
 const cols=columns(m)+'monto_transferencia,estado_pago,cliente_aviso_en,actualizado_en)';
 const vals=values(m)+"$"+(m.uki?'4':'3')+",'avisada',now(),now())";
 const result=await db.query(
  'INSERT INTO '+m.payment+' '+cols+' VALUES '+vals+
  ' ON CONFLICT (solicitud_id) DO UPDATE SET estado_pago='+ "'avisada'"+
  ',cliente_aviso_en=COALESCE('+m.payment+'.cliente_aviso_en,now()),actualizado_en=now()'+
  ' WHERE '+m.payment+'.store_id=$2 AND '+m.payment+'.estado_pago='+ "'pendiente'"+
  ' AND '+m.payment+'.monto_transferencia=$'+(m.uki?'4':'3')+
  ' RETURNING estado_pago',
  [...params(m,order.orderId,order.storeId),order.montoTransferencia]);
 if(result.length===0)throw fail(409,'El estado cambió: actualiza el pedido');
 return {status:'avisada',repeated:false};
}
async function staffConfirm({db,order,staff,bank,receivedAmount,seenBankCredit}={}){
 const m=TABLES[order?.storeId];
 if(!m)throw fail(400,'Sucursal inválida');
 const current=await paymentState(db,order);
 if(current==='confirmada')return {status:current,repeated:true};
 if(!OP.canStaffConfirm({order,staff,bank,receivedAmount,seenBankCredit,transferStatus:current}))
  throw fail(409,'Debes verificar abono y monto exacto con tu cuenta bancaria');
 const cols=columns(m)+'monto_transferencia,estado_pago,confirmada_en,confirmada_por,abono_verificado_en,actualizado_en)';
 const amountIndex=m.uki?4:3,actorIndex=m.uki?5:4;
 const vals=values(m)+'$'+amountIndex+","+"'confirmada'"+',now(),$'+actorIndex+',now(),now())';
 const saved=await db.query(
  'INSERT INTO '+m.payment+' '+cols+' VALUES '+vals+
  ' ON CONFLICT (solicitud_id) DO UPDATE SET estado_pago='+ "'confirmada'"+
  ',confirmada_en=now(),confirmada_por=$'+actorIndex+',abono_verificado_en=now(),actualizado_en=now()'+
  ' WHERE '+m.payment+'.store_id=$2 AND '+m.payment+'.estado_pago IN ('+ "'pendiente','avisada'"+')'+
  ' AND '+m.payment+'.monto_transferencia=$'+amountIndex+
  ' RETURNING estado_pago',
  [...params(m,order.orderId,order.storeId),order.montoTransferencia,staff.userId]);
 if(saved.length!==1)throw fail(409,'Confirma nuevamente los datos del pedido');
 return {status:'confirmada',repeated:false,nota:'No se registró automáticamente una venta en caja'};
}
async function sendMessage({db,order,from,body,staff,chatSecret}={}){
 const m=TABLES[order?.storeId];
 if(!m||!chatSecret||!OP.canSendMessage({order,sender:from,body,staff}))
  throw fail(400,'El chat no está permitido para este pedido');
 const count=await db.query(
  'SELECT COUNT(*)::integer AS n FROM '+m.messages+
  ' WHERE solicitud_id=$1::uuid AND store_id=$2'+scope(m)+
  ' AND remitente=$'+(m.uki?'4':'3')+
  " AND creado_en>now()-interval '10 minutes'",
  [...params(m,order.orderId,order.storeId),from]);
 if(Number(count[0]?.n||0)>=(from==='cliente'?10:20))
  throw fail(429,'Demasiados mensajes, intenta luego');
 const sealed=CHAT.seal({storeId:order.storeId,orderId:order.orderId,from,body},chatSecret);
 if(!sealed)throw fail(400,'Mensaje inválido');
 const extra=m.uki?',branch':'';
 const paramsInsert=m.uki?[order.orderId,order.storeId,m.branch,from,sealed.mensaje_cifrado,sealed.nonce]:
  [order.orderId,order.storeId,from,sealed.mensaje_cifrado,sealed.nonce];
 const i=m.uki?4:3;
 const result=await db.query(
  'INSERT INTO '+m.messages+'(solicitud_id,store_id'+extra+
  ',remitente,mensaje_cifrado,nonce) VALUES($1::uuid,$2'+(m.uki?',$3':'')+
  ',$'+i+',$'+(i+1)+',$'+(i+2)+') RETURNING id',paramsInsert);
 if(result.length!==1)throw fail(503,'No se guardó el mensaje');
 return {sent:true};
}
module.exports={TABLES,loadOne,issueAccepted,issueForRegistered,verifyCustomer,paymentState,messages,snapshot,clientNotice,staffConfirm,sendMessage};
