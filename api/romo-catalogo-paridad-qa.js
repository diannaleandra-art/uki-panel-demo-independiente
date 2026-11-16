'use strict';
/**
 * Lectura privada para dueños: compara catálogo aprobado Romo vs Neon Romo.
 * No POST, no PATCH, no escritura, no importaciones automáticas.
 * Se mantiene DESACTIVADA sin las dos banderas privadas de QA.
 */
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const STORE='romo:serena';
const fail=(r,s,e)=>r.status(s).json({ok:false,storeId:STORE,error:e});
const validOrigin=x=>/^https:\/\/[a-z0-9.-]+$/i.test(x)&&!String(x).includes('..');

function config(env){
  if(!entornoPanelRomoAutorizado(env)||env.VERCEL_ENV!=='preview'||
     env.ROMO_CATALOGO_PARIDAD_QA_ENABLED!=='true')return null;
  const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
  const carta=String(env.ROMO_CARTA_CATALOGO_QA_ORIGIN||'');
  const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
  if(!validOrigin(origin)||!validOrigin(carta)||origin===carta||
     !/^[a-z0-9.-]+$/.test(host))return null;
  let db;
  try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));}catch{return null;}
  if(!['postgres:','postgresql:'].includes(db.protocol)||
     db.hostname.toLowerCase()!==host||db.pathname!=='/romos_sushi'||
     !db.username||!db.password)return null;
  for(const other of ['UKI_INVENTARIO_LIVE_DATABASE_URL',
      'UKI_INVENTARIO_QA_DATABASE_URL','UKI_FIN_PRIVATE_DATABASE_URL',
      'UKI_FIN_QA_DATABASE_URL']){
    try{if(new URL(String(env[other]||'')).hostname.toLowerCase()===host)return null}
    catch{}
  }
  return {origin,carta,database:db.toString()};
}
module.exports=async function romoCatalogoParidadQA(req,res){
  res.setHeader('Cache-Control','private,no-store,max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Origin');
  const conf=config(process.env);
  if(!conf)return fail(res,503,'Paridad de catálogo Romo no habilitada');
  const actual=String(req.headers?.origin||'');
  const sameHost=!actual&&String(req.headers?.host||'').toLowerCase()===
    new URL(conf.origin).host.toLowerCase();
  if(actual!==conf.origin&&!sameHost)
    return fail(res,403,'Origen del panel Romo no autorizado');
  if(actual)res.setHeader('Access-Control-Allow-Origin',conf.origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return fail(res,405,'Esta consulta no puede guardar datos');
  try{
    const sql=require('@neondatabase/serverless').neon(conf.database);
    const db={query:(q,args)=>sql.query(q,args)};
    const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
    const identity=await auth.resolveRomoIdentity({
      authorization:req.headers?.authorization,db,
      verifyToken:auth.verifyFirebaseGoogleToken
    });
    if(!identity||identity.brand!=='romo'||identity.role!=='duenos')
      return fail(res,403,'Solo los dueños de Romo pueden consultar la comparación');
    const reader=await import('../lib/romo-catalogo-lectura-real-qa.mjs');
    const neon=await reader.leerCatalogoRealPanelRomoQA({db,identity});
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),8000);
    let resp;
    try{
      resp=await fetch(conf.carta+'/api/romo-catalogo-aprobado-qa',{
        method:'GET',headers:{Origin:conf.origin,Accept:'application/json'},
        cache:'no-store',redirect:'error',signal:ctrl.signal
      });
    }finally{clearTimeout(timer);}
    if(!resp.ok)return fail(res,503,'La carta aprobada no permite leer el catálogo aún');
    const carta=await resp.json();
    const mod=await import('../lib/romo-catalogo-paridad-aprobada-qa.mjs');
    return res.status(200).json(mod.compararCatalogosAprobadosRomoQA(carta,neon));
  }catch(e){
    console.error('Error de paridad Romo',String(e?.message||e));
    return fail(res,503,'No se confirmó la comparación de catálogos Romo');
  }
};
module.exports._internalQA={config};
