'use strict';
// Inventario exclusivo Romo, API del mismo proyecto que el panel Uki.
// Nunca comparte el almacén ni autenticación de inventario de Uki.
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const STORE='romo:serena';
const fail=(r,n,s)=>r.status(n).json({ok:false,storeId:STORE,error:s});
function config(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
   env.ROMO_INVENTARIO_LECTURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(host))return null;
 const parse=(text,user)=>{
  try{
   const u=new URL(String(text||''));
   return ['postgres:','postgresql:'].includes(u.protocol)&&
    u.hostname.toLowerCase()===host&&u.pathname==='/romos_sushi'&&
    u.username===user&&u.password?u.toString():null;
  }catch{return null}
 };
 const read=parse(env.ROMO_PRIVATE_DATABASE_URL,'romos_app_service');
 // Inventario y caja usan la cuenta de servicio ya existente de Romo.
 // El usuario de alta de claves NO es la credencial de inventario.
 const write=read;
 if(!read)return null;
 for(const key of ['UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
  'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL']){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 return {origin,read,write};
}
module.exports=async function romoInventarioQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf)return fail(res,503,'Inventario Romo no habilitado');
 const method=String(req.method||'').toUpperCase();
 if(!['GET','POST','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 const origin=String(req.headers?.origin||'');
 const host=String(req.headers?.host||'').toLowerCase();
 const same=origin===conf.origin||(method==='GET'&&!origin&&
  host===new URL(conf.origin).host.toLowerCase());
 if(!same)return fail(res,403,'Origen del panel Romo inválido');
 if(origin)res.setHeader('Access-Control-Allow-Origin',conf.origin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 if(method==='OPTIONS')return res.status(204).end();
 if(method==='POST'&&(process.env.ROMO_INVENTARIO_ESCRITURA_QA_ENABLED!=='true'||!conf.write))
  return fail(res,503,'Inventario de Romo en modo consulta');
 if(method==='POST'&&String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 if(method==='POST'&&JSON.stringify(req.body||{}).length>15000)
  return fail(res,413,'Formulario demasiado grande');
 try{
  const neon=require('@neondatabase/serverless').neon;
  const read=neon(conf.read),reader={query:(sql,values)=>read.query(sql,values)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db:reader,
   verifyToken:auth.verifyFirebaseGoogleToken
  });
  // Mismo reparto de permisos: dueños y agendador pueden gestionar inventario;
  // personal de inventario puede contar/registrar existencias, pero no editar catálogo.
  // Las operaciones concretas siguen autorizadas dentro del módulo de inventario.
  if(!identity||!['duenos','agendador','inventario'].includes(identity.role))
   return fail(res,403,'Sin permiso de inventario de Romo');
  const inv=await import('../lib/romo-inventario-qa.mjs');
  if(method==='GET'){
   const result=await inv.readInventarioRomoQA({db:reader,identity});
   return res.status(200).json({ok:true,...result});
  }
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!=='action|args|expectedRevision'||
    !['alta','editar','editar_completo','archivar','conteo','entrada','disponibilidad'].includes(body.action)||
    !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||
    !body.args||typeof body.args!=='object'||Array.isArray(body.args))
   return fail(res,400,'Operación de inventario inválida');
  const writer=reader; // Solo tabla Romo, con control de revisión en SQL.
  const result=await inv.guardarOperacionInventarioRomoQA({
   db:writer,identity,expectedRevision:body.expectedRevision,
   action:body.action,args:body.args
  });
  return res.status(200).json({ok:true,...result});
 }catch(e){
  if(e?.code==='REVISION_CONFLICTO')return fail(res,409,'Inventario cambió; actualiza antes de repetir');
  if(/permiso|rol|identidad|autorizad/i.test(String(e?.message||'')))
   return fail(res,403,'Sin permiso para inventario Romo');
  if(/inválid|Cantidad|artículo|Nombre|unidad|tipo|existe|SKU|cambios|límite|stock|Entrada|archivado/i.test(String(e?.message||'')))
   return fail(res,400,'Datos de inventario no válidos');
  return fail(res,503,'Movimiento no confirmado en Neon Romo');
 }
};
module.exports._internalQA={config};
