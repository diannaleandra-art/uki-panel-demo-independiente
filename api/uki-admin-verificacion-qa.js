'use strict';
// Uki Sushi · PRUEBA Google exclusivamente contra Neon QA, NUNCA producción.
// No tiene acciones de escritura. El PIN de trabajador no da acceso a esta API.
const {url:qaDatabase}=require('../lib/uki-inventario-db-live.cjs');
const {baseItems}=require('../lib/uki-catalogo-v1.cjs');
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const QA_ORIGIN='https://uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app';
const BRANCHES=new Set(['arica','serena']);
const fail=(res,status,message)=>res.status(status).json({ok:false,error:message});
const qaEnabled=(env=process.env)=>env.VERCEL_ENV==='preview'&&
 env.VERCEL_GIT_COMMIT_REF===QA_REF&&env.UKI_INVENTARIO_QA_ENABLED==='true';
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
async function googleAdmin(req,env=process.env){
 const bearer=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const ids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 return ids.includes(payload.sub)||payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase())?
  {uid:String(payload.sub)}:null;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers?.origin||'');
 if(origin===QA_ORIGIN&&qaEnabled()){
  res.setHeader('Access-Control-Allow-Origin',QA_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 }
 if(!qaEnabled())return fail(res,404,'Verificación disponible únicamente en pruebas.');
 if(req.method==='OPTIONS')return res.status(origin===QA_ORIGIN?204:403).end();
 if(req.method!=='POST')return fail(res,405,'Método no permitido');
 if(origin!==QA_ORIGIN)return fail(res,403,'Abre el enlace oficial de pruebas.');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const request=req.body;
 if(!request||typeof request!=='object'||Array.isArray(request)||JSON.stringify(request).length>1000)
  return fail(res,400,'Solicitud inválida');
 const branch=String(request.branch||''),action=String(request.action||'');
 if(!BRANCHES.has(branch))return fail(res,400,'Sucursal inválida');
 if(!['diagnostico','historial','revision'].includes(action))return fail(res,400,'Solo consulta de QA');
 const admin=await googleAdmin(req).catch(()=>null);
 if(!admin)return fail(res,403,'Acceso Google no autorizado para administración Uki.');
 const url=qaDatabase();
 if(!url)return fail(res,503,'La base de pruebas no está disponible.');
 try{
  const sql=require('@neondatabase/serverless').neon(url);
  if(action==='diagnostico'){
   const [custom,history,extras,ingredients]=await Promise.all([
    sql.query('SELECT COUNT(*)::int AS n FROM public.uki_carta_productos_custom_v1 WHERE branch=$1',[branch]),
    sql.query('SELECT COUNT(*)::int AS n FROM public.uki_inventario_revisiones_qa WHERE branch=$1',[branch]),
    sql.query('SELECT sku,name,category,stock_unit,stock_qty,min_stock_qty,version FROM public.uki_inventario_extras_qa WHERE branch=$1 ORDER BY name LIMIT 50',[branch]),
    baseItems(branch)
   ]);
   const defaults=ingredients.filter(x=>x.kind==='ingredient').map(x=>({
    sku:x.sku,name:x.name,kind:'ingredient',stock_qty:Number(x.stock_qty)||0,
    min_stock_qty:Number(x.min_stock_qty)||0,stock_unit:x.stock_unit||'un'
   }));
   const other=extras.map(x=>({...x,kind:'inventory',stock_qty:Number(x.stock_qty)||0,
    min_stock_qty:Number(x.min_stock_qty)||0}));
   return res.status(200).json({ok:true,branch,modo:'SOLO QA',autorizada:true,
    nuevosProductos:Number(custom[0]?.n)||0,revisiones:Number(history[0]?.n)||0,
    items:[...defaults,...other].slice(0,120)});
  }
  if(action==='historial'){
   const desde=request.desde==null?'':String(request.desde);
   const hasta=request.hasta==null?'':String(request.hasta);
   if((desde&&!validDay(desde))||(hasta&&!validDay(hasta))||desde&&hasta&&desde>hasta)
    return fail(res,400,'Fechas inválidas');
   const rows=await sql.query(
    "SELECT id,worker_name,summary,created_at FROM public.uki_inventario_revisiones_qa WHERE branch=$1 AND ($2::text='' OR (created_at AT TIME ZONE 'America/Santiago')::date>=NULLIF($2::text,'')::date) AND ($3::text='' OR (created_at AT TIME ZONE 'America/Santiago')::date<=NULLIF($3::text,'')::date) ORDER BY created_at DESC LIMIT 25",
    [branch,desde,hasta]);
   return res.status(200).json({ok:true,branch,revisiones:rows,modo:'SOLO QA'});
  }
  const id=String(request.id||'');
  if(!/^[a-f0-9-]{36}$/i.test(id))return fail(res,400,'Identificador incorrecto.');
  const rows=await sql.query(
   'SELECT id,worker_name,items,summary,created_at FROM public.uki_inventario_revisiones_qa WHERE branch=$1 AND id=$2::uuid LIMIT 1',[branch,id]);
  if(!rows.length)return fail(res,404,'No se encontró esa revisión en pruebas.');
  return res.status(200).json({ok:true,branch,revision:rows[0],modo:'SOLO QA'});
 }catch(e){
  console.error('Verificación QA error',String(e?.code||e?.name||'error').slice(0,45));
  return fail(res,503,'No fue posible consultar la base de pruebas. No se modificaron datos reales.');
 }
};
module.exports._testing={qaEnabled,validDay};
