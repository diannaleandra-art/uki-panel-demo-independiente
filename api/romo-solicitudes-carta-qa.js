'use strict';
/**
 * Ruta única de recepción de carta de Romo La Serena. Recupera el motor
 * existente de solicitudes sin reabrir la antigua rama QA ni tocar Uki.
 * GET privado de lectura, PATCH aceptación atómica y POST público tienen
 * banderas DIFERENTES. Por defecto solo se permite GET en Preview.
 */
const {createHash}=require('node:crypto');
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const STORE='romo:serena';
const fail=(r,n,msg)=>r.status(n).json({ok:false,storeId:STORE,error:msg});
const urlOk=v=>/^https:\/\/[a-z0-9.-]+$/i.test(v)&&!String(v).includes('..');
function configuration(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
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
 return {origin,carta:urlOk(carta)?carta:null,read,write};
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
 const carta=!!conf.carta&&actualOrigin===conf.carta;
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
 const core=await import('../lib/romo-solicitudes-carta-qa.mjs');
 const {neon}=require('@neondatabase/serverless');
 const reader=neon(conf.read),dbReader={query:(sql,args)=>reader.query(sql,args)};
 // Estado público mínimo: no entrega solicitudes ni datos de clientes.
 // Sólo se abre cuando envío y aceptación manual están autorizados.
 if(method==='GET'&&carta){
  if(process.env.ROMO_SOLICITUDES_PUBLICO_QA_ENABLED!=='true'||
     process.env.ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED!=='true')
   return fail(res,503,'Recepción pública de Romo todavía no habilitada');
  try{
   const db=await dbReader.query("SELECT revision FROM public.romo_estado_operativo_v1 WHERE store_id=$1 AND revision>=1 LIMIT 1",[STORE]);
   if(!db.length)return fail(res,503,'Estado de caja Romo no confirmado');
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
   const result=await core.registrarSolicitudRomo({db:writer,body:req.body,ipHash});
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
   action==='rechazada'?['estado','id','motivo']:
   (action==='reservar'||action==='liberar')?['claimToken','estado','id']:[];
  if(!allowedFields.length||Object.keys(body).sort().join('|')!==allowedFields.sort().join('|'))
   return fail(res,400,'Acción no permitida');
  const args={db:writer,identity,...body};
  const result=action==='reservar'?await core.reservarSolicitudRomo(args):
   action==='liberar'?await core.liberarSolicitudRomo(args):
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
module.exports._internalQA={configuration};
