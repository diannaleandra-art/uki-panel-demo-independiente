'use strict';
// Banners publicitarios de la carta Romo: aislados de pedidos, caja, precios y SKU.
// GET público únicamente desde la carta; cambios solo dueños Google en panel.
const STORE='romo:serena',BRANCH='preparacion/uki-romo-sobre-main-20261114';
const err=(res,status,message)=>res.status(status).json({ok:false,storeId:STORE,error:message});
const originValid=x=>/^https:\/\/[a-z0-9.-]+$/i.test(x)&&!x.includes('..');
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_CATALOGO_LECTURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const carta=String(env.ROMO_CARTA_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 let db;
 try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 if(!originValid(origin)||!originValid(carta)||!host.endsWith('.neon.tech')||
  !['postgres:','postgresql:'].includes(db.protocol)||db.hostname.toLowerCase()!==host||
  db.pathname!=='/romos_sushi'||db.username!=='romos_app_service'||!db.password)return null;
 return {origin,carta,url:db.toString(),write:env.ROMO_BANNER_ESCRITURA_QA_ENABLED==='true'};
}
const photoValid=v=>v===''||
 (typeof v==='string'&&v.length<180000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/]+={0,2}$/.test(v));
function validate(items){
 if(!Array.isArray(items)||items.length>6)throw Error('Máximo seis anuncios en el banner');
 const ids=new Set();
 return items.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    Object.keys(raw).sort().join('|')!=='id|image|price|subtitle|title|visible')
   throw Error('Contenido de banner inválido');
  const {id,title,subtitle,price,image,visible}=raw;
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(id)||ids.has(id)||
    typeof title!=='string'||title.trim().length<2||title.length>80||
    typeof subtitle!=='string'||subtitle.length>165||
    !Number.isSafeInteger(price)||price<0||price>1000000||
    typeof visible!=='boolean'||!photoValid(image))
   throw Error('Revisa el nombre, descripción, precio o fotografía del anuncio');
  ids.add(id);
  return {id,title:title.trim(),subtitle:subtitle.trim(),price,image,visible};
 });
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const cfg=config(process.env);
 if(!cfg)return err(res,503,'Banner Romo no habilitado');
 const method=String(req.method||'').toUpperCase();
 if(!['OPTIONS','GET','POST'].includes(method))return err(res,405,'Método no permitido');
 const origin=String(req.headers?.origin||'');
 const panel=origin===cfg.origin||
  (!origin&&method==='GET'&&req.headers?.host===new URL(cfg.origin).host);
 const carta=origin===cfg.carta;
 if(!panel&&!carta)return err(res,403,'Origen no autorizado');
 if(method==='POST'&&!panel)return err(res,403,'Solo el panel de Romo puede editar el banner');
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(method==='OPTIONS')return res.status(204).end();
 if(method==='POST'){
  if(!cfg.write)return err(res,503,'Edición de banners todavía no habilitada');
  if(!String(req.headers?.['content-type']||'').startsWith('application/json'))
   return err(res,415,'Se requiere JSON');
  if(JSON.stringify(req.body||{}).length>1200000)return err(res,413,'Fotografías demasiado grandes');
 }
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.url);
  const db={query:(q,args)=>neon.query(q,args)};
  let identity=null;
  // El panel siempre verifica Google, incluso para consultar anuncios ocultos.
  if(panel){
   const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
   identity=await auth.resolveRomoIdentity({
    authorization:req.headers?.authorization,db,verifyToken:auth.verifyFirebaseGoogleToken
   });
   if(!identity||identity.role!=='duenos')return err(res,403,'Solo dueños pueden editar los banners Romo');
  }
  if(method==='GET'){
   const rows=await db.query('SELECT revision,items FROM public.romo_banner_carta_v1 WHERE store_id=$1',[STORE]);
   const revision=Number(rows[0]?.revision||0);
   const items=validate(rows[0]?.items||[]);
   return res.status(200).json({ok:true,storeId:STORE,revision,
    items:panel?items:items.filter(x=>x.visible),readOnly:!panel});
  }
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!=='expectedRevision|items'|| 
    !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)
   return err(res,400,'Revisión del banner inválida');
  const items=validate(body.items);
  const updated=await db.query(
   'UPDATE public.romo_banner_carta_v1 SET revision=revision+1,items=$2::jsonb,actualizado_en=now(),actualizado_por=$3 WHERE store_id=$1 AND revision=$4 RETURNING revision',
   [STORE,JSON.stringify(items),identity.userId,body.expectedRevision]
  );
  if(updated.length!==1)return err(res,409,'El banner cambió desde otro equipo. Recarga antes de guardar.');
  return res.status(200).json({ok:true,storeId:STORE,revision:Number(updated[0].revision),saved:items.length});
 }catch(e){
  if(/revisa|máximo|inval|fotograf|banner|anuncio|contenido/i.test(String(e?.message||'')))
   return err(res,400,String(e.message||'Contenido inválido').slice(0,180));
  return err(res,503,'Neon no confirmó el banner; no se publicó ningún cambio');
 }
};
module.exports._internal={config,validate};
