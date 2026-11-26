'use strict';
// Reuse the authenticated monthly archive; only return aggregate ingredient quantities.
// Never certify full coverage from historical snapshots/current recipe versions.
const crypto=require('node:crypto'),zlib=require('node:zlib');
const {summarize}=require('./costeo-periodo-automatico-v1.cjs');
const {productsFor}=require('./costeo-recetas-servicio-v1.cjs');
const monthOf=t=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).format(new Date(t)).slice(0,7);
const units={kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],un:['un',1],porciones:['porciones',1]};
function archiveOrders(row,store,start,end){
 if(!['gzip','json'].includes(row.encoding)||typeof row.base64!=='string'||row.base64.length>1650000)throw Error('Formato de respaldo inválido');
 const compressed=Buffer.from(row.base64,'base64'),raw=row.encoding==='gzip'?zlib.gunzipSync(compressed,{maxOutputLength:8000000}):compressed;
 if(raw.length>8000000||crypto.createHash('sha256').update(raw).digest('hex')!==row.sha256)throw Error('Respaldo no verificable');
 const a=JSON.parse(raw.toString('utf8'));
 if(a.version!==1||a.sucursal!==store||a.mes!==row.mes||!Array.isArray(a.registros?.pedidos)||a.sinFecha?.pedidos!==0||a.resumen?.pedidos!==a.registros.pedidos.length)throw Error('Respaldo incompleto');
 return a.registros.pedidos.filter(p=>Date.parse(p.fechaISO)>Date.parse(start)&&Date.parse(p.fechaISO)<=Date.parse(end)).map(p=>({id:p.id,suc:p.suc,fechaISO:p.fechaISO,pagado:p.pagado,estado:p.estado,esPremio:p.esPremio===true,productos:Array.isArray(p.productos)?p.productos.map(x=>({skuCarta:x.skuCarta,nombre:x.nombre,detalle:x.detalle,cantidad:x.cantidad,precioUnit:x.precioUnit})):[]}));
}
function combine(rows,summary){
 return rows.map(r=>{
  const unit=units[r.unit],matches=summary.consumption.filter(x=>x.sku===r.sku&&unit&&units[x.unit]?.[0]===unit[0]);
  const sales=matches.length?matches.reduce((a,x)=>a+x.quantity*units[x.unit][1]/unit[1],0):null;
  const expected=r.status==='provisional'&&sales!==null?r.opening+r.received-sales:null;
  const difference=expected!==null?expected-r.closing:null;
  return {...r,salesIdentified:sales,expectedPartial:expected,differencePartial:difference,differenceValuePartial:difference!==null&&r.unitCost!==null?Math.round(difference*r.unitCost):null};
 });
}
async function attachSales(physical,inventoryDb,financeDb,store){
 if(!physical.available)return physical;
 const missing=reason=>({...physical,sales:{available:false,reason,coverageComplete:false}});
 if(!financeDb)return missing('Archivo financiero no disponible.');
 try{
  const from=monthOf(physical.start),to=monthOf(physical.end);
  const rows=await financeDb.query("SELECT mes,encoding,sha256,encode(contenido,'base64') AS base64 FROM public.fin_archivos_mensuales_v1 WHERE sucursal=$1 AND mes BETWEEN $2 AND $3 ORDER BY mes LIMIT 13",[store,from,to]);
  if(!rows.length)return missing('Todavía no existe un respaldo con pedidos para este intervalo. Las ventas en vivo requieren conexión adicional.');
  if(rows.length>12)return missing('Intervalo demasiado amplio.');
  const orders=rows.flatMap(r=>archiveOrders({...r,base64:r.base64.replace(/\s/g,'')},store,physical.start,physical.end));
  if(!orders.length)return missing('El respaldo no contiene pedidos identificables en este intervalo.');
  const [products,recipes,prices]=await Promise.all([
   productsFor(inventoryDb,store),
   inventoryDb.query('SELECT product_sku,variant_key,recipe_lines,confirmed,revision FROM public.costeo_recetas_estado_v1 WHERE store_id=$1 AND confirmed=true',[store]),
   inventoryDb.query('SELECT sku,unit,quantity,price FROM public.costeo_precios_v1 WHERE store_id=$1',[store]).catch(e=>{if(e.code==='42P01'||e.code==='42501')return [];throw e;})
  ]);
  if(!recipes.length)return missing('No hay recetas confirmadas en la fuente de costeo.');
  const summary=summarize(store,orders,recipes.map(r=>({...r,store})),prices.map(p=>({...p,store})),products);
  return {...physical,rows:combine(physical.rows,summary),sales:{available:true,source:'archivo_mensual',calculated:summary.calculated,pending:summary.pending,cost:summary.cost,coverageComplete:false,reason:'Comparación parcial: pedidos de respaldo y recetas vigentes; no acredita pérdidas.'}};
 }catch{return missing('No se pudieron verificar los pedidos o el recetario vinculado.');}
}
module.exports={attachSales,combine,archiveOrders};
