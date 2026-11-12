'use strict';
/**
 * Solo para registrar un verificador CIFRADO de la contraseña YA usada en Uki.
 * No expone una contraseña, ni registra pagos, ni autoriza clientes.
 * Requiere cuenta Google firmada y rol dueños Romo en base independiente.
 */
const deny=(res,status,error)=>res.status(status).json({ok:false,error});
module.exports=async function romoAltaClaveQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env;
 const origin=String(req.headers?.origin||'');
 const expected=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(env.VERCEL_ENV!=='production'||env.ROMO_ACCESO_CLAVES_ALTA_LIVE_ENABLED!=='true'||
    !/^https:\/\/[^\/\s?#@]+$/.test(expected)||origin!==expected)
  return deny(res,503,'La vinculación de claves Romo todavía no está habilitada');
 res.setHeader('Access-Control-Allow-Origin',expected);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return deny(res,405,'Método de vinculación no permitido');
 if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return deny(res,415,'Solo se recibe JSON cifrado');
 const bytes=Number(req.headers?.['content-length']||0);
 if(!Number.isFinite(bytes)||bytes>1800)
  return deny(res,413,'Verificador cifrado demasiado grande');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).join('|')!=='proof')
  return deny(res,400,'No se aceptan contraseñas ni campos ajenos');
 let reading,mod,identityModule,config,db;
 try{
  reading=await import('../lib/romo-claves-lectura-servidor-qa.mjs');
  mod=await import('../lib/romo-claves-alta-qa.mjs');
  identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  // Misma base/host privado de Romo, jamás tablas Uki.
  config=reading.romoPrivateReadConfig(env);
  if(!config||config.origin!==origin)throw Error('Base Romo no configurada');
  const sql=require('@neondatabase/serverless').neon(config.url);
  if(typeof sql.query!=='function')throw Error('SQL Romo no preparado');
  db=Object.freeze({query:(statement,params)=>sql.query(statement,params)});
 }catch{return deny(res,503,'El enrolamiento privado de Romo no está preparado')}
 let identity;
 try{
  identity=await identityModule.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:identityModule.verifyFirebaseGoogleToken,env
  });
 }catch{return deny(res,503,'No se pudo verificar Google para Romo')}
 if(!identity||identity.role!=='duenos')
  return deny(res,403,'Solo la cuenta dueña de Romo puede vincular claves');
 try{
  const result=await mod.enrolarClaveExistenteRomoQA({db,identity,proof:body.proof});
  return res.status(201).json({ok:true,...result});
 }catch(e){
  if(e?.code==='ROMO_PROOF_EXISTS')
   return deny(res,409,'Esta clave ya estaba vinculada; no se reemplazó');
  if(/inválid|verificador|permitid|corresponde|tamaño|campos/i.test(String(e?.message||'')))
   return deny(res,400,'Verificador de Romo inválido');
  return deny(res,503,'No se pudo confirmar la vinculación cifrada de Romo');
 }
};
