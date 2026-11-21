'use strict';
/* Imágenes Romo: privadas por defecto; reemplazo publicado solo por dueños y con auditoría atómica. */
const {createHash,randomUUID}=require('node:crypto');
const STORE='romo:serena';
const {config}=require('./romo-carta-ediciones-seguras-qa.js')._internalQA;
const {resolverOrigenLecturaUnificadaRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
const {entornoGestionRomoAutorizado,escrituraGestionRomoAutorizada}=require('../lib/romo-entorno-gestion.cjs');
const fail=(res,status,error)=>res.status(status).json({ok:false,storeId:STORE,error});
const BYTES=300000,BASE64=/^[A-Za-z0-9+/]+={0,2}$/;
module.exports=async function romoFotosQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 if(!entornoGestionRomoAutorizado(process.env))
    return fail(res,503,'Fotografías solo en Preview de Romo');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Fotografías de Romo no habilitadas');
 const method=String(req.method||'').toUpperCase();
 if(!['GET','POST','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 const origin=String(req.headers?.origin||'');
 const access=resolverOrigenLecturaUnificadaRomoQA(req,conf.panel,conf.sharedRead);
 if(!access)return fail(res,403,'Origen no autorizado');
 if(origin)res.setHeader('Access-Control-Allow-Origin',access.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods',access.compartido?'GET,OPTIONS':'GET,POST,OPTIONS');
 if(method==='OPTIONS')return res.status(204).end();
 const write=escrituraGestionRomoAutorizada(process.env);
 if(method==='POST'&&(!write||access.compartido))return fail(res,503,'Fotografías en solo lectura');
 let sku;
 if(method==='GET')sku=String(req.query?.sku||'');
 else{
  const body=req.body;
  if(!String(req.headers['content-type']||'').startsWith('application/json')||
     !body||typeof body!=='object'||Array.isArray(body)||
     JSON.stringify(body).length>450000)
    return fail(res,400,'Foto inválida o demasiado grande');
  if(!['save','remove','replace-published'].includes(body.action)||
     !Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||
     body.expectedVersion>100000||
     Object.keys(body).some(k=>!['action','sku','expectedVersion','base64','expectedCommercialRevision'].includes(k))||
     (body.action==='replace-published'?(!Number.isSafeInteger(body.expectedCommercialRevision)||body.expectedCommercialRevision<1||body.expectedVersion<1||body.expectedVersion>=100000):body.expectedCommercialRevision!==undefined)||
     (body.action!=='remove'&&typeof body.base64!=='string')||
     (body.action==='remove'&&body.base64!==undefined))
    return fail(res,400,'Acción de fotografía inválida');
  sku=String(body.sku||'');
 }
 if(!/^[A-Za-z0-9áéíóúñÁÉÍÓÚÑ _:.@-]{1,100}$/.test(sku))
   return fail(res,400,'Identificador de producto inválido');
 try{
  const {neon}=require('@neondatabase/serverless');
  const sql=neon(conf.database);
  const db={query:(query,args)=>sql.query(query,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers.authorization,db,verifyToken:auth.verifyFirebaseGoogleToken
  });
  if(!identity||identity.brand!=='romo'||identity.role!=='duenos')
    return fail(res,403,'Solo dueños de Romo');
  // Solo SKUs existentes en la carta base o en los borradores de Romo.
  const [adminRows,baseResp]=await Promise.all([
   db.query('SELECT contenido FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1',[STORE]),
   (async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);
    try{return await fetch(conf.carta+'/api/romo-catalogo-aprobado-qa',{
     headers:{Origin:conf.panel,Accept:'application/json',
      ...await require('../lib/romo-oidc-s2s-qa.cjs').headersOIDCRomoQA(process.env)},
     cache:'no-store',redirect:'error',signal:c.signal
    });}finally{clearTimeout(timer);}})()
  ]);
  if(!baseResp.ok)throw Error('Catálogo Romo no verificado');
  const base=await baseResp.json();
  if(base.storeId!==STORE||base.readOnly!==true||!Array.isArray(base.products)||
     base.products.length!==40||!Array.isArray(adminRows)||adminRows.length!==1)
    throw Error('Productos de Romo no confirmados');
  const data=adminRows[0].contenido;
  const drafts=[...(data?.products||[]),...(data?.promotions||[])];
  const allowed=base.products.some(p=>p.sku===sku)||drafts.some(p=>p.sku===sku);
  if(!allowed)return fail(res,404,'Producto no encontrado en Romo');
  if(method==='GET'){
   const rows=await db.query(
    "SELECT encode(contenido,'base64') AS base64, version FROM public.romo_carta_admin_fotos_qa_v1 WHERE store_id=$1 AND sku=$2",
    [STORE,sku]);
   if(!Array.isArray(rows)||rows.length>1)throw Error('Foto no verificada');
   return res.status(200).json({ok:true,storeId:STORE,sku,readOnly:true,
    draftOnly:true,version:Number(rows[0]?.version||0),
    image:rows[0]?'data:image/jpeg;base64,'+String(rows[0].base64).replace(/\s+/g,''):null});
  }
  const body=req.body,expected=body.expectedVersion;
  // La foto de una promoción publicada permanece intacta hasta retirarla.
  // Bloquear la revisión comercial dentro de la misma sentencia para impedir carreras.
  const lockPhoto=`WITH commercial AS (SELECT contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1 FOR SHARE), permitted AS (SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM commercial, jsonb_array_elements(COALESCE(contenido->'gestion'->'promotions','[]'::jsonb)) p WHERE p->>'sku'=('monthly:romoq-'||substring($2::text FROM 7)) AND $2 LIKE 'promo:%')), `;
  const eventId=randomUUID();
  let rows;
  if(body.action==='remove'){
   if(expected<1)return fail(res,409,'No hay foto para eliminar');
   rows=await db.query([
    lockPhoto+'removed AS (DELETE FROM public.romo_carta_admin_fotos_qa_v1',
    'WHERE store_id=$1 AND sku=$2 AND version=$3 AND EXISTS(SELECT 1 FROM permitted) RETURNING version),',
    'audit AS (INSERT INTO public.romo_carta_admin_fotos_auditoria_qa_v1',
    '(event_id,store_id,sku,accion,version,responsable_uid)',
    "SELECT $4,$1,$2,'quitar',version,$5 FROM removed RETURNING event_id)",
    'SELECT removed.version FROM removed JOIN audit ON true'
   ].join('\n'),[STORE,sku,expected,eventId,identity.userId]);
  }else{
   const raw=body.base64;
   if(raw.length>410000||raw.length<1400||!BASE64.test(raw))
     return fail(res,400,'Foto JPEG no válida');
   const binary=Buffer.from(raw,'base64');
   if(binary.length<1024||binary.length>BYTES||
      binary[0]!==255||binary[1]!==216||binary[2]!==255||
      binary[binary.length-2]!==255||binary[binary.length-1]!==217)
     return fail(res,400,'La imagen debe ser JPEG comprimido');
   const hash=createHash('sha256').update(binary).digest('hex');
   if(body.action==='replace-published'){
    if(!conf.write||process.env.ROMO_PROMOCIONES_PUBLICACION_ENABLED!=='true'||!/^promo:[a-f0-9-]{36}$/.test(sku))
     return fail(res,403,'Reemplazo de fotografía publicado no autorizado');
    const commercialRows=await db.query('SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',[STORE]);
    if(commercialRows.length!==1)return fail(res,409,'Carta comercial no confirmada');
    const row=commercialRows[0],lib=await import('../lib/romo-carta-ediciones-seguras-qa.mjs');
    const view=lib.vistaEdicionesRomoQA(base,row);
    const commercialSku='monthly:romoq-'+sku.slice(6);
    const prev=view.publishedPromotions.find(p=>p.sku===commercialSku);
    if(view.revision!==body.expectedCommercialRevision||!prev||prev.photoVersion!==expected)
     return fail(res,409,'Cambió la promoción o su fotografía; actualiza antes de reemplazar');
    const doc=structuredClone(typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido);
    const original=doc.gestion.promotions.find(p=>p.sku===commercialSku);
    const before={...original};
    original.photoVersion=expected+1;doc.revision=view.revision+1;
    lib.vistaEdicionesRomoQA(base,{...row,revision:doc.revision,contenido:doc});
    const changed=await db.query([
     'WITH locked AS (SELECT store_id FROM public.romo_carta_ediciones_v1 WHERE store_id=$1 AND revision=$10 AND base_sha256=$11 FOR UPDATE),',
     'saved_photo AS (UPDATE public.romo_carta_admin_fotos_qa_v1 SET contenido=decode($3,\'base64\'),version=version+1,actualizado_por=$5,actualizado_en=now() WHERE store_id=$1 AND sku=$2 AND version=$4 AND EXISTS(SELECT 1 FROM locked) RETURNING version),',
     'saved_catalog AS (UPDATE public.romo_carta_ediciones_v1 SET revision=revision+1,contenido=$9::jsonb,actualizado_por=$5,actualizado_en=now() WHERE store_id=$1 AND revision=$10 AND base_sha256=$11 AND EXISTS(SELECT 1 FROM saved_photo) RETURNING revision),',
     'audit_photo AS (INSERT INTO public.romo_carta_admin_fotos_auditoria_qa_v1(event_id,store_id,sku,accion,version,sha256,bytes,responsable_uid) SELECT $6,$1,$2,\'subir\',version,$7,$8,$5 FROM saved_photo RETURNING event_id),',
     'audit_catalog AS (INSERT INTO public.romo_carta_ediciones_auditoria_v1(store_id,revision,revision_anterior,base_sha256,sku,anterior,nuevo,responsable_uid,motivo) SELECT $1,revision,$10,$11,$12,$13::jsonb,$14::jsonb,$5,\'Actualizar fotografía de promoción publicada\' FROM saved_catalog RETURNING revision)',
     'SELECT saved_photo.version,saved_catalog.revision FROM saved_photo CROSS JOIN saved_catalog CROSS JOIN audit_photo JOIN audit_catalog ON audit_catalog.revision=saved_catalog.revision'
    ].join('\n'),[STORE,sku,raw,expected,identity.userId,eventId,hash,binary.length,JSON.stringify(doc),view.revision,row.base_sha256,commercialSku,JSON.stringify(before),JSON.stringify(original)]);
    if(changed.length!==1||Number(changed[0].version)!==expected+1||Number(changed[0].revision)!==doc.revision)
     return fail(res,409,'No se confirmó el reemplazo; actualiza antes de repetir');
    return res.status(200).json({ok:true,storeId:STORE,sku,draftOnly:false,publicada:true,guardado:true,auditado:true,version:expected+1,revisionComercial:doc.revision});
   }
   const args=[STORE,sku,raw,expected,identity.userId,eventId,hash,binary.length];
   if(expected===0){
    rows=await db.query([
     lockPhoto+'saved AS (INSERT INTO public.romo_carta_admin_fotos_qa_v1',
     "(store_id,sku,mime_type,contenido,version,actualizado_por)",
     "SELECT $1,$2,'image/jpeg',decode($3,'base64'),1,$5 WHERE $4=0 AND EXISTS(SELECT 1 FROM permitted)",
     'ON CONFLICT DO NOTHING RETURNING version),',
     'audit AS (INSERT INTO public.romo_carta_admin_fotos_auditoria_qa_v1',
     '(event_id,store_id,sku,accion,version,sha256,bytes,responsable_uid)',
     "SELECT $6,$1,$2,'subir',version,$7,$8,$5 FROM saved RETURNING event_id)",
     'SELECT saved.version FROM saved JOIN audit ON true'
    ].join('\n'),args);
   }else{
    rows=await db.query([
     lockPhoto+'saved AS (UPDATE public.romo_carta_admin_fotos_qa_v1',
     "SET contenido=decode($3,'base64'),version=version+1,actualizado_por=$5,actualizado_en=now()",
     'WHERE store_id=$1 AND sku=$2 AND version=$4 AND EXISTS(SELECT 1 FROM permitted) RETURNING version),',
     'audit AS (INSERT INTO public.romo_carta_admin_fotos_auditoria_qa_v1',
     '(event_id,store_id,sku,accion,version,sha256,bytes,responsable_uid)',
     "SELECT $6,$1,$2,'subir',version,$7,$8,$5 FROM saved RETURNING event_id)",
     'SELECT saved.version FROM saved JOIN audit ON true'
    ].join('\n'),args);
   }
  }
  if(!Array.isArray(rows)||rows.length!==1)
   return fail(res,409,'La foto cambió o pertenece a una promoción publicada. Retira la promoción antes de reemplazar su foto.');
  return res.status(200).json({ok:true,storeId:STORE,sku,draftOnly:true,
   guardado:true,auditado:true,version:body.action==='remove'?0:Number(rows[0].version)});
 }catch(e){
  console.error('Foto QA Romo no confirmada:',String(e?.message||e));
  return fail(res,503,'La fotografía no se confirmó; comprueba su estado antes de repetir');
 }
};