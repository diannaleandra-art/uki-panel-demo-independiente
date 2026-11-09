'use strict';
// Ingredientes editables del ARMADO, no del inventario. Sin operaciones de caja.
const {randomUUID}=require('node:crypto');
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const ORIGINS=new Set(['https://diannaleandra-art.github.io','https://uki-sushi-pedidos.vercel.app']);
const BRANCHES=new Set(['arica','serena']),CATEGORIES=new Set(['vegetal','proteina','envoltura']);
const SURFACES=new Set(['classic','premium','monthly','handroll','burger','gohan']);
const QA_REF='preparacion/uki-publicacion-unificada-2026-11-07';
const QA_REF_ETAPA2='integracion/uki-promociones-ingredientes-seguros-qa-20261109';
const QA_MENU=/^https:\/\/(?:uki-sushi-pedidos-[a-z0-9-]+-diannaleandra-7046|uki-sushi-carta-prueba(?:-[a-z0-9-]+-diannaleandra-7046)?)\.vercel\.app$/;
const QA_PANEL=/^https:\/\/uki-sushi-inventario-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/;
const qa=e=>e.VERCEL_ENV==='preview'&&
 (e.VERCEL_GIT_COMMIT_REF===QA_REF||e.VERCEL_GIT_COMMIT_REF===QA_REF_ETAPA2)&&
 e.UKI_INVENTARIO_QA_ENABLED==='true';
