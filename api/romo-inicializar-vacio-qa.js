'use strict';
/**
 * Primera preparación CIFRADA y VACÍA de Romo La Serena.
 * Solo en preview aprobada. Acción manual confirmada por dueños.
 * Nunca conecta Uki ni habilita operaciones después del INSERT.
 */
const STORE='romo:serena';
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const SENTINEL='ROMO_VACIO_QA_UNA_VEZ';
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
const UKI_DBS=[
 'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
 'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL'
];
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_INICIALIZACION_DUENOS_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(host))return null;
 function database(value,username){
  let u;try{u=new URL(String(value||''));}catch{return null;}
  if(!['postgres:','postgresql:'].includes(u.protocol)||
     u.hostname.toLowerCase()!==host||u.pathname!=='/romos_sushi'||
     !u.username||!u.password||u.username!==username)return null;
  return u.toString();
 }
 const reader=database(env.ROMO_PRIVATE_DATABASE_URL,'romos_app_service');
 const writer=database(env.ROMO_CLAVE_ALTA_PRIVILEGED_DATABASE_URL,'romos_clave_alta_qa_20261114');
 if(!reader||!writer||reader===writer)return null;
 for(const name of UKI_DBS){
  try{if(new URL(String(env[name]||'')).hostname.toLowerCase()===host)return null;}catch{}
 }
 return {origin,reader,writer};
}
module.exports=async function romoInicializarVacioQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Primera preparación Romo no habilitada');
 const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
 if(!esOrigenAutorizadoRomoQA(req,conf.origin))return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return fail(res,405,'Solo preparación inicial por dueños');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join(',')!=='confirmacion,expectedRevision,snapshot'||
    body.expectedRevision!==0||body.confirmacion!==SENTINEL)
  return fail(res,400,'Confirmación de inicialización inválida');
 if(JSON.stringify(body).length>2000000)
  return fail(res,413,'El paquete cifrado es demasiado grande');
 try{
  const vault=await import('../lib/romo-estado-cifrado-persistencia-qa.mjs');
  const cifrado=vault.validarSobreCifradoRomoQA(body.snapshot);
  const neon=require('@neondatabase/serverless').neon;
  const reader=neon(conf.reader),writer=neon(conf.writer);
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,
   db:{query:(sql,params)=>reader.query(sql,params)},
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')
   return fail(res,403,'Solo dueños autorizados');
  // Exigir que la contraseña Uki La Serena ya tenga un verificador enrolado.
  // El servidor NO recibe ni conoce esa contraseña.
  const proof=await reader.query(
   'SELECT uki_source FROM public.romo_clave_compartida_v1 WHERE store_id=$1 AND uki_source=$2 LIMIT 1',
   [STORE,'uki:serena']);
  if(!Array.isArray(proof)||proof.length!==1)
   return fail(res,403,'Primero vincula tu acceso Uki La Serena');
  const existing=await reader.query(
   'SELECT revision FROM public.romo_estado_operativo_v1 WHERE store_id=$1 LIMIT 1',
   [STORE]);
  if(!Array.isArray(existing))throw Error('Respuesta de base inválida');
  if(existing.length>0)return fail(res,409,'Romo ya tiene un estado inicial');
  // Rol escritor limitado: INSERT de cuatro columnas y SELECT SOLO revision.
  // Sin UPDATE/DELETE y sin ON CONFLICT(store_id), que exigiría SELECT adicional.
  const rows=await writer.query(
   'INSERT INTO public.romo_estado_operativo_v1(store_id,revision,snapshot,actualizado_por) '+
   'VALUES($1,1,$2::jsonb,$3) ON CONFLICT DO NOTHING RETURNING revision',
   [STORE,cifrado,identity.userId]
  );
  if(!Array.isArray(rows)||rows.length===0)
   return fail(res,409,'Romo ya fue inicializado; no se reemplazó');
  if(rows.length!==1||Number(rows[0].revision)!==1)
   throw Error('Revisión inicial no confirmada');
  return res.status(201).json({ok:true,storeId:STORE,created:true,revision:1,operacionesHabilitadas:false});
 }catch(e){
  // No registrar tokens, contraseñas, pedidos, correo, ni contenido cifrado.
  const state=typeof e?.code==='string'&&/^[A-Z0-9]{5}$/.test(e.code)?e.code:'NO_SQLSTATE';
  console.error('[romo-inicializacion-qa] no confirmada',{sqlstate:state});
  return fail(res,503,'No se pudo confirmar la preparación inicial de Romo');
 }
};
module.exports._internalQA={config};
