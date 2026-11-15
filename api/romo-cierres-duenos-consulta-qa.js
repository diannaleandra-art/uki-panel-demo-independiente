'use strict';
/**
 * Cierres Romo para Mi Administración (SOLO LECTURA, Preview).
 * Exige Google con rol de dueños en Neon Romo Y PIN privado vigente
 * validado por la API existente de Mi Administración. Nunca modifica
 * fin_movimientos ni mezcla las ventas con Uki.
 */
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const STORE='romo:serena';
const FIN_URL='https://uki-sushi-inventario.vercel.app/api/mi-administracion-live';
const fail=(r,n,msg)=>r.status(n).json({ok:false,storeId:STORE,error:msg});
const day=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 !Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
function configure(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_CIERRES_DUENOS_LECTURA_QA_ENABLED!=='true')return null;
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const urlText=String(env.ROMO_PRIVATE_DATABASE_URL||'');
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 let url;try{url=new URL(urlText)}catch{return null}
 if(!/^[a-z0-9.-]+$/.test(host)||!/^https:\/\/[^\/\s?#@]+$/.test(origin)||
  !['postgres:','postgresql:'].includes(url.protocol)||
  url.hostname.toLowerCase()!==host||url.pathname!=='/romos_sushi'||
  url.username!=='romos_app_service'||!url.password)return null;
 return {url:url.toString(),origin};
}
module.exports=async function consultaCierresQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const config=configure(process.env);
 if(!config)return fail(res,503,'Cierres Romo privados aún no habilitados');
 if(!['POST','OPTIONS'].includes(req.method))return fail(res,405,'Método no permitido');
 const requestOrigin=String(req.headers?.origin||'');
 // La misma administración de Uki puede consultar Romo en modo lectura.
 // Nunca admite otros orígenes ni permite mutaciones financieras.
 const origins=new Set([config.origin,'https://uki-sushi-inventario.vercel.app']);
 if(!origins.has(requestOrigin))return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',requestOrigin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Fin-Session');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).sort().join('|')!=='desde|hasta'||!day(body.desde)||
  !day(body.hasta)||body.desde>body.hasta)
  return fail(res,400,'Fechas inválidas');
 const range=(Date.parse(body.hasta+'T12:00:00Z')-Date.parse(body.desde+'T12:00:00Z'))/86400000;
 if(range>31)return fail(res,400,'Consulta máximo 32 días');
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]{30,12000})$/)?.[1];
 const pin=String(req.headers?.['x-fin-session']||'');
 if(!token||!(/^[0-9a-f]{64}$/i.test(pin)))return fail(res,401,'Inicia sesión Google y PIN privado');
 try{
  const neon=require('@neondatabase/serverless').neon;
  const sql=neon(config.url),db={query:(q,values)=>sql.query(q,values)};
  const identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  const owner=await identityModule.resolveRomoIdentity({
   authorization:'Bearer '+token,db,verifyToken:identityModule.verifyFirebaseGoogleToken
  });
  if(!owner||owner.role!=='duenos')return fail(res,403,'Sin acceso de dueños Romo');
  // El PIN se valida en su servicio original; nunca se copia a este endpoint.
  const authResponse=await fetch(FIN_URL,{
   method:'POST',cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+token,'X-Fin-Session':pin,
    Origin:'https://uki-sushi-inventario.vercel.app',
    'Content-Type':'application/json'},
   body:JSON.stringify({action:'estado'})
  });
  const authData=await authResponse.json().catch(()=>null);
  if(!authResponse.ok||authData?.ok!==true||authData.autorizado!==true)
   return fail(res,401,'Sesión privada de Mi Administración no confirmada');
  const rows=await db.query(
   'SELECT source_key,turno_ref,fecha_operativa::text AS fecha_operativa,revision_neon,resumen '+
   'FROM public.romo_cierres_constancia_v1 WHERE store_id=$1 AND fecha_operativa '+
   'BETWEEN $2::date AND $3::date ORDER BY fecha_operativa DESC,turno_ref DESC LIMIT 101',
   [STORE,body.desde,body.hasta]);
  if(!Array.isArray(rows)||rows.length>100)
   return fail(res,409,'Reduce el rango para ver todos los cierres');
  const check=await import('../lib/romo-cierre-constancia-qa.mjs');
  const vistos=new Set();
  const cierres=rows.map(row=>{
   const raw=typeof row.resumen==='string'?JSON.parse(row.resumen):row.resumen;
   const summary={...raw,estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',
    revision_neon:Number(row.revision_neon)};
   if(!check.constanciaResumenCoincideRomoQA({...row,store_id:STORE},summary))
    throw Error('Constancia inconsistente de Romo');
   // source_key ya fue cotejada con la constancia real de Neon. Exponerla
   // solo al dueño autenticado permite deduplicación futura por turno,
   // SIN incorporar ni modificar todavía movimientos en Mi Administración.
   if(typeof row.source_key!=='string'||
      row.source_key!=='romo:serena|'+row.turno_ref||
      vistos.has(row.source_key))
    throw Error('Constancia Romo con identificador duplicado o inválido');
   vistos.add(row.source_key);
   return {source_key:row.source_key,
    estado_contable:'pendiente_incorporacion',
    turno_ref:row.turno_ref,fecha_operativa:row.fecha_operativa,
    revision_neon:Number(row.revision_neon),venta_total:raw.venta_total,
    pedidos:raw.pedidos,gastos_cierre:raw.gastos_cierre,
    delivery_por_pagar:raw.delivery_por_pagar,
    propinas:raw.propinas,medios:raw.medios};
  });
  return res.status(200).json({ok:true,storeId:STORE,cierres,soloLectura:true,
   incluidoEnContabilidad:false});
 }catch{
  return fail(res,503,'No se pudo verificar la consulta privada de Romo; no se modificó nada');
 }
};
module.exports._internalQA={configure};
