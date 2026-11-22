'use strict';
const {operate}=require('../lib/costeo-precios-servicio-v1.cjs');
async function dispatch(req,res,store,db,uid){
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>40000)return fail(res,400,'Solicitud inválida.');
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
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
function config(env){
 if(!entornoPanelRomoAutorizado(env)||
   env.ROMO_CAJA_ACUMULADA_LECTURA_QA_ENABLED!=='true')return null;
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 let db;try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null;}
 if(!/^[a-z0-9.-]+$/.test(host)||!host.endsWith('.neon.tech')||
    !/^https:\/\/[^\/\s?#@]+$/.test(origin)||
    !['postgres:','postgresql:'].includes(db.protocol)||
    db.hostname.toLowerCase()!==host||db.pathname!=='/romos_sushi'||
    db.username!=='romos_app_service'||!db.password)return null;
 for(const name of ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
                    'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{
   if(new URL(String(env[name]||'')).hostname.toLowerCase()===host)return null;
  }catch{}
 }
 return {url:db.toString(),origin,
  write:env.ROMO_CAJA_ACUMULADA_ESCRITURA_QA_ENABLED==='true'};
}

module.exports=async(req,res)=>{
 if(process.env.ROMO_COSTEO_V1_ENABLED!=='true')return fail(res,404,'Costos aún no habilitados.');
 const conf=config(process.env);if(!conf)return fail(res,503,'Base de datos no disponible.');
 const origin=String(req.headers?.origin||'');
 if(origin!==conf.origin)return fail(res,403,'Origen no autorizado.');
 headers(res,origin);
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST'||String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')return fail(res,405,'Solicitud no permitida.');
 try{
  const neon=require('@neondatabase/serverless').neon(conf.url);
  const db={query:(statement,params)=>neon.query(statement,params)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({authorization:req.headers?.authorization,db,verifyToken:auth.verifyFirebaseGoogleToken});
  if(!identity||identity.brand!=='romo'||identity.role!=='duenos')return fail(res,403,'Acceso exclusivo de dueños.');
  if(req.body?.branch!=='romo')return fail(res,400,'Sucursal inválida.');
  return await dispatch(req,res,'romo:serena',db,identity.userId);
 }catch(e){return fail(res,503,'No se pudo confirmar el precio. Actualiza antes de reintentar.');}
};
