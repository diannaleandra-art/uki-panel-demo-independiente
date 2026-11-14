'use strict';
/**
 * API futura del MISMO panel Uki para Romo La Serena.
 * Sólo copia de preparación, NO desplegada. Inactiva por defecto;
 * nunca disponible en Production ni desde la carta pública.
 * Usa la misma sesión Firebase Google, permisos propios Neon Romo y
 * la bóveda AES-GCM del panel. Sin claves ni datos de Uki.
 */
const STORE='romo:serena';
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const send=(res,code,message)=>res.status(code).json({ok:false,storeId:STORE,error:message});
const URI_NAMES=[
 'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
 'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL'
];

function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_ESTADO_CIFRADO_QA_ENABLED!=='true')
   return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||
    !/^[a-z0-9.-]+$/.test(host))return null;
 let uri;
 try{uri=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 if(!['postgres:','postgresql:'].includes(uri.protocol)||
    uri.hostname.toLowerCase()!==host||
    uri.pathname!=='/romos_sushi'||!uri.username||!uri.password)
   return null;
 for(const key of URI_NAMES){
  try{
   if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null;
  }catch{}
 }
 return {url:uri.toString(),origin};
}

module.exports=async function romoEstadoCifradoPanelQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf)return send(res,503,'La conexión de Romo sigue desactivada');
 const origin=String(req.headers?.origin||'');
 if(origin!==conf.origin)return send(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return send(res,405,'Método no permitido');
 if(req.method==='POST'&&process.env.ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED!=='true')
   return send(res,503,'Guardado Romo todavía no habilitado');

 try{
  const neon=require('@neondatabase/serverless').neon(conf.url);
  if(typeof neon?.query!=='function')throw Error('Driver no preparado');
  const db={query:(sql,args)=>neon.query(sql,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,
   db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity)return send(res,403,'Sesión o permiso Romo inválidos');
  const vault=await import('../lib/romo-estado-cifrado-persistencia-qa.mjs');
  if(req.method==='GET'){
   const result=await vault.leerEstadoCifradoRomoQA({db,identity});
   return res.status(200).json(result);
  }
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
   return send(res,415,'Se requiere JSON');
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||
     body.storeId && body.storeId!==STORE||
     !Number.isSafeInteger(body.expectedRevision))
   return send(res,400,'Contenido inválido');
  if(JSON.stringify(body).length>2000000)
   return send(res,413,'Paquete demasiado grande');
  const saved=await vault.guardarEstadoCifradoRomoQA({
   db,identity,expectedRevision:body.expectedRevision,snapshot:body.snapshot
  });
  return res.status(200).json(saved);
 }catch(error){
  const message=String(error?.message||'');
  // No revelar consultas, URL, tokens, datos personales ni secretos.
  if(/recarga antes de guardar|Actualiza antes de guardar/.test(message))
   return send(res,409,'Romo cambió en otro teléfono; vuelve a cargar antes de guardar');
  if(/permiso|autorizad|Este rol/.test(message))
   return send(res,403,'Permiso insuficiente para esta operación');
  if(/cifrad|Paquete|demasiado grande|Sobre/.test(message))
   return send(res,400,'Sobre cifrado Romo inválido');
  return send(res,503,'El servicio de Romo no está disponible');
 }
};
module.exports._internalQA={config};
