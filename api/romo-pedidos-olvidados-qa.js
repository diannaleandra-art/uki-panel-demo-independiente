'use strict';
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
/**
 * Extensión privada de Historial Romo: versiones de pedidos olvidados.
 * DOS banderas separadas (solo lectura por defecto, escritura apagada).
 * La confirmación usa SQL transaccional CAS + constancia inmutable, nunca
 * una segunda venta ni una operación real de banco/tarjeta.
 */
const STORE='romo:serena';
const CLOSE=/^romo:serena\|\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const fail=(res,status,msg)=>res.status(status).json({ok:false,storeId:STORE,error:msg});
const keys=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join('|')===fields.slice().sort().join('|');
function config(env={}){
 if(!entornoPanelRomoAutorizado(env)||
  env.ROMO_OLVIDOS_LECTURA_QA_ENABLED!=='true')return null;
 let db;try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||
  !/^[a-z0-9.-]+\.neon\.tech$/.test(host)||
  !['postgres:','postgresql:'].includes(db.protocol)||
  db.hostname.toLowerCase()!==host||
  db.pathname!=='/romos_sushi'||db.username!=='romos_app_service'||
  !db.password)return null;
 for(const key of ['UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL',
   'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL']){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)
   return null;}catch{}
 }
 return Object.freeze({url:db.toString(),origin,
  write:env.ROMO_OLVIDOS_ESCRITURA_QA_ENABLED==='true'});
}
module.exports=async function romoPedidosOlvidadosQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=config(process.env);
 if(!cfg)return fail(res,503,'No se habilitó la revisión de olvidos de Romo');
 const method=String(req.method||'').toUpperCase();
 if(!['POST','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 if(String(req.headers?.origin||'')!==cfg.origin)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(method==='OPTIONS')return res.status(204).end();
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'JSON obligatorio');
 const b=req.body;
 if(!b||typeof b!=='object'||Array.isArray(b)||
  JSON.stringify(b).length>2500000||
  !['confirmar','consultar'].includes(b.action))
  return fail(res,400,'Operación de historial no permitida');
 const write=b.action==='confirmar';
 const MIGRACION=require('../lib/seguimiento-aislar-escrituras-legadas-qa.cjs');
 if(MIGRACION.blocked({route:'olvido-snapshot',method,action:b.action}))return MIGRACION.denial(res);
 if(write&&!cfg.write)return fail(res,503,
  'Los recibos versionados de Romo siguen solo consulta');
 if(write&&(!keys(b,['action','expectedRevision','snapshot','resumen'])||
  !Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<1))
  return fail(res,400,'Falta revisión CAS del estado cifrado');
 if(!write&&(!keys(b,['action','fuenteOriginal','version'])||
  !CLOSE.test(b.fuenteOriginal||'')||
  !Number.isSafeInteger(b.version)||b.version<2||b.version>32))
  return fail(res,400,'Indica cierre original y versión válida');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(sql,params)=>neon.query(sql,params)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(identity?.role!=='duenos')
   return fail(res,403,'Solo dueños de Romo pueden emitir y consultar el recibo');
  const lib=await import('../lib/romo-olvidos-constancias-qa.mjs');
  const value=write?await lib.confirmarConstanciaOlvidoRomoQA({
   db,identity,expectedRevision:b.expectedRevision,
   snapshot:b.snapshot,resumen:b.resumen
  }):await lib.consultarConstanciaOlvidoRomoQA({
   db,identity,fuenteOriginal:b.fuenteOriginal,version:b.version
  });
  return res.status(200).json({ok:true,storeId:STORE,...value});
 }catch(e){
  const msg=String(e?.message||'');
  if(/versi[oó]n|duplic|existe|revisi[oó]n|cambi[oó]|unique|conflict|consecutiva/i.test(msg))
   return fail(res,409,'La versión o revisión cambió: consulta Neon/Historial antes de repetir');
  if(/permiso|autoriza|identidad/i.test(msg))return fail(res,403,'Operación no autorizada');
  if(/invalid|inv[aá]lid|importe|fecha|entrega|falta|medio|local|producto|cuadr/i.test(msg))
   return fail(res,400,'El comprobante histórico no concilia con el cierre');
  return fail(res,503,'Neon no confirmó: reabre Romo y consulta Historial antes de reintentar');
 }
};
module.exports._configQA=config;
