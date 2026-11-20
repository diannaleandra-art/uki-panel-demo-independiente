'use strict';
/**
 * Administración en BORRADOR de carta Romo La Serena. Privada y aislada:
 * No publica productos nuevos, no cambia cotizador, ni escribe en Uki.
 * POST únicamente en QA con permiso temporal de dueños y auditoría CAS.
 */
const STORE='romo:serena';
const fail=(res,status,error)=>res.status(status).json({ok:false,storeId:STORE,error});
const {config}=require('./romo-carta-ediciones-seguras-qa.js')._internalQA;
const M=require('../lib/romo-carta-administracion-qa.cjs');
const {resolverOrigenLecturaUnificadaRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
const {entornoGestionRomoAutorizado,escrituraGestionRomoAutorizada}=require('../lib/romo-entorno-gestion.cjs');
async function approved(conf){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const resp=await fetch(conf.carta+'/api/romo-catalogo-aprobado-qa',{
   method:'GET',
   headers:{Origin:conf.panel,Accept:'application/json',
    ...await require('../lib/romo-oidc-s2s-qa.cjs').headersOIDCRomoQA(process.env)},
   cache:'no-store',redirect:'error',signal:controller.signal
  });
  if(!resp.ok)throw Error('Catálogo aprobado no verificable');
  const raw=await resp.text();
  if(raw.length>200000)throw Error('Catálogo demasiado grande');
  return JSON.parse(raw);
 }finally{clearTimeout(timer);}
}
module.exports=async function gestionRomoQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 if(!entornoGestionRomoAutorizado(process.env))
  return fail(res,503,'Administración disponible solo en QA de Romo');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Administración de Romo no habilitada');
 const method=String(req.method||'').toUpperCase();
 if(!['GET','POST','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 const origin=String(req.headers?.origin||'');
 const access=resolverOrigenLecturaUnificadaRomoQA(req,conf.panel,conf.sharedRead);
 if(!access)return fail(res,403,'Origen de Romo no autorizado');
 if(origin)res.setHeader('Access-Control-Allow-Origin',access.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods',access.compartido?'GET,OPTIONS':'GET,POST,OPTIONS');
 if(method==='OPTIONS')return res.status(204).end();
 // Bandera separada: no reabre el editor de la carta comercial ni producción.
 const adminWrite=escrituraGestionRomoAutorizada(process.env);
 if(method==='POST'&&!adminWrite)return fail(res,503,'Gestión Romo solo lectura en Preview');
 if(method==='POST'&&(!String(req.headers['content-type']||'').startsWith('application/json')||
   !req.body||typeof req.body!=='object'||Array.isArray(req.body)||
   JSON.stringify(req.body).length>6000))
  return fail(res,400,'Solicitud administrativa inválida');
 if(method==='POST'){
  const keys=Object.keys(req.body).sort().join('|');
  if(keys!==['action','expectedRevision','fields','motivo'].sort().join('|'))
   return fail(res,400,'Campos no autorizados');
  if(!Number.isSafeInteger(req.body.expectedRevision)||req.body.expectedRevision<0||
   typeof req.body.action!=='string'||!req.body.fields||
   typeof req.body.fields!=='object'||Array.isArray(req.body.fields)||
   typeof req.body.motivo!=='string'||req.body.motivo.trim().length<4||
   req.body.motivo.trim().length>300)
   return fail(res,400,'Información de guardado inválida');
 }
 try{
  const {neon}=require('@neondatabase/serverless');
  const sql=neon(conf.database);
  const db={query:(query,args)=>sql.query(query,args)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({authorization:req.headers.authorization,
   db,verifyToken:auth.verifyFirebaseGoogleToken});
  if(!identity||identity.brand!=='romo'||identity.role!=='duenos')
   return fail(res,403,'Solo cuenta de dueños de Romo');
  const base=await approved(conf);
  const rows=await db.query('SELECT store_id,revision,contenido FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1',[STORE]);
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Registro administrativo no inicializado en Neon QA');
  const current=M.read(rows[0]);
  if(method==='GET')return res.status(200).json({
   ...M.view(rows[0],base),edicionHabilitada:adminWrite,
   aviso:'Borradores administrativos, no publicados en la carta comercial'
  });
  if(current.revision!==req.body.expectedRevision)
   return fail(res,409,'La gestión cambió. Actualiza la pantalla antes de guardar');
  const next=M.apply(current,base,req.body.action,req.body.fields);
  // CAS + auditoría como una sentencia. Nunca registrar éxito si falla auditoría.
  const saveSql=[
   'WITH saved AS (',
   ' UPDATE public.romo_carta_admin_qa_v1',
   ' SET revision=revision+1,contenido=$3::jsonb,actualizado_por=$4,actualizado_en=now()',
   ' WHERE store_id=$1 AND revision=$2',
   ' RETURNING revision',
   '), audit AS (',
   ' INSERT INTO public.romo_carta_admin_auditoria_qa_v1',
   ' (store_id,revision,accion,registro_id,anterior,nuevo,responsable_uid,motivo)',
   ' SELECT $1,revision,$5,$6,$7::jsonb,$8::jsonb,$4,$9 FROM saved',
   ' RETURNING revision',
   ') SELECT saved.revision FROM saved JOIN audit USING (revision)'
  ].join('\n');
  const saved=await db.query(saveSql,[
   STORE,current.revision,JSON.stringify(next.data),identity.userId,
   next.action,next.id,JSON.stringify(next.before),JSON.stringify(next.after),
   req.body.motivo.trim()
  ]);
  if(!Array.isArray(saved)||saved.length!==1||Number(saved[0].revision)!==next.revision)
   return fail(res,409,'Conflicto de revisión; ningún cambio confirmado');
  return res.status(200).json({ok:true,storeId:STORE,revision:next.revision,
   guardado:true,auditado:true,draftOnly:true});
 }catch(error){
  if(error?.status===400)return fail(res,400,String(error.message));
  if(error?.status===409)return fail(res,409,'Conflicto de revisión; actualiza antes de guardar');
  console.error('Administración QA Romo falló:',String(error?.message||error));
  return fail(res,503,'El cambio no pudo confirmarse; consulta el estado antes de repetirlo');
 }
};
module.exports._internalQA={config,apply:M.apply};