'use strict';
/**
 * Proyección para dueños Romo exclusivamente en Preview. Nunca publica ventas,
 * no lee de Uki ni escribe sobre la carta aprobada.
 */
const STORE='romo:serena';
const fail=(res,status,error)=>res.status(status).json({ok:false,storeId:STORE,error});
const {config}=require('./romo-carta-ediciones-seguras-qa.js')._internalQA;
const {resolverOrigenLecturaUnificadaRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
module.exports=async function vistaPreviaRomoQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 if(process.env.VERCEL_ENV!=='preview'||
    process.env.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816')
   return fail(res,503,'Vista previa exclusiva de Romo QA');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Vista previa de Romo no habilitada');
 const origin=String(req.headers?.origin||'');
 const access=resolverOrigenLecturaUnificadaRomoQA(req,conf.panel,conf.sharedRead);
 if(!access)return fail(res,403,'Origen no autorizado');
 if(origin)res.setHeader('Access-Control-Allow-Origin',access.origin);
 res.setHeader('Access-Control-Allow-Methods',access.compartido?'GET,OPTIONS':'GET,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return fail(res,405,'Vista previa solo lectura');
 try{
  const {neon}=require('@neondatabase/serverless');
  const sql=neon(conf.database);
  const db={query:(text,args)=>sql.query(text,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.brand!=='romo'||identity.role!=='duenos')
   return fail(res,403,'La vista previa exige cuenta de dueños');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
  let base;
  try{
   const response=await fetch(conf.carta+'/api/romo-catalogo-aprobado-qa',{
    method:'GET',headers:{Origin:conf.panel,Accept:'application/json',
     ...await require('../lib/romo-oidc-s2s-qa.cjs').headersOIDCRomoQA(process.env)},
    cache:'no-store',redirect:'error',signal:ctl.signal
   });
   if(!response.ok)throw Error('Catálogo Romo no disponible');
   const text=await response.text();
   if(text.length>200000)throw Error('Catálogo demasiado grande');
   base=JSON.parse(text);
  }finally{clearTimeout(timer);}
  const [commercial,admin,photos]=await Promise.all([
   db.query('SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',[STORE]),
   db.query('SELECT store_id,revision,contenido FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1',[STORE]),
   db.query('SELECT sku,version FROM public.romo_carta_admin_fotos_qa_v1 WHERE store_id=$1',[STORE])
  ]);
  if(!Array.isArray(commercial)||commercial.length!==1||
     !Array.isArray(admin)||admin.length!==1||
     !Array.isArray(photos)||photos.length>250)
    throw Error('Faltan los documentos aprobados de Romo QA');
  const editing=await import('../lib/romo-carta-ediciones-seguras-qa.mjs');
  const official=editing.vistaEdicionesRomoQA(base,commercial[0]);
  const project=require('../lib/romo-carta-vista-previa-admin-qa.cjs');
  const result=project.proyectarVistaAdminRomoQA(official,admin[0],photos);
  return res.status(200).json(result);
 }catch(e){
  console.error('Vista previa privada Romo falló:',String(e?.message||e));
  return fail(res,503,'No se puede confirmar la vista previa; no se cambió el catálogo');
 }
};