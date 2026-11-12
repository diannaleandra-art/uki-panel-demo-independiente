'use strict';
/**
 * ALTA RESTRINGIDA y apagada por defecto de la misma cuenta Google de Uki.
 * La propietaria autorizó vincular su cuenta, NO habilitar ventas.
 * No recibe UID/email/rol/contraseña desde el navegador; solamente token.
 * Se abrirá sólo con aprobación de publicación y configuración segura.
 */
const fail=(res,status,message)=>res.status(status).json({ok:false,error:message});
module.exports=async function romoDuenosAltaQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env,origin=String(req.headers?.origin||'');
 if(env.VERCEL_ENV!=='production'||
    env.ROMO_DUENOS_ALTA_EXPLICITA_ENABLED!=='true'||
    env.ROMO_DUENOS_VINCULO_ENABLED!=='true'||
    !/^https:\/\/[^\/\s?#@]+$/.test(String(env.ROMO_PANEL_ALLOWED_ORIGIN||''))||
    origin!==env.ROMO_PANEL_ALLOWED_ORIGIN)
   return fail(res,503,'Vinculación de Romo no habilitada');
 res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return fail(res,405,'Método no permitido');
 const type=String(req.headers?.['content-type']||'').split(';')[0].trim();
 if(type!=='application/json'||req.body===null||typeof req.body!=='object'||
    Array.isArray(req.body)||Object.keys(req.body).length!==0)
  return fail(res,400,'Solicitud inválida: no enviar claves ni datos de identidad');
 let module,cfg,db;
 try{
  module=await import('../lib/romo-duenos-alta-qa.mjs');
  cfg=module.romoAltaDuenosConfigQA(env);
  if(!cfg||cfg.origin!==origin)
   return fail(res,503,'Vinculación no configurada');
  const sql=require('@neondatabase/serverless').neon(cfg.databaseUrl);
  db=Object.freeze({query:(statement,params)=>sql(statement,params)});
 }catch{return fail(res,503,'La base privada de Romo no está preparada')}
 try{
  const done=await module.enlazarDuenosRomoConGoogleExistenteQA({
   authorization:req.headers?.authorization,db,env
  });
  return res.status(done.alreadyLinked?200:201).json({
   ok:true,storeId:'romo:serena',ownerLinked:true,
   alreadyLinked:done.alreadyLinked,salesEnabled:false
  });
 }catch{
  // No mostrar token, UID, correo, contraseñas, query SQL ni conexiones.
  return fail(res,403,'No se pudo vincular esta sesión Google a Romo');
 }
};
