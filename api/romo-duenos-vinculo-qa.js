'use strict';
/**
 * ENDPOINT FUTURO: comprobar el Google de dueños de Romo dentro de la
 * sesión existente de Uki. Solo lectura de identidad, SIN permisos ni SQL.
 * No recibe clave de Uki. Está APAGADO por defecto.
 */
const deny=(res,status,error)=>res.status(status).json({ok:false,error});
module.exports=async function romoDuenosVinculoQA(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Origin');

  const env=process.env;
  const expectedOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
  const origin=String(req.headers?.origin||'');
  if(env.VERCEL_ENV!=='production'||
     env.ROMO_DUENOS_VINCULO_ENABLED!=='true'||
     !/^https:\/\/[^\/\s?#@]+$/.test(expectedOrigin)||
     origin!==expectedOrigin)
    return deny(res,503,'Verificación de cuenta Romo no habilitada');

  res.setHeader('Access-Control-Allow-Origin',expectedOrigin);
  res.setHeader('Access-Control-Allow-Headers','Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return deny(res,405,'Método no permitido');

  let module;
  try{module=await import('../lib/romo-duenos-vinculo-qa.mjs')}catch{
    return deny(res,503,'Comprobación de Google no disponible');
  }
  if(!module.ownerLinkInspectionEnabled(env))
    return deny(res,503,'Comprobación de Google no configurada');

  const result=await module.inspectRomoOwnerGoogle({
    authorization:req.headers?.authorization,
    env
    // Sin sustitución de verifyToken: siempre verifica firma Firebase en servidor.
  });
  if(!result.ok)return deny(res,403,'Esta cuenta Google no está autorizada para la preparación');

  // Este resultado NO concede permisos: solo identifica la cuenta
  // Google verificada, para vincularla en una operación FUTURA autorizada.
  return res.status(200).json({
    ok:true,storeId:'romo:serena',googleVerified:true,
    requiresRomoRoleEnrollment:true,authorizationGranted:false
  });
};
