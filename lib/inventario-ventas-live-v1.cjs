'use strict';
const STORES=new Set(['uki:arica','uki:serena','romo:serena']);
const TYPES=new Set(['roll-clasico','premium']);
const PROTEINS=new Set(['pollo','carne','kanicama','camaron','cerdo','salmon','pulpo','berenjena crispy','vegetariano','desconocida']);
const states=new Set(['prepared','review']);
const validTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
function validate(store,body,now=Date.now()){
 if(!STORES.has(store)||!body||!Number.isSafeInteger(body.revision)||body.revision<1||!validTime(body.start)||!validTime(body.capturedAt)||Date.parse(body.capturedAt)>now+300000||Date.parse(body.start)>=Date.parse(body.capturedAt)||Date.parse(body.capturedAt)-Date.parse(body.start)>8*86400000||!Array.isArray(body.facts)||body.facts.length>2000)throw Error('Datos de consumo inválidos');
 const seen=new Set();
 const facts=body.facts.map(f=>{
  if(!f||Object.keys(f).sort().join('|')!=='at|id|rolls|state'||!Number.isSafeInteger(f.id)||f.id<1||!validTime(f.at)||Date.parse(f.at)<=Date.parse(body.start)||Date.parse(f.at)>Date.parse(body.capturedAt)||!states.has(f.state)||!Array.isArray(f.rolls)||f.rolls.length>120)throw Error('Pedido de consumo inválido');
  const key=f.id+'|'+f.at;if(seen.has(key))throw Error('Pedido duplicado');seen.add(key);
  if(f.state==='review'&&f.rolls.length)throw Error('Pedido pendiente con consumo no verificado');
  return {id:f.id,at:f.at,state:f.state,rolls:f.rolls.map(r=>{
   if(!r||Object.keys(r).sort().join('|')!=='count|protein|type'||!TYPES.has(r.type)||!PROTEINS.has(r.protein)||!Number.isSafeInteger(r.count)||r.count<1||r.count>1000)throw Error('Roll inválido');
   return {type:r.type,protein:r.protein,count:r.count};
  })};
 });
 return {revision:body.revision,start:body.start,capturedAt:body.capturedAt,facts};
}
async function save(db,store,body){
 const v=validate(store,body);
 const rows=await db.query(`INSERT INTO public.fin_consumo_ventas_live_v1 AS current
 (store_id,source_revision,window_start,captured_at,facts)
 VALUES($1,$2,$3::timestamptz,$4::timestamptz,$5::jsonb)
 ON CONFLICT(store_id) DO UPDATE SET source_revision=EXCLUDED.source_revision,window_start=EXCLUDED.window_start,captured_at=EXCLUDED.captured_at,facts=EXCLUDED.facts,received_at=now()
 WHERE current.source_revision<EXCLUDED.source_revision
 RETURNING source_revision`,[store,v.revision,v.start,v.capturedAt,JSON.stringify(v.facts)]);
 return {ok:true,store,registered:rows.length===1,unchanged:rows.length===0};
}
function estimate(facts,recipes,start,end){
 const chosen=new Map();
 for(const r of recipes)if(!chosen.has(r.sku)||r.ambito!=='todos')chosen.set(r.sku,r);
 const grams=new Map(),counts=new Map();let calculated=0,pending=0;
 const add=(name,g)=>grams.set(name,(grams.get(name)||0)+g);
 const line=(r,name)=>{const hits=(r?.lineas||[]).filter(x=>x.nombre===name&&x.pendiente!==true&&Number.isFinite(Number(x.gramos))&&Number(x.gramos)>0);return hits.length===1?Number(hits[0].gramos):null;};
 for(const f of facts){
  if(Date.parse(f.at)<=Date.parse(start)||Date.parse(f.at)>Date.parse(end))continue;
  if(f.state!=='prepared'||!f.rolls.length){pending++;continue;}
  let has=false;
  for(const roll of f.rolls){
   const recipe=chosen.get(roll.type);
   if(!recipe||!['confirmada','parcial'].includes(recipe.estado))continue;
   const rice=line(recipe,'Arroz cocido y aliñado');
   if(rice!==null){add('Arroz cocido y aliñado',rice*roll.count);has=true;}
   const protein=roll.type==='roll-clasico'&&roll.protein==='pollo'?line(recipe,'Pollo'):roll.type==='premium'&&!['desconocida','vegetariano','berenjena crispy'].includes(roll.protein)?line(recipe,'Proteína'):null;
   if(protein!==null){add(roll.protein,protein*roll.count);has=true;}
   const key=roll.type+'|'+roll.protein;counts.set(key,(counts.get(key)||0)+roll.count);
  }
  if(has)calculated++;else pending++;
 }
 return {calculated,pending,ingredients:[...grams].map(([name,quantity])=>({name,quantity,unit:'g'})),rolls:[...counts].map(([key,count])=>({type:key.split('|')[0],protein:key.split('|')[1],count})),coverageComplete:false};
}
async function read(db,store,start,end){
 const rows=await db.query('SELECT window_start,captured_at,facts FROM public.fin_consumo_ventas_live_v1 WHERE store_id=$1',[store]);
 const r=rows[0];
 if(!r||Date.parse(r.window_start)>Date.parse(start)||Date.parse(r.captured_at)<Date.parse(end)||!Array.isArray(r.facts))return {available:false,reason:'El panel operativo todavía no ha sincronizado este intervalo completo.'};
 const recipes=await db.query("SELECT sku,ambito,estado,lineas FROM public.fin_recetas_estandar_v1 WHERE ambito='todos' OR ambito=$1",[store]);
 return {available:true,source:'panel_operativo',...estimate(r.facts,recipes,start,end),reason:'Gramajes de preparación según recetario estándar. No equivalen necesariamente a peso de compra; no incluyen todos los ingredientes ni acreditan pérdidas.'};
}
module.exports={validate,save,estimate,read};
