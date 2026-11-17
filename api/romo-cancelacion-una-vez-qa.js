'use strict';
/**
 * ROMO — intención de cancelación QA, apagada por defecto.
 * Guarda únicamente una constancia fuera del snapshot AES-GCM.
 * No modifica pedidos ni caja: NO afirma que el pedido esté cancelado.
 * Nunca abre las banderas del guardado genérico.
 * No se llama desde la UI hasta probar la reconciliación.
 */
const {config:configEstado}=require('./romo-estado-cifrado-panel-qa.js')._internalQA;
const {esOrigenAutorizadoRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
const STORE='romo:serena';
const send=(res,status,message)=>res.status(status).json({ok:false,storeId:STORE,error:message});

function config(env={}){
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816'||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel'||
    env.ROMO_CANCELACION_UNICA_QA_ENABLED!=='true'||
    // Para este piloto no habilitar la escritura comercial genérica.
    env.ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED==='true'||
    env.ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED==='true')
   return null;
 const cfg=configEstado(env);
 if(!cfg)return null;
 let parsed;
 try{parsed=new URL(cfg.url)}catch{return null}
 if(parsed.username!=='romos_app_service')return null;
 return Object.freeze({url:cfg.url,origin:cfg.origin});
}

module.exports=async function romoCancelarUnicaQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const cfg=config(process.env);
 if(!cfg)return send(res,503,'Piloto único Romo no habilitado');
 if(!esOrigenAutorizadoRomoQA(req,cfg.origin))
  return send(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Methods','POST');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(req.method==='OPTIONS'){
  // El preflight sólo habilita el mismo origen y método POST, sin operar Neon.
  if(String(req.headers?.['access-control-request-method']||'').toUpperCase()!=='POST')
   return send(res,403,'Preflight no autorizado');
  return res.status(204).end();
 }
 if(req.method!=='POST')return send(res,405,'Sólo registro de intención QA mediante POST');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return send(res,415,'Se requiere JSON');
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||
    JSON.stringify(req.body).length>1400)
  return send(res,400,'Paquete de cancelación inválido');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(sql,args)=>neon.query(sql,args)};
  const identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await identityModule.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:identityModule.verifyFirebaseGoogleToken
  });
  if(identity?.role!=='duenos')return send(res,403,'Acceso de dueños obligatorio');
  const {guardarCancelacionUnicaRomoQA}=await import('../lib/romo-cancelacion-una-vez-qa.mjs');
  const result=await guardarCancelacionUnicaRomoQA({db,identity,datos:req.body});
  return res.status(200).json(result);
 }catch(error){
  const msg=String(error?.message||'');
  if(/Solicitud duplicada, revisión modificada/.test(msg))
   return send(res,409,'Ya existe una solicitud o la revisión cambió; revisar antes de repetir');
  if(/permiso|Identidad|dueños|autorizad/i.test(msg))
   return send(res,403,'Operación no autorizada');
  if(/Formulario|Pedido y revisión|quién canceló|responsable|motivo|intención de cancelación inválid/i.test(msg))
   return send(res,400,'Solicitud de cancelación inválida');
  // No se revela SQL, tokens, bases ni credenciales.
  return send(res,503,'No se confirmó la intención de cancelación QA');
 }
};
module.exports._internalQA={config};
