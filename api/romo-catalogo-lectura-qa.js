'use strict';
/**
 * Futuro GET del catálogo real de Romo para el MISMO panel Uki.
 * Sin POST/PUT/DELETE. No activo: preview, rama y flag explícitos.
 */
const STORE='romo:serena';
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const fail=(res,status,msg)=>res.status(status).json({ok:false,error:msg});
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
   env.ROMO_CATALOGO_LECTURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const expected=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(expected))
  return null;
 let database;
 try{database=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 if(!['postgres:','postgresql:'].includes(database.protocol)||
    database.hostname.toLowerCase()!==expected||
    database.pathname!=='/romos_sushi'||!database.username||!database.password)
  return null;
 for(const key of [
   'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
   'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===expected)return null}catch{}
 }
 return {origin,database:database.toString()};
}
module.exports=async function romoCatalogoLecturaQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Catálogo del panel Romo no habilitado');
 const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
 if(!esOrigenAutorizadoRomoQA(req,conf.origin))
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization');
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return fail(res,405,'Solo lectura de catálogo');
 try{
  const sql=require('@neondatabase/serverless').neon(conf.database);
  const db={query:(query,args)=>sql.query(query,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity)return fail(res,403,'Sin permiso para la carta Romo');
  const reader=await import('../lib/romo-catalogo-lectura-real-qa.mjs');
  const result=await reader.leerCatalogoRealPanelRomoQA({db,identity});
  return res.status(200).json(result);
 }catch{return fail(res,503,'Catálogo Romo temporalmente no disponible');}
};
module.exports._internalQA={config};
