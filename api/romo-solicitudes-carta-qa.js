'use strict';
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
/**
 * Ruta única de recepción de carta de Romo La Serena. Recupera el motor
 * existente de solicitudes sin reabrir la antigua rama QA ni tocar Uki.
 * GET privado de lectura, PATCH aceptación atómica y POST público tienen
 * banderas DIFERENTES. Por defecto solo se permite GET en Preview.
 */
const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
const STORE='romo:serena';
const fail=(r,n,msg)=>r.status(n).json({ok:false,storeId:STORE,error:msg});
const urlOk=v=>/^https:\/\/[a-z0-9.-]+$/i.test(v)&&!String(v).includes('..');

/** Acepta pedidos enviados por Netlify solo si el servidor conoce la clave.
 * No reemplaza el acceso Google del personal ni habilita ventas automáticas.
 * Desactiva inmediatamente si la clave falta o si la petición es antigua.
 */
function confirmarFirmaNetlifyQA(req,env){
 const secret=String(env.ROMO_NETLIFY_RELAY_SECRET||'');
 if(secret.length<32)return false;
 const sentAt=String(req.headers?.['x-romo-relay-time']||'');
 if(!/^\d{13}$/.test(sentAt))return false;
 const parsed=Number(sentAt);
 if(!Number.isSafeInteger(parsed)||Math.abs(Date.now()-parsed)>180000)return false;
 const signature=String(req.headers?.['x-romo-relay-signature']||'');
 if(!/^[0-9a-f]{64}$/i.test(signature))return false;
 const actual=Buffer.from(signature.toLowerCase(),'hex');
 const payload=JSON.stringify(req.body||{});
 const expected=createHmac('sha256',secret)
   .update(sentAt+'\n'+payload,'utf8').digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
function configuration(env){
 if(!entornoPanelRomoAutorizado(env)||
    env.ROMO_SOLICITUDES_LECTURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const carta=String(env.ROMO_CARTA_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!urlOk(origin)||!/^[a-z0-9.-]+$/.test(host))return null;
 const validate=(value,username)=>{
  let u;try{u=new URL(String(value||''))}catch{return null}
  if(!['postgres:','postgresql:'].includes(u.protocol)||
    u.hostname.toLowerCase()!==host||u.pathname!=='/romos_sushi'||
    !u.username||!u.password||(username&&u.username!==username))return null;
  return u.toString();
 };
 const read=validate(env.ROMO_PRIVATE_DATABASE_URL,'romos_app_service');
 // La cuenta de servicio de Romo ya tiene INSERT/UPDATE sobre solicitudes y CAS.
 // La cuenta de alta de clave no tiene permiso INSERT ni acceso al snapshot;
 // nunca usarla para recibir o aceptar pedidos.
 const write=read;
 if(!read)return null;
 for(const name of ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
                     'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{if(new URL(String(env[name]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 // Segunda dirección de la carta, exclusivamente para el preview manual de Romo.
 // Inactiva por defecto. Nunca cambia el origen de la carta comercial ni las API Uki.
 const cartaPreview=String(env.ROMO_CARTA_PREVIEW_ALLOWED_ORIGIN||'');
 return {origin,carta:urlOk(carta)?carta:null,
  cartaPreview:env.VERCEL_ENV==='preview'&&
   env.ROMO_CARTA_PREVIEW_QA_ENABLED==='true'&&urlOk(cartaPreview)?
   cartaPreview:null,
  netlifyCarta:env.ROMO_NETLIFY_BRIDGE_QA_ENABLED==='true'?
   'https://romos-sushi-qa-privado.netlify.app':null,
  read,write};
}
module.exports=async function romoSolicitudesCartaQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=configuration(process.env);
 if(!conf)return fail(res,503,'Recepción de carta Romo sin habilitar');
 const method=String(req.method||'').toUpperCase();
 if(!['GET','POST','PATCH','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 const actualOrigin=String(req.headers?.origin||'');
 const host=String(req.headers?.host||'').toLowerCase();
 // Solo GET puede proceder de la misma página sin header Origin.
 const panel=(actualOrigin===conf.origin)||
  (method==='GET'&&!actualOrigin&&host===new URL(conf.origin).host.toLowerCase());
 const carta=(!!conf.carta&&actualOrigin===conf.carta)||
  (!!conf.cartaPreview&&actualOrigin===conf.cartaPreview)||
  (!!conf.netlifyCarta&&actualOrigin===conf.netlifyCarta);
 const allowed=(method==='POST'||(method==='GET'&&carta))?carta:
  method==='OPTIONS'?(actualOrigin===conf.origin||carta):panel;
 if(!allowed)return fail(res,403,'Origen no autorizado');
 if(actualOrigin)res.setHeader('Access-Control-Allow-Origin',actualOrigin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(method==='OPTIONS')return res.status(204).end();
 if(method==='POST'&&process.env.ROMO_SOLICITUDES_PUBLICO_QA_ENABLED!=='true')
  return fail(res,503,'La carta de Romo todavía no registra solicitudes en QA');
 if(method==='PATCH'&&process.env.ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED!=='true')
  return fail(res,503,'La aceptación de carta de Romo todavía no está activada');
 if(method!=='GET'&&!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return fail(res,415,'Se requiere JSON');
 if(method!=='GET'&&JSON.stringify(req.body||{}).length>2300000)
  return fail(res,413,'Contenido excede el límite');
 if(method==='POST'&&actualOrigin===conf.netlifyCarta&&
    !confirmarFirmaNetlifyQA(req,process.env))
  return fail(res,403,'Firma de servidor Romo no autorizada');
 const core=await import('../lib/romo-solicitudes-carta-qa.mjs');
 const {neon}=require('@neondatabase/serverless');
 const reader=neon(conf.read),dbReader={query:(sql,args)=>reader.query(sql,args)};
 // Estado público mínimo: no entrega solicitudes ni datos de clientes.
 // Sólo se abre cuando envío y aceptación manual están autorizados.
 if(method==='GET'&&carta){
  // No anunciar que Netlify puede recibir pedidos si su firma privada falta.
  if(actualOrigin===conf.netlifyCarta&&
     String(process.env.ROMO_NETLIFY_RELAY_SECRET||'').length<32)
   return fail(res,503,'Firma privada de Netlify sin configurar');
  if(process.env.ROMO_SOLICITUDES_PUBLICO_QA_ENABLED!=='true'||
     process.env.ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED!=='true'||
     process.env.ROMO_COTIZADOR_PROXY_QA_ENABLED!=='true')
   return fail(res,503,'Recepción pública de Romo todavía no habilitada');
  try{
   const db=await dbReader.query("SELECT revision FROM public.romo_estado_operativo_v1 WHERE store_id=$1 AND revision>=1 LIMIT 1",[STORE]);
   if(!db.length)return fail(res,503,'Estado de caja Romo no confirmado');
   // No mostrar recepción habilitada si faltan las ediciones base o
   // el mecanismo de revisión que protege contra cambios de precio.
   const rev=await dbReader.query("SELECT revision FROM public.romo_carta_ediciones_v1 WHERE store_id=$1 AND revision>=1 LIMIT 1",[STORE]);
   if(!Array.isArray(rev)||rev.length!==1)
     return fail(res,503,'Carta Romo todavía no tiene revisión comercial confirmada');
   return res.status(200).json({ok:true,enabled:true,storeId:STORE,countsAsSale:false});
  }catch{return fail(res,503,'Romo no puede confirmar su recepción');}
 }
 let writer=null;
 if(method!=='GET'){
  if(!conf.write)return fail(res,503,'Escritura aislada de Romo no disponible');
  // Es la misma BD exclusivamente Romo, nunca una BD financiera o Uki.
  writer=dbReader;
 }
 try{
  if(method==='POST'){
   const salt=String(process.env.ROMO_SOLICITUDES_RATE_SALT||'');
   if(salt.length<24)return fail(res,503,'Registro público todavía no preparado');
   const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'')
    .split(',')[0].slice(0,100);
   const ipHash=createHash('sha256').update('romo-carta:'+salt+':'+ip).digest('hex');
   // El backend vuelve a leer Neon Romo y recalcula cada importe en el
   // modelo oficial de la carta. Una respuesta sin confirmar NO registra pedido.
   const quote=await import('../lib/romo-cotizacion-servidor-qa.mjs');
   const result=await core.registrarSolicitudRomo({
     db:writer,body:req.body,ipHash,
     cotizador:args=>quote.cotizarSolicitudRomoServidorQA(args)
   });
   return res.status(result.repetido?200:201).json(result);
  }
  const identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await identityModule.resolveRomoIdentity({
   authorization:req.headers?.authorization,db:dbReader,
   verifyToken:identityModule.verifyFirebaseGoogleToken
  });
  // El agendador registrado en Neon puede gestionar pedidos, igual que Uki.
  // El módulo de operaciones verifica por separado lectura, rechazo y aceptación.
  if(!identity||!['duenos','agendador'].includes(identity.role))
   return fail(res,403,'Cuenta sin permiso de pedidos de Romo');
  if(method==='GET'){
   const data=await core.listarSolicitudesRomo({db:dbReader,identity});
   return res.status(200).json(data);
  }
  const body=req.body,action=body?.estado;
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof action!=='string')
   return fail(res,400,'Acción inválida');
  const allowedFields=action==='aceptada'?
   ['claimToken','estado','expectedRevision','id','pedidoId','snapshot']:
   action==='recuperar'?['confirmoSinPedido','estado','id','motivo','nombreResponsable']:
   action==='rechazada'?['estado','id','motivo']:
   (action==='reservar'||action==='liberar')?['claimToken','estado','id']:[];
  if(!allowedFields.length||Object.keys(body).sort().join('|')!==allowedFields.sort().join('|'))
   return fail(res,400,'Acción no permitida');
  const args={db:writer,identity,...body};
  const result=action==='reservar'?await core.reservarSolicitudRomo(args):
   action==='liberar'?await core.liberarSolicitudRomo(args):
   action==='recuperar'?await core.recuperarReservaRomo(args):
   action==='rechazada'?await core.rechazarSolicitudRomo(args):
   await core.aceptarYGuardarSolicitudRomo(args);
  return res.status(200).json(result);
 }catch(e){
  const code=[400,403,409,429,503].includes(e?.status)?e.status:
    e?.code==='REVISION_CONFLICTO'?409:503;
  return fail(res,code,code===503?
    'No se confirmó la solicitud. Consulta la bandeja antes de reintentar.':
    code===409?'Solicitud reservada, procesada o revisión cambiada. Actualiza.':
    code===403?'Permisos insuficientes para Romo.':
    code===429?'Demasiadas solicitudes. Contacta por WhatsApp.':'Datos de solicitud inválidos.');
 }
};
module.exports._internalQA={configuration,confirmarFirmaNetlifyQA};
