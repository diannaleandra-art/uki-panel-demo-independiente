'use strict';
/**
 * RUTA FUTURA del MISMO panel: comprobación de contraseñas Uki para Romo.
 * APAGADA por defecto, solo GET autorizado con Firebase Google + permiso
 * de Romo en el servidor. NUNCA envía contraseñas ni datos de Uki.
 *
 * Los navegadores pueden hacer un preflight OPTIONS desde el panel Uki,
 * pero esto no habilita acceso a registros ni a pedidos.
 */
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
module.exports=async function romoClavesLecturaQA(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Origin');
  const env=process.env;
  const origin=String(req.headers?.origin||'');
  const configuredOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
  const isOrigin=/^https:\/\/[^\/\s?#@]+$/.test(configuredOrigin)&&origin===configuredOrigin;
  const enabled=env.VERCEL_ENV==='preview'&&
    env.VERCEL_GIT_COMMIT_REF==='preparacion/uki-romo-sobre-main-20261114'&&
    env.ROMO_ACCESO_CLAVES_QA_ENABLED==='true';
  if(!enabled||!isOrigin)
    return fail(res,503,'Acceso de Romo todavía no habilitado');
  res.setHeader('Access-Control-Allow-Origin',configuredOrigin);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return fail(res,405,'Método no permitido');

  let reading;
  try{reading=await import('../lib/romo-claves-lectura-servidor-qa.mjs')}catch{
    return fail(res,503,'Verificación de Romo no preparada');
  }
  const config=reading.romoClavesReadConfig(env);
  if(!config)return fail(res,503,'Base exclusiva de Romo no configurada');
  let db;
  try{db=require('@neondatabase/serverless').neon(config.url)}catch{
    return fail(res,503,'Base exclusiva de Romo no disponible');
  }
  let auth;
  try{auth=await import('../lib/romo-identidad-servidor-qa.mjs')}catch{
    return fail(res,503,'No se pudo verificar la sesión Google');
  }
  try{
    const identity=await auth.resolveRomoIdentity({
      authorization:req.headers?.authorization,
      db,
      verifyToken:auth.verifyFirebaseGoogleToken
    });
    if(!identity)return fail(res,403,'Sin autorización para Romo La Serena');
    const outcome=await reading.readRomoSharedPassProofs({db,identity});
    return res.status(200).json({ok:true,...outcome});
  }catch{
    // No filtrar datos del esquema, errores SQL, UID, secretos ni contraseñas.
    return fail(res,503,'Verificación de Romo temporalmente no disponible');
  }
};
