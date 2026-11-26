'use strict';
// Conciliación pura, sin escrituras ni descuentos de stock.
const units={g:['g',1],kg:['g',1000],ml:['ml',1],l:['ml',1000],un:['un',1]};
const stores=new Set(['uki:arica','uki:serena','romo:serena']);
function reconcile({store,items,plans=[],coverageComplete=false}){
 if(!stores.has(store)||!Array.isArray(items)||!Array.isArray(plans))throw Error('Datos de conciliación inválidos');
 const used=new Map(), seen=new Set();let complete=coverageComplete===true;
 for(const p of plans){
  if(typeof p.orderKey!=='string'||!p.orderKey.startsWith(store+'|')||seen.has(p.orderKey))throw Error('Pedido duplicado o de otra sucursal');
  seen.add(p.orderKey);
  if(p.status!=='ready'){complete=false;continue;}
  if(!Array.isArray(p.consumption))throw Error('Consumo inválido');
  for(const x of p.consumption){const u=units[x.unit];if(!u||!Number.isFinite(x.quantity)||x.quantity<0)throw Error('Cantidad inválida');const k=x.sku+'|'+u[0];used.set(k,(used.get(k)||0)+x.quantity*u[1]);}
 }
 const skus=new Set();
 const rows=items.map(i=>{
  if(i.store!==store||!i.sku||skus.has(i.sku)||!units[i.unit])throw Error('Insumo duplicado o inválido');
  skus.add(i.sku);
  const [unit,factor]=units[i.unit], k=i.sku+'|'+unit;
  const fields=['opening','received','transferIn','transferOut','waste','staff','closing'];
  const valid=fields.every(f=>typeof i[f]==='number'&&Number.isFinite(i[f])&&i[f]>=0);
  const sales=(used.get(k)||0)/factor;used.delete(k);
  const actual=valid?i.opening+i.received+i.transferIn-i.transferOut-i.closing:null;
  const expected=valid&&complete?i.opening+i.received+i.transferIn-i.transferOut-sales-i.waste-i.staff:null;
  const difference=expected===null?null:expected-i.closing;
  const price=typeof i.unitCost==='number'&&Number.isFinite(i.unitCost)&&i.unitCost>=0?i.unitCost:null;
  return {sku:i.sku,unit:i.unit,sales:complete?sales:null,knownSales:sales,actual,expected,closing:valid?i.closing:null,difference,differenceCost:difference===null||price===null?null:Math.round(difference*price),status:!valid||!complete?'incomplete':expected<0||actual<0?'review':'ready'};
 });
 if(used.size){complete=false;for(const r of rows){r.sales=null;r.expected=null;r.difference=null;r.differenceCost=null;r.status='incomplete';}}
 return {store,complete:complete&&rows.every(r=>r.status==='ready'),rows,unmappedConsumption:[...used.keys()]};
}
module.exports={reconcile};
