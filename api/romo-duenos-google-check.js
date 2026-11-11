'use strict';
/**
 * Solo comprobación de Google de dueños para Romo La Serena.
 *
 * No conecta bases de datos ni crea usuarios/contraseñas/permisos.
 * No altera pedidos/caja/inventario de Uki ni de Romo.
 * Se activa exclusivamente mediante variables de Vercel en producción.
 */
const PROJECT='uki-panel-f4909';
const SOURCE='https://securetoken.google.com/'+PROJECT;
const TOKEN=/^Bearer ([A-Za-z0-9_.-]{30,12000})$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORIGIN=/^https:\/\/[^\s\/?#@]+$/;
const KEY_URL='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks;

const fail=(res,status,msg)=>res.status(status).json({ok:false,error:msg});

function configuration(env){
 if(env.VERCEL_ENV!=='production'||env.ROMO_DUENOS_VINCULO_ENABLED!=='true')
  return null;
 const ownerEmail=String(env.ROMO_DUENOS_GOOGLE_EMAIL||'').trim().toLowerCase();
 const allowedOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'').trim();
 if(!EMAIL.test(ownerEmail)||ownerEmail.includes(',')||!ORIGIN.test(allowedOrigin))
  return null;
 return {ownerEmail,allowedOrigin};
}
async function verifyGoogle(token,config){
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 jwks ||= createRemoteJWKSet(new URL(KEY_URL));
 const {payload}=await jwtVerify(token,jwks,{
  issuer:SOURCE,audience:PROJECT,algorithms:['RS256']
 });
 const uid=String(payload.sub||'');
 const email=String(payload.email||'').trim().toLowerCase();
 if(!UID.test(uid)||!payload.email_verified||
    payload.firebase?.sign_in_provider!=='google.com'||
    email!==config.ownerEmail)return false;
 return true;
}
module.exports=async function romoDuenosGoogleCheck(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const config=configuration(process.env);
 const origin=String(req.headers?.origin||'');
 if(!config||origin!==config.allowedOrigin)
  return fail(res,503,'Comprobación Google Romo no habilitada');
 res.setHeader('Access-Control-Allow-Origin',config.allowedOrigin);
 res.setHeader('Access-Control-Allow-Headers','Authorization');
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return fail(res,405,'Método no permitido');

 const match=String(req.headers?.authorization||'').match(TOKEN);
 if(!match||match[1].startsWith('UKIDEV1.'))
  return fail(res,403,'Google no autorizado para Romo');
 let verified=false;
 try{verified=await verifyGoogle(match[1],config)}catch{}
 if(!verified)return fail(res,403,'Google no autorizado para Romo');
 // NO expone email, UID ni datos internos y NO activa Romo.
 return res.status(200).json({
  ok:true,storeId:'romo:serena',googleVerified:true,
  authorizationGranted:false,requiresRomoRoleEnrollment:true
 });
};
