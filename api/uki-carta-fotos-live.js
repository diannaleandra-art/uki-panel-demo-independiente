'use strict';
// Fotos de carta administradas desde iPhone y guardadas por sucursal en Neon.
// No tiene acceso a pedidos, timbres, stock o cierres. Borrado lógico separado.
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const {baseItems}=require('../lib/uki-catalogo-v1.cjs');
const ORIGINS=new Set(['https://diannaleandra-art.github.io','https://uki-sushi-pedidos.vercel.app']);
const BRANCHES=new Set(['arica','serena']);
const QA_REF_ETAPA2='integracion/uki-promociones-ingredientes-seguros-qa-20261109';
const QA_REF_TIPOS='qa/uki-promos-tipos-producto-20261110';
// En preview sólo funciona con la rama exacta, bandera QA y URL Neon QA validada por dbUrl.
const promocionesHabilitadas=env=>env.UKI_PROMOS_VISIBILIDAD_ENABLED==='true';
const enabled=env=>(env.VERCEL_ENV==='production'&&env.UKI_INGREDIENTES_ARMADO_ENABLED==='true')||
 (env.VERCEL_ENV==='preview'&&(env.VERCEL_GIT_COMMIT_REF===QA_REF_ETAPA2||env.VERCEL_GIT_COMMIT_REF===QA_REF_TIPOS)&&env.UKI_INVENTARIO_QA_ENABLED==='true');
const KINDS=new Set(['classic','premium','monthly','pizza','dish','topping']);
const sameQAOrigin=(origin,env=process.env)=>enabled(env)&&env.VERCEL_ENV==='preview'&&
 !!env.VERCEL_URL&&origin==='https://'+env.VERCEL_URL;
// La carta de prueba solo puede LEER fotos, nunca modificarlas: POST sigue
// limitado al panel autenticado. QA requiere rama y base separada.
const qaMenuAllowed=(origin,env=process.env)=>env.VERCEL_ENV==='preview'&&
 (env.VERCEL_GIT_COMMIT_REF===QA_REF_ETAPA2||env.VERCEL_GIT_COMMIT_REF===QA_REF_TIPOS)&&env.UKI_INVENTARIO_QA_ENABLED==='true'&&
 /^https:\/\/uki-sushi-pedidos-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(origin);
