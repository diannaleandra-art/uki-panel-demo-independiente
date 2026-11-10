'use strict';
// Uki Sushi: disponibilidad manual por sucursal; nunca alterar stock, precios, caja ni pedidos.
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const {baseItems}=require('../lib/uki-catalogo-v1.cjs');
const BRANCHES=new Set(['arica','serena']);
const ORIGINS=new Set(['https://diannaleandra-art.github.io','https://uki-sushi-pedidos.vercel.app']);
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const QA_REF_ETAPA2='integracion/uki-promociones-ingredientes-seguros-qa-20261109';
const QA_REF_TIPOS='qa/uki-promos-tipos-producto-20261110';
const QA_PANEL_ORIGIN='https://uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app';
function qaBranch(env=process.env){return env.VERCEL_ENV==='preview'&&
 (env.VERCEL_GIT_COMMIT_REF===QA_REF||(env.VERCEL_GIT_COMMIT_REF===QA_REF_ETAPA2||env.VERCEL_GIT_COMMIT_REF===QA_REF_TIPOS))&&
 env.UKI_INVENTARIO_QA_ENABLED==='true';}
function qaMenuOrigin(origin){
 return /^https:\/\/uki-sushi-pedidos-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(origin);
}
function qaOwnOrigin(origin,env=process.env){
 return qaBranch(env)&&!!env.VERCEL_URL&&origin==='https://'+env.VERCEL_URL;
}
function allowedOrigin(origin,env=process.env){
 return ORIGINS.has(origin)||(qaBranch(env)&&(qaMenuOrigin(origin)||origin===QA_PANEL_ORIGIN))||qaOwnOrigin(origin,env);
}
const PROJECT='uki-panel-f4909';
const fail=(res,code,error)=>res.status(code).json({ok:false,error});
async function authorized(req){
 const bearer=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/'+PROJECT,audience:PROJECT,algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const ids=String(process.env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(process.env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!ids.includes(payload.sub)&&!(payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub),label:'Administración Uki'};
}
async function catalog(sql,branch){
 const [base,overrides,added]=await Promise.all([
  baseItems(branch),
  sql.query('SELECT sku,available,version FROM public.uki_carta_items_v1 WHERE branch=$1',[branch]),
  sql.query('SELECT sku,kind,name,group_key,available,version FROM public.uki_carta_productos_custom_v1 WHERE branch=$1',[branch])
 ]);
 const map=new Map(overrides.map(x=>[String(x.sku),x]));
 return [...base.map(i=>({sku:i.sku,kind:i.kind,name:i.name,group:i.group_key,
  available:map.has(i.sku)?map.get(i.sku).available===true:true,
  version:map.has(i.sku)?Number(map.get(i.sku).version):0})),
  ...added.map(i=>({sku:i.sku,kind:i.kind,name:i.name,group:i.group_key,
   available:i.available===true,version:Number(i.version)}))];
}
function updateStatement(){return [
 'WITH before AS (SELECT available,version FROM public.uki_carta_items_v1 WHERE branch=$1 AND sku=$2),',
 'changed AS (INSERT INTO public.uki_carta_items_v1',
 '(branch,sku,kind,group_key,custom,name,description,price,available,stock_qty,stock_unit,version,updated_by)',
 "SELECT $1,$2,$3,$4,FALSE,$5,'',$6,$7,0,'un',1,$8",
 'WHERE $9=0 OR EXISTS (SELECT 1 FROM before WHERE version=$9)',
 'ON CONFLICT (branch,sku) DO UPDATE',
 'SET available=EXCLUDED.available,version=public.uki_carta_items_v1.version+1,',
 'updated_at=NOW(),updated_by=EXCLUDED.updated_by',
 'WHERE public.uki_carta_items_v1.version=$9 AND public.uki_carta_items_v1.available IS DISTINCT FROM EXCLUDED.available',
 'RETURNING branch,sku,available,version),',
 'logged AS (INSERT INTO public.uki_carta_movimientos_v1',
 '(branch,sku,accion,disponibilidad_anterior,disponibilidad_nueva,realizado_por,rol,identidad_autorizada)',
 "SELECT changed.branch,changed.sku,CASE WHEN changed.available THEN 'disponible' ELSE 'agotado' END,",
 "COALESCE(before.available,TRUE),changed.available,$10,'admin',$8",
 'FROM changed LEFT JOIN before ON TRUE RETURNING id)',
 'SELECT changed.available,changed.version FROM changed JOIN logged ON TRUE'
 ].join(' ');}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers?.origin||'');
 if(origin&&allowedOrigin(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 }
 if(req.method==='OPTIONS')return res.status(allowedOrigin(origin)?204:403).end();
 if(req.method!=='GET'&&req.method!=='POST')return fail(res,405,'Método no permitido');
 if(origin&&!allowedOrigin(origin))return fail(res,403,'Origen no autorizado');
 const branch=String(req.method==='GET'?(req.query?.branch||''):(req.body?.branch||''));
 if(!BRANCHES.has(branch))return fail(res,400,'Sucursal incorrecta');
 const url=dbUrl();
 if(!url)return fail(res,503,'Disponibilidad temporalmente no disponible');
 let sql;try{sql=require('@neondatabase/serverless').neon(url);}catch{return fail(res,503,'Servicio no disponible');}
 try{
  if(req.method==='GET'){
   const [rows,custom]=await Promise.all([
    sql.query('SELECT sku FROM public.uki_carta_items_v1 WHERE branch=$1 AND available=FALSE',[branch]),
    sql.query('SELECT sku FROM public.uki_carta_productos_custom_v1 WHERE branch=$1 AND available=FALSE',[branch])
   ]);
   return res.status(200).json({ok:true,branch,unavailable:[...rows,...custom].map(r=>String(r.sku))});
  }
  if(origin!=='https://diannaleandra-art.github.io'&&!(qaBranch()&&origin===QA_PANEL_ORIGIN))return fail(res,403,'Solo panel operativo');
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')return fail(res,415,'Se requiere JSON');
  if(!req.body||JSON.stringify(req.body).length>1200)return fail(res,400,'Solicitud inválida');
  const user=await authorized(req).catch(()=>null);
  if(!user)return fail(res,403,'Solo administración Google autorizada');
  if(req.body.action==='listar')return res.status(200).json({ok:true,branch,items:await catalog(sql,branch)});
  if(req.body.action!=='marcar')return fail(res,400,'Acción no permitida');
  const {sku,available,expected_version}=req.body;
  if(typeof sku!=='string'||typeof available!=='boolean'||!Number.isSafeInteger(expected_version)||expected_version<0)return fail(res,400,'Cambio inválido');
  const items=await baseItems(branch),entry=items.find(x=>x.sku===sku);
  if(!entry){
   const custom=await sql.query('SELECT sku FROM public.uki_carta_productos_custom_v1 WHERE branch=$1 AND sku=$2',[branch,sku]);
   if(!custom.length)return fail(res,404,'Producto no reconocido en esta carta y sucursal');
   const rows=await sql.query(`WITH before AS (
    SELECT available,version FROM public.uki_carta_productos_custom_v1 WHERE branch=$1 AND sku=$2
   ), changed AS (
    UPDATE public.uki_carta_productos_custom_v1
    SET available=$3,version=version+1,updated_by=$5,updated_at=NOW()
    WHERE branch=$1 AND sku=$2 AND version=$4 AND available IS DISTINCT FROM $3
    RETURNING branch,sku,available,version
   ), logged AS (
    INSERT INTO public.uki_carta_movimientos_v1
    (branch,sku,accion,disponibilidad_anterior,disponibilidad_nueva,realizado_por,rol,identidad_autorizada)
    SELECT changed.branch,changed.sku,CASE WHEN changed.available THEN 'disponible' ELSE 'agotado' END,
     before.available,changed.available,'Administración Uki','admin',$5
    FROM changed JOIN before ON TRUE RETURNING id
   ) SELECT changed.available,changed.version FROM changed JOIN logged ON TRUE`,
    [branch,sku,available,expected_version,user.uid]);
   if(!rows.length)return fail(res,409,'La disponibilidad cambió. Actualiza antes de guardar.');
   return res.status(200).json({ok:true,branch,sku,available:rows[0].available,version:Number(rows[0].version)});
  }
  const rows=await sql.query(updateStatement(),[branch,entry.sku,entry.kind,entry.group_key,entry.name,entry.price,available,user.uid,expected_version,user.label]);
  if(!rows.length)return fail(res,409,'Otro cambio de disponibilidad se guardó antes. Actualiza la lista.');
  return res.status(200).json({ok:true,branch,sku,available:rows[0].available,version:Number(rows[0].version)});
 }catch(err){
  console.error('Disponibilidad manual error',String(err?.code||err?.name||'error').slice(0,70));
  return fail(res,503,'No se pudo consultar o guardar la disponibilidad. No se modificó la caja.');
 }
};
module.exports._testing={ORIGINS,allowedOrigin,updateStatement,catalog};