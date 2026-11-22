// Apartado privado de consulta: gramajes confirmados y simulador de precios.
// No modifica carta publica, caja, inventario, cierres ni pedidos.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => Number.isFinite(n) ? '$' + Math.round(n).toLocaleString('es-CL') : '—';
  const recipes = [
    {
      name:'Gohan de pollo, camarón o salmón',
      state:'Confirmada',
      note:'Base aprobada. Para Gohan vegetariano se revisará la sustitución de proteína.',
      items:[['Arroz cocido y aliñado',150],['Proteína',80],['Queso crema',40],['Palta',40],['Cebollín',20]]
    },
    {
      name:'Roll premium · 10 piezas',
      state:'Confirmada',
      note:'La envoltura elegida se suma aparte; puede haber recargos por proteína.',
      items:[['Arroz cocido y aliñado',180],['Proteína',60],['Queso crema',25],['Vegetal 1',20],['Vegetal 2',20]]
    },
    {
      name:'Envolturas premium',
      state:'Confirmada',
      note:'Solo se aplica la envoltura que elija el cliente, no todas a la vez.',
      items:[['Palta exterior',35],['Queso crema exterior',30],['Salmón exterior',40],['Panko seco',20],['Sésamo',8],['Ciboulette',6]]
    },
    {
      name:'Handroll grande',
      state:'Confirmada en base',
      note:'Incluye una porción de salsa; gramaje de apanizado/tempura por revisar.',
      items:[['Arroz cocido y aliñado',180],['Proteína',45],['Queso crema',25],['Vegetal',25]]
    },
    {
      name:'Sushi burger',
      state:'Confirmada en base',
      note:'Papas solo cuando el producto las incluye. En la opción vegetariana se reemplaza la proteína.',
      items:[['Arroz cocido para ambas tapas',180],['Proteína',90],['Queso crema',30],['Vegetales: 2 en total',40],['Papas, si incluye',120]]
    },
    {
      name:'Roll clásico · 12 piezas',
      state:'Parcialmente confirmado',
      note:'El vegetal de 25 g es una propuesta pendiente de aprobación, no una receta definitiva.',
      items:[['Arroz cocido y aliñado',180],['Pollo',45],['Queso crema',25],['Vegetal sugerido',25]]
    }
  ];
  const products = [
    {name:'Roll clásico de pollo · 12 piezas',price:3800},
    {name:'Handroll grande',price:3800},
    {name:'Premium · 20 piezas',price:13000},
    {name:'Gohan de pollo',price:6500},
    {name:'Gohan de camarón',price:7200},
    {name:'Gohan de salmón',price:8000},
    {name:'Sushi burger con papas',price:8000},
    {name:'Romo · Promoción 36 piezas',price:9500}
  ];
  function renderRecipes() {
    const root=$('rxRecipes');if(!root)return;
    root.replaceChildren();
    for(const recipe of recipes){
      const details=document.createElement('details');details.className='rx-recipe';
      if(recipe.name.startsWith('Gohan'))details.open=true;
      const sum=document.createElement('summary');
      sum.textContent=recipe.name+' · '+recipe.state;
      const grid=document.createElement('div');grid.className='rx-recipe-grid';
      for(const [name,gram] of recipe.items){
        const row=document.createElement('div');row.className='rx-recipe-row';
        const a=document.createElement('span');a.textContent=name;
        const b=document.createElement('strong');b.textContent=gram+' g';
        row.append(a,b);grid.append(row);
      }
      const note=document.createElement('p');note.className='hint';note.textContent=recipe.note;
      details.append(sum,grid,note);root.append(details);
    }
  }
  function renderExample(){
    const p=$('rxProduct'),price=$('rxPrice'),cost=$('rxCost'),tax=$('rxTax');
    if(!p||!price||!cost||!tax)return;
    const n=Number(price.value),c=Number(cost.value),hasPrice=price.value.trim()!==''&&Number.isFinite(n)&&n>0;
    const hasCost=cost.value.trim()!==''&&Number.isFinite(c)&&c>=0;
    const gross=tax.value==='con';
    const saleNet=hasPrice?n/1.19:NaN;
    const costShown=hasCost?(gross?c*1.19:c):NaN;
    $('rxSaleLabel').textContent=gross?'Lo vendo en (con IVA)':'Lo vendo en (sin IVA)';
    $('rxSale').textContent=fmt(gross?n:saleNet);
    $('rxCostLabel').textContent=gross?'Me cuesta prepararlo (con IVA estimado)':'Me cuesta prepararlo (sin IVA)';
    $('rxCostShown').textContent=fmt(costShown);
    $('rxMargin').textContent=hasPrice&&hasCost?fmt(saleNet-c):'Sin costo completo';
    $('rxPriceSuggested').textContent=hasCost?fmt(Math.ceil((c*1.19/0.30)/100)*100):'Sin costo completo';
    $('rxPriceLow').textContent=hasCost?fmt(Math.ceil((c*1.19/0.35)/100)*100):'—';
    $('rxMarginDescription').textContent=hasCost?
      'Queda después de ingredientes e IVA, pero ANTES de sueldos, arriendo, comisiones y otros gastos. No es ganancia final.':
      'Para saber cuánto deja, registra primero todos los ingredientes y envases en Negocios → Costos.';
    $('rxTaxExplanation').textContent=gross?
      'La vista con IVA considera una compra con IVA recuperable del 19 %. El IVA que efectivamente se pague se calcula por período.':
      'La vista sin IVA compara la venta neta con el costo neto de insumos. El resultado final es el mismo en ambas vistas.';
  }
  function init(){
    if(!$('rxRecipes'))return;
    renderRecipes();
    const select=$('rxProduct');
    for(let i=0;i<products.length;i++) select.add(new Option(products[i].name,String(i)));
    function chosen(){
      $('rxPrice').value=String(products[Number(select.value)||0].price);
      $('rxCost').value='';
      renderExample();
    }
    select.onchange=chosen;
    for(const id of ['rxTax','rxCost','rxPrice'])$(id).addEventListener('input',renderExample);
    $('rxGoCosts').addEventListener('click',()=>{
      const tab=document.querySelector('button[data-tab="negocios"]');
      if(!tab)return;tab.click();
      const recipe=$('costRecetasPanel');
      if(recipe){recipe.open=true;recipe.scrollIntoView({behavior:'smooth',block:'start'});}
    });
    $('rxGoPurchases').addEventListener('click',()=>{
      document.querySelector('button[data-tab="facturas"]')?.click();
    });
    chosen();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
