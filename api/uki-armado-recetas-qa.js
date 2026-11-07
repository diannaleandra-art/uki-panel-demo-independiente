'use strict';
// QA: no modifica inventario, caja, pedidos ni carta productiva.
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const {listing}=require('./uki-carta-precios-live.js')._testing;
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const qa=(e=process.env)=>e.VERCEL_ENV==='preview'&&e.VERCEL_GIT_COMMIT_REF===QA_REF&&e.UKI_INVENTARIO_QA_ENABLED==='true';
const ORIGINS=new Set(['https://diannaleandra-art.github.io']);
const originOK=x=>ORIGINS.has(x)||/^https:\/\/uki-sushi-(?:pedidos|inventario)-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(x);
const fail=(r,status,error)=>r.status(status).json({ok:false,error});
const nameOK=s=>typeof s==='string'&&s.trim().length>=2&&s.trim().length<=80&&!/[\u0000-\u001f<>]/.test(s);
const skuOK=s=>typeof s==='string'&&s.length>=3&&s.length<=120&&/^[a-z0-9:-]+$/i.test(s);
const validRecipe=raw=>{
 if(!Array.isArray(raw)||raw.length<1||raw.length>60)return null;
 const units=new Set(['un','g','kg','ml','l','porciones']),clean=[];
 for(const i of raw){
  const qty=Number(i?.cantidad),cost=Number(i?.costo_unidad),unit=i?.unidad;
  if(!nameOK(i?.nombre)||!units.has(unit)||!Number.isFinite(qty)||qty<=0||qty>100000||
     !Number.isFinite(cost)||cost<0||cost>10000000||qty*cost>100000000)return null;
  clean.push({nombre:i.nombre.trim(),cantidad:Math.round(qty*1000)/1000,unidad:unit,
    costo_unidad:Math.round(cost*1000)/1000});
 }
 return clean;
};
async function authorized(req,e=process.env){
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const emails=String(e.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
 const ids=String(e.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim());
 if(!ids.includes(payload.sub)&&!(payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub)};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff');
 const origin=String(req.headers?.origin||'');
 if(origin&&originOK(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 }
 if(req.method==='OPTIONS')return res.status(originOK(origin)?204:403).end();
 if(!qa())return fail(res,404,'Solo disponible en pruebas.');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido.');
 if(origin&&!originOK(origin))return fail(res,403,'Origen no autorizado.');
 const branch=String(req.method==='GET'?req.query?.branch:req.body?.branch||'');
 if(!['arica','serena'].includes(branch))return fail(res,400,'Sucursal inválida.');
 const url=dbUrl();if(!url)return fail(res,503,'Base aislada de pruebas no disponible.');
 let sql;
 try{sql=require('@neondatabase/serverless').neon(url);}catch{return fail(res,503,'Base de pruebas no disponible.');}
 try{
  const list=()=>sql.query('SELECT id,categoria,preparacion,nombre,recargo,activo,version FROM public.uki_armado_opciones_qa WHERE branch=$1 ORDER BY preparacion,categoria,nombre',[branch]);
  const removed=()=>sql.query('SELECT sku,retirado FROM public.uki_productos_retirados_qa WHERE branch=$1',[branch]);
  if(req.method==='GET'){
   const [opciones,retirados]=await Promise.all([list(),removed()]);
   return res.status(200).json({ok:true,branch,opciones:opciones.map(x=>({...x,recargo:Number(x.recargo)})),
    retirados:retirados.filter(x=>x.retirado).map(x=>x.sku)});
  }
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json'||!req.body||
   JSON.stringify(req.body).length>12000)return fail(res,400,'Solicitud JSON inválida.');
  const who=await authorized(req).catch(()=>null);
  if(!who)return fail(res,403,'Solo administración Google autorizada.');
  const action=String(req.body.action||'');
  if(action==='listar-admin'){
   const [opciones,retirados,recetas,productos]=await Promise.all([
    list(),removed(),
    sql.query('SELECT sku,ingredientes,version FROM public.uki_recetas_costos_qa WHERE branch=$1',[branch]),
    listing(sql,branch)
   ]);
   return res.status(200).json({ok:true,branch,opciones,retirados,recetas,
    productos:productos.map(x=>({sku:x.sku,name:x.name,kind:x.kind,price:x.price,available:x.available,custom:x.custom}))});
  }
  if(action==='guardar-opcion'){
   const {categoria,preparacion,nombre}=req.body;
   const recargo=Number(req.body.recargo),activo=req.body.activo!==false;
   if(!['proteina','vegetal'].includes(categoria)||
    !['classic','premium','monthly','dish'].includes(preparacion)||!nameOK(nombre)||
    !Number.isSafeInteger(recargo)||recargo<0||recargo>50000)
     return fail(res,400,'Revisa tipo, preparación, nombre y recargo.');
   const rows=await sql.query(
    'INSERT INTO public.uki_armado_opciones_qa(branch,categoria,preparacion,nombre,recargo,activo,actualizado_por) '+
    'VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (branch,categoria,preparacion,lower(btrim(nombre))) '+
    'DO UPDATE SET recargo=excluded.recargo,activo=excluded.activo,version=public.uki_armado_opciones_qa.version+1,'+
    'actualizado_por=excluded.actualizado_por,actualizado_en=now() '+
    'RETURNING id,categoria,preparacion,nombre,recargo,activo,version',
    [branch,categoria,preparacion,nombre.trim(),recargo,activo,who.uid]);
   return res.status(200).json({ok:true,branch,opcion:rows[0]});
  }
  if(action==='guardar-receta'){
   const sku=req.body.sku,lines=validRecipe(req.body.ingredientes);
   if(!skuOK(sku)||!lines)return fail(res,400,'Revisa ingredientes, cantidades y costos.');
   if(!(await listing(sql,branch)).some(x=>x.sku===sku))return fail(res,404,'Producto no encontrado en esta sucursal.');
   const result=await sql.query('INSERT INTO public.uki_recetas_costos_qa(branch,sku,ingredientes,actualizado_por) '+
    'VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(branch,sku) DO UPDATE SET ingredientes=excluded.ingredientes,'+
    'version=public.uki_recetas_costos_qa.version+1,actualizado_por=excluded.actualizado_por,actualizado_en=now() '+
    'RETURNING sku,version',[branch,sku,JSON.stringify(lines),who.uid]);
   return res.status(200).json({ok:true,branch,receta:result[0]});
  }
  if(action==='retirar-producto'){
   const sku=req.body.sku,retirado=req.body.retirado;
   if(!skuOK(sku)||typeof retirado!=='boolean')return fail(res,400,'Revisa producto y estado.');
   if(!(await listing(sql,branch)).some(x=>x.sku===sku))return fail(res,404,'Producto no encontrado.');
   const result=await sql.query('INSERT INTO public.uki_productos_retirados_qa(branch,sku,retirado,actualizado_por) '+
    'VALUES($1,$2,$3,$4) ON CONFLICT(branch,sku) DO UPDATE SET retirado=excluded.retirado,'+
    'version=public.uki_productos_retirados_qa.version+1,actualizado_por=excluded.actualizado_por,actualizado_en=now() '+
    'RETURNING sku,retirado,version',[branch,sku,retirado,who.uid]);
   return res.status(200).json({ok:true,branch,producto:result[0]});
  }
  return fail(res,400,'Acción no permitida.');
 }catch(e){
  console.error('Armado QA',String(e?.code||e?.name||'error').slice(0,60));
  return fail(res,503,'No se pudo guardar en pruebas. La carta y la caja siguen intactas.');
 }
};
module.exports._testing={qa,originOK,nameOK,validRecipe};
