'use strict';
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
/**
 * Cierre Romo QA: actualización cifrada + constancia única en una sentencia SQL.
 * Nunca recibe datos de clientes en claro ni toca la base comercial de Uki.
 */
const STORE='romo:serena';
const fail=(res,status,msg)=>res.status(status).json({ok:false,storeId:STORE,error:msg});
function config(env){
 if(!entornoPanelRomoAutorizado(env)||
    env.ROMO_CIERRE_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(host))return null;
 let reader;
 try{reader=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 const ok=(x,user)=>['postgres:','postgresql:'].includes(x.protocol)&&
   x.hostname.toLowerCase()===host&&x.pathname==='/romos_sushi'&&
   x.username===user&&!!x.password;
 // La cuenta de alta de claves no puede confirmar cierres ni modificar estado.
 // Romo tiene una cuenta de servicio con UPDATE CAS e INSERT de constancias.
 if(!ok(reader,'romos_app_service'))return null;
 // Puerta QA estricta: este servicio no puede cerrar accidentalmente
 // sobre la rama principal Neon de Romo ni sobre otras sucursales.
 if(env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='qa/romos-panel-v816'){
  const qaHosts=new Set([
   'ep-wild-hat-bezucf4v.c-9.us-east-2.aws.neon.tech',
   'ep-wild-hat-bezucf4v-pooler.c-9.us-east-2.aws.neon.tech'
  ]);
  if(!qaHosts.has(reader.hostname.toLowerCase())||!qaHosts.has(host))return null;
 }
 for(const key of ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
  'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 return {origin,reader:reader.toString(),writer:reader.toString()};
}
module.exports=async function romoCierreQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const cfg=config(process.env);
 if(!cfg)return fail(res,503,'Cierre Romo no autorizado para este entorno');
 if(req.method!=='POST')return fail(res,405,'Solo cierres explícitos');
 const MIGRACION=require('../lib/seguimiento-aislar-escrituras-legadas-qa.cjs');
 if(MIGRACION.blocked({route:'cierre-snapshot',method:req.method}))return MIGRACION.denial(res);
 if(String(req.headers?.origin||'')!==cfg.origin)return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!=='expectedRevision|resumen|snapshot|turnoId'||
    !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||
    !body.resumen||typeof body.resumen!=='object'||Array.isArray(body.resumen)||
    JSON.stringify(body).length>2400000)
  return fail(res,400,'Paquete de cierre no válido');
 try{
  const neon=require('@neondatabase/serverless').neon;
  const read=neon(cfg.reader),dbReader={query:(sql,args)=>read.query(sql,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db:dbReader,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')
   return fail(res,403,'Solo dueños de Romo pueden cerrar en pruebas');
  const dbWriter=dbReader; // Operación atómica y aislada en Neon Romo.
  const cierre=await import('../lib/romo-cierre-constancia-qa.mjs');
  const result=await cierre.confirmarCierreConConstanciaRomoQA({
   db:dbWriter,identity,expectedRevision:body.expectedRevision,
   snapshot:body.snapshot,turnoId:body.turnoId,resumen:body.resumen
  });
  return res.status(200).json({ok:true,...result});
 }catch(err){
  if(err?.code==='ROMO_CIERRE_PENDIENTES')
   return fail(res,409,'Hay solicitudes de carta pendientes. El cierre no se confirmó.');
  if(err?.code==='REVISION_CONFLICTO')
   return fail(res,409,'El turno ya se cerró o Romo cambió; consulta Neon antes de repetir.');
  if(/permiso|identidad|autorizad/i.test(String(err?.message||'')))
   return fail(res,403,'Sin permiso');
  if(/inválid|resumen|monto|importe|cifra|cuadran|fecha/i.test(String(err?.message||'')))
   return fail(res,400,'Revisa el cierre, su resumen y la fecha operativa');
  return fail(res,503,'No fue posible confirmar el cierre. Revisa Historial y Neon antes de repetir.');
 }
};
module.exports._internalQA={config};
