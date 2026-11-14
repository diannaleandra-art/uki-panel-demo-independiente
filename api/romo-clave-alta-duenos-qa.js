'use strict';
/**
 * Alta inicial de UNA PRUEBA CIFRADA de la clave existente Uki en Romo.
 * Exclusivo dueños con Google firmado y rol en Neon Romo.
 * Nunca recibe contraseñas. Nunca reemplaza una prueba ya guardada.
 * Apagado salvo preview/branch y flag(s) de autorización explícitos.
 */
const STORE='romo:serena';
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const fail=(res,code,msg)=>res.status(code).json({ok:false,error:msg});
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_CLAVE_ALTA_QA_ENABLED!=='true'||
    env.ROMO_CLAVE_ALTA_ESCRITURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(host))return null;
 function parse(raw){
  let u;try{u=new URL(String(raw||''))}catch{return null}
  return ['postgres:','postgresql:'].includes(u.protocol)&&
   u.hostname.toLowerCase()===host&&u.pathname==='/romos_sushi'&&
   u.username&&u.password?u.toString():null;
 }
 const reader=parse(env.ROMO_PRIVATE_DATABASE_URL);
 const writer=parse(env.ROMO_CLAVE_ALTA_PRIVILEGED_DATABASE_URL);
 if(!reader||!writer||reader===writer)return null;
 for(const key of [
  'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
  'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
   try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 return {origin,reader,writer};
}
module.exports=async function romoClaveAltaDuenosQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Alta de clave Romo no habilitada');
 const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
 if(!esOrigenAutorizadoRomoQA(req,conf.origin))
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return fail(res,405,'Método no permitido');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Formato no permitido');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
   Object.keys(body).some(k=>!['ukiSource','proof'].includes(k))||
   JSON.stringify(body).length>1500)
  return fail(res,400,'Prueba cifrada inválida');
 try{
  const validator=await import('../lib/romo-clave-compartida-qa.mjs');
  const proof=body.proof;
  const checked=validator.validateRomoPassProof(proof);
  if(body.ukiSource!==checked.slot||proof.storeId!==STORE)
   return fail(res,400,'Sucursal de origen inválida');

  const neon=require('@neondatabase/serverless').neon;
  const reader=neon(conf.reader),writer=neon(conf.writer);
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,
   db:{query:(query,args)=>reader.query(query,args)},
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')
   return fail(res,403,'Solo dueños autorizados pueden registrar claves');
  const rows=await writer.query(
   'INSERT INTO public.romo_clave_compartida_v1(store_id,uki_source,proof,updated_by) '+
   'VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(store_id,uki_source) '+
   'DO NOTHING RETURNING uki_source',
   [STORE,checked.slot,JSON.stringify(proof),identity.userId]
  );
  if(!Array.isArray(rows)||rows.length===0)
   return fail(res,409,'La clave de ese local ya está registrada');
  if(rows.length!==1||rows[0].uki_source!==checked.slot)
   throw Error('Escritura inesperada');
  return res.status(201).json({ok:true,storeId:STORE,ukiSource:checked.slot,created:true});
 }catch{
  return fail(res,503,'Registro de clave Romo no disponible');
 }
};
module.exports._internalQA={config};
