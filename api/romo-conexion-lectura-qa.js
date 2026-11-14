'use strict';
/**
 * Romo La Serena: diagnóstico de conexión exclusivamente de LECTURA.
 * No abre caja, no retorna el snapshot cifrado y jamás escribe en Neon.
 * Disponible solo en la rama de prueba autorizada por dueños.
 */
const STORE='romo:serena';
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const reply=(res,status,error)=>res.status(status).json({ok:false,error});
const OTHER_DATABASES=[
 'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
 'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL'
];
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
   env.ROMO_CONEXION_LECTURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(host))return null;
 let db;
 try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null;}
 if(!['postgres:','postgresql:'].includes(db.protocol)||
   db.hostname.toLowerCase()!==host||db.pathname!=='/romos_sushi'||
   !db.username||!db.password)return null;
 for(const key of OTHER_DATABASES){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null;}catch{}
 }
 return {origin,db:db.toString()};
}
module.exports=async function romoConexionLecturaQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf)return reply(res,503,'Lectura de Romo no habilitada');
 const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
 if(!esOrigenAutorizadoRomoQA(req,conf.origin))
  return reply(res,403,'Origen de Romo no autorizado');
 res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization');
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return reply(res,405,'Solo consulta; las operaciones están desactivadas');
 try{
  const neon=require('@neondatabase/serverless').neon(conf.db);
  const db={query:(sql,params)=>neon.query(sql,params)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')
   return reply(res,403,'Solo dueños autorizados pueden comprobar Romo');
  // Metadatos únicamente, nunca el sobre AES ni datos de caja.
  const rows=await db.query(
   'SELECT revision FROM public.romo_estado_operativo_v1 WHERE store_id=$1 LIMIT 2',
   [STORE]
  );
  if(!Array.isArray(rows)||rows.length>1)throw Error('Estado ambiguo');
  const revision=rows.length===1?Number(rows[0].revision):0;
  if(!Number.isSafeInteger(revision)||revision<0||(rows.length===1&&revision===0))
   throw Error('Revisión inesperada');
  return res.status(200).json({
   ok:true,storeId:STORE,inicializado:revision>0,
   soloLectura:true,operacionesHabilitadas:false
  });
 }catch{
  return reply(res,503,'No se pudo consultar la conexión independiente de Romo');
 }
};
module.exports._internalQA={config};
