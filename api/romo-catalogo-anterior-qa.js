'use strict';
/**
 * Lectura desde Supabase de catálogo comercial preexistente de Romo.
 * Requiere: rama exacta QA, bandera privada, Google dueño + Neon permiso,
 * clave publishable de tabla pública. No usa service_role, no escribe a
 * Supabase/Neon y no activa ventas. Datos sólo de productos, nunca pedidos.
 */
const legacyHost='awldmutolllpyucvhicc.supabase.co';
const QA_BRANCH='qa/romo-catalogo-inventario-sin-publicar-20261111';
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
const qa=(env=process.env)=>env.VERCEL_ENV==='preview'&&
 env.VERCEL_GIT_COMMIT_REF===QA_BRANCH&&
 env.ROMO_IMPORTACION_CATALOGO_QA_ENABLED==='true'&&
 env.ROMO_CATALOGO_QA_ENABLED==='true'&&
 /^[a-z0-9.-]+\.vercel\.app$/.test(String(env.VERCEL_URL||''));
module.exports=async function romoCatalogoAnteriorQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!qa())return fail(res,503,'Importación de Romo no habilitada');
 const actualHost=String(req.headers?.host||'').toLowerCase();
 const expected=String(process.env.VERCEL_URL||'').toLowerCase();
 if(actualHost!==expected||req.headers?.origin&&req.headers.origin!=='https://'+expected)
  return fail(res,403,'Origen no autorizado');
 if(req.method!=='GET')return fail(res,405,'Sólo lectura');
 const key=String(process.env.ROMO_SUPABASE_CATALOGO_PUBLISHABLE_KEY||'');
 if(!/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(key))
  return fail(res,503,'Catálogo anterior no configurado');
 let db;
 try{
  const setup=require('./romo-catalogo-qa.js')._testing.dbConfig(process.env);
  if(!setup)return fail(res,503,'Permiso de Romo no configurado');
  db=require('@neondatabase/serverless').neon(setup);
 }catch{return fail(res,503,'Identidad Romo no disponible')}
 try{
  const identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await identityModule.resolveRomoIdentity({
   db,authorization:req.headers?.authorization,
   verifyToken:identityModule.verifyFirebaseGoogleToken,env:process.env
  });
  if(!identity||identity.role!=='duenos')return fail(res,403,'Solo dueños autorizados');
  const legacy=await import('../lib/romo-catalogo-anterior-lectura-qa.mjs');
  const ctl=new AbortController();
  const timeout=setTimeout(()=>ctl.abort(),11000);
  let response;
  try{
   response=await fetch(legacy.legacySupabaseUrl(),{
    method:'GET',headers:{apikey:key},redirect:'error',credentials:'omit',
    cache:'no-store',signal:ctl.signal
   });
  }finally{clearTimeout(timeout)}
  if(!response.ok)return fail(res,502,'Supabase no entregó productos disponibles para revisión');
  const len=Number(response.headers.get('content-length')||0);
  if(len>150000)return fail(res,502,'Catálogo origen demasiado grande');
  const raw=await response.text();
  if(raw.length>150000)return fail(res,502,'Catálogo origen demasiado grande');
  const data=legacy.legacyRomoCatalogReview(JSON.parse(raw));
  return res.status(200).json({ok:true,...data});
 }catch{
  return fail(res,503,'No se pudo consultar el catálogo anterior. No se cambió ningún precio');
 }
};
module.exports._testing={qa};
