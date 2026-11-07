'use strict';
// Caja acumulada en efectivo: operaciones reales del panel existente, permisos Google actuales.
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const allowedOrigins=new Set(['https://diannaleandra-art.github.io']);
const BRANCHES=new Set(['arica','serena']);
const ACTIONS=new Set(['saldo','movimientos','inicializar','entrada','gasto','retiro',
 'traspaso','sincronizar_cierre']);
const writeActions=new Set(['inicializar','entrada','gasto','retiro','traspaso']);
const liveEnabled=(env=process.env)=>env.VERCEL_ENV==='production'&&env.UKI_INVENTARIO_LIVE_ENABLED==='true';
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
 // Reutiliza las MISMAS cuentas Google que ya están autorizadas en el panel Uki.
 // No hay otro PIN, contraseña, Google ni registro separado para Caja acumulada.
 const uids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!uids.includes(payload.sub)&&!(payload.email_verified&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub)};
}
const safeText=(x,max=240)=>typeof x==='string'&&x.trim().length>=3&&x.trim().length<=max;
module.exports=async function ukiCajaAcumuladaLive(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers?.origin||'');
 const goodOrigin=allowedOrigins.has(origin);
 if(liveEnabled()&&goodOrigin){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 }
 if(!liveEnabled())return error(res,404,'Servicio de caja acumulada no disponible.');
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
 if(!db)return error(res,503,'La base de datos de caja no está configurada.');
 try{
  const sql=require('@neondatabase/serverless').neon(db);
  if(action==='saldo'){
   const rows=await sql.query('SELECT branch,balance,initialized,initialized_at,updated_at FROM public.uki_caja_acum_cuentas_live WHERE branch=$1',[branch]);
   return res.status(200).json({ok:true,branch,modo:'PRODUCCION',cuenta:rows[0]||{branch,balance:0,initialized:false}});
  }
  if(action==='movimientos'){
   const rows=await sql.query('SELECT id,branch,op_key,tipo,monto,saldo_resultante,concepto,actor_uid,responsable,fecha_operativa,cierre_clave,sucursal_destino,creado_en FROM public.uki_caja_acum_movimientos_live WHERE branch=$1 ORDER BY creado_en DESC,id DESC LIMIT 80',[branch]);
   return res.status(200).json({ok:true,branch,modo:'PRODUCCION',movimientos:rows});
  }
  if(action==='sincronizar_cierre'){
   // El cierre jamás modifica S.cierres: solo se refleja el efectivo ya confirmado,
   // descontado y contado exactamente. No admitir monto negativo ni dato incompleto.
   const closeKey=body.cierre_clave,day=body.fecha_operativa,ms=body.fecha_cierre_ms;
   if(!amount(body.monto)||!validUUID(body.op_key)||!validDay(day)||
      typeof closeKey!=='string'||closeKey.trim().length<8||closeKey.length>150||
      !Number.isSafeInteger(ms)||ms<1700000000000||ms>Date.now()+20*60000||
      body.confirmado!==true||body.diferencia_efectivo!==0||
      body.efectivo_contado!==body.monto||
      typeof body.responsable!=='string'||body.responsable.trim().length<2||
      body.responsable.trim().length>80)
       return error(res,400,'Cierre confirmado incompleto o sin conciliación.');
   const result=await sql.query(
    'SELECT public.uki_caja_acum_sincronizar_cierre_live($1,$2,$3,$4,$5,$6::uuid,$7,$8) AS resultado',
    [branch,closeKey.trim(),day,body.monto,ms,body.op_key,user.uid,body.responsable.trim()]);
   return res.status(200).json({...result[0].resultado,modo:'PRODUCCION'});
  }
  if(!writeActions.has(action))return error(res,400,'Acción desconocida.');
  if(action==='inicializar'&&body.saldo_inicial_contado!==true)
    return error(res,400,'Cuenta el efectivo real y confirma el saldo inicial.');
  // La caja no copia silenciosamente movimientos desde los cierres de ventas.
  // Los cierres deberán llevar referencia única, importe y día operativo confirmados.
  if(!amount(body.monto)||!validUUID(body.op_key)||!safeText(body.concepto)||typeof body.responsable!=='string'||body.responsable.trim().length<2||body.responsable.trim().length>80)
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
   'SELECT public.uki_caja_acum_aplicar_live($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10) AS resultado',
   [branch,action,body.monto,body.op_key,user.uid,body.concepto.trim(),fecha,cierre,destino,body.responsable.trim()]);
  return res.status(200).json({...rows[0].resultado,modo:'PRODUCCION'});
 }catch(e){
  const label=String(e?.message||'Error en caja acumulada');
  if(/Saldo insuficiente|ya fue inicializada|Cierre ya registrado|no fue incorporado|Ya tiene ese importe|clase|fecha|clave|monto|importe|inicial|destino|otra acción|operación|Primero concilia|anterior al saldo|Fecha de cierre futura/.test(label))
   return error(res,409,label.slice(0,220));
  console.error('Uki caja QA error:',String(e?.code||e?.name||'db').slice(0,70));
  return error(res,503,'No se pudo operar sobre la caja acumulada. Los cierres y ventas no se modificaron.');
 }
};
module.exports._testing={liveEnabled,amount,validDay,validUUID,allowedOrigins};
