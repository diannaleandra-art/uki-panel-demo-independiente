'use strict';
const {operate}=require('../lib/costeo-precios-servicio-v1.cjs');
async function dispatch(req,res,store,db,uid){
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>3000)return fail(res,400,'Solicitud inválida.');
 const result=await operate(db,store,uid,body);
 return res.status(result.status||200).json(result);
}
function headers(res,origin){
 res.setHeader('Cache-Control','private,no-store');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
}
function fail(res,status,error){return res.status(status).json({ok:false,error});}
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
async function adminUser(req,env=process.env){
 const bearer=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 // Reutiliza las MISMAS cuentas Google que ya están autorizadas en el panel Uki.
 // No hay otro PIN, contraseña, Google ni registro separado para Caja acumulada.
 const uids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!uids.includes(payload.sub)&&!(payload.email_verified&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub)};
}

module.exports=async(req,res)=>{
 const origin=String(req.headers?.origin||'');
 if(process.env.UKI_COSTEO_V1_ENABLED!=='true'||process.env.VERCEL_ENV!=='production')return fail(res,404,'Costos aún no habilitados.');
 if(origin!=='https://diannaleandra-art.github.io')return fail(res,403,'Origen no autorizado.');
 headers(res,origin);
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST'||String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')return fail(res,405,'Solicitud no permitida.');
 const user=await adminUser(req).catch(()=>null);
 if(!user)return fail(res,403,'Acceso exclusivo de administración.');
 const branch=req.body?.branch;
 if(!['arica','serena'].includes(branch))return fail(res,400,'Sucursal inválida.');
 const url=dbUrl();if(!url)return fail(res,503,'Base de datos no disponible.');
 try{return await dispatch(req,res,'uki:'+branch,require('@neondatabase/serverless').neon(url),user.uid);}
 catch(e){return fail(res,503,'No se pudo confirmar el precio. Actualiza antes de reintentar.');}
};
