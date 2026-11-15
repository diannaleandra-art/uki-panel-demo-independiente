'use strict';
// Romo La Serena: trabajador solo entrega conteo, duenos concilian despues.
const crypto=require('node:crypto'),pin=require('../lib/uki-inventario-pin-live.cjs');
const STORE='romo:serena',REF='preparacion/uki-romo-sobre-main-20261114';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const fail=(r,status,msg)=>r.status(status).json({ok:false,storeId:STORE,error:msg});
const shape=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join('|')===keys.slice().sort().join('|');
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==REF||
   env.ROMO_PRECIERRE_TRABAJADOR_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const salt=String(env.ROMO_SOLICITUDES_RATE_SALT||'');
 let u;try{u=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null;}
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!host.endsWith('.neon.tech')||
    !/^[a-z0-9.-]+$/.test(host)||!['postgres:','postgresql:'].includes(u.protocol)||
    u.hostname.toLowerCase()!==host||u.pathname!=='/romos_sushi'||
    u.username!=='romos_app_service'||!u.password||salt.length<48)return null;
 for(const n of ['UKI_FIN_PRIVATE_DATABASE_URL','UKI_INVENTARIO_LIVE_DATABASE_URL',
    'UKI_FIN_QA_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL']){
  try{if(new URL(String(env[n]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 return {origin,url:u.toString(),salt,
  write:env.ROMO_PRECIERRE_TRABAJADOR_ESCRITURA_QA_ENABLED==='true'};
}
function validDay(d){
 if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;
 const n=Date.parse(d+'T12:00:00Z');
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===d;
}
function fingerprint(req,salt){
 const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'sin-ip')
  .split(',')[0].slice(0,100).trim();
 return crypto.createHmac('sha256',salt).update('romo-precierre-v1|'+ip).digest('hex');
}
async function validWorkerPin(db,code,hash){
 if(!pin.valido(code))return false;
 const q='INSERT INTO public.romo_pin_intentos_v1 AS p '+
  '(store_id,identidad_hash,fallos,bloqueado_hasta,actualizado_en) '+
  'VALUES($1,$2,1,NULL,now()) '+
  'ON CONFLICT (store_id,identidad_hash) DO UPDATE SET '+
  "fallos=CASE WHEN p.actualizado_en<now()-interval '15 minutes' "+
  'THEN 1 ELSE LEAST(p.fallos+1,5) END, '+
  "bloqueado_hasta=CASE WHEN p.actualizado_en<now()-interval '15 minutes' THEN NULL "+
  "WHEN p.fallos+1>=5 THEN now()+interval '15 minutes' ELSE NULL END, "+
  'actualizado_en=now() WHERE p.bloqueado_hasta IS NULL OR p.bloqueado_hasta<=now() '+
  'RETURNING fallos';
 const attempt=await db.query(q,[STORE,hash]);
 if(attempt.length!==1)return false;
 const rows=await db.query('SELECT salt,hash FROM public.romo_precierre_pin_v1 WHERE store_id=$1 LIMIT 1',[STORE]);
 if(rows.length!==1||!pin.comprobar(code,rows[0]))return false;
 await db.query('DELETE FROM public.romo_pin_intentos_v1 WHERE store_id=$1 AND identidad_hash=$2',[STORE,hash]);
 return true;
}
module.exports=async function romoPrecierreTrabajadorQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=config(process.env);
 if(!cfg)return fail(res,503,'Precierre de personal Romo aun no habilitado');
 if(String(req.headers?.origin||'')!==cfg.origin)
  return fail(res,403,'Origen del panel no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return fail(res,405,'Metodo no permitido');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
    JSON.stringify(body).length>2600)return fail(res,400,'Datos invalidos');
 const action=body.action;
 if(!['estado-pin','crear-pin','pendientes','enviar','conciliar'].includes(action))
  return fail(res,400,'Operacion no permitida');
 if(['crear-pin','enviar','conciliar'].includes(action)&&!cfg.write)
  return fail(res,503,'Precierre del trabajador en modo consulta');
 if((['estado-pin','pendientes'].includes(action)&&!shape(body,['action']))||
   (action==='crear-pin'&&!shape(body,['action','codigo']))||
   (action==='conciliar'&&!shape(body,['action','id','turno_ref','revision'])))
  return fail(res,400,'Campos no permitidos');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(sql,params)=>neon.query(sql,params)};
  if(action==='enviar'){
   if(!shape(body,['action','codigo','id','turno_ref','fecha_operativa','inicio_ms',
      'trabajador','efectivo_contado','observaciones'])||
      !pin.valido(body.codigo)||!UUID.test(String(body.id||''))||
      !TURN.test(String(body.turno_ref||''))||!validDay(body.fecha_operativa)||
      !Number.isSafeInteger(body.inicio_ms)||body.inicio_ms<=0||
      body.turno_ref!==body.fecha_operativa+'@'+body.inicio_ms||
      typeof body.trabajador!=='string'||body.trabajador.trim().length<2||
      body.trabajador.trim().length>60||
      !Number.isSafeInteger(body.efectivo_contado)||body.efectivo_contado<0||
      body.efectivo_contado>100000000||
      typeof body.observaciones!=='string'||body.observaciones.length>300)
    return fail(res,400,'Revisa nombre, referencia del turno y conteo');
   const hash=fingerprint(req,cfg.salt);
   if(!await validWorkerPin(db,body.codigo,hash))
    return fail(res,403,'PIN incorrecto o temporalmente bloqueado');
   const record=await db.query(
    'SELECT public.romo_precierre_enviar_v1($1::uuid,$2,$3,$4,$5,$6,$7,$8) AS resultado',
    [body.id,body.turno_ref,body.fecha_operativa,body.inicio_ms,
     body.trabajador.trim(),body.efectivo_contado,body.observaciones,hash]);
   const x=record[0]?.resultado;
   if(x?.ok!==true)return fail(res,503,'Envio no confirmado');
   return res.status(200).json({ok:true,storeId:STORE,id:x.id,estado:x.estado,
     duplicate:x.duplicate,mensaje:'Conteo recibido para revision del dueno. Caja sigue abierta.'});
  }
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(identity?.brand!=='romo'||identity.role!=='duenos')
   return fail(res,403,'Solo duenos de Romo');
  if(action==='estado-pin'){
   const rows=await db.query('SELECT 1 FROM public.romo_precierre_pin_v1 WHERE store_id=$1 LIMIT 1',[STORE]);
   return res.status(200).json({ok:true,storeId:STORE,configurado:rows.length===1});
  }
  if(action==='crear-pin'){
   if(!pin.valido(body.codigo))return fail(res,400,'PIN de seis numeros obligatorio');
   const secret=pin.crear(body.codigo);
   const rows=await db.query('SELECT public.romo_precierre_crear_pin_v1($1,$2,$3) AS creado',
    [secret.salt,secret.hash,identity.userId]);
   return rows[0]?.creado===true?
    res.status(201).json({ok:true,storeId:STORE,configurado:true}):
    fail(res,409,'El PIN de precierre ya existe; no se reemplazo');
  }
  if(action==='pendientes'){
   const rows=await db.query(
    'SELECT id::text,turno_ref,fecha_operativa,inicio_ms,trabajador,efectivo_contado,'+
    'observaciones,estado,recibido_en,revision_conciliada '+
    'FROM public.romo_precierre_envios_v1 WHERE store_id=$1 '+
    'ORDER BY recibido_en DESC LIMIT 50',[STORE]);
   return res.status(200).json({ok:true,storeId:STORE,envios:rows});
  }
  if(!UUID.test(String(body.id||''))||!TURN.test(String(body.turno_ref||''))||
     !Number.isSafeInteger(body.revision)||body.revision<1)
   return fail(res,400,'Falta revision del precierre confirmado');
  const rows=await db.query(
   'SELECT public.romo_precierre_conciliar_v1($1::uuid,$2,$3,$4) AS confirmado',
   [body.id,body.turno_ref,body.revision,identity.userId]);
  return rows[0]?.confirmado===true?
   res.status(200).json({ok:true,storeId:STORE,conciliado:true}):
   fail(res,409,'No se pudo conciliar; consulta el historial');
 }catch(e){
  if(/Ya existe un conteo|fuera de alcance|duplicad/i.test(String(e?.message||'')))
   return fail(res,409,'Ya existe un conteo para ese turno o la referencia no es valida');
  return fail(res,503,'No se confirmo el registro de Romo. Revisa antes de repetir.');
 }
};
module.exports._internalQA={config};
