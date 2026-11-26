'use strict';
// Consulta de costos históricos, sin movimientos financieros ni actualizaciones de stock.
// Solo se llama tras verificar Google y PIN de Mi Administración.
const stores=['uki:arica','uki:serena','romo:serena'];
function romoReadUrl(e){
 // Credencial separada de solo lectura, a configurar por el dueño de la BD.
 const candidate=e.ROMO_COSTEO_ADMIN_READ_URL,host=String(e.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 if(!candidate||!host||!host.endsWith('.neon.tech'))return null;
 try{const u=new URL(candidate);if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname.toLowerCase()!==host||u.pathname!=='/romos_sushi'||u.username!=='romos_costeo_read'||!u.password)return null;
 for(const other of [e.UKI_FIN_PRIVATE_DATABASE_URL,e.UKI_INVENTARIO_LIVE_DATABASE_URL]){if(other&&new URL(other).hostname.toLowerCase()===host)return null;}
 return candidate;}catch{return null;}
}
async function readStore(db,store,desde,hasta){
 const rows=await db.query(`SELECT COUNT(*)::text AS pedidos, SUM(revenue)::text AS ventas, SUM(cost)::text AS costo,
 (SELECT cutoff FROM public.costeo_inicio_v1 WHERE store_id=$1) AS inicio
 FROM public.costeo_consumos_pedido_v1 WHERE store_id=$1 AND service_date BETWEEN $2::date AND $3::date`,[store,desde,hasta]);
 const r=rows[0],count=Number(r?.pedidos);
 if(!r||!Number.isSafeInteger(count)||count<0)throw Error('Datos no verificables');
 const ventas=count?Number(r.ventas):null,costo=count?Number(r.costo):null;
 if(count&&(!Number.isSafeInteger(ventas)||ventas<0||!Number.isSafeInteger(costo)||costo<0))throw Error('Importes no verificables');
 return {store,status:count?'parcial':'sin_registros',pedidos:count,ventas,costo,margen:count?ventas-costo:null,inicio:r.inicio||null};
}
async function report(desde,hasta,e=process.env){
 const neon=require('@neondatabase/serverless').neon;
 const ukiUrl=require('./uki-inventario-db-live.cjs').url(e);
 const romoUrl=romoReadUrl(e);
 return Promise.all(stores.map(async store=>{
  const url=store==='romo:serena'?romoUrl:ukiUrl;
  if(!url)return {store,status:'no_disponible'};
  try{return await readStore(neon(url),store,desde,hasta);}catch{return {store,status:'no_disponible'};}
 }));
}
// Consulta privada por local, sin credenciales nuevas ni acceso cruzado a la BD Romo.
async function fetchRomoPhysical(bearer,fetcher=fetch){
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(String(bearer||'')))return {store:'romo:serena',available:false,reason:'Confirma el acceso de dueños de Romo.'};
 const response=await fetcher('https://romos-sushi-panel.vercel.app/api/romo-inventario-qa?vista=conciliacion',{method:'GET',cache:'no-store',redirect:'error',headers:{Authorization:bearer,Origin:'https://romos-sushi-panel.vercel.app',Accept:'application/json'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('Consulta de Romo no disponible');
 const raw=await response.text();if(raw.length>1000000)throw Error('Respuesta de inventario demasiado grande');
 const data=JSON.parse(raw);
 if(data.ok!==true||data.store!=='romo:serena'||data.storeId!=='romo:serena'||typeof data.available!=='boolean'||data.available&&(!Array.isArray(data.rows)||!Number.isFinite(Date.parse(data.start))||!Number.isFinite(Date.parse(data.end))||Date.parse(data.start)>=Date.parse(data.end)))throw Error('Respuesta de Romo no verificable');
 return data;
}
async function physicalReport(financeDb,e=process.env,bearer=null){
 const neon=require('@neondatabase/serverless').neon;
 const ukiUrl=require('./uki-inventario-db-live.cjs').url(e), romoUrl=romoReadUrl(e);
 const {readPhysical}=require('./inventario-periodo-fisico-v1.cjs');
 return Promise.all(stores.map(async store=>{
  const url=store==='romo:serena'?romoUrl:ukiUrl;
  let report={store,available:false,reason:'Conexión de lectura del local no disponible.'};
  try{
   if(!url&&store!=='romo:serena')throw Error('Conexión no disponible');
   const db=url?neon(url):null;
   const physical=db?await readPhysical(db,store):await fetchRomoPhysical(bearer);
   report=db?await require('./costeo-admin-consumo-archivo-v1.cjs').attachSales(physical,db,financeDb,store):{...physical,sales:{available:false,reason:'Consulta física directa de Romo; gramajes de pedidos en sección de ventas sincronizadas.',coverageComplete:false}};
  }catch{report={store,available:false,reason:'No se pudo verificar el historial de este local.'};}
  if(financeDb&&e.UKI_CONSUMO_VENTAS_LIVE_ENABLED==='true'){
   try{report.liveSales=await require('./inventario-ventas-live-v1.cjs').read(financeDb,store,report.available?report.start:null,report.available?report.end:null);}
   catch{report.liveSales={available:false,reason:'Consumo de ventas en vivo aún no disponible.'};}
  }
  return report;
 }));
}
module.exports={report,readStore,physicalReport,fetchRomoPhysical};
