'use strict';
const stores=new Set(['uki:arica','uki:serena','romo:serena']);
const names=new Set(['Arroz cocido y aliñado','pollo','carne','kanicama','camaron','cerdo','salmon','pulpo']);
const validSku=(store,sku)=>store.startsWith('uki:')?/^(ingredient:[a-z0-9-]+|inv:[a-f0-9-]{36})$/.test(sku):/^r_[a-z0-9_-]{3,150}$/.test(sku);
const fail=message=>Object.assign(Error(message),{status:400});
function validate(input,items){
 const store=input.store,name=input.ingredient,sku=String(input.sku||''),raw=Number(input.rawGrams),prepared=Number(input.preparedGrams),note=String(input.note||'').trim(),version=input.version;
 if(!stores.has(store)||!names.has(name)||!validSku(store,sku)||!items.some(x=>x.sku===sku&&['g','kg'].includes(x.unit)))throw fail('Selecciona el insumo de peso del mismo local.');
 if(!Number.isFinite(raw)||!Number.isFinite(prepared)||raw<=0||prepared<=0||raw>1000000||prepared>1000000||prepared/raw<0.05||prepared/raw>10||note.length<5||note.length>180||!Number.isSafeInteger(version)||version<0||input.confirmed!==true)throw fail('Confirma los pesos medidos y la observación.');
 return {store,name,sku,raw,prepared,note,version};
}
async function list(db,store){
 if(!stores.has(store))throw fail('Local inválido.');
 return db.query('SELECT ingredient,sku,raw_g,prepared_g,note,revision,confirmed_at FROM public.fin_rendimientos_consumo_v1 WHERE store_id=$1 ORDER BY ingredient',[store]);
}
async function save(db,v,actor){
 const args=[v.store,v.name,v.sku,v.raw,v.prepared,v.note,actor];
 const rows=v.version===0?await db.query(`INSERT INTO public.fin_rendimientos_consumo_v1(store_id,ingredient,sku,raw_g,prepared_g,note,confirmed_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING revision,confirmed_at`,args):
 await db.query(`UPDATE public.fin_rendimientos_consumo_v1 SET sku=$3,raw_g=$4,prepared_g=$5,note=$6,confirmed_by=$7,confirmed_at=now(),revision=revision+1 WHERE store_id=$1 AND ingredient=$2 AND revision=$8 RETURNING revision,confirmed_at`,[...args,v.version]);
 if(rows.length!==1)throw Object.assign(Error('El rendimiento cambió. Consulta nuevamente.'),{status:409});
 return rows[0];
}
function convertSales(sales,rows,factors){
 if(!sales?.available)return [];
 return (sales.ingredients||[]).map(i=>{
  const matches=factors.filter(f=>f.ingredient===i.name),f=matches.length===1?matches[0]:null;
  const row=f&&rows.find(r=>r.sku===f.sku&&['g','kg'].includes(r.unit));
  const raw=Number(f?.raw_g),prepared=Number(f?.prepared_g);
  if(!f||!row||!Number.isFinite(raw)||!Number.isFinite(prepared)||raw<=0||prepared<=0||i.unit!=='g'||!Number.isFinite(i.quantity)||i.quantity<0)return {ingredient:i.name,preparedGrams:i.quantity,status:'pending',reason:'Falta equivalencia de peso confirmada.'};
  const quantity=i.quantity*raw/prepared/(row.unit==='kg'?1000:1);
  return {ingredient:i.name,sku:row.sku,preparedGrams:i.quantity,quantity,unit:row.unit,status:'estimated',confirmedAt:f.confirmed_at,note:f.note};
 });
}
module.exports={validate,list,save,convertSales};
