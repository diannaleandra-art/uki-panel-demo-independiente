'use strict';
/**
 * Catálogo privado de Romo La Serena, API de QA exclusivamente.
 * Reutiliza Google Uki, autoriza roles desde Neon Romo, nunca consulta Uki.
 * GET: lectura; POST: guardado de borradores sólo dueños, con revisión CAS.
 * Ambos APAGADOS salvo flags específicos de rama QA. No publica la carta.
 */
const QA_BRANCH='qa/romo-catalogo-inventario-sin-publicar-20261111';
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
const enabled=(env=process.env)=>
 env.VERCEL_ENV==='preview'&&
 env.VERCEL_GIT_COMMIT_REF===QA_BRANCH&&
 env.ROMO_CATALOGO_QA_ENABLED==='true'&&
 /^[a-z0-9.-]+\.vercel\.app$/.test(String(env.VERCEL_URL||''));
function validOrigin(req,env=process.env){
 const host=String(req.headers?.host||'').trim().toLowerCase();
 if(host!==String(env.VERCEL_URL||'').toLowerCase())return false;
 const origin=String(req.headers?.origin||'').trim();
 const same='https://'+host;
 const external=String(env.ROMO_CATALOGO_QA_ALLOWED_ORIGIN||'').trim();
 if(!origin)return req.method==='GET'; // Sólo GET mismo host, nunca POST sin Origin.
 if(origin===same)return true;
 return /^https:\/\/[^/\s?#@]+$/.test(external)&&origin===external;
}
function dbConfig(env=process.env){
 let url;
 try{url=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));}catch{return null}
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').trim().toLowerCase();
 if(!host||host!==url.hostname.toLowerCase()||!host.endsWith('.neon.tech')||
  !['postgres:','postgresql:'].includes(url.protocol)||url.pathname!=='/romos_sushi'||
  !url.username||!url.password)return null;
 for(const key of ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_FIN_PRIVATE_DATABASE_URL',
  'UKI_INVENTARIO_QA_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 return url.toString();
}
const draftsOnly=catalog=>['productos','promociones','ingredientes'].every(k=>
 Array.isArray(catalog[k])&&catalog[k].every(row=>row.visible===false));
module.exports=async function romoCatalogoQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env;
 if(!enabled(env))return fail(res,503,'El catálogo de Romo continúa en pruebas');
 if(!validOrigin(req,env))return fail(res,403,'Origen no autorizado');
 const origin=String(req.headers?.origin||'');
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET'&&req.method!=='POST')return fail(res,405,'Método no permitido');
 if(req.method==='POST'&&env.ROMO_CATALOGO_QA_WRITE_ENABLED!=='true')
  return fail(res,503,'Edición de Romo no habilitada');
 if(req.method==='POST'&&
  String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Solicitud JSON requerida');
 const len=Number(req.headers?.['content-length']||0);
 if(!Number.isFinite(len)||len>250000)return fail(res,413,'Solicitud demasiado grande');
 const url=dbConfig(env);
 if(!url)return fail(res,503,'Base privada de Romo no configurada');
 let sql,identityModule,catalogModule;
 try{
  sql=require('@neondatabase/serverless').neon(url);
  if(typeof sql.query!=='function')throw Error('Sin consultas parametrizadas');
  identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
  catalogModule=await import('../lib/romo-catalogo-integracion-qa.mjs');
 }catch{return fail(res,503,'Servicio de Romo no disponible')}
 const identity=await identityModule.resolveRomoIdentity({
  authorization:req.headers?.authorization,db:sql,
  verifyToken:identityModule.verifyFirebaseGoogleToken,env
 }).catch(()=>null);
 if(!identity)return fail(res,403,'Sin autorización para Romo La Serena');
 if(req.method==='GET'){
  try{
   const data=await catalogModule.readRomoCatalog({db:sql,identity});
   return res.status(200).json({ok:true,...data,ventaHabilitada:false,
    edicionHabilitada:identity.role==='duenos'&&env.ROMO_CATALOGO_QA_WRITE_ENABLED==='true'});
  }catch{return fail(res,503,'No fue posible consultar el catálogo')}
 }
 if(identity.role!=='duenos')return fail(res,403,'Sólo dueños pueden editar el catálogo');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).sort().join('|')!=='catalog|expectedRevision'||
  !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)
  return fail(res,400,'Formulario o revisión inválidos');
 if(JSON.stringify(body).length>240000)return fail(res,413,'Catálogo demasiado grande');
 try{
  const validated=catalogModule.normalizeRomoCatalog(body.catalog);
  // Esta fase sólo permite guardar borradores en Neon; no activar visibles.
  if(!draftsOnly(validated))return fail(res,409,'Sólo borradores: publicación no habilitada');
  const result=await catalogModule.saveRomoCatalog({
   db:sql,identity,expectedRevision:body.expectedRevision,catalog:validated
  });
  return res.status(200).json({ok:true,...result,ventaHabilitada:false});
 }catch(error){
  if(error?.code==='ROMO_CATALOG_CONFLICT')
   return fail(res,409,'Otro equipo modificó la carta; actualiza antes de guardar');
  if(/Catálogo|Código|Producto|artículo|Precio|Composición|Tipo|Sección|Medios|revisión|inválid|permitido|límite/i.test(String(error?.message||'')))
   return fail(res,400,'Datos de catálogo no válidos');
  return fail(res,503,'No se pudo confirmar el guardado de Romo');
 }
};
module.exports._testing={enabled,validOrigin,dbConfig,draftsOnly};
