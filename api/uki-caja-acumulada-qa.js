'use strict';
// Únicamente QA: no habilita operaciones de caja acumulada en producción.
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const allowedOrigins=new Set(['https://diannaleandra-art.github.io',
 'https://uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app']);
const BRANCHES=new Set(['arica','serena']);
const ACTIONS=new Set(['saldo','movimientos','inicializar','entrada','gasto','retiro',
 'traspaso','cierre','ajustar_cierre']);
const writeActions=new Set(['inicializar','entrada','gasto','retiro','traspaso','cierre','ajustar_cierre']);
const qaEnabled=(env=process.env)=>env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF===QA_REF&&
 env.UKI_INVENTARIO_QA_ENABLED==='true';
const error=(res,status,msg)=>res.status(status).json({ok:false,error:msg});
const amount=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000;
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const validUUID=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
async function adminUser(req,env=process.env){
 const bearer=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const uids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!uids.includes(payload.sub)&&!(payload.email_verified&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub)};
}
const safeText=(x,max=240)=>typeof x==='string'&&x.trim().length>=3&&x.trim().length<=max;
module.exports=async function ukiCajaAcumuladaQA(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers?.origin||'');
 const goodOrigin=allowedOrigins.has(origin);
 if(qaEnabled()&&goodOrigin){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 }
 if(!qaEnabled())return error(res,404,'Caja acumulada disponible únicamente en pruebas.');
 if(req.method==='OPTIONS')return res.status(goodOrigin?204:403).end();
 if(req.method!=='POST')return error(res,405,'Método no permitido.');
 if(!goodOrigin)return error(res,403,'Origen no autorizado.');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return error(res,415,'Se requiere JSON.');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2200)
  return error(res,400,'Solicitud inválida.');
 const branch=String(body.branch||''),action=String(body.action||'');
 if(!BRANCHES.has(branch)||!ACTIONS.has(action))return error(res,400,'Sucursal o acción inválida.');
 const user=await adminUser(req).catch(()=>null);
 if(!user)return error(res,403,'Google sin autorización de administración.');
 const db=dbUrl();
 if(!db)return error(res,503,'La base de pruebas está desactivada.');
 try{
  const sql=require('@neondatabase/serverless').neon(db);
  if(action==='saldo'){
   const rows=await sql.query('SELECT branch,balance,initialized,initialized_at,updated_at FROM public.uki_caja_acum_cuentas_qa WHERE branch=$1',[branch]);
   return res.status(200).json({ok:true,branch,modo:'QA',cuenta:rows[0]||{branch,balance:0,initialized:false}});
  }
  if(action==='movimientos'){
   const rows=await sql.query('SELECT id,branch,op_key,tipo,monto,saldo_resultante,concepto,actor_uid,fecha_operativa,cierre_clave,sucursal_destino,creado_en FROM public.uki_caja_acum_movimientos_qa WHERE branch=$1 ORDER BY creado_en DESC,id DESC LIMIT 80',[branch]);
   return res.status(200).json({ok:true,branch,modo:'QA',movimientos:rows});
  }
  if(!writeActions.has(action))return error(res,400,'Acción desconocida.');
  // La caja no copia silenciosamente movimientos desde los cierres de ventas.
  // Los cierres deberán llevar referencia única, importe y día operativo confirmados.
  if(!amount(body.monto)||!validUUID(body.op_key)||!safeText(body.concepto))
   return error(res,400,'Monto, concepto o identificador incorrecto.');
  const fecha=body.fecha_operativa??null;
  if(fecha!==null&&!validDay(fecha))return error(res,400,'Fecha operativa incorrecta.');
  const cierre=body.cierre_clave??null;
  if(['cierre','ajustar_cierre'].includes(action)&&(!safeText(cierre,150)||!fecha))
   return error(res,400,'Se requiere una referencia y día del cierre confirmado.');
  const destino=body.destino??null;
  if(action==='traspaso'&&(!BRANCHES.has(destino)||destino===branch))
   return error(res,400,'Destino del traspaso incorrecto.');
  const rows=await sql.query(
   'SELECT public.uki_caja_acum_aplicar_qa($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9) AS resultado',
   [branch,action,body.monto,body.op_key,user.uid,body.concepto.trim(),fecha,cierre,destino]);
  return res.status(200).json({...rows[0].resultado,modo:'QA'});
 }catch(e){
  const label=String(e?.message||'Error en caja acumulada');
  if(/Saldo insuficiente|ya fue inicializada|Cierre ya registrado|no fue incorporado|Ya tiene ese importe|clase|fecha|clave|monto|importe|inicial|destino|otra acción|operación/.test(label))
   return error(res,409,label.slice(0,220));
  console.error('Uki caja QA error:',String(e?.code||e?.name||'db').slice(0,70));
  return error(res,503,'No se pudo operar sobre la caja de pruebas. No se tocaron ventas reales.');
 }
};
module.exports._testing={qaEnabled,amount,validDay,validUUID,allowedOrigins};
