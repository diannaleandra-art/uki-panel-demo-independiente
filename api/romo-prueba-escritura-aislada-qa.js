'use strict';
/**
 * Comprobación ÚNICA de escritura para Romo QA.
 * - Solo Vercel Preview en la rama QA del proyecto Romo.
 * - Solo Neon BRANCH QA: URL y host separados de la base principal.
 * - Solo Firebase Google firmado con rol 'duenos' en esa rama Neon.
 * - INSERT idempotente de prueba, SIN UPDATE al estado cifrado ni caja.
 * - OFF por defecto. No representa cancelación del pedido real.
 */
const {createHash}=require('node:crypto');
const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
const OP='romo-qa-autorizacion-20261117';
const STORE='romo:serena';
const REV=2;
const send=(res,status,message)=>res.status(status).json({
 ok:false,tipo:'prueba_escritura_aislada',error:message
});
function config(env={}){
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816'||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel'||
    env.ROMO_QA_PRUEBA_ESCRITURA_ENABLED!=='true'||
    env.ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED==='true'||
    env.ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED==='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[^/\s?#@]+$/.test(origin))return null;
 const expectedHost=String(env.ROMO_QA_PRUEBA_DB_HOST||'').toLowerCase();
 if(!/^ep-[a-z0-9-]+\.c-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(expectedHost))
  return null;
 let qa,main;
 try{
  qa=new URL(String(env.ROMO_QA_PRUEBA_DB_URL||''));
  main=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));
 }catch{return null}
 if(!['postgres:','postgresql:'].includes(qa.protocol)||
    qa.username!=='romos_app_service'||!qa.password||
    qa.pathname!=='/romos_sushi'||qa.hostname.toLowerCase()!==expectedHost||
    qa.hostname.toLowerCase()===main.hostname.toLowerCase()||
    qa.toString()===main.toString())
  return null;
 return Object.freeze({origin,url:qa.toString()});
}
const SQL=[
 'INSERT INTO public.romo_prueba_escritura_aislada_qa_v1',
 ' (operation_id,store_id,observed_revision,actor_sha256)',
 'SELECT $1,$2,$3,$4 FROM public.romo_estado_operativo_v1 AS e',
 'WHERE e.store_id=$2 AND e.revision=$3',
 'ON CONFLICT (operation_id) DO NOTHING',
 'RETURNING operation_id,observed_revision'
].join(' ');
async function probe({db,identity,body}={}){
 if(identity?.brand!=='romo'||identity?.role!=='duenos'||
    !Array.isArray(identity?.branches)||!identity.branches.includes('serena')||
    typeof identity?.userId!=='string'||!identity.userId)
  throw Object.assign(Error('Sólo dueños de Romo'),{code:'ROLE'});
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!=='expectedRevision|operationId'||
    body.operationId!==OP||body.expectedRevision!==REV)
  throw Object.assign(Error('Operación QA inválida'),{code:'BODY'});
 if(!db||typeof db.query!=='function')
  throw Object.assign(Error('Neon QA no disponible'),{code:'QA_DB'});
 const actorHash=createHash('sha256').update(identity.userId,'utf8').digest('hex');
 const rows=await db.query(SQL,[OP,STORE,REV,actorHash]);
 if(!Array.isArray(rows)||rows.length!==1||
    rows[0]?.operation_id!==OP||Number(rows[0]?.observed_revision)!==REV)
  throw Object.assign(Error('Prueba ya ejecutada o revisión distinta'),{code:'REPLAY'});
 return Object.freeze({
  ok:true,tipo:'prueba_escritura_aislada',soloQA:true,
  revisionObservada:REV,registrosCreados:1,
  pedidoCancelado:false,pagosModificados:false,cajaModificada:false
 });
}
module.exports=async function endpoint(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const cfg=config(process.env);
 if(!cfg)return send(res,503,'Prueba aislada QA deshabilitada');
 if(!esOrigenAutorizadoRomoQA(req,cfg.origin))
  return send(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(req.method==='OPTIONS'){
  if(String(req.headers?.['access-control-request-method']||'').toUpperCase()!=='POST')
   return send(res,403,'Método previo no permitido');
  return res.status(204).end();
 }
 if(req.method!=='POST')return send(res,405,'Sólo POST de prueba');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return send(res,415,'Solo JSON');
 if(!req.body||JSON.stringify(req.body).length>200)
  return send(res,400,'Paquete de prueba inválido');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(sql,args)=>neon.query(sql,args)};
  const identityMod=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await identityMod.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:identityMod.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')return send(res,403,'Sólo dueños autorizados');
  const result=await probe({db,identity,body:req.body});
  return res.status(200).json(result);
 }catch(error){
  if(error?.code==='ROLE')return send(res,403,'Acceso insuficiente');
  if(error?.code==='BODY')return send(res,400,'Solicitud no autorizada');
  if(error?.code==='REPLAY')return send(res,409,'La prueba ya fue registrada o la revisión cambió');
  return send(res,503,'No fue posible confirmar la prueba en Neon QA');
 }
};
module.exports._internalQA={config,probe,SQL};
