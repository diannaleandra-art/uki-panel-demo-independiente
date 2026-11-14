'use strict';
/** Owner-only Romo QA operational metadata. No sales, orders or snapshots. */
const STORE='romo:serena',BRANCH='qa/integracion-panel-unico-romo-serena-20261112';
const HOST='ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech';
const ORIGIN='https://uki-sushi-panel-git-qa-integracion-pa-261e5e-diannaleandra-7046.vercel.app';
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
function config(env={}){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_FIN_SYNC_QA_BRANCH!==BRANCH||env.ROMO_FIN_OWNER_QA_ENABLED!=='true')
  return null;
 let url;
 try{url=new URL(String(env.ROMO_CIERRES_QA_DATABASE_URL||''))}catch{return null}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==HOST||
    url.pathname!=='/romos_sushi'||!url.username||!url.password||
    url.hash||url.searchParams.has('options'))return null;
 return Object.freeze({url:url.toString(),origin:ORIGIN});
}
module.exports=async function romoPanelDiagnosticoQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const cfg=config(process.env);
 if(!cfg)return fail(res,404,'Diagnóstico Romo desactivado.');
 const origin=String(req.headers?.origin||'');
 if(origin!==cfg.origin)return fail(res,403,'Origen no autorizado.');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return fail(res,405,'Solo consulta.');
 if(Number(req.headers?.['content-length']||0)>0)
  return fail(res,400,'No se aceptan datos en la consulta.');
 let db,auth;
 try{
  db=require('@neondatabase/serverless').neon(cfg.url);
  auth=await import('../lib/romo-identidad-servidor-qa.mjs');
 }catch{return fail(res,503,'Romo QA no disponible.');}
 let identity;
 try{
  identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken,env:process.env
  });
 }catch{return fail(res,503,'No se comprobó la identidad.');}
 if(!identity||identity.role!=='duenos'||identity.brand!=='romo'||
    !identity.branches?.includes('serena'))
  return fail(res,403,'Solo dueños autorizados pueden consultar Romo.');
 try{
  const sql=
   'SELECT '+
   '(SELECT revision FROM public.romo_estado_operativo_v1 WHERE store_id=$1 LIMIT 1) AS revision,'+
   '(SELECT COUNT(*)::integer FROM public.romo_turnos_v1 WHERE store_id=$1) AS turnos,'+
   "(SELECT COUNT(*)::integer FROM public.romo_solicitudes_carta_v1 WHERE store_id=$1 AND branch='serena' AND estado='pendiente') AS solicitudes_pendientes,"+
   '(SELECT COUNT(*)::integer FROM public.romo_cierres_constancia_v1 WHERE store_id=$1) AS cierres_confirmados';
  const rows=await db.query(sql,[STORE]);
  if(!Array.isArray(rows)||rows.length!==1)return fail(res,503,'Consulta incompleta.');
  const row=rows[0],revision=row.revision===null?0:Number(row.revision);
  const turnos=Number(row.turnos),solicitudesPendientes=Number(row.solicitudes_pendientes),
   cierresConfirmados=Number(row.cierres_confirmados);
  if(![revision,turnos,solicitudesPendientes,cierresConfirmados].every(v=>
   Number.isSafeInteger(v)&&v>=0))
    return fail(res,503,'Estado de Romo inconsistente.');
  return res.status(200).json({
   ok:true,storeId:STORE,sucursal:'Romo’s Sushi La Serena',
   revision,turnos,solicitudesPendientes,cierresConfirmados,
   modo:'solo_lectura',operacionesHabilitadas:false
  });
 }catch{return fail(res,503,'No se pudo consultar Neon Romo QA.');}
};
module.exports._testing={config};
