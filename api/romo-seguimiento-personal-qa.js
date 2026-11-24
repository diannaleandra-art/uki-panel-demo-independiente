'use strict';
// Bandeja de seguimiento de Romo: accesible SOLO al personal Google autorizado
// en la tabla Romo, en Preview. No cobra, no modifica la caja ni las ventas.
const C=require('../lib/romo-seguimiento-transferencia-v1.cjs');
const CHAT=require('../lib/romo-seguimiento-chat-qa.cjs');
const readConfig=require('./romo-seguimiento-cliente-qa.js')._testing.config;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(res,code,message)=>res.status(code).json({ok:false,error:message});
function configured(env=process.env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='preparacion/panel-chat-transferencia-integrado-20261124'||
   env.ROMO_SEGUIMIENTO_PERSONAL_QA_ENABLED!=='true')return null;
 return readConfig(env);
}
function shapeOrder(row){
 const metodo=C.normalizeMethod(row?.metodo),total=C.transferAmount({metodo,total:Number(row?.total_indicado)});
 return {id:row.id,codigoPedido:String(row.codigo_pedido||'').slice(0,60),
  cliente:String(row.cliente||'').slice(0,80),estadoPedido:row.estado,
  metodoPago:metodo,montoTransferencia:total,
  estadoPago:row.estado_pago||'pendiente',clienteAvisoEn:row.cliente_aviso_en||null,
  ultimaConsulta:row.ultimo_mensaje||null};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 const cfg=configured();
 if(!cfg)return fail(res,503,'Bandeja de seguimiento todavía no habilitada');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(req.method==='POST'&&(!String(req.headers['content-type']||'').startsWith('application/json')||
  !req.body||typeof req.body!=='object'||Array.isArray(req.body)||
  JSON.stringify(req.body).length>1300))return fail(res,400,'Formulario inválido');
 const origin=String(req.headers.origin||'');
 const host=String(req.headers.host||'').toLowerCase();
 const preview='https://'+host;
 const exactPreview=String(process.env.VERCEL_URL||'').toLowerCase()===host&&
  /^romos-sushi-panel-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(host);
 if(!exactPreview||origin&&origin!==preview&&origin!==String(process.env.ROMO_PANEL_ALLOWED_ORIGIN||''))
  return fail(res,403,'Origen no autorizado');
 try{
  const sql=require('@neondatabase/serverless').neon(cfg.db);
  const db={query:(query,params)=>sql.query(query,params)};
  const m=await import('../lib/romo-identidad-servidor-qa.mjs');
  const person=await m.resolveRomoIdentity({
   authorization:req.headers.authorization,db,verifyToken:m.verifyFirebaseGoogleToken
  });
  if(!person||!['duenos','agendador'].includes(person.role))
   return fail(res,403,'Personal sin permiso para seguimiento Romo');
  if(req.method==='GET'&&!req.query?.id){
   const rows=await db.query(
    "SELECT s.id,s.codigo_pedido,s.cliente,s.estado,s.total_indicado,s.datos->>'medioPago' AS metodo,t.estado_pago,t.cliente_aviso_en,(SELECT max(m.creado_en) FROM public.romo_seguimiento_chat_cifrado_v1 m WHERE m.solicitud_id=s.id AND m.store_id='romo:serena' AND m.remitente='cliente') AS ultimo_mensaje FROM public.romo_solicitudes_carta_v1 s LEFT JOIN public.romo_seguimiento_transferencia_v1 t ON t.solicitud_id=s.id AND t.store_id='romo:serena' WHERE s.store_id='romo:serena' AND s.branch='serena' AND s.estado='aceptada' AND s.creado_en>now()-interval '7 days' ORDER BY s.creado_en DESC LIMIT 80",
    []);
   return res.status(200).json({ok:true,storeId:'romo:serena',orders:rows.map(shapeOrder)});
  }
  const id=req.method==='GET'?req.query?.id:req.body?.id;
  if(typeof id!=='string'||!UUID.test(id))return fail(res,400,'Pedido inválido');
  const rows=await db.query(
   "SELECT s.id,s.codigo_pedido,s.cliente,s.estado,s.total_indicado,s.datos->>'medioPago' AS metodo,t.estado_pago,t.cliente_aviso_en FROM public.romo_solicitudes_carta_v1 s LEFT JOIN public.romo_seguimiento_transferencia_v1 t ON t.solicitud_id=s.id AND t.store_id='romo:serena' WHERE s.id=$1::uuid AND s.store_id='romo:serena' AND s.branch='serena' AND s.estado='aceptada' LIMIT 1",
   [id]);
  if(rows.length!==1)return fail(res,404,'Pedido no disponible');
  const s=rows[0],view=shapeOrder(s);
  if(req.method==='POST'){
   const action=req.body.action;
   if(action==='confirmar_transferencia'){
    if(!cfg.bank||req.body.verificadoEnBanco!==true||
      !Number.isSafeInteger(req.body.montoRecibido)||
      view.metodoPago!=='transferencia'||view.montoTransferencia!==req.body.montoRecibido||
      view.montoTransferencia<=0)
     return fail(res,409,'Comprueba el abono real y el importe exacto en la cuenta autorizada');
    const confirmed=await db.query(
     "INSERT INTO public.romo_seguimiento_transferencia_v1(solicitud_id,store_id,monto_transferencia,estado_pago,confirmada_en,confirmada_por,abono_verificado_en,actualizado_en) VALUES($1::uuid,'romo:serena',$2,'confirmada',now(),$3,now(),now()) ON CONFLICT(solicitud_id) DO UPDATE SET estado_pago='confirmada',confirmada_en=now(),confirmada_por=$3,abono_verificado_en=now(),actualizado_en=now() WHERE romo_seguimiento_transferencia_v1.store_id='romo:serena' AND romo_seguimiento_transferencia_v1.estado_pago IN ('pendiente','avisada') AND romo_seguimiento_transferencia_v1.monto_transferencia=$2 RETURNING estado_pago",
     [id,view.montoTransferencia,person.userId]);
    if(!confirmed.length&&view.estadoPago!=='confirmada')
      return fail(res,409,'El pago cambió. Consulta antes de registrar otra vez');
    return res.status(200).json({ok:true,storeId:'romo:serena',id,estadoPago:'confirmada',
     nota:'Verificación manual por personal. No se registró un cobro en caja'});
   }
   if(action==='responder_mensaje'){
    if(!cfg.chatSecret||!CHAT.acceptable({storeId:'romo:serena',orderId:id,
      from:'agendador',body:req.body.texto}))return fail(res,400,'Mensaje no permitido');
    const limit=await db.query(
     "SELECT COUNT(*)::integer AS n FROM public.romo_seguimiento_chat_cifrado_v1 WHERE solicitud_id=$1::uuid AND store_id='romo:serena' AND remitente='agendador' AND creado_en>now()-interval '10 minutes'",[id]);
    if(Number(limit[0]?.n||0)>=20)return fail(res,429,'Límite temporal de mensajes');
    const packed=CHAT.seal({storeId:'romo:serena',orderId:id,from:'agendador',body:req.body.texto},cfg.chatSecret);
    if(!packed)return fail(res,400,'Mensaje inválido');
    await db.query(
     "INSERT INTO public.romo_seguimiento_chat_cifrado_v1 (solicitud_id,store_id,remitente,mensaje_cifrado,nonce) VALUES($1::uuid,'romo:serena','agendador',$2,$3)",
     [id,packed.mensaje_cifrado,packed.nonce]);
    return res.status(200).json({ok:true,storeId:'romo:serena',id,enviado:true});
   }
   return fail(res,400,'Acción no autorizada');
  }
  let messages=[];
  if(cfg.chatSecret){
   const list=await db.query(
    "SELECT remitente,mensaje_cifrado,nonce,creado_en FROM public.romo_seguimiento_chat_cifrado_v1 WHERE solicitud_id=$1::uuid AND store_id='romo:serena' ORDER BY creado_en DESC,id DESC LIMIT 30",[id]);
   messages=list.reverse().map(row=>({remitente:row.remitente,
    texto:CHAT.unseal({storeId:'romo:serena',orderId:id,from:row.remitente,
     ciphertext:row.mensaje_cifrado,nonce:row.nonce},cfg.chatSecret),
    creadoEn:row.creado_en})).filter(m=>m.texto!==null);
  }
  return res.status(200).json({ok:true,storeId:'romo:serena',pedido:view,mensajes:messages,
   chatHabilitado:!!cfg.chatSecret,puedeConfirmar:!!cfg.bank&&view.metodoPago==='transferencia'});
 }catch(error){
  console.error('Romo seguimiento personal:',String(error?.code||error?.name||'error').slice(0,40));
  return fail(res,503,'No fue posible actualizar la bandeja. Revisa antes de repetir');
 }
};
module.exports._testing={configured,shapeOrder};
