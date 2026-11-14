'use strict';
/**
 * MISMO PANEL / Romo La Serena: API privada del estado TOTAL cifrado.
 *
 * Bloqueado por defecto. No se publicará ni operará hasta completar
 * permisos Google, contraseña existente, pruebas y autorización expresa.
 * El API jamás recibe contraseñas, clientes o pedidos en texto abierto.
 */
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
module.exports=async function romoEstadoOperativoQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env;
 const qa=env.VERCEL_ENV==='preview'&&
  env.VERCEL_GIT_COMMIT_REF==='qa/integracion-panel-unico-romo-serena-20261112'&&
  env.ROMO_OPERATIVO_QA_ENABLED==='true';
 if(!qa&&(env.VERCEL_ENV!=='production'||env.ROMO_OPERATIVO_LIVE_ENABLED!=='true'))
  return fail(res,503,'Romo todavía no está habilitado para operar');
 const actualOrigin=String(req.headers?.origin||'');
 const expectedOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[^\/\s?#@]+$/.test(expectedOrigin)||
    actualOrigin!==expectedOrigin)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',expectedOrigin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(req.method==='POST'&&
    !String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return fail(res,415,'Se requiere JSON cifrado');
 const size=Number(req.headers?.['content-length']||0);
 if(!Number.isFinite(size)||size>2800000)
  return fail(res,413,'El respaldo cifrado supera el tamaño permitido');

 let store;
 try{store=await import('../lib/romo-estado-operativo-qa.mjs')}
 catch{return fail(res,503,'Módulo Romo no preparado')}
 const config=store.romoOperativoConfig(env);
 if(!config)return fail(res,503,'Base exclusiva Romo no configurada');

 let db,identityModule;
 try{
  db=require('@neondatabase/serverless').neon(config.url);
  identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
 }catch{return fail(res,503,'El servicio privado de Romo no está disponible')}

 let identity;
 try{
  identity=await identityModule.resolveRomoIdentity({
   authorization:req.headers?.authorization,
   db,
   verifyToken:identityModule.verifyFirebaseGoogleToken,
   env
  });
 }catch{return fail(res,503,'No se pudo comprobar el acceso Romo')}
 if(!identity)return fail(res,403,'Sin autorización para Romo La Serena');

 if(req.method==='GET'){
  try{
   const state=await store.readRomoOperativeState({db,identity});
   return res.status(200).json({ok:true,...state});
  }catch(error){
   if(/no tiene permiso|identidad|La identidad|Sin permiso/.test(String(error?.message||'')))
    return fail(res,403,'Sin permiso para consultar Romo');
   return fail(res,503,'No se pudo consultar el estado de Romo');
  }
 }
 const body=req.body;
 const esCierre=body?.operation==='cierre_definitivo';
 if(esCierre&&(qa?
  env.ROMO_CIERRE_QA_ENABLED!=='true'||env.ROMO_CIERRE_RECIBO_QA_ENABLED!=='true':
  env.ROMO_CIERRE_DEFINITIVO_LIVE_ENABLED!=='true'||
  env.ROMO_CIERRE_RECIBO_LIVE_ENABLED!=='true'))
  return fail(res,503,'Cierre y constancia de Romo todavía no autorizados');
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!==(esCierre?
     'expectedRevision|operation|resumen|snapshot|turnoId':'expectedRevision|snapshot'))
  return fail(res,400,'Formato de respaldo no válido');
 try{
  const result=esCierre?await store.confirmarCierreConConstanciaRomoQA({
    db,identity,expectedRevision:body.expectedRevision,
    snapshot:body.snapshot,turnoId:body.turnoId,resumen:body.resumen
   }):await store.saveRomoOperativeState({
    db,identity,expectedRevision:body.expectedRevision,snapshot:body.snapshot
   });
  return res.status(200).json({ok:true,...result});
 }catch(error){
  if(error?.code==='ROMO_CIERRE_PENDIENTES')
   return fail(res,409,'Quedan solicitudes de la carta por atender; no se cerró la caja');
  if(error?.code==='REVISION_CONFLICTO')
   return fail(res,409,'Romo cambió desde otro equipo. Recarga antes de guardar');
  if(/no es válido|no pertenece|no autorizadas|límite|revisión operativa|supera|El cifrado/.test(String(error?.message||'')))
   return fail(res,400,'El respaldo cifrado de Romo no es válido');
  if(/no tiene permiso|identidad|La identidad|Sin permiso/.test(String(error?.message||'')))
   return fail(res,403,'Sin permiso para guardar Romo');
  return fail(res,503,'No se pudo guardar. Los cambios de Romo no están confirmados');
 }
};
