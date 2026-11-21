'use strict';
// Read only: serve exactly the published image/version, never draft data.
const {config}=require('./romo-carta-cambios-publicos-qa.js')._internalQA;
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 const conf=config(process.env);
 if(!conf||process.env.ROMO_PROMOCIONES_PUBLICACION_ENABLED!=='true'||req.headers?.origin!==conf.carta)return res.status(403).end();
 const sku=String(req.query?.sku||''),v=Number(req.query?.v);
 if(!/^monthly:romoq-[a-f0-9-]{36}$/.test(sku)||!Number.isSafeInteger(v)||v<1||v>100000)return res.status(400).end();
 try{
  const sql=require('@neondatabase/serverless').neon(conf.database);
  const rows=await sql.query("SELECT encode(f.contenido,'base64') AS image FROM public.romo_carta_ediciones_v1 e JOIN public.romo_carta_admin_fotos_qa_v1 f ON f.store_id=e.store_id AND f.sku=$2 AND f.version=$3 WHERE e.store_id=$1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(e.contenido->'gestion'->'promotions','[]'::jsonb)) p WHERE p->>'sku'=$4 AND (p->>'photoVersion')::bigint=$3)",['romo:serena','promo:'+sku.slice(14),v,sku]);
  if(rows.length!==1)return res.status(404).end();
  const bytes=Buffer.from(rows[0].image,'base64');
  if(bytes.length<1024||bytes.length>300000||bytes[0]!==255||bytes[1]!==216)return res.status(404).end();
  res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Length',String(bytes.length));return res.status(200).end(bytes);
 }catch(e){return res.status(503).end();}
};
