'use strict';
// Proyección PURE: no aplica movimientos, ni presume que un pedido cancelado devuelve stock.
// Asignaciones verificadas deben provenir de una revisión autorizada y coincidir con el pedido íntegro.
function buildConsumptionPlanner(){
 const stores={'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena','Romo’s Sushi La Serena':'romo:serena'};
 const units={kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],un:['un',1]};
 const positive=n=>Number.isFinite(n)&&n>0;
 const key=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=180;
 const money=n=>Number.isSafeInteger(n)&&n>=0;
 function identify(store,order){
  if(!order||stores[order.suc]!==store||!Number.isSafeInteger(Number(order.id))||Number(order.id)<1||!Number.isFinite(Date.parse(order.fechaISO)))throw Error('Pedido o sucursal no verificable');
  return store+'|'+String(Number(order.id))+'|'+new Date(order.fechaISO).toISOString();
 }
 function plan({store,order,assignments=[],recipes=[],prices=[]}){
  const orderKey=identify(store,order);
  const lines=Array.isArray(order.productos)?order.productos:[];
  if(order.estado==='Cancelado')return {orderKey,status:'review',reason:'cancelado_revisar_consumo_real',lines:[],consumption:[],cost:null,revenue:null,grossProfit:null};
  if(order.pagado!==true||order.estado!=='Entregado')return {orderKey,status:'pending',reason:'pago_o_entrega_pendiente',lines:[],consumption:[],cost:null,revenue:null,grossProfit:null};
  if(!lines.length)return {orderKey,status:'review',reason:'sin_detalle',lines:[],consumption:[],cost:null,revenue:null,grossProfit:null};
  const results=[],totals=new Map();let revenue=0,allCost=0;let complete=true;let costComplete=true;
  for(let index=0;index<lines.length;index++){
   const x=lines[index],q=Number(x.cantidad),price=Number(x.precioUnit);
   const matches=assignments.filter(a=>a.index===index&&a.store===store&&a.orderKey===orderKey&&a.sku===x.skuCarta&&a.detail===String(x.detalle||'')&&a.name===String(x.nombre||'')&&a.quantity===q&&a.unitPrice===price&&a.verified===true);
   const a=matches.length===1?matches[0]:null;
   const candidates=a?recipes.filter(r=>r.store===store&&r.product_sku===a.sku&&r.variant_key===a.variant&&r.confirmed===true&&String(r.revision)===String(a.recipeRevision)):[];
   const r=candidates.length===1?candidates[0]:null;
   if(!key(x.skuCarta)||!Number.isSafeInteger(q)||q<1||q>1000||!money(price)||!r||!Array.isArray(r.recipe_lines)||!r.recipe_lines.length){
    complete=false;results.push({index,status:'review',reason:'producto_o_receta_sin_validar'});continue;
   }
   let c=0;const used=[],seen=new Set();let ok=true,lineCostComplete=true;
   for(const item of r.recipe_lines){
    const n=Number(item.quantity),u=units[item.unit];
    const ps=prices.filter(p=>p.store===store&&p.sku===item.sku);
    const p=ps.length===1?ps[0]:null,pu=p&&units[p.unit];
    if(!key(item.sku)||seen.has(item.sku)||!positive(n)||!u){ok=false;break;}
    seen.add(item.sku);
    const amount=n*u[1]*q;
    const priced=pu&&pu[0]===u[0]&&positive(Number(p.quantity))&&positive(Number(p.price));
    const lineCost=priced?amount/(Number(p.quantity)*pu[1])*Number(p.price):0;
    if(!priced){lineCostComplete=false;costComplete=false;}
    if(!positive(amount)||!Number.isFinite(lineCost)){ok=false;break;}
    used.push({sku:item.sku,unit:u[0],quantity:amount});c+=lineCost;
   }
   if(!ok||!money(price*q)||!Number.isFinite(c)){complete=false;results.push({index,status:'review',reason:'precio_o_unidad_incompleta'});continue;}
   revenue+=price*q;allCost+=c;
   for(const item of used){const id=item.sku+'|'+item.unit;const prior=totals.get(id)||{...item,quantity:0};prior.quantity+=item.quantity;totals.set(id,prior);}
   results.push({index,status:'ready',sku:x.skuCarta,variant:r.variant_key,recipeRevision:r.revision,cost:lineCostComplete?Math.round(c):null,revenue:price*q});
  }
  return {orderKey,status:complete?'ready':'review',lines:results,consumption:complete?[...totals.values()].sort((a,b)=>a.sku.localeCompare(b.sku)||a.unit.localeCompare(b.unit)):[],cost:complete&&costComplete?Math.round(allCost):null,revenue:complete?revenue:null,grossProfit:complete&&costComplete?revenue-Math.round(allCost):null,costComplete:complete&&costComplete};
 }
 function compare(previous,next){
  if(!next||next.status!=='ready')return {status:'review',changes:[]};
  if(previous&&previous.orderKey!==next.orderKey)throw Error('Pedido distinto');
  const norm=p=>JSON.stringify({lines:p.lines,consumption:p.consumption,cost:p.cost,revenue:p.revenue});
  if(previous&&norm(previous)===norm(next))return {status:'duplicate',changes:[]};
  if(previous)return {status:'review',reason:'edicion_o_costo_cambiado_requiere_conciliacion',changes:[]};
  return {status:'ready',changes:next.consumption};
 }
 return {plan,compare};
}
module.exports=buildConsumptionPlanner();
