'use strict';
/**
 * LECTURA PRIVADA Romo, bloqueada por defecto incluso para clientes reales.
 * No expone productos públicamente, no admite escritura ni toca Uki.
 */
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
module.exports=async function romoCatalogoQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env;
 // No activar en production. QA necesita habilitación separada y explícita.
 if(env.VERCEL_ENV!=='preview'||env.ROMO_CATALOGO_QA_ENABLED!=='true')
  return fail(res,503,'Catálogo Romo en preparación');
 const origin=String(req.headers?.origin||'');
 const allowed=String(env.ROMO_CATALOGO_QA_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[^\/\s?#@]+$/.test(allowed)||origin!==allowed)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',allowed);
 res.setHeader('Access-Control-Allow-Headers','Authorization');
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return fail(res,405,'Sólo lectura');
 let url,host;
 try{
  url=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));
  host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase().trim();
 }catch{return fail(res,503,'Base Romo sin configurar');}
 if(!['postgresql:','postgres:'].includes(url.protocol)||
    url.hostname.toLowerCase()!==host||!host.endsWith('.neon.tech')||
    url.pathname!=='/romos_sushi'||!url.username||!url.password||
    ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_FIN_PRIVATE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL']
      .some(key=>{try{return new URL(env[key]).hostname.toLowerCase()===host}catch{return false}}))
  return fail(res,503,'La base Romo no es independiente');
 try{
  const db=require('@neondatabase/serverless').neon(url.toString());
  const identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  const catalogModule=await import('../lib/romo-catalogo-integracion-qa.mjs');
  const identity=await identityModule.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:identityModule.verifyFirebaseGoogleToken,env
  });
  if(!identity)return fail(res,403,'Sin permiso Romo');
  const result=await catalogModule.readRomoCatalog({db,identity});
  return res.status(200).json({ok:true,...result});
 }catch{return fail(res,503,'No se pudo consultar el catálogo de Romo');}
};