const originAllowed=(origin,env=process.env)=>ORIGINS.has(origin)||sameQAOrigin(origin,env)||qaMenuAllowed(origin,env);
const fail=(res,code,error)=>res.status(code).json({ok:false,error});
function validSku(value){
 if(typeof value!=='string'||value.length<5||value.length>120||!/^[a-z]+:[a-z0-9-]+$/.test(value))return false;
 return KINDS.has(value.split(':')[0]);
}
function validPicture(mime,text){
 if(!['image/jpeg','image/webp','image/png'].includes(mime)||
    typeof text!=='string'||text.length<50||text.length>350000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(text)||text.length%4!==0)return false;
 const binary=Buffer.from(text,'base64');
 if(binary.length<100||binary.length>256*1024)return false;
 return mime==='image/jpeg'?binary[0]===255&&binary[1]===216&&binary[2]===255:
   mime==='image/png'?binary.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
   binary.toString('ascii',0,4)==='RIFF'&&binary.toString('ascii',8,12)==='WEBP';
}
async function authorize(req,env){
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const ids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const email=String(payload.email||'').toLowerCase();
 if(!ids.includes(payload.sub)&&!(email&&payload.email_verified===true&&emails.includes(email)))return null;
 return String(payload.sub);
}
async function productExists(sql,branch,sku,env=process.env){
 const base=await baseItems(branch);
 if(base.some(x=>x.sku===sku&&x.kind!=='ingredient'))return true;
 const [custom,promos]=await Promise.all([
  sql.query('SELECT sku FROM public.uki_carta_productos_custom_v1 WHERE branch=$1 AND sku=$2 LIMIT 1',[branch,sku]),
  promocionesHabilitadas(env)?
   sql.query('SELECT sku FROM public.uki_carta_promos_custom_v1 WHERE branch=$1 AND sku=$2 LIMIT 1',[branch,sku]):Promise.resolve([])
 ]);
 return custom.length>0||promos.length>0;
}
module.exports=async function(req,res){
 const origin=String(req.headers?.origin||''),env=process.env;
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(origin&&originAllowed(origin,env)){res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 }
 if(req.method==='OPTIONS')return res.status(originAllowed(origin,env)?204:403).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(origin&&!originAllowed(origin,env))return fail(res,403,'Origen no autorizado');
 if(!enabled(env))
  return fail(res,503,'Fotos de carta aún no habilitadas');
 const branch=String(req.method==='GET'?req.query?.branch||'':req.body?.branch||'');
 if(!BRANCHES.has(branch))return fail(res,400,'Sucursal inválida');
 const url=dbUrl(env);if(!url)return fail(res,503,'Base de fotos no disponible');
 let sql;try{sql=require('@neondatabase/serverless').neon(url)}catch{return fail(res,503,'Servicio no disponible')}
 try{
  if(req.method==='GET'){
   const sku=String(req.query?.sku||'');
   if(sku){
    if(!validSku(sku))return fail(res,400,'Producto inválido');
    const found=await sql.query('SELECT mime,data_base64 FROM public.uki_carta_fotos_v1 WHERE branch=$1 AND sku=$2',[branch,sku]);
    if(!found.length)return fail(res,404,'Foto no encontrada');
    res.setHeader('Content-Type',found[0].mime);res.setHeader('Content-Disposition','inline');
    res.setHeader('Cache-Control','public,max-age=120');
    return res.status(200).end(Buffer.from(found[0].data_base64,'base64'));
   }
   const rows=await sql.query('SELECT sku,version,mime FROM public.uki_carta_fotos_v1 WHERE branch=$1 ORDER BY sku LIMIT 200',[branch]);
   return res.status(200).json({ok:true,branch,items:rows.map(x=>({sku:x.sku,version:Number(x.version),mime:x.mime}))});
  }
  if(origin!=='https://diannaleandra-art.github.io'&&!sameQAOrigin(origin,env))return fail(res,403,'Solo administración');
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
   return fail(res,415,'Se requiere JSON');
  if(!req.body||JSON.stringify(req.body).length>355000)return fail(res,400,'Imagen demasiado grande');
  const uid=await authorize(req,env).catch(()=>null);if(!uid)return fail(res,403,'Solo administración Google autorizada');
  const action=String(req.body.action||''),sku=String(req.body.sku||'');
  const version=req.body.expected_version;
  if(!validSku(sku)||!Number.isSafeInteger(version)||version<0)return fail(res,400,'Actualiza la foto antes de continuar');
  if(!await productExists(sql,branch,sku))return fail(res,404,'Producto no encontrado');
  if(action==='subir'){
   const mime=String(req.body.mime||''),data=String(req.body.data_base64||'');
   if(!validPicture(mime,data))return fail(res,400,'Sube una imagen JPEG, PNG o WebP de hasta 256 KB');
   const rows=await sql.query(
     'INSERT INTO public.uki_carta_fotos_v1(branch,sku,mime,data_base64,version,updated_by) SELECT $1,$2,$3,$4,1,$6 WHERE $5=0 ON CONFLICT(branch,sku) DO UPDATE SET mime=$3,data_base64=$4,version=public.uki_carta_fotos_v1.version+1,updated_by=$6,updated_at=now() WHERE public.uki_carta_fotos_v1.version=$5 RETURNING sku,version',
     [branch,sku,mime,data,version,uid]);
   if(!rows.length)return fail(res,409,'La foto cambió en otro dispositivo; actualiza antes de reemplazarla');
   return res.status(200).json({ok:true,branch,sku,version:Number(rows[0].version)});
  }
  if(action==='quitar'){
   if(version<1)return fail(res,409,'No hay foto subida para quitar');
   const rows=await sql.query('DELETE FROM public.uki_carta_fotos_v1 WHERE branch=$1 AND sku=$2 AND version=$3 RETURNING sku',[branch,sku,version]);
   if(!rows.length)return fail(res,409,'La foto cambió. Actualiza antes de quitarla');
   return res.status(200).json({ok:true,branch,sku,version:0});
  }
  return fail(res,400,'Acción no permitida');
 }catch(e){
  console.error('Uki fotos',String(e?.code||e?.name||'error').slice(0,50));
  return fail(res,503,'Servicio de fotos temporalmente no disponible; tus productos no cambiaron');
 }
};
module.exports._test={validPicture,validSku,productExists,enabled,originAllowed,sameQAOrigin,promocionesHabilitadas};
