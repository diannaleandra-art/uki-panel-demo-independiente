'use strict';
// Separar el identificador de la venta del de la bodega física.
// Las ventas nunca se transfieren entre marcas.
const warehouseOf=store=>({'uki:arica':'arica','uki:serena':'serena','romo:serena':'serena'})[store]||null;
const brandsOf=warehouse=>warehouse==='arica'?['uki:arica']:warehouse==='serena'?['uki:serena','romo:serena']:[];
function combineSales(reports,warehouse){
 const brands=brandsOf(warehouse),sources=brands.map(store=>({store,sale:reports.find(x=>x.store===store)?.liveSales}));
 const available=sources.filter(x=>x.sale?.available===true);
 if(!available.length)return {available:false,coverageComplete:false,sources,reason:'Todavía no hay consumo sincronizado.'};
 const first=available[0].sale;
 const aligned=available.every(x=>x.sale.start===first.start&&x.sale.end===first.end);
 // No sumar ventanas distintas: mostrar cada marca por separado si difieren.
 if(!aligned)return {available:false,coverageComplete:false,sources,reason:'Los intervalos de ventas difieren; no se suman.'};
 const ingredients=new Map();
 for(const {sale} of available)for(const i of sale.ingredients||[]){
  if(typeof i.name!=='string'||i.unit!=='g'||!Number.isFinite(i.quantity)||i.quantity<0)continue;
  ingredients.set(i.name,(ingredients.get(i.name)||0)+i.quantity);
 }
 return {available:true,start:first.start,end:first.end,coverageComplete:false,allBrandsAvailable:available.length===brands.length,
  sources,calculated:available.reduce((n,x)=>n+Number(x.sale.calculated||0),0),pending:available.reduce((n,x)=>n+Number(x.sale.pending||0),0),
  ingredients:[...ingredients].map(([name,quantity])=>({name,quantity,unit:'g'})),
  reason:available.length===brands.length?'Consumo identificado de las marcas que usan esta bodega; parcial.':'Falta sincronizar una marca; consumo parcial.'};
}
function physicalWarehouses(reports){
 return ['arica','serena'].map(warehouse=>{
  const stock=reports.find(r=>r.store==='uki:'+warehouse);
  return {warehouse,brands:brandsOf(warehouse),physical:stock||null,sales:combineSales(reports,warehouse),coverageComplete:false};
 });
}
module.exports={warehouseOf,brandsOf,combineSales,physicalWarehouses};
