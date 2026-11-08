'use strict';
// Administración de Carta y precios (nunca inventario, caja ni pedidos).
const {randomUUID}=require('node:crypto');
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const {baseItems}=require('../lib/uki-catalogo-v1.cjs');
const BRANCHES=new Set(['arica','serena']);
const ALLOWED=new Set(['https://diannaleandra-art.github.io','https://uki-sushi-pedidos.vercel.app']);
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const QA_MENU='https://uki-sushi-pedidos-git-feature-uki-dis-eb0d72-diannaleandra-7046.vercel.app';
const QA_PANEL='https://uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app';
const qa=env=>env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF===QA_REF&&env.UKI_INVENTARIO_QA_ENABLED==='true';
const originAllowed=(origin,env=process.env)=>ALLOWED.has(origin)||(qa(env)&&(origin===QA_MENU||origin===QA_PANEL));
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
async function authorized(req,env=process.env){
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
 const ids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim());
 if(!ids.includes(payload.sub)&&!(payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub)};
}
function goodPrice(x){return Number.isSafeInteger(x)&&x>=1&&x<=1000000;}
function goodText(value,max=100){return typeof value==='string'&&value.trim().length>=2&&value.trim().length<=max;}
function getSKU(kind,name){return kind+':'+String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,62)+'-'+randomUUID().slice(0,8);}
function validNew(input,branch){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const kind=input.kind==='pizza'?'pizza':input.kind==='dish'?'dish':null;
 if(!kind||kind==='pizza'&&branch!=='arica'||input.group!==(kind==='pizza'?'pizzas':'entradas'))return null;
 if(!goodText(input.name)||!goodPrice(input.price)||typeof input.description!=='string'||input.description.length>500)return null;
 return {kind,group:input.group,name:input.name.trim(),description:input.description.trim(),price:input.price};
}
async function listing(sql,branch){
 const [base,overrides,custom]=await Promise.all([
  baseItems(branch),
  sql.query("SELECT sku,price,available,version FROM public.uki_carta_items_v1 WHERE branch=$1 AND kind<>'ingredient'",[branch]),
  sql.query("SELECT sku,kind,group_key,name,description,price,available,version FROM public.uki_carta_productos_custom_v1 WHERE branch=$1 ORDER BY group_key,name",[branch])
 ]);
 const map=new Map(overrides.map(o=>[String(o.sku),o]));
 const normal=base.filter(i=>i.kind!=='ingredient').map(i=>{
  const o=map.get(i.sku);return {sku:i.sku,kind:i.kind,group:i.group_key,name:i.name,description:i.description||'',
   price:o&&o.price!==null?Number(o.price):i.price,available:o?o.available===true:true,version:o?Number(o.version):0,custom:false};
 });
 return [...normal,...custom.map(x=>({sku:x.sku,kind:x.kind,group:x.group_key,name:x.name,
  description:x.description,price:Number(x.price),available:x.available===true,version:Number(x.version),custom:true}))];
}
async function modifyPrice(sql,branch,item,price,version,uid){
 if(item.custom){
  return sql.query("UPDATE public.uki_carta_productos_custom_v1 SET price=$3,version=version+1,updated_by=$5,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND version=$4 AND price IS DISTINCT FROM $3 RETURNING sku,price,version",[branch,item.sku,price,version,uid]);
 }
 return sql.query(`INSERT INTO public.uki_carta_items_v1
 (branch,sku,kind,group_key,custom,name,description,price,available,stock_qty,stock_unit,version,updated_by)
 SELECT $1,$2,$3,$4,FALSE,$5,$6,$7,TRUE,0,'un',1,$8
 WHERE $9=0 OR EXISTS (SELECT 1 FROM public.uki_carta_items_v1 WHERE branch=$1 AND sku=$2 AND version=$9)
 ON CONFLICT(branch,sku) DO UPDATE SET price=$7,version=public.uki_carta_items_v1.version+1,updated_by=$8,updated_at=NOW()
 WHERE public.uki_carta_items_v1.version=$9 AND public.uki_carta_items_v1.price IS DISTINCT FROM $7
 RETURNING sku,price,version`,[branch,item.sku,item.kind,item.group,item.name,item.description,price,uid,version]);
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const origin=String(req.headers?.origin||'');
 if(origin&&originAllowed(origin)){res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');}
 if(req.method==='OPTIONS')return res.status(originAllowed(origin)?204:403).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(origin&&!originAllowed(origin))return fail(res,403,'Origen no autorizado');
 const branch=String(req.method==='GET'?req.query?.branch||'':req.body?.branch||'');
 if(!BRANCHES.has(branch))return fail(res,400,'Sucursal inválida');
 const url=dbUrl();if(!url)return fail(res,503,'Servicio de carta no disponible');
 let sql;try{sql=require('@neondatabase/serverless').neon(url);}catch{return fail(res,503,'Servicio no disponible');}
 try{
  if(req.method==='GET'){
   // No enviar productos personalizados retirados al menú de los clientes;
   // la lista administrativa conserva todos los registros para poder restaurarlos.
   const items=(await listing(sql,branch)).filter(i=>!i.custom||i.available);
   return res.status(200).json({ok:true,branch,items});
  }
  if(origin!=='https://diannaleandra-art.github.io'&&!(qa(process.env)&&origin===QA_PANEL))
   return fail(res,403,'Solo administración');
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')return fail(res,415,'Se requiere JSON');
  if(!req.body||JSON.stringify(req.body).length>1800)return fail(res,400,'Solicitud inválida');
  const user=await authorized(req).catch(()=>null);if(!user)return fail(res,403,'Solo administración Google autorizada');
  const action=String(req.body.action||'');
  if(action==='listar')return res.status(200).json({ok:true,branch,items:await listing(sql,branch)});
  if(action==='crear-producto'){
   const input=validNew(req.body.item,branch);if(!input)return fail(res,400,'Solo pizzas de Regimiento Arica y entradas simples; revisa nombre y precio');
   const sku=getSKU(input.kind,input.name);
   const rows=await sql.query(`INSERT INTO public.uki_carta_productos_custom_v1
   (branch,sku,kind,group_key,name,description,price,updated_by)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
   RETURNING sku,kind,group_key,name,description,price,available,version`,
   [branch,sku,input.kind,input.group,input.name,input.description,input.price,user.uid]);
   return res.status(201).json({ok:true,branch,item:rows[0]});
  }
  if(!['editar-precio','editar-producto','retirar-producto','restaurar-producto'].includes(action))return fail(res,400,'Acción no permitida');
  const sku=String(req.body.sku||''),version=req.body.expected_version;
  if(!Number.isSafeInteger(version)||version<0||!sku||sku.length>120)return fail(res,400,'Actualiza la lista y vuelve a intentar');
  const items=await listing(sql,branch),entry=items.find(x=>x.sku===sku);
  if(!entry)return fail(res,404,'Producto no encontrado');
  if(action==='retirar-producto'||action==='restaurar-producto'){
   if(!entry.custom)return fail(res,400,'Los productos originales se controlan con Disponible/Agotado; solo puedes retirar los que agregaste.');
   const disponible=action==='restaurar-producto';
   if(entry.available===disponible)return fail(res,409,'El producto ya tiene ese estado. Actualiza la lista.');
   const changed=await sql.query('UPDATE public.uki_carta_productos_custom_v1 SET available=$3,version=version+1,updated_by=$5,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND available IS DISTINCT FROM $3 AND version=$4 RETURNING sku,available,version',
    [branch,sku,disponible,version,user.uid]);
   if(!changed.length)return fail(res,409,'El producto cambió. Actualiza antes de continuar.');
   return res.status(200).json({ok:true,branch,item:changed[0]});
  }
  if(!goodPrice(req.body.price))return fail(res,400,'Precio inválido');
  let rows;
  if(action==='editar-precio')rows=await modifyPrice(sql,branch,entry,req.body.price,version,user.uid);
  else{
   if(!entry.custom||!goodText(req.body.name)||typeof req.body.description!=='string'||req.body.description.length>500)
    return fail(res,400,'Solo se puede renombrar un producto agregado desde aquí');
   rows=await sql.query(`UPDATE public.uki_carta_productos_custom_v1 SET name=$3,description=$4,price=$5,
     version=version+1,updated_by=$7,updated_at=NOW()
    WHERE branch=$1 AND sku=$2 AND version=$6
    RETURNING sku,name,description,price,version`,
   [branch,sku,req.body.name.trim(),req.body.description.trim(),req.body.price,version,user.uid]);
  }
  if(!rows.length)return fail(res,409,'El producto cambió o ya tiene ese precio. Actualiza la lista.');
  return res.status(200).json({ok:true,branch,item:rows[0]});
 }catch(e){console.error('Carta precios',String(e?.code||e?.name||'error').slice(0,60));
  return fail(res,503,'No se pudo completar la operación. Inventario y caja siguen intactos');}
};
module.exports._testing={goodPrice,validNew,originAllowed,getSKU,listing,modifyPrice};
