'use strict';
const {plan}=require('./costeo-consumo-pedido-v1.cjs');
const {convert}=require('./costeo-recetas-v1.cjs');
const {productsFor}=require('./costeo-recetas-servicio-v1.cjs');
const fail=(error,status=400)=>({ok:false,status,error});
async function project(db,store,body,items){
 const order=body.order;
 if(!order||!Array.isArray(order.productos)||order.productos.length>100||!Array.isArray(body.choices)||body.choices.length>100)return fail('Pedido o variantes no válidos.');
 let orderKey;
 try{orderKey=plan({store,order}).orderKey;}catch(e){return fail(e.message);}
 const products=await productsFor(db,store);
 const recipes=(await db.query('SELECT product_sku,variant_key,recipe_lines,confirmed,revision FROM public.costeo_recetas_estado_v1 WHERE store_id=$1 AND confirmed=true',[store])).map(x=>({...x,store}));
 const prices=(await db.query('SELECT sku,unit,quantity,price FROM public.costeo_precios_v1 WHERE store_id=$1',[store])).map(x=>({...x,store}));
 const assignments=[];
 for(const c of body.choices){
  if(!c||!Number.isSafeInteger(c.index)||c.index<0||c.index>=order.productos.length||typeof c.variant!=='string'||c.verified!==true)return fail('Variante no verificada.');
  const x=order.productos[c.index];
  if(!products.some(p=>p.sku===x.skuCarta))continue;
  assignments.push({index:c.index,store,orderKey,sku:x.skuCarta,detail:String(x.detalle||''),name:String(x.nombre||''),quantity:Number(x.cantidad),unitPrice:Number(x.precioUnit),verified:true,variant:c.variant,recipeRevision:c.revision});
 }
 let result;try{result=plan({store,order,assignments,recipes,prices});}catch(e){return fail('No se pudo calcular este pedido.');}
 const stock=result.consumption.map(c=>{
  const matches=items.filter(i=>i.sku===c.sku),item=matches.length===1?matches[0]:null;
  const amount=item?convert(c.quantity,c.unit,item.stock_unit):null;
  const raw=item?.stock_qty,available=raw!=null&&raw!==''?Number(raw):NaN;
  return {sku:c.sku,name:item?.name||c.sku,unit:item?.stock_unit||c.unit,required:amount,available:Number.isFinite(available)?available:null,after:amount!==null&&Number.isFinite(available)?available-amount:null};
 });
 return {ok:true,store,projection:result,stock,estimatedWithCurrentPrices:true,readOnly:true};
}
module.exports={project};
