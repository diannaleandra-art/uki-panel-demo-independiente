// Base común de costeo de recetas. Sin persistencia ni efectos sobre existencias.
// prices: [{store,sku,unit,quantity,price}] (precio de compra de la cantidad indicada).
// recipe: [{sku,quantity,unit}] por unidad vendida. revenue: importe real de la línea CLP.
// Sin receta o costo completo, grossProfit y cost son null; no se inventan datos.
function buildCostEngine(){
  const units={kg:['masa',1000],g:['masa',1],l:['volumen',1000],ml:['volumen',1],un:['unidad',1]};
  function qty(value){if(typeof value!=='number'&&typeof value!=='string')return null;if(typeof value==='string'&&!/^\d+(?:[.,]\d+)?$/.test(value.trim()))return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>0?n:null;}
  function convert(amount,from,to){const n=qty(amount),a=units[from],b=units[to];return n!==null&&a&&b&&a[0]===b[0]?n*a[1]/b[1]:null;}
  function calculate({store,recipe,prices,quantity=1,revenue=null}){
    if(typeof store!=='string'||!store.trim())throw new Error('Sucursal requerida');
    const count=qty(quantity),missing=[],lines=[];
    if(count===null)throw new Error('Cantidad inválida');
    if(!Array.isArray(recipe)||!recipe.length)missing.push({reason:'receta_no_registrada'});
    for(const row of Array.isArray(recipe)?recipe:[]){
      const sku=String(row.sku??'').trim();
      const candidates=(Array.isArray(prices)?prices:[]).filter(p=>p.store===store&&p.sku===sku);
      if(!sku||candidates.length!==1){missing.push({sku,reason:candidates.length>1?'precio_ambiguo':'precio_no_registrado'});continue;}
      const p=candidates[0],amount=convert(row.quantity,row.unit,p.unit),pack=qty(p.quantity),price=qty(p.price);
      if(amount===null||pack===null||price===null){missing.push({sku,reason:'cantidad_unidad_o_precio_invalido'});continue;}
      const cost=amount*count/pack*price;
      if(!Number.isFinite(cost)){missing.push({sku,reason:'costo_invalido'});continue;}
      lines.push({sku,quantity:amount*count,unit:p.unit,cost});
    }
    const partialCost=lines.reduce((s,x)=>s+x.cost,0),complete=missing.length===0;
    const validRevenue=typeof revenue==='number'&&Number.isSafeInteger(revenue)&&revenue>=0;
    return {store,quantity:count,complete,missing,lines,partialCost:Math.round(partialCost),cost:complete?Math.round(partialCost):null,revenue:validRevenue?revenue:null,grossProfit:complete&&validRevenue?revenue-Math.round(partialCost):null};
  }
  return {convert,calculate};
}
module.exports=buildCostEngine();
