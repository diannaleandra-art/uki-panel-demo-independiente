'use strict';
const {validatePrice}=require('./costeo-validacion-v1.cjs');
async function itemsFor(db,store){
 if(store==='romo:serena'){
  return db.query("SELECT $1::text AS store, i->>'sku' AS sku, i->>'name' AS name, i->>'stock_unit' AS stock_unit FROM public.romo_inventario_v1 CROSS JOIN LATERAL jsonb_array_elements(contenido->'items') i WHERE store_id=$1 AND COALESCE(i->>'archived','false')<>'true' ORDER BY name",[store]);
 }
 if(!['uki:arica','uki:serena'].includes(store))throw Error('Sucursal no autorizada');
 return db.query("SELECT $1::text AS store, sku,name,stock_unit FROM (SELECT sku,name,stock_unit FROM public.uki_inventario_items_live WHERE branch=$2 UNION ALL SELECT sku,name,stock_unit FROM public.uki_inventario_extras_live WHERE branch=$2) i ORDER BY name",[store,store.split(':')[1]]);
}
async function operate(db,store,uid,body){
 const items=await itemsFor(db,store);
 if(body.action==='listar'){
  const prices=await db.query('SELECT sku,unit,quantity,price,revision,updated_at FROM public.costeo_precios_v1 WHERE store_id=$1 ORDER BY sku',[store]);
  return {ok:true,store,items,prices};
 }
 if(body.action!=='guardar-precio')return {ok:false,status:400,error:'Acción no permitida'};
 let price;
 try{price=validatePrice(store,body,items)}catch(e){return {ok:false,status:400,error:e.message}}
 const rev=body.revision;
 if(!Number.isSafeInteger(rev)||rev<0)return {ok:false,status:400,error:'Revisión incorrecta'};
 const params=[store,price.sku,price.unit,price.quantity,price.price,uid,rev];
 const rows=rev===0?
 await db.query('INSERT INTO public.costeo_precios_v1(store_id,sku,unit,quantity,price,updated_by) SELECT $1,$2,$3,$4,$5,$6 ON CONFLICT (store_id,sku) DO NOTHING RETURNING sku,unit,quantity,price,revision,updated_at',params.slice(0,6)):
 await db.query('UPDATE public.costeo_precios_v1 SET unit=$3,quantity=$4,price=$5,updated_by=$6,revision=revision+1,updated_at=now(),source_ref=NULL WHERE store_id=$1 AND sku=$2 AND revision=$7 RETURNING sku,unit,quantity,price,revision,updated_at',params);
 return rows.length===1?{ok:true,store,price:rows[0]}:{ok:false,status:409,error:'El precio cambió. Actualiza antes de volver a guardar.'};
}
module.exports={operate};
