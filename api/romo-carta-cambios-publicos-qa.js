'use strict';
/**
 * Romo: lectura PUBLICA (precios/disponibilidad, nunca clientes ni auditoría).
 * La carta correcta consultará aquí en la publicación conjunta, no ahora.
 * Solo Preview de Romo y bandera APAGADA por defecto; NO es endpoint Uki.
 */
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const STORE='romo:serena';
const fail=(r,s,e)=>r.status(s).json({ok:false,storeId:STORE,error:e});
const validOrigin=x=>/^https:\/\/[a-z0-9.-]+$/i.test(x)&&!String(x).includes('..');
function config(env){
  if(!entornoPanelRomoAutorizado(env)||env.VERCEL_ENV!=='preview'||
     env.ROMO_CARTA_CAMBIOS_PUBLICOS_QA_ENABLED!=='true')return null;
  const panel=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
  const carta=String(env.ROMO_CARTA_CATALOGO_QA_ORIGIN||'');
  const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
  if(!validOrigin(panel)||!validOrigin(carta)||panel===carta||
     !/^[a-z0-9.-]+$/.test(host))return null;
  let url;
  try{url=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));}
  catch{return null;}
  if(!['postgres:','postgresql:'].includes(url.protocol)||
     url.hostname.toLowerCase()!==host||url.pathname!=='/romos_sushi'||
     url.username!=='romos_app_service'||!url.password||url.hash)return null;
  for(const k of ['UKI_INVENTARIO_LIVE_DATABASE_URL',
    'UKI_INVENTARIO_QA_DATABASE_URL','UKI_FIN_PRIVATE_DATABASE_URL',
    'UKI_FIN_QA_DATABASE_URL']){
    try{if(new URL(String(env[k]||'')).hostname.toLowerCase()===host)return null}
    catch{}
  }
  return {panel,carta,database:url.toString()};
}
module.exports=async function romoCartaCambiosPublicosQA(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Vary','Origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  const conf=config(process.env);
  if(!conf)return fail(res,503,'Publicación de cambios Romo deshabilitada');
  const origin=String(req.headers?.origin||'');
  if(origin!==conf.carta)return fail(res,403,'La solicitud no viene de la carta aprobada de Romo');
  res.setHeader('Access-Control-Allow-Origin',conf.carta);
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Accept');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return fail(res,405,'Sólo consulta de cambios de Romo');
  try{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
    let response;
    try{
      response=await fetch(conf.carta+'/api/romo-catalogo-aprobado-qa',{
        method:'GET',
        headers:{Origin:conf.panel,Accept:'application/json'},
        cache:'no-store',redirect:'error',signal:ctrl.signal
      });
    }finally{clearTimeout(timer);}
    if(!response.ok)throw Error('Fuente Romo no comprobada');
    const base=await response.json();
    const sql=require('@neondatabase/serverless').neon(conf.database);
    const rows=await sql.query(
      'SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',
      [STORE]);
    if(!Array.isArray(rows)||rows.length>1)throw Error('Estado de ediciones no confirmado');
    const lib=await import('../lib/romo-carta-ediciones-seguras-qa.mjs');
    const vista=lib.vistaEdicionesRomoQA(base,rows[0]||null);
    const feed=await import('../lib/romo-carta-feed-cotizacion-qa.mjs');
    return res.status(200).json(feed.construirFeedRomoQA(base,vista));
  }catch(e){
    console.error('Cambios públicos Romo no confirmados',String(e?.message||e));
    return fail(res,503,'No es posible confirmar los precios de Romo');
  }
};
module.exports._internalQA={config};
