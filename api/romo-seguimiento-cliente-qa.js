'use strict';
/* Estado mínimo para clientes. NO contiene API de cobro, no escribe caja y no envía WhatsApp. */
const C=require('../lib/romo-seguimiento-transferencia-v1.cjs');
const CHAT=require('../lib/romo-seguimiento-chat-qa.cjs');
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
function config(e=process.env){
 if(e.VERCEL_ENV!=='preview'||e.VERCEL_GIT_COMMIT_REF!=='preparacion/panel-chat-transferencia-integrado-20261124'||!entornoPanelRomoAutorizado(e)||e.ROMO_SEGUIMIENTO_QA_ENABLED!=='true')return null;
 const origin=String(e.ROMO_CARTA_ALLOWED_ORIGIN||''),panel=String(e.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[a-z0-9.-]+$/i.test(origin)||!/^https:\/\/[a-z0-9.-]+$/i.test(panel))return null;
 let url;try{url=new URL(String(e.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==String(e.ROMO_PRIVATE_DATABASE_HOST||'')||
   url.pathname!=='/romos_sushi'||url.username!=='romos_app_service'||!url.password||
   !C.secretReady(e.ROMO_SEGUIMIENTO_TOKEN_SECRET))return null;
 let bank=null;
 try{
  const b=JSON.parse(String(e.ROMO_SANTANDER_DATOS_VERIFICADOS_JSON||'null'));
  if(b&&b.verificado===true&&b.sucursal==='romo:serena'&&String(b.banco).toLowerCase().includes('santander')&&
    typeof b.titular==='string'&&b.titular.length<=100&&
    typeof b.cuenta==='string'&&b.cuenta.length<=40&&
    typeof b.rut==='string'&&b.rut.length<=18&&
    typeof b.tipo==='string'&&b.tipo.length<=50&&
    typeof b.correo==='string'&&b.correo.length<=100)
    bank={banco:b.banco,titular:b.titular,rut:b.rut,tipo:b.tipo,cuenta:b.cuenta,correo:b.correo};
 }catch{}
 return {origin,db:url.toString(),secret:e.ROMO_SEGUIMIENTO_TOKEN_SECRET,bank,chatSecret:CHAT.key(e.ROMO_SEGUIMIENTO_CHAT_KEY_HEX)?e.ROMO_SEGUIMIENTO_CHAT_KEY_HEX:null};
}
function respond(res,status,body){return res.status(status).json({ok:status<400,...body});}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Vary','Origin');
 const cfg=config();
 if(!cfg)return respond(res,503,{error:'Seguimiento todavía no habilitado.'});
 const origin=String(req.headers.origin||'');
 if(origin!==cfg.origin)return respond(res,403,{error:'Origen no autorizado.'});
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Seguimiento-Pedido');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return respond(res,405,{error:'Método no permitido.'});
 const identity=C.readToken(req.headers['x-seguimiento-pedido'],cfg.secret);
 if(!identity)return respond(res,403,{error:'Enlace inválido o caducado.'});
 if(req.method==='POST'&&(!String(req.headers['content-type']||'').startsWith('application/json')||
  JSON.stringify(req.body||{}).length>1300||
  !['avisar_transferencia','enviar_mensaje'].includes(req.body?.action)))
  return respond(res,400,{error:'Acción no permitida.'});
 try{
  const sql=require('@neondatabase/serverless').neon(cfg.db);
  const lookup=await sql.query(
   "SELECT id,codigo_pedido,estado,total_indicado,datos->>'medioPago' AS metodo FROM public.romo_solicitudes_carta_v1 WHERE id=$1::uuid AND request_key=$2 AND store_id='romo:serena' AND branch='serena' LIMIT 1",
   [identity.id,identity.key]
  );
  if(lookup.length!==1)return respond(res,404,{error:'Solicitud no encontrada.'});
  const s=lookup[0],metodo=C.normalizeMethod(s.metodo),total=C.transferAmount({metodo,total:Number(s.total_indicado)});
  if(req.method==='POST'&&req.body.action==='avisar_transferencia'){
   if(metodo!=='transferencia'||total===null||!cfg.bank||s.estado!=='aceptada')
    return respond(res,409,{error:'Primero confirma que el local aceptó tu pedido por transferencia.'});
   // El aviso no cobra, no aumenta ventas ni cambia a confirmada.
   await sql.query(
    "INSERT INTO public.romo_seguimiento_transferencia_v1(solicitud_id,store_id,monto_transferencia,estado_pago,cliente_aviso_en) VALUES($1::uuid,'romo:serena',$2,'avisada',now()) ON CONFLICT (solicitud_id) DO UPDATE SET estado_pago=CASE WHEN romo_seguimiento_transferencia_v1.estado_pago='confirmada' THEN 'confirmada' ELSE 'avisada' END,cliente_aviso_en=COALESCE(romo_seguimiento_transferencia_v1.cliente_aviso_en,now()),actualizado_en=now() WHERE romo_seguimiento_transferencia_v1.store_id='romo:serena' AND romo_seguimiento_transferencia_v1.monto_transferencia=$2",
    [identity.id,total]
   );
  }
  if(req.method==='POST'&&req.body.action==='enviar_mensaje'){
   if(s.estado!=='aceptada'||!cfg.chatSecret||!CHAT.acceptable({
    storeId:'romo:serena',orderId:identity.id,from:'cliente',body:req.body.texto
   }))return respond(res,409,{error:'Este chat todavía no está disponible.'});
   const limit=await sql.query(
    "SELECT count(*)::integer AS n FROM public.romo_seguimiento_chat_cifrado_v1 WHERE store_id='romo:serena' AND solicitud_id=$1::uuid AND remitente='cliente' AND creado_en>now()-interval '10 minutes'",
    [identity.id]);
   if(Number(limit[0]?.n||0)>=10)return respond(res,429,{error:'Espera antes de enviar más mensajes.'});
   const packed=CHAT.seal({storeId:'romo:serena',orderId:identity.id,from:'cliente',body:req.body.texto},cfg.chatSecret);
   if(!packed)return respond(res,400,{error:'Mensaje inválido.'});
   await sql.query(
    "INSERT INTO public.romo_seguimiento_chat_cifrado_v1 (solicitud_id,store_id,remitente,mensaje_cifrado,nonce) VALUES ($1::uuid,'romo:serena','cliente',$2,$3)",
    [identity.id,packed.mensaje_cifrado,packed.nonce]
   );
  }
  const rows=await sql.query("SELECT estado_pago,cliente_aviso_en,confirmada_en FROM public.romo_seguimiento_transferencia_v1 WHERE solicitud_id=$1::uuid AND store_id='romo:serena' LIMIT 1",[identity.id]);
  const st=rows[0]?.estado_pago||'pendiente',view=C.customerStatus({orderStatus:s.estado,transferStatus:st,method:metodo});
  let messages=[];
  const chatEnabled=!!cfg.chatSecret&&s.estado==='aceptada';
  if(chatEnabled){
   const latest=await sql.query(
    "SELECT remitente,mensaje_cifrado,nonce,creado_en FROM public.romo_seguimiento_chat_cifrado_v1 WHERE store_id='romo:serena' AND solicitud_id=$1::uuid ORDER BY creado_en DESC,id DESC LIMIT 30",
    [identity.id]);
   messages=latest.reverse().map(m=>({
    remitente:m.remitente,
    texto:CHAT.unseal({storeId:'romo:serena',orderId:identity.id,from:m.remitente,
     ciphertext:m.mensaje_cifrado,nonce:m.nonce},cfg.chatSecret),
    creadoEn:m.creado_en
   })).filter(m=>m.texto!==null);
  }
  return respond(res,200,{
   storeId:'romo:serena',codigoPedido:String(s.codigo_pedido||'').slice(0,60),
   estadoPedido:s.estado,estadoPago:st,descripcionPedido:view.order,descripcionPago:view.payment,
   pagoConfirmado:view.paid,metodoPago:metodo,montoTransferencia:total,
   datosBancarios:metodo==='transferencia'&&s.estado==='aceptada'?cfg.bank:null,
   datosBancariosDisponibles:!!cfg.bank,datosBancariosVerificados:!!cfg.bank,datosBancariosSucursal:cfg.bank?'romo:serena':null,
   puedeAvisarTransferencia:!!cfg.bank&&metodo==='transferencia'&&s.estado==='aceptada'&&st==='pendiente'&&Number.isSafeInteger(total)&&total>0,
   chatHabilitado:chatEnabled,mensajes:messages,soloSeguimiento:true,
   nota:'Avisar que transferiste no acredita un abono en Santander.'
  });
 }catch(err){
  console.error('Romo seguimiento:',String(err.code||err.name||'error').slice(0,50));
  return respond(res,503,{error:'No se pudo actualizar el seguimiento. Vuelve a consultar sin repetir el pago.'});
 }
};
module.exports._testing={config};
