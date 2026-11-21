'use strict';
/* Resguardo privado mensual. No elimina información operativa ni financiera.
   Acceso idéntico a Mi Administración: Firebase Google autorizado + PIN vigente. */
const crypto=require('node:crypto'),zlib=require('node:zlib');
const STORE=new Set(['uki:arica','uki:serena','romo:serena']);
const SECTIONS=['pedidos','cierres','gastos','retiros','propinas','deliveriesManuales','incidencias','ajustesHistoricos','solicitudesWhatsApp'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=(res,n,msg)=>res.status(n).json({ok:false,error:msg});
const good=(res,data)=>res.status(200).json({ok:true,...data});
function config(e=process.env){
 if(e.VERCEL_ENV!=='production'||e.UKI_FIN_PRIVATE_ENABLED!=='true'||e.UKI_ARCHIVO_MENSUAL_HABILITADO!=='true')return null;
 try{
  const u=new URL(String(e.UKI_FIN_PRIVATE_DATABASE_URL||''));
  const allowed=['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech',
   'ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech'];
  if(!['postgres:','postgresql:'].includes(u.protocol)||!allowed.includes(u.hostname)||!u.password)return null;
  return u.toString();
 }catch{return null;}
}
const allowedOrigins=new Set(['https://uki-sushi-inventario.vercel.app',
 'https://romos-sushi-panel.vercel.app','https://diannaleandra-art.github.io']);
const month=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&m>='2026-11'&&m<='2099-12';
function dates(m){
 const [y,n]=m.split('-').map(Number),days=new Date(Date.UTC(y,n,0)).getUTCDate();
 return {desde:m+'-01',hasta:m+'-'+String(days).padStart(2,'0'),
  habilitado:new Date(Date.UTC(y,n,5)).toISOString().slice(0,10)};
}
function todayChile(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const obj=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return obj.year+'-'+obj.month+'-'+obj.day;
}
function verify(data,suc,mes,period){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.version!==1||data.sucursal!==suc||
 data.mes!==mes||data.desde!==period.desde||data.hasta!==period.hasta||
 !Array.isArray(data.clientes)||data.clientes.length>10000||
 !data.registros||typeof data.registros!=='object'||Array.isArray(data.registros)||
 !data.resumen||typeof data.resumen!=='object'||Array.isArray(data.resumen))
  throw Error('Estructura de archivo mensual incorrecta.');
 let total=0;
 for(const k of SECTIONS){
  const a=data.registros[k];
  if(!Array.isArray(a)||a.length>15000||data.resumen[k]!==a.length)
   throw Error('Conteos del archivo mensual inconsistentes.');
  total+=a.length;
 }
 total+=data.clientes.length;
 if(total>20000||data.resumen.clientes!==data.clientes.length)throw Error('El archivo supera el límite o difiere de su resumen.');
 return total;
}
async function google(req,e=process.env){
 const token=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com'||!payload.email_verified)return null;
 const emails=String(e.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(!emails.includes(String(payload.email||'').toLowerCase()))return null;
 return {uid:String(payload.sub)};
}
async function privateSession(sql,req,who){
 const token=String(req.headers['x-fin-session']||'');
 if(!/^[0-9a-f]{64}$/i.test(token))return false;
 const rows=await sql.query('SELECT 1 FROM public.fin_sesiones WHERE token_hash=$1 AND usuario_uid=$2 AND expira_en>now() LIMIT 1',[hash(token),who.uid]);
 return rows.length===1;
}
module.exports=async function archivoMensual(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const db=config();
 if(!db)return fail(res,404,'Archivo mensual aún no disponible.');
 const origin=String(req.headers.origin||''),self='https://'+String(req.headers.host||'');
 if(!allowedOrigins.has(origin)&&origin!==self)return fail(res,403,'Origen de archivo mensual no autorizado.');
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Fin-Session');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST'||String(req.headers['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,405,'Se requiere POST JSON.');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>1750000)
  return fail(res,413,'Archivo demasiado grande.');
 const who=await google(req).catch(()=>null);
 if(!who)return fail(res,403,'Se requiere Google autorizado de Mi Administración.');
 const sql=require('@neondatabase/serverless').neon(db);
 try{
  if(!await privateSession(sql,req,who))return fail(res,401,'Ingresa el PIN privado de Mi Administración.');
  const action=String(body.action||'');
  if(action==='listar'){
   const rows=await sql.query('SELECT sucursal,mes,desde::text,hasta::text,sha256,resumen,creado_en,total_registros FROM public.fin_archivos_mensuales_v1 ORDER BY mes DESC,sucursal LIMIT 180',[]);
   return good(res,{archivos:rows});
  }
  if(!STORE.has(body.sucursal)||!month(body.mes))return fail(res,400,'Sucursal o mes incorrectos.');
  const {sucursal,mes}=body,period=dates(mes);
  if(action==='consultar'){
   const rows=await sql.query('SELECT sucursal,mes,desde::text,hasta::text,sha256,resumen,creado_en,total_registros,encoding,encode(contenido,\'base64\') AS base64 FROM public.fin_archivos_mensuales_v1 WHERE sucursal=$1 AND mes=$2',[sucursal,mes]);
   if(!rows.length)return fail(res,404,'El archivo mensual todavía no está registrado.');
   return good(res,{archivo:{...rows[0],base64:rows[0].base64.replace(/\s/g,'')}});
  }
  if(action==='verificar'){
   const rows=await sql.query('SELECT sha256,creado_en,total_registros FROM public.fin_archivos_mensuales_v1 WHERE sucursal=$1 AND mes=$2',[sucursal,mes]);
   return good(res,{confirmado:rows.length===1,sha256:rows[0]?.sha256||null,
    totalRegistros:rows[0]?.total_registros||0});
  }
  if(action!=='guardar')return fail(res,400,'Acción de archivo no permitida.');
  if(todayChile()<period.habilitado)return fail(res,409,'Este archivo estará disponible desde '+period.habilitado+'.');
  if(typeof body.sha256!=='string'||!/^[a-f0-9]{64}$/.test(body.sha256)||
     !['gzip','json'].includes(body.encoding)||typeof body.base64!=='string'||
     body.base64.length<4||body.base64.length>1650000||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))
   return fail(res,400,'Comprueba la integridad y formato del respaldo.');
  const compressed=Buffer.from(body.base64,'base64');
  if(compressed.length<1||compressed.length>1200000)return fail(res,413,'El archivo es demasiado grande.');
  const raw=body.encoding==='gzip'?
   zlib.gunzipSync(compressed,{maxOutputLength:8000000}):compressed;
  if(raw.length>8000000||hash(raw)!==body.sha256)return fail(res,409,'El respaldo no superó la verificación SHA-256.');
  const parsed=JSON.parse(raw.toString('utf8'));
  const n=verify(parsed,sucursal,mes,period);
  const result=await sql.query("INSERT INTO public.fin_archivos_mensuales_v1(sucursal,mes,desde,hasta,sha256,encoding,contenido,total_registros,resumen,creado_por_uid) VALUES($1,$2,$3::date,$4::date,$5,$6,decode($7,'base64'),$8,$9::jsonb,$10) ON CONFLICT(sucursal,mes) DO NOTHING RETURNING sha256",
   [sucursal,mes,period.desde,period.hasta,body.sha256,body.encoding,body.base64,n,JSON.stringify(parsed.resumen),who.uid]);
  if(!result.length){
   const check=await sql.query('SELECT sha256 FROM public.fin_archivos_mensuales_v1 WHERE sucursal=$1 AND mes=$2',[sucursal,mes]);
   if(check[0]?.sha256!==body.sha256)return fail(res,409,'Ya existe un archivo mensual diferente. No se reemplazó el original.');
  }
  await sql.query('INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,nuevo,actor_uid) VALUES($1,$2,$3,$4::jsonb,$5)',
   ['archivo_mensual',sucursal+'|'+mes,result.length?'guardar':'consultar_existente',
    JSON.stringify({sha256:body.sha256,registros:n}),who.uid]);
  return good(res,{confirmado:true,sucursal,mes,sha256:body.sha256,totalRegistros:n,permanente:true});
 }catch(e){
  if(e?.code==='23505')return fail(res,409,'El archivo mensual ya existe.');
  console.error('Archivo mensual:',String(e?.code||e?.name||'error').slice(0,70));
  return fail(res,503,'No se pudo verificar el respaldo. No se borró ningún registro.');
 }
};
module.exports._testing={dates,month,verify,config,todayChile};