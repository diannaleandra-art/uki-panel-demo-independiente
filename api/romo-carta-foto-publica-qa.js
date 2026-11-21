'use strict';
/* Fotografía pública de una promoción YA publicada en el catálogo Romo.
   Jamás devuelve imágenes de borradores, usuarios o pedidos. Sólo GET. */
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const {config}=require('./romo-carta-cambios-publicos-qa.js')._internalQA;
const fail=(res,status)=>res.status(status).end();
module.exports=async function fotoPublicadaRomo(req,res){
 res.setHeader('Cache-Control','public, max-age=180, s-maxage=180');
 res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env,conf=config(env);
 if(!conf||!entornoPanelRomoAutorizado(env))return fail(res,503);
 if(req.method!=='GET')return fail(res,405);
 const sku=String(req.query?.sku||'');
 if(!/^monthly:romoq-[a-f0-9-]{36}$/.test(sku))return fail(res,400);
 const original='promo:'+sku.slice('monthly:romoq-'.length);
 try{
  const {neon}=require('@neondatabase/serverless'),sql=neon(conf.database);
  const current=await sql.query(
   "SELECT p->>'photoVersion' AS version, p->>'available' AS disponible "+
   "FROM public.romo_carta_ediciones_v1 e, "+
   "LATERAL jsonb_array_elements(coalesce(e.contenido->'gestion'->'promotions','[]'::jsonb)) p "+
   "WHERE e.store_id=$1 AND p->>'sku'=$2 LIMIT 1",
   ['romo:serena',sku]);
  if(current.length!==1||current[0].disponible!=='true')return fail(res,404);
  const version=Number(current[0].version);
  if(!Number.isSafeInteger(version)||version<1)return fail(res,404);
  const rows=await sql.query(
   "SELECT encode(contenido,'base64') AS foto, version "+
   'FROM public.romo_carta_admin_fotos_qa_v1 WHERE store_id=$1 AND sku=$2 AND version=$3',
   ['romo:serena',original,version]);
  if(rows.length!==1||rows[0].version!==version)return fail(res,404);
  const bytes=Buffer.from(rows[0].foto||'','base64');
  if(bytes.length<1024||bytes.length>300000||bytes[0]!==255||
     bytes[1]!==216||bytes[2]!==255||bytes[bytes.length-2]!==255||
     bytes[bytes.length-1]!==217)return fail(res,404);
  res.setHeader('Content-Type','image/jpeg');
  return res.status(200).send(bytes);
 }catch(e){
  console.error('Foto pública Romo no verificable',String(e?.message||e));
  return fail(res,503);
 }
};
