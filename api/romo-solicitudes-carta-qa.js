'use strict';
/**
 * API única Romo para solicitudes iniciadas por WhatsApp y bandeja del MISMO
 * panel Uki. Esta ruta no crea venta, pago, timbre ni cierre.
 * Apagada hasta habilitación comercial expresa, SQL y autorización de roles.
 */
const fail=(res,code,error)=>res.status(code).json({ok:false,error});
module.exports=async function romoSolicitudesCartaQA(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env,origin=String(req.headers?.origin||'');
 const publicOrigin=String(env.ROMO_CARTA_ALLOWED_ORIGIN||'');
 const staffOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(env.VERCEL_ENV!=='production'||
    env.ROMO_CARTA_SOLICITUDES_LIVE_ENABLED!=='true')
  return fail(res,503,'La bandeja de Romo aún no está habilitada');
 const read=req.method==='GET'||req.method==='OPTIONS'&&
   String(req.headers?.['access-control-request-method']||'').toUpperCase()==='GET';
 const expected=read?staffOrigin:publicOrigin;
 if(!/^https:\/\/[^\/\s?#@]+$/.test(expected)||origin!==expected)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',expected);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods',read?'GET,OPTIONS':'POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(req.method==='POST'){
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
   return fail(res,415,'Se espera JSON');
  if(Number(req.headers?.['content-length']||0)>16000)
   return fail(res,413,'Solicitud Romo demasiado grande');
 }
 let mod,auth,reading,config,db;
 try{
  mod=await import('../lib/romo-solicitudes-carta-qa.mjs');
  reading=await import('../lib/romo-claves-lectura-servidor-qa.mjs');
  config=reading.romoPrivateReadConfig(env);
  if(!config||config.storeId!=='romo:serena')throw Error('Sin base Romo');
  const sql=require('@neondatabase/serverless').neon(config.url);
  if(typeof sql.query!=='function')throw Error('Neon Romo no disponible');
  db=Object.freeze({query:(statement,params)=>sql.query(statement,params)});
 }catch{return fail(res,503,'Base exclusiva de Romo no configurada')}
 try{
  if(req.method==='POST'){
   const salt=env.ROMO_SOLICITUDES_RATE_SALT;
   const ip=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
   let outcome;
   try{outcome=await mod.ingresarSolicitudRomoQA({db,request:req.body,ip,salt})}
   catch(e){
    if(e?.code==='ROMO_ORDER_DUPLICATE')return fail(res,409,'Código utilizado para otro pedido');
    if(e?.code==='ROMO_ORDER_RATE')return fail(res,429,'Demasiadas solicitudes; envía tu pedido por WhatsApp');
    if(/pedido|sucursal|formulario|solicitud|antispam|revisa/i.test(String(e?.message||'')))
     return fail(res,400,'Datos de la solicitud de Romo inválidos');
    throw e;
   }
   return res.status(outcome.repetido?200:201).json({ok:true,...outcome});
  }
  auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken,env
  });
  if(!identity)return fail(res,403,'Cuenta Google sin acceso a la bandeja Romo');
  const items=await mod.leerSolicitudesRomoQA({db,identity});
  return res.status(200).json({ok:true,...items});
 }catch{return fail(res,503,'No se pudo completar la consulta de Romo')}
};