const sameQAOrigin=(origin,e)=>qa(e)&&!!e.VERCEL_URL&&origin==='https://'+e.VERCEL_URL;
const enabled=e=>(e.VERCEL_ENV==='production'&&e.UKI_INGREDIENTES_ARMADO_ENABLED==='true')||qa(e);
const allow=(origin,e)=>!origin||ORIGINS.has(origin)||(qa(e)&&(QA_MENU.test(origin)||QA_PANEL.test(origin)||sameQAOrigin(origin,e)));
const error=(res,s,msg)=>res.status(s).json({ok:false,error:msg});
const normalizeName=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
function validateItem(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 const name=String(v.name||'').trim().replace(/\s+/g,' ');
 const category=String(v.category||''),surcharge=v.surcharge,available=v.available;
 if(name.length<2||name.length>70||!CATEGORIES.has(category)||
    !Number.isSafeInteger(surcharge)||surcharge<0||surcharge>50000||
    typeof available!=='boolean'||!Array.isArray(v.surfaces))return null;
 const surfaces=[...new Set(v.surfaces)];
 const allowedCategory={vegetal:SURFACES,proteina:new Set(['classic','premium','monthly','handroll','burger']),envoltura:new Set(['classic','premium','monthly','handroll'])};
 if(!surfaces.length||surfaces.length>6||surfaces.some(s=>!SURFACES.has(s)||!allowedCategory[category].has(s)))return null;
 // No llamar un ingrediente como opción estructural de armado.
 if(['mixta','sin vegetal','solo proteina','vegetariano','sin nori','sin queso'].includes(normalizeName(name)))return null;
 return {name,category,surcharge,surfaces,available};
}
async function userFromToken(req,e=process.env){
 const raw=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!raw||raw.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(raw,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const ids=String(e.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(e.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const email=String(payload.email||'').toLowerCase();
 if(!ids.includes(payload.sub)&&!(email&&payload.email_verified===true&&emails.includes(email)))return null;
 return String(payload.sub);
}
async function listing(sql,branch){
 const r=await sql.query('SELECT sku,category,name,surcharge,surfaces,available,version FROM public.uki_armado_ingredientes_v1 WHERE branch=$1 ORDER BY category,name',[branch]);
 return r.map(x=>({sku:x.sku,category:x.category,name:x.name,surcharge:Number(x.surcharge),surfaces:x.surfaces,available:x.available===true,version:Number(x.version)}));
}
module.exports=async function(req,res){
 const e=process.env,origin=String(req.headers?.origin||'');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 if(!allow(origin,e))return error(res,403,'Origen no autorizado');
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return error(res,405,'Método no permitido');
 if(!enabled(e))return error(res,503,'Administrador de ingredientes aún no habilitado');
 const branch=String(req.method==='GET'?req.query?.branch||'':req.body?.branch||'');
 if(!BRANCHES.has(branch))return error(res,400,'Sucursal incorrecta');
 const url=dbUrl(e);if(!url)return error(res,503,'Base de carta no disponible');
 let sql;try{sql=require('@neondatabase/serverless').neon(url)}
 catch{return error(res,503,'No se pudo abrir base de datos')}
 try{
  if(req.method==='GET')return res.status(200).json({ok:true,branch,items:await listing(sql,branch)});
  if(origin!=='https://diannaleandra-art.github.io'&&!(qa(e)&&QA_PANEL.test(origin))&&!sameQAOrigin(origin,e))
   return error(res,403,'Solo administración');
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
   return error(res,415,'Se requiere JSON');
  if(!req.body||JSON.stringify(req.body).length>2000)return error(res,400,'Solicitud inválida');
  const uid=await userFromToken(req,e).catch(()=>null);
  if(!uid)return error(res,403,'Solo administración Google autorizada');
  const action=String(req.body.action||'');
  if(action==='listar')return res.status(200).json({ok:true,branch,items:await listing(sql,branch)});
  // Retirar no borra una preparación antigua ni altera stock/caja.
  // La carta usa available=false para ocultar esta opción, el editor permite restaurarla.
  if(action==='retirar'||action==='restaurar'){
   const sku=String(req.body.sku||''),version=req.body.expected_version;
   if(!/^armado:(vegetal|proteina|envoltura):[0-9a-f-]{13}$/i.test(sku)||!Number.isSafeInteger(version)||version<1)
    return error(res,400,'Actualiza el ingrediente antes de continuar');
   const available=action==='restaurar';
   const changed=await sql.query('UPDATE public.uki_armado_ingredientes_v1 SET available=$4,version=version+1,updated_by=$5,updated_at=now() WHERE branch=$1 AND sku=$2 AND version=$3 AND available IS DISTINCT FROM $4 RETURNING sku,available,version',
    [branch,sku,version,available,uid]);
   if(!changed.length)return error(res,409,'La opción ya cambió. Actualiza la lista.');
   return res.status(200).json({ok:true,branch,sku,available,version:Number(changed[0].version)});
  }
  const item=validateItem(req.body.item);
  if(!item)return error(res,400,'Revisa ingrediente, categoría, recargo y preparaciones');
  if(action==='crear'){
   const sku='armado:'+item.category+':'+randomUUID().slice(0,13);
   const r=await sql.query('INSERT INTO public.uki_armado_ingredientes_v1(branch,sku,category,name,surcharge,surfaces,available,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING sku,version',
    [branch,sku,item.category,item.name,item.surcharge,item.surfaces,item.available,uid]);
   if(!r.length)return error(res,409,'El ingrediente ya existe. Edita el registro existente.');
   return res.status(201).json({ok:true,branch,sku,version:Number(r[0].version)});
  }
  if(action!=='editar')return error(res,400,'Acción no permitida');
  const sku=String(req.body.sku||''),version=req.body.expected_version;
  if(!/^armado:(vegetal|proteina|envoltura):[0-9a-f-]{13}$/i.test(sku)||
     !Number.isSafeInteger(version)||version<1)return error(res,400,'Actualiza antes de editar');
  const r=await sql.query('UPDATE public.uki_armado_ingredientes_v1 SET name=$4,category=$5,surcharge=$6,surfaces=$7,available=$8,version=version+1,updated_by=$9,updated_at=now() WHERE branch=$1 AND sku=$2 AND version=$3 RETURNING sku,version',
   [branch,sku,version,item.name,item.category,item.surcharge,item.surfaces,item.available,uid]);
  if(!r.length)return error(res,409,'El ingrediente cambió. Actualiza la lista.');
  return res.status(200).json({ok:true,branch,sku,version:Number(r[0].version)});
 }catch(ex){
  if(ex?.code==='23505')return error(res,409,'Ya existe un ingrediente con ese nombre en la sucursal');
  console.error('Ingredientes de armado',String(ex?.code||ex?.name||'error').slice(0,70));
  return error(res,503,'No se guardó. Los pedidos, caja e inventario permanecen sin cambios');
 }
};
module.exports._test={validateItem,normalizeName,enabled,allow};
