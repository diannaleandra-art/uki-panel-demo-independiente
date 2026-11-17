'use strict';
/**
 * Sólo ensayo QA de cancelación cifrada sobre BRANCH SEPARADA de Neon.
 * Conserva extremo-a-extremo: el servidor sólo verifica estructura AES-GCM,
 * propietario Google de Romo, identidad del host QA, revisión exacta,
 * fingerprint previo y auditoría atómica de uso único.
 * NO PUEDE inspeccionar semánticamente el contenido cifrado.
 * NO conecta la escritura general de pedidos, caja ni base principal.
 */
const {createHash}=require('node:crypto');
const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
const STORE='romo:serena',PEDIDO=1,REV=2,OLD_MD5='2ecee5d9256b2fa5b93e77864cbdea51';
const QA_BRANCH='qa/romos-panel-v816';
const send=(res,status,message)=>res.status(status).json({
 ok:false,tipo:'cancelacion_cifrada_solo_qa',error:message
});
function config(env={}){
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!==QA_BRANCH||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel'||
    env.ROMO_QA_CANCELACION_CIFRADA_ENABLED!=='true'||
    env.ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED==='true'||
    env.ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED==='true'||
    env.ROMO_CANCELACION_UNICA_QA_ENABLED==='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_QA_PRUEBA_DB_HOST||'').toLowerCase();
 if(!/^https:\/\/[^/\s?#@]+$/.test(origin)||
    !/^ep-[a-z0-9-]+\.c-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host))
  return null;
 let qa,main;
 try{
  qa=new URL(String(env.ROMO_QA_PRUEBA_DB_URL||''));
  main=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));
 }catch{return null}
 if(!['postgres:','postgresql:'].includes(qa.protocol)||
    qa.hostname.toLowerCase()!==host||qa.hostname.toLowerCase()===main.hostname.toLowerCase()||
    qa.toString()===main.toString()||
    qa.username!=='romos_app_service'||!qa.password||qa.pathname!=='/romos_sushi')
  return null;
 return Object.freeze({origin,url:qa.toString()});
}
const SQL=[
 'WITH original AS (',
 ' SELECT store_id, revision FROM public.romo_estado_operativo_v1',
 ' WHERE store_id=$1 AND revision=$2 AND md5(snapshot::text)=$3',
 ' AND NOT EXISTS (SELECT 1 FROM public.romo_cancelacion_sobre_piloto_qa_v1',
 '   WHERE store_id=$1 AND pedido_id=$6)',
 ' FOR UPDATE',
 '), actualizado AS (',
 ' UPDATE public.romo_estado_operativo_v1 AS e',
 ' SET revision=e.revision+1,snapshot=$4::jsonb,actualizado_por=$5,actualizado_en=NOW()',
 ' FROM original AS prev WHERE e.store_id=prev.store_id AND e.revision=prev.revision',
 ' RETURNING e.store_id,e.revision,md5(e.snapshot::text) AS nuevo_md5',
 '), constancia AS (',
 ' INSERT INTO public.romo_cancelacion_sobre_piloto_qa_v1',
 ' (store_id,pedido_id,revision_anterior,revision_nueva,previo_md5,nuevo_md5,actor_sha256,categoria,motivo_sha256)',
 ' SELECT store_id,$6,$2,revision,$3,nuevo_md5,$7,$8,$9 FROM actualizado',
 ' RETURNING revision_nueva,nuevo_md5',
 ') SELECT revision_nueva,nuevo_md5 FROM constancia'
].join(' ');
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
async function guardarQA({db,identity,body}={}){
 if(identity?.brand!=='romo'||identity?.role!=='duenos'||
    !Array.isArray(identity?.branches)||!identity.branches.includes('serena')||
    typeof identity?.userId!=='string'||!identity.userId)
  throw Object.assign(Error('Dueños de Romo obligatorios'),{code:'ROLE'});
 if(!db||typeof db.query!=='function')
  throw Object.assign(Error('Rama QA no disponible'),{code:'DB'});
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!=='categoria|expectedRevision|motivo|pedidoId|snapshot'||
    body.expectedRevision!==REV||body.pedidoId!==PEDIDO||body.categoria!=='local'||
    typeof body.motivo!=='string'||body.motivo.trim().length<4||
    body.motivo.length>300)
  throw Object.assign(Error('Datos de cancelación de prueba inválidos'),{code:'BODY'});
 const {validarSobreCifradoRomoQA}=await import('../lib/romo-estado-cifrado-persistencia-qa.mjs');
 const snapshot=validarSobreCifradoRomoQA(body.snapshot);
 // La huella AES-GCM no permite verificar qué campos cambian.
 // La autorización del dueño y la comprobación local son indispensables.
 const rows=await db.query(SQL,[
  STORE,REV,OLD_MD5,snapshot,identity.userId,PEDIDO,
  sha(identity.userId),'local',sha(body.motivo.trim())
 ]);
 if(!Array.isArray(rows)||rows.length!==1||Number(rows[0]?.revision_nueva)!==3||
    !/^[a-f0-9]{32}$/.test(String(rows[0]?.nuevo_md5||'')))
  throw Object.assign(Error('QA sin confirmación única'),{code:'REPLAY'});
 return Object.freeze({ok:true,tipo:'cancelacion_cifrada_solo_qa',soloQA:true,
  storeId:STORE,revision:3,pedidoId:PEDIDO,
  auditoriaRegistrada:true,revisionPrincipalModificada:false,
  semanticaVerificadaEnServidor:false});
}
module.exports=async function endpoint(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=config(process.env);
 if(!cfg)return send(res,503,'Ensayo de cancelación QA deshabilitado');
 if(!esOrigenAutorizadoRomoQA(req,cfg.origin))
  return send(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(req.method==='OPTIONS'){
  if(!['GET','POST'].includes(String(req.headers?.['access-control-request-method']||'').toUpperCase()))
   return send(res,403,'Método previo no autorizado');
  return res.status(204).end();
 }
 if(!['GET','POST'].includes(req.method))return send(res,405,'Método no permitido');
 if(req.method==='POST'&&
    (String(req.headers?.['content-type']||'').split(';')[0]!=='application/json'||
     !req.body||typeof req.body!=='object'||Array.isArray(req.body)||
     JSON.stringify(req.body).length>2000000))
  return send(res,400,'Paquete de prueba inválido');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(sql,args)=>neon.query(sql,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')return send(res,403,'Dueños de Romo obligatorios');
  if(req.method==='GET'){
   const rows=await db.query(
    'SELECT revision,snapshot,md5(snapshot::text) AS fingerprint FROM public.romo_estado_operativo_v1 WHERE store_id=$1',
    [STORE]);
   if(!Array.isArray(rows)||rows.length!==1)return send(res,503,'Copia QA no disponible');
   const row=rows[0],revision=Number(row.revision);
   const {validarSobreCifradoRomoQA}=await import('../lib/romo-estado-cifrado-persistencia-qa.mjs');
   validarSobreCifradoRomoQA(row.snapshot);
   return res.status(200).json({ok:true,soloQA:true,storeId:STORE,revision,
    snapshot:row.snapshot,listaParaEnsayo:revision===REV&&row.fingerprint===OLD_MD5});
  }
  const result=await guardarQA({db,identity,body:req.body});
  return res.status(200).json(result);
 }catch(error){
  if(error?.code==='ROLE')return send(res,403,'Dueños autorizados obligatorios');
  if(error?.code==='BODY')return send(res,400,'Solicitud QA inválida');
  if(error?.code==='REPLAY')return send(res,409,'La revisión cambió o el ensayo ya fue realizado; NO repetir');
  return send(res,503,'No se pudo confirmar ensayo QA; revisa Neon antes de repetir');
 }
};
module.exports._internalQA={config,SQL,guardarQA};
