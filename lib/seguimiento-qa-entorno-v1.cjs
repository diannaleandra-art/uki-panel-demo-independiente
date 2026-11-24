'use strict';
/* Fail-closed: sólo preview del lote, bases QA diferentes de producción. */
const {validatedDestination}=require('./seguimiento-cuentas-aprobadas-v1.cjs');
const BRANCH='preparacion/enlaces-seguros-3-sucursales-20261124';
const STORE_DB=Object.freeze({
 'uki:arica':'SEGUIMIENTO_UKI_QA_DATABASE_URL',
 'uki:serena':'SEGUIMIENTO_UKI_QA_DATABASE_URL',
 'romo:serena':'SEGUIMIENTO_ROMO_QA_DATABASE_URL'
});
function parseDatabase(uri,host){
 try{
  const u=new URL(uri);
  return ['postgres:','postgresql:'].includes(u.protocol)&&
   u.hostname===host&&host.length>12&&u.username&&u.password&&u.pathname.length>1?
   u.toString():null;
 }catch{return null;}
}
function config(env=process.env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
   env.SEGUIMIENTO_TRES_QA_ENABLED!=='true'||env.SEGUIMIENTO_QA_AISLAMIENTO_VERIFICADO!=='true'||
   !/^[a-f0-9]{64}$/i.test(String(env.SEGUIMIENTO_TOKEN_SECRET_HEX||''))||
   !/^[a-f0-9]{64}$/i.test(String(env.SEGUIMIENTO_CHAT_SECRET_HEX||''))||
   !/^[a-z0-9-]+\.vercel\.app$/.test(String(env.VERCEL_URL||'')))return null;
 const uki=parseDatabase(env.SEGUIMIENTO_UKI_QA_DATABASE_URL,env.SEGUIMIENTO_UKI_QA_DB_HOST);
 const romo=parseDatabase(env.SEGUIMIENTO_ROMO_QA_DATABASE_URL,env.SEGUIMIENTO_ROMO_QA_DB_HOST);
 if(!uki||!romo||new URL(uki).hostname===new URL(romo).hostname)return null;
 // Nunca reutilizar credenciales de las conexiones operativas, aunque ambas puedan leer.
 for(const prod of ['UKI_MESAS_LIVE_DATABASE_URL','UKI_INVENTARIO_LIVE_DATABASE_URL',
  'ROMO_PRIVATE_DATABASE_URL']){
  let url;try{url=new URL(env[prod])}catch{continue}
  if([uki,romo].some(x=>new URL(x).hostname===url.hostname))return null;
 }
 let raw={};try{raw=JSON.parse(String(env.SEGUIMIENTO_CUENTAS_VERIFICADAS_QA_JSON||'{}'))}catch{return null}
 const banks={};
 for(const storeId of Object.keys(STORE_DB)){
  const b=validatedDestination(storeId,raw);
  banks[storeId]=b?{storeId,verified:true,datos:b}:null;
 }
 return Object.freeze({
  origin:'https://'+env.VERCEL_URL,tokenSecret:env.SEGUIMIENTO_TOKEN_SECRET_HEX,
  chatSecret:env.SEGUIMIENTO_CHAT_SECRET_HEX,
  urls:Object.freeze({'uki:arica':uki,'uki:serena':uki,'romo:serena':romo}),
  banks:Object.freeze(banks)
 });
}
function makeDb(config,storeId){
 const uri=config?.urls?.[storeId];
 if(!uri)return null;
 const sql=require('@neondatabase/serverless').neon(uri);
 return {query:(query,args)=>sql.query(query,args)};
}
function validOrigin(req,config){
 const host=String(req.headers?.host||'').toLowerCase();
 const origin=String(req.headers?.origin||'');
 return config&&host===new URL(config.origin).hostname&&
  (!origin||origin===config.origin);
}
module.exports={BRANCH,STORE_DB,config,makeDb,validOrigin};
