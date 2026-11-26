'use strict';
const {plan}=require('./costeo-consumo-pedido-v1.cjs');
const {classify}=require('./inventario-cobertura-pedidos-v1.cjs');
function automaticAssignments(store,order,recipes,products){
 const orderKey=plan({store,order}).orderKey;
 return order.productos.flatMap((x,index)=>{
  // No inferir recetas por proteína sola, nombre parcial, ni "base" por defecto.
  const detail=String(x.detalle||'').trim();
  if(!detail||detail==='base'||!products.some(p=>p.sku===x.skuCarta&&p.store===store))return [];
  const candidates=recipes.filter(r=>r.store===store&&r.confirmed===true&&r.product_sku===x.skuCarta&&r.variant_key===detail);
  if(candidates.length!==1)return [];
  const r=candidates[0];
  return [{index,store,orderKey,sku:x.skuCarta,detail:String(x.detalle||''),name:String(x.nombre||''),quantity:Number(x.cantidad),unitPrice:Number(x.precioUnit),verified:true,variant:r.variant_key,recipeRevision:r.revision}];
 });
}
function summarize(store,orders,recipes,prices,products){
 const seen=new Set(),results=[],totals=new Map();
 for(const order of orders){
  let orderKey;
  try{orderKey=plan({store,order}).orderKey;}catch{results.push({status:'review',reason:'pedido_invalido'});continue;}
  if(seen.has(orderKey)){results.push({status:'review',reason:'duplicado',orderKey});continue;}
  seen.add(orderKey);
  const kind=classify(order);
  if(kind!=='eligible'){results.push({orderKey,status:'review',reason:kind});continue;}
  const p=plan({store,order,recipes,prices,assignments:automaticAssignments(store,order,recipes,products)});
  results.push({orderKey,status:p.status,reason:p.status==='ready'?null:'receta_sin_coincidencia_exacta',cost:p.cost,revenue:p.revenue});
  for(const x of p.consumption){const k=x.sku+'|'+x.unit;const old=totals.get(k)||{...x,quantity:0};old.quantity+=x.quantity;totals.set(k,old);}
 }
 const ready=results.filter(r=>r.status==='ready');
 return {results,consumption:[...totals.values()],calculated:ready.length,pending:results.length-ready.length,cost:ready.length&&ready.every(r=>r.cost!==null)?ready.reduce((a,r)=>a+r.cost,0):null,coverageComplete:false,readOnly:true};
}
async function projectPeriod(db,store,body){
 if(!Array.isArray(body.orders)||body.orders.length>20)return {ok:false,status:400,error:'Lote de pedidos inválido (máximo 20).'};
 const products=await require('./costeo-recetas-servicio-v1.cjs').productsFor(db,store);
 const recipes=(await db.query('SELECT product_sku,variant_key,recipe_lines,confirmed,revision FROM public.costeo_recetas_estado_v1 WHERE store_id=$1 AND confirmed=true',[store])).map(x=>({...x,store}));
 const prices=(await db.query('SELECT sku,unit,quantity,price FROM public.costeo_precios_v1 WHERE store_id=$1',[store])).map(x=>({...x,store}));
 return {ok:true,store,...summarize(store,body.orders,recipes,prices,products),estimatedWithCurrentRecipes:true};
}
module.exports={automaticAssignments,summarize,projectPeriod};
