'use strict';
const {validateRecipe}=require('./costeo-validacion-v1.cjs');
const {calculate}=require('./costeo-recetas-v1.cjs');
async function productsFor(db,store){
 if(store==='romo:serena'){
  return db.query("SELECT $1::text AS store,x->>'sku' AS sku,x->>'name' AS name,x->>'kind' AS kind FROM public.romo_catalogo_v1 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(contenido->'products','[]'::jsonb)||COALESCE(contenido->'promotions','[]'::jsonb)) x WHERE store_id=$1 AND x->>'sku' IS NOT NULL ORDER BY name",[store]);
 }
 if(!['uki:arica','uki:serena'].includes(store))throw Error('Sucursal no autorizada');
 const branch=store.split(':')[1];
 const base=(await require('./uki-catalogo-v1.cjs').baseItems(branch)).filter(p=>p.kind!=='ingredient').map(p=>({store,sku:p.sku,name:p.name,kind:p.kind}));
 const custom=await db.query("SELECT $1::text AS store,sku,name,kind FROM public.uki_carta_productos_custom_v1 WHERE branch=$2 UNION ALL SELECT $1::text AS store,sku,name,'promo' AS kind FROM public.uki_carta_promos_custom_v1 WHERE branch=$2",[store,branch]);
 return [...new Map([...base,...custom].map(p=>[p.sku,p])).values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
async function operateRecipe(db,store,uid,body,items){
 const products=await productsFor(db,store);
 const prices=(await db.query('SELECT sku,unit,quantity,price FROM public.costeo_precios_v1 WHERE store_id=$1',[store])).map(p=>({...p,store}));
 if(body.action==='listar-recetas'){
  const recipes=await db.query('SELECT product_sku,variant_key,recipe_lines,confirmed,revision,updated_at FROM public.costeo_recetas_estado_v1 WHERE store_id=$1 ORDER BY product_sku,variant_key',[store]);
  return {ok:true,store,products,recipes:recipes.map(r=>({...r,cost:calculate({store,recipe:r.recipe_lines,prices}).cost}))};
 }
 if(body.action==='confirmar-receta'){
  if(body.confirmar!==true||!Number.isSafeInteger(body.revision)||body.revision<1)return {ok:false,status:400,error:'Confirma la receta completa y su revisión.'};
  const rows=await db.query('SELECT product_sku,variant_key,recipe_lines,confirmed,revision FROM public.costeo_recetas_estado_v1 WHERE store_id=$1 AND product_sku=$2 AND variant_key=$3 AND revision=$4',[store,body.productSku,body.variantKey,body.revision]);
  if(rows.length!==1)return {ok:false,status:409,error:'Actualiza la receta antes de confirmar.'};
  const r=rows[0];let valid;
  try{valid=validateRecipe(store,{productSku:r.product_sku,variantKey:r.variant_key,lines:r.recipe_lines},items,products)}catch(e){return {ok:false,status:400,error:e.message};}
  const cost=calculate({store,recipe:valid.recipe,prices});
  if(!cost.complete)return {ok:false,status:400,error:'Primero registra los precios de todos los insumos.'};
  const changed=await db.query('UPDATE public.costeo_recetas_estado_v1 SET confirmed=true,updated_by=$4,revision=revision+1,updated_at=now() WHERE store_id=$1 AND product_sku=$2 AND variant_key=$3 AND revision=$5 AND confirmed=false RETURNING product_sku,variant_key,recipe_lines,confirmed,revision,updated_at',[store,r.product_sku,r.variant_key,uid,body.revision]);
  if(changed.length!==1)return {ok:false,status:409,error:'La receta fue modificada o ya está confirmada.'};
  return {ok:true,store,recipe:{...changed[0],cost:cost.cost}};
 }
 if(body.action!=='guardar-receta')return {ok:false,status:400,error:'Acción de receta no permitida'};
 let recipe;try{recipe=validateRecipe(store,body,items,products)}catch(e){return {ok:false,status:400,error:e.message}}
 if(!Number.isSafeInteger(body.revision)||body.revision<0)return {ok:false,status:400,error:'Revisión incorrecta'};
 const p=[store,recipe.productSku,recipe.variantKey,JSON.stringify(recipe.recipe),uid,body.revision];
 const fields='product_sku,variant_key,recipe_lines,confirmed,revision,updated_at';
 const rows=body.revision===0?
 await db.query('INSERT INTO public.costeo_recetas_estado_v1(store_id,product_sku,variant_key,recipe_lines,updated_by) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT (store_id,product_sku,variant_key) DO NOTHING RETURNING '+fields,p.slice(0,5)):
 await db.query('UPDATE public.costeo_recetas_estado_v1 SET recipe_lines=$4::jsonb,updated_by=$5,confirmed=false,revision=revision+1,updated_at=now() WHERE store_id=$1 AND product_sku=$2 AND variant_key=$3 AND revision=$6 RETURNING '+fields,p);
 if(rows.length!==1)return {ok:false,status:409,error:'La receta cambió. Actualiza antes de guardar.'};
 return {ok:true,store,recipe:{...rows[0],cost:calculate({store,recipe:recipe.recipe,prices}).cost}};
}
module.exports={operateRecipe,productsFor};
