'use strict';
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
/**
 * Caja acumulada exclusiva de Romo La Serena.
 * PREVIEW cerrada por defecto. No consulta Uki ni finanzas comerciales.
 * Todas las escrituras requieren Google dueño real + flag separada y una
 * transacción atómica en la BD romos_sushi.
 */
const STORE='romo:serena';
const fail=(res,status,error)=>res.status(status).json({ok:false,storeId:STORE,error});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOSE_KEY=/^romo:serena\|\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
function config(env){
 if(!entornoPanelRomoAutorizado(env)||
   env.ROMO_CAJA_ACUMULADA_LECTURA_QA_ENABLED!=='true')return null;
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 let db;try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null;}
 if(!/^[a-z0-9.-]+$/.test(host)||!host.endsWith('.neon.tech')||
    !/^https:\/\/[^\/\s?#@]+$/.test(origin)||
    !['postgres:','postgresql:'].includes(db.protocol)||
    db.hostname.toLowerCase()!==host||db.pathname!=='/romos_sushi'||
    db.username!=='romos_app_service'||!db.password)return null;
 for(const name of ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
                    'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{
   if(new URL(String(env[name]||'')).hostname.toLowerCase()===host)return null;
  }catch{}
 }
 return {url:db.toString(),origin,
  write:env.ROMO_CAJA_ACUMULADA_ESCRITURA_QA_ENABLED==='true'};
}
const only=(b,fields)=>b&&typeof b==='object'&&!Array.isArray(b)&&
 Object.keys(b).sort().join('|')===fields.slice().sort().join('|');
const trim=(value,min,max)=>typeof value==='string'&&
 value.trim().length>=min&&value.trim().length<=max;
module.exports=async function romoCajaAcumuladaQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Caja acumulada Romo no habilitada');
 const method=String(req.method||'').toUpperCase();
 if(!['POST','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 const origin=String(req.headers?.origin||'');
 if(origin!==conf.origin)return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 if(method==='OPTIONS')return res.status(204).end();
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
    JSON.stringify(body).length>3000||typeof body.action!=='string')
  return fail(res,400,'Solicitud inválida');
 const action=body.action;
 const write=['inicializar','entrada','gasto','retiro','sincronizar_cierre'].includes(action);
 if(!['saldo','movimientos'].includes(action)&&!write)
  return fail(res,400,'Operación no autorizada');
 if(write&&!conf.write)return fail(res,503,'Caja acumulada Romo solo consulta');
 if(!write&&!only(body,['action']))return fail(res,400,'Consulta inválida');
 if(write){
  const fields=action==='sincronizar_cierre'?
   ['action','source_key','concepto','responsable','op_key']:
   ['action','monto','concepto','responsable','op_key'];
  if(!only(body,fields)||!UUID.test(String(body.op_key||''))||
     !trim(body.responsable,2,80)||!trim(body.concepto,3,240))
   return fail(res,400,'Faltan datos del movimiento');
  if(action==='sincronizar_cierre'){
   if(!CLOSE_KEY.test(String(body.source_key||'')))
    return fail(res,400,'Referencia de cierre inválida');
  }else if(!Number.isSafeInteger(body.monto)||body.monto<0||
    body.monto>100000000||(action!=='inicializar'&&body.monto===0)){
   return fail(res,400,'Monto incorrecto');
  }
 }
 try{
  const neon=require('@neondatabase/serverless').neon(conf.url);
  const db={query:(statement,params)=>neon.query(statement,params)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.role!=='duenos')
   return fail(res,403,'Solo dueños de Romo pueden consultar o mover caja acumulada');
  if(action==='saldo'){
   const rows=await db.query(
    'SELECT store_id,balance,initialized,initialized_at,updated_at '+
    'FROM public.romo_caja_acum_cuenta_v1 WHERE store_id=$1 LIMIT 1',[STORE]);
   return res.status(200).json({ok:true,storeId:STORE,soloRomo:true,
    cuenta:rows[0]||{store_id:STORE,balance:0,initialized:false}});
  }
  if(action==='movimientos'){
   const rows=await db.query(
    'SELECT id,tipo,monto,saldo_resultante,concepto,responsable,'+
     'source_key,creado_en FROM public.romo_caja_acum_movimientos_v1 '+
     'WHERE store_id=$1 ORDER BY creado_en DESC,id DESC LIMIT 250',[STORE]);
   return res.status(200).json({ok:true,storeId:STORE,soloRomo:true,
    movimientos:rows,soloLectura:true});
  }
  // La identidad proviene de Firebase + rol Neon, nunca del navegador.
  // El actorId es el uid verificado en el servidor y no el nombre manual.
  const result=await db.query(
   'SELECT public.romo_caja_acum_aplicar_v1($1,$2::bigint,$3::uuid,$4,$5,$6,$7) AS resultado',
   [action,action==='sincronizar_cierre'?null:body.monto,
    body.op_key,identity.userId,body.responsable.trim(),
    body.concepto.trim(),action==='sincronizar_cierre'?body.source_key:null]
  );
  const out=result[0]?.resultado;
  if(out?.ok!==true)return fail(res,503,'No se confirmó el movimiento en Neon Romo');
  return res.status(200).json({ok:true,storeId:STORE,soloRomo:true,
   revision:undefined,...out});
 }catch(e){
  // No repetir a ciegas: una conexión interrumpida puede haber escrito.
  // El historial + misma op_key son la única vía de conciliar un reintento.
  return fail(res,503,'No se pudo confirmar la caja acumulada de Romo. Consulta el historial antes de repetir.');
 }
};
module.exports._internalQA={config};
