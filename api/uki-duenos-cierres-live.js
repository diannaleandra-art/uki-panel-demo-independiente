'use strict';
/* Uki Sushi — puente automático de cierres definitivos para dueños.
 * Solo recibe totales, tras respaldo confirmado en Firebase: no clientes ni pedidos.
 * No modifica la caja, ingresos manuales o datos de otras empresas.
 * Lectura protegida por Google autorizado y sesión con PIN privado.
 */
const crypto=require('node:crypto');
const HOSTS=new Set(['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech','ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech']);
const BRANCHES=new Set(['arica','serena']);
const MEDIOS=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const allowedOrigins=new Set(['https://diannaleandra-art.github.io']);
// Solo previews de este mismo proyecto Uki. Acceso real exige Google + PIN de dueños.
const publicOwnerOrigin='https://uki-sushi-inventario.vercel.app';
const fail=(res,n,error)=>res.status(n).json({ok:false,error});
const isDay=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};
const int=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const enabled=(env=process.env)=>env.VERCEL_ENV==='production'&&env.UKI_FIN_AUTO_LIVE_ENABLED==='true';
function databaseUrl(env=process.env){
 if(!enabled(env))return null;
 let v;try{v=new URL(String(env.UKI_FIN_PRIVATE_DATABASE_URL||''));}catch{return null;}
 return ['postgres:','postgresql:'].includes(v.protocol)&&HOSTS.has(v.hostname)?v.toString():null;
}
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
async function google(req,env=process.env){
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{
  issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']
 });
 if(payload.firebase?.sign_in_provider!=='google.com'||!payload.email_verified)return null;
 const allowed=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'')
  .split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
 if(!allowed.includes(String(payload.email||'').toLowerCase()))return null;
 return {uid:String(payload.sub)};
}
async function ownerAuthorized(sql,req,user){
 const secret=String(req.headers?.['x-fin-session']||'');
 if(!/^[0-9a-f]{64}$/i.test(secret))return false;
 const rows=await sql.query('SELECT 1 FROM public.fin_sesiones WHERE usuario_uid=$1 AND token_hash=$2 AND expira_en>now() LIMIT 1',[user.uid,h(secret)]);
 return rows.length>0;
}
function validateClose(body,now=Date.now()){
 const b=String(body.branch||''),date=body.fecha_operativa,ms=body.fecha_cierre_ms;
 const sale=body.venta_total,pedidos=body.pedidos,methods=body.medios;
 const desglose={gastos_cierre:body.gastos_cierre,delivery_por_pagar:body.delivery_por_pagar,
  propinas:body.propinas,retiros:body.retiros};
 if(!BRANCHES.has(b)||!isDay(date)||!int(ms,now+20*60000)||ms<1700000000000||
  !int(sale)||!int(pedidos,10000)||Object.values(desglose).some(v=>!int(v))||
  body.confirmado!==true||
  !methods||typeof methods!=='object'||Array.isArray(methods))return null;
 const entries=Object.entries(methods);
 if(entries.length>MEDIOS.size||entries.some(([k,v])=>!MEDIOS.has(k)||!int(v)))return null;
 if(entries.reduce((n,[,v])=>n+v,0)!==sale)return null;
 return {branch:b,fecha_operativa:date,fecha_cierre_ms:ms,venta_total:sale,pedidos,
  medios:Object.fromEntries(entries),...desglose,source_key:h(['uki',b,ms].join('|')),
  turno_ref:'uki|'+b+'|'+ms};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers?.origin||'');
 const allow=allowedOrigins.has(origin)||origin===publicOwnerOrigin;
 if(enabled()&&allow){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Fin-Session');
 }
 if(!enabled())return fail(res,404,'Servicio privado de cierres no disponible.');
 if(req.method==='OPTIONS')return res.status(allow?204:403).end();
 if(req.method!=='POST'||!allow)return fail(res,403,'Origen no autorizado.');
 if(!String(req.headers?.['content-type']||'').startsWith('application/json'))
  return fail(res,415,'Se requiere JSON.');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>3500)
  return fail(res,400,'Solicitud inválida.');
 const who=await google(req).catch(()=>null);
 if(!who)return fail(res,403,'Acceso de Google no autorizado.');
 const db=databaseUrl();
 if(!db)return fail(res,503,'Base QA no disponible.');
 try{
  const sql=require('@neondatabase/serverless').neon(db);
  if(body.action==='registrar_cierre'){
   const close=validateClose(body);
   if(!close)return fail(res,400,'Cierre definitivo inválido o no conciliado.');
   // Se inserta una sola vez; nunca sobreescribe cierres históricos.
   const rows=await sql.query(
    'INSERT INTO public.fin_uki_cierres_live_v1 '+
    '(branch,source_key,turno_ref,fecha_operativa,estado,revision,venta_total,pedidos,medios,gastos_cierre,delivery_por_pagar,propinas,retiros,recibido_de_uid) '+
    'VALUES($1,$2,$3,$4,\'cerrado\',1,$5,$6,$7::jsonb,$8,$9,$10,$11,$12) '+
    'ON CONFLICT (branch,source_key) DO NOTHING RETURNING branch,source_key',
    [close.branch,close.source_key,close.turno_ref,close.fecha_operativa,
     close.venta_total,close.pedidos,JSON.stringify(close.medios),
     close.gastos_cierre,close.delivery_por_pagar,close.propinas,close.retiros,who.uid]);
   if(!rows.length){
    const prior=await sql.query('SELECT venta_total,pedidos,medios,gastos_cierre,delivery_por_pagar,propinas,retiros,fecha_operativa::text AS fecha_operativa FROM public.fin_uki_cierres_live_v1 WHERE branch=$1 AND source_key=$2',[close.branch,close.source_key]);
    if(!prior.length||Number(prior[0].venta_total)!==close.venta_total||
     Number(prior[0].pedidos)!==close.pedidos||
     ['gastos_cierre','delivery_por_pagar','propinas','retiros'].some(k=>Number(prior[0][k])!==close[k])||
     String(prior[0].fecha_operativa).slice(0,10)!==close.fecha_operativa||
     Object.keys(close.medios).sort().some(k=>Number(prior[0].medios?.[k])!==close.medios[k])||
     Object.keys(prior[0].medios||{}).length!==Object.keys(close.medios).length)
     return fail(res,409,'Ese cierre ya existe con datos distintos; requiere conciliación.');
   }
   return res.status(200).json({ok:true,registrado:!!rows.length,duplicado:!rows.length,
    referencia:close.turno_ref});
  }
  if(body.action==='listar_cierres'){
   if(!await ownerAuthorized(sql,req,who))return fail(res,403,'Requiere acceso privado de dueños.');
   const branch=String(body.branch||'todos'),from=body.desde,to=body.hasta;
   if(branch!=='todos'&&!BRANCHES.has(branch)||!isDay(from)||!isDay(to)||from>to)
    return fail(res,400,'Filtros incorrectos.');
   const rows=await sql.query(
    'SELECT branch,turno_ref,fecha_operativa,venta_total,pedidos,medios,gastos_cierre,delivery_por_pagar,propinas,retiros,actualizado_en '+
    'FROM public.fin_uki_cierres_live_v1 WHERE estado=\'cerrado\' '+
    'AND ($1::text=\'todos\' OR branch=$1) AND fecha_operativa BETWEEN $2 AND $3 '+
    'ORDER BY fecha_operativa DESC,turno_ref DESC LIMIT 250',[branch,from,to]);
   return res.status(200).json({ok:true,cierres:rows,nota:'Consulta informativa: no se suma automáticamente a las ventas manuales.'});
  }
  return fail(res,400,'Acción no permitida.');
 }catch(e){
  console.error('Cierres dueños privados:',String(e?.code||e?.name||'db').slice(0,60));
  return fail(res,503,'No se pudo sincronizar el cierre privado. La caja permanece intacta.');
 }
};
module.exports._testing={enabled,databaseUrl,validateClose,isDay,allowedOrigins};
