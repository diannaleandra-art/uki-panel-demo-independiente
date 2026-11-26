'use strict';
// No cambia stock. Solo coteja registros visibles de intervalos de inventario.
const stores=new Set(['uki:arica','uki:serena','romo:serena']);
const units={kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],un:['un',1],porciones:['porciones',1]};
function canonical(store,sku){
 // Solo códigos oficiales de la misma base de ingredientes, no nombres libres.
 if(store.startsWith('uki:')&&/^inv:[a-f0-9-]{36}$/.test(String(sku)))return String(sku);
 const m=store.startsWith('uki:')?String(sku).match(/^ingredient:((?:proteina|vegetal|envoltura|salsa)-[a-z0-9-]+)$/):String(sku).match(/^r_base_((?:proteina|vegetal|envoltura|salsa)_[a-z0-9_]+)$/);
 return m?m[1].replaceAll('_','-'):null;
}
function compareTransfers(reports){
 const list=[],groups=new Map();
 for(const report of reports||[]){
  if(!stores.has(report.store)||report.justifications?.available!==true)continue;
  for(const r of report.justifications.rows||[]){
   if(!['traspaso_salida','traspaso_entrada'].includes(r.kind)||!stores.has(r.counterparty)||r.counterparty===report.store||!r.transfer_ref)continue;
   const from=r.kind==='traspaso_salida'?report.store:r.counterparty,to=r.kind==='traspaso_salida'?r.counterparty:report.store;
   const ingredient=canonical(report.store,r.sku),unit=units[r.unit],qty=Number(r.quantity);
   const entry={store:report.store,kind:r.kind,sku:r.sku,from,to,folio:r.transfer_ref,ingredient,quantity:r.quantity,unit:r.unit};
   if(!ingredient||!unit||!Number.isFinite(qty)||qty<=0){list.push({...entry,status:'equivalencia_pendiente'});continue;}
   const key=JSON.stringify([from,to,r.transfer_ref,ingredient]);
   const g=groups.get(key)||[];g.push({...entry,baseUnit:unit[0],baseQuantity:qty*unit[1]});groups.set(key,g);
  }
 }
 for(const g of groups.values()){
  const sent=g.filter(r=>r.kind==='traspaso_salida'),received=g.filter(r=>r.kind==='traspaso_entrada'),x=g[0];
  const match=sent.length===1&&received.length===1;
  const a=sent[0],b=received[0];
  const status=!match?(sent.length>1||received.length>1?'duplicado_revisar':'contraparte_no_visible'):a.baseUnit!==b.baseUnit?'unidad_distinta':Math.abs(a.baseQuantity-b.baseQuantity)>1e-6?'cantidad_distinta':'coincide';
  list.push({from:x.from,to:x.to,folio:x.folio,ingredient:x.ingredient,status,sent:a?{quantity:a.quantity,unit:a.unit}:null,received:b?{quantity:b.quantity,unit:b.unit}:null});
 }
 return {rows:list,coverageComplete:false,readOnly:true,warning:'Solo registros visibles en los intervalos consultados de cada local. Contraparte no visible no significa que no se recibió. No modifica saldos ni certifica pérdidas.'};
}
module.exports={compareTransfers,canonical};
