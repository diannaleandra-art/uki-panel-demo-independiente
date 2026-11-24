'use strict';
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
/**
 * Misma sección Historial de Romo; endpoint privado y apagado por defecto.
 * Un recibo v2 se emite SOLO junto con actualización CAS del snapshot.
 * No envía dinero, no reabre caja original ni importa cierre a Finanzas.
 */
const STORE='romo:serena';
const fail=(res,status,error)=>res.status(status).json({ok:false,storeId:STORE,error});
const hasOnly=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===keys.slice().sort().join('|');
function config(env={}){
 if(!entornoPanelRomoAutorizado(env)||
   env.ROMO_RECTIFICACION_CIERRE_LECTURA_QA_ENABLED!=='true')return null;
 let url;try{url=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}
 catch{return null}
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||
  !/^[a-z0-9.-]+\.neon\.tech$/.test(host)||
  !['postgres:','postgresql:'].includes(url.protocol)||
  url.hostname.toLowerCase()!==host||
  url.pathname!=='/romos_sushi'||url.username!=='romos_app_service'||
  !url.password)return null;
 for(const envName of ['UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL',
  'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL']){
  try{if(new URL(String(env[envName]||'')).hostname.toLowerCase()===host)
   return null;}catch{}
 }
 return {url:url.toString(),origin,
  write:env.ROMO_RECTIFICACION_CIERRE_ESCRITURA_QA_ENABLED==='true'};
}
module.exports=async function romoRectificacionCierreV2QA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=config(process.env);
 if(!cfg)return fail(res,503,'Rectificaciones de Romo no habilitadas');
 const method=String(req.method||'').toUpperCase();
 if(!['POST','OPTIONS'].includes(method))return fail(res,405,'Método no autorizado');
 if(String(req.headers?.origin||'')!==cfg.origin)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 if(method==='OPTIONS')return res.status(204).end();
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
  JSON.stringify(body).length>2500000||
  !['confirmar','consultar'].includes(body.action))
  return fail(res,400,'Operación de Romo inválida');
 const write=body.action==='confirmar';
 const MIGRACION=require('../lib/seguimiento-aislar-escrituras-legadas-qa.cjs');
 if(MIGRACION.blocked({route:'rectificacion-snapshot',method,action:body.action}))return MIGRACION.denial(res);
 if(write&&!cfg.write)return fail(res,503,'Rectificación solo consulta; sin autorización de escritura');
 if(write&&(!hasOnly(body,['action','expectedRevision','snapshot','resumen'])||
    !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1))
  return fail(res,400,'Falta revisión y estado cifrado CAS');
 if(!write&&(!hasOnly(body,['action','fuenteOriginal'])||
   !/^romo:serena\|\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(body.fuenteOriginal||'')))
  return fail(res,400,'Referencia de cierre inválida');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(sql,params)=>neon.query(sql,params)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')
   return fail(res,403,'Solo dueños de Romo pueden consultar o confirmar rectificaciones');
  const backend=await import('../lib/romo-rectificacion-constancia-v2-qa.mjs');
  const result=write?
   await backend.confirmarReciboRectificacionRomoQA({
    db,identity,expectedRevision:body.expectedRevision,
    snapshot:body.snapshot,resumen:body.resumen
   }):
   await backend.consultarReciboRectificacionRomoQA({
    db,identity,fuenteOriginal:body.fuenteOriginal
   });
  return res.status(200).json({ok:true,storeId:STORE,...result});
 }catch(error){
  const msg=String(error?.message||'');
  if(/Ya se confirmó|ya existe|cambió|duplic|revisión|unique|conflict/i.test(msg))
   return fail(res,409,'Rectificación ya registrada o revisión cambiada: consulta Historial/Neon antes de reintentar');
  if(/autoriza|permiso|identidad/i.test(msg))return fail(res,403,'Sin permiso');
  if(/inválid|incorrect|fuente|importe|medio|resumen|monto|cuadr|momento|hora|turno/i.test(msg))
   return fail(res,400,'La rectificación o su conciliación no coinciden con el cierre original');
  return fail(res,503,'No se confirmó el recibo v2. Reabre Romo y consulta Neon antes de repetir');
 }
};
module.exports._configQA=config;
