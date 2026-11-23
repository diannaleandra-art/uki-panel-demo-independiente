// Apartado privado de consulta: gramajes confirmados y simulador de precios.
// No modifica carta publica, caja, inventario, cierres ni pedidos.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => Number.isFinite(n) ? '$' + Math.round(n).toLocaleString('es-CL') : '—';
  let recipes=[];
  let changing=null;
  let readEpoch=0;
  let prices=[];
  let chosenProduct=null;
  let priceSeq=0;
  const otherEstimateByType={clasico:400,premium:750,handroll:450,gohan:700,burger:950,promocion:470};
  const states={confirmada:'Confirmada',parcial:'En revisión',pendiente:'Pendiente'};
  const scope=()=>$('rxScope').value;
  function renderRecipes() {
    const root=$('rxRecipes');if(!root)return;
    root.replaceChildren();
    if(!recipes.length){
      const p=document.createElement('p');p.className='hint';
      p.textContent='Selecciona un local y consulta las recetas después de ingresar con Google y el PIN.';
      root.append(p);return;
    }
    for(const recipe of recipes){
      const details=document.createElement('details');details.className='rx-recipe';
      if(recipe.sku==='gohan')details.open=true;
      const sum=document.createElement('summary');
      sum.textContent=recipe.nombre+' · '+(states[recipe.estado]||'En revisión');
      const grid=document.createElement('div');grid.className='rx-recipe-grid';
      for(const item of recipe.lineas){
        const row=document.createElement('div');row.className='rx-recipe-row';
        const label=document.createElement('span');
        label.textContent=String(item.nombre)+(item.pendiente===true?' · por confirmar':'');
        const weight=document.createElement('strong');weight.textContent=Number(item.gramos)+' g';
        row.append(label,weight);grid.append(row);
      }
      const note=document.createElement('p');note.className='hint';note.textContent=recipe.notas||'Sin observaciones';
      const origin=document.createElement('p');origin.className='hint';
      const time=recipe.modificado_en?new Date(recipe.modificado_en).toLocaleString('es-CL',{timeZone:'America/Santiago'}):'';
      origin.textContent=(recipe.origen==='todos'?'Receta general':'Receta de esta sucursal')+
        (time?' · Última actualización: '+time:'');
      const btn=document.createElement('button');btn.className='soft';btn.type='button';btn.textContent='✏️ Modificar cantidades';
      btn.onclick=()=>editRecipe(recipe);
      details.append(sum,grid,note,origin,btn);root.append(details);
    }
  }
  function makeLine(item={}){
    const row=document.createElement('div');row.className='rx-edit-line';
    const a=document.createElement('label');a.textContent='Ingrediente';
    const name=document.createElement('input');name.type='text';name.maxLength=85;
    name.placeholder='Ej. Palta';name.value=String(item.nombre||'');a.append(name);
    const b=document.createElement('label');b.textContent='Gramos';
    const gram=document.createElement('input');gram.type='number';gram.min='0.01';gram.max='5000';
    gram.step='0.01';gram.inputMode='decimal';gram.value=String(item.gramos||'');b.append(gram);
    const actions=document.createElement('div');actions.className='rx-edit-actions';
    const check=document.createElement('label');const pending=document.createElement('input');
    pending.type='checkbox';pending.checked=item.pendiente===true;
    check.append(pending,document.createTextNode('Pendiente de confirmar'));
    const del=document.createElement('button');del.type='button';del.className='soft';
    del.textContent='Quitar';del.onclick=()=>row.remove();
    actions.append(check,del);row.append(a,b,actions);
    row.getData=()=>({nombre:name.value.trim(),gramos:Number(gram.value),pendiente:pending.checked});
    $('rxEditLines').append(row);
  }
  function editRecipe(recipe){
    changing={sku:recipe.sku,version:recipe.version,ambito:scope()};
    $('rxEditName').textContent='Editar '+recipe.nombre;
    $('rxEditStatus').value=recipe.estado;
    $('rxEditNotes').value=recipe.notas||'';
    $('rxEditLines').replaceChildren();
    for(const line of recipe.lineas)makeLine(line);
    $('rxEditNotice').textContent=scope()==='todos'?
      'Guardarás la receta general que comparten los tres locales.':
      'Guardarás una versión exclusiva de esta sucursal.';
    const box=$('rxEditBox');box.hidden=false;box.open=true;
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeEdit(){
    changing=null;$('rxEditBox').hidden=true;$('rxEditBox').open=false;
    $('rxEditLines').replaceChildren();
  }
  async function refresh(){
    const epoch=++readEpoch,selected=scope(),status=$('rxLoadStatus');
    closeEdit();recipes=[];renderRecipes();
    status.textContent='Consultando recetas privadas…';
    try{
      const bridge=window.ukiRecetasPrivadas;
      if(!bridge)throw Error('La sesión privada todavía no está disponible.');
      const data=await bridge.consultar(selected);
      if(epoch!==readEpoch||scope()!==selected)return;
      if(!Array.isArray(data.recetas)||data.ambito!==selected)throw Error('Respuesta de recetas no verificable.');
      recipes=data.recetas;renderRecipes();
      status.textContent=recipes.length+' fichas disponibles. Los cambios se guardan en Mi Administración, no en la carta.';
      const history=$('rxHistory');history.replaceChildren();
      if(Array.isArray(data.cambios)&&data.cambios.length){
        for(const h of data.cambios){
          const row=document.createElement('p');
          const stamp=h.cambiado_en?new Date(h.cambiado_en).toLocaleString('es-CL',{timeZone:'America/Santiago'}):'';
          row.textContent=(recipes.find(r=>r.sku===h.sku)?.nombre||h.sku)+
            ' · '+(h.ambito==='todos'?'Los tres locales':h.ambito)+
            (stamp?' · '+stamp:'')+' · edición '+h.version_nueva;
          history.append(row);
        }
      }else history.textContent='Sin modificaciones posteriores a la carga inicial.';
    }catch(e){
      if(epoch!==readEpoch)return;
      status.textContent='No se pudieron consultar las recetas: '+String(e.message||e);
    }
  }
  async function saveRecipe(){
    if(!changing)return;
    const btn=$('rxSave'),notice=$('rxEditNotice');
    const lines=[...$('rxEditLines').children].map(x=>x.getData());
    if(!lines.length||lines.some(x=>!x.nombre||!Number.isFinite(x.gramos)||x.gramos<=0)){
      notice.textContent='Completa los nombres y gramos de todos los ingredientes.';return;
    }
    btn.disabled=true;notice.textContent='Guardando…';
    try{
      const payload={...changing,estado:$('rxEditStatus').value,notas:$('rxEditNotes').value,lineas:lines};
      const saved=await window.ukiRecetasPrivadas.guardar(payload);
      if(saved.ambito!==changing.ambito)throw Error('No coincide la sucursal guardada.');
      notice.textContent='Receta guardada correctamente. Actualizando…';
      await refresh();
    }catch(e){notice.textContent='No se pudo guardar: '+String(e.message||e)}
    finally{btn.disabled=false;}
  }

  function formatPrice(value){
    return Number.isFinite(Number(value))&&value!==null&&value!==''?fmt(Number(value)):'—';
  }
  function proteinNotPricedLabel(p){
    return p?.tipo==='gohan'&&/camar[oó]n|salm[oó]n/i.test(p.nombre);
  }
  function renderComparison(){
    const p=chosenProduct,gross=$('rxTax').value==='con',
      value=$('rxSale'),costLines=$('rxCostBreakdown');
    costLines.replaceChildren();
    if(!p){
      value.textContent='—';$('rxFactored').textContent='—';
      $('rxTotalCost').textContent='—';$('rxMargin').textContent='—';
      $('rxPriceLow').textContent='—';$('rxPriceSuggested').textContent='—';
      $('rxProductNote').textContent='Elige un producto para ver su precio de venta y cuánto se conoce de su costo.';
      $('rxMarginDescription').textContent='No se han seleccionado datos de un producto.';
      return;
    }
    const price=Number(p.precio_carta),
      partial=p.subtotal_facturas_estimado===null?null:Number(p.subtotal_facturas_estimado),
      entered=$('rxExtraEstimate').value.trim(),
      other=entered===''?null:Number(entered),
      expense=Number($('rxSaleExpense').value||0);
    const valid=Number.isFinite(other)&&other>=0&&Number.isFinite(expense)&&expense>=0;
    const total=valid?(partial||0)+other:null,
      all=valid?total+expense:null;
    const shown=n=>n===null?'Pendiente':fmt(gross?n*1.19:n);
    $('rxSaleLabel').textContent=gross?'Lo vendes actualmente, con IVA':'Lo vendes actualmente, sin IVA';
    value.textContent=fmt(gross?price:price/1.19);
    $('rxProductNote').textContent=p.nombre+' · Precio leído de la carta actual. No es una venta histórica.';
    for(const line of p.desglose||[]){
      const row=document.createElement('div');row.className='rx-cost-line';
      const left=document.createElement('span');
      left.textContent=line.ingrediente.charAt(0).toUpperCase()+line.ingrediente.slice(1)+
        ' · '+line.gramos+' g';
      if(line.negocio_compra||line.fecha_compra){
        const source=document.createElement('small');source.style.display='block';
        source.style.color='var(--muted)';
        source.textContent='Factura de '+(line.negocio_compra||'proveedor')+
          (line.fecha_compra?' · '+line.fecha_compra.split('-').reverse().join('/'):'')+
          '. Presentación y rendimiento por confirmar.';
        left.append(source);
      }
      const right=document.createElement('strong');
      right.textContent=shown(Number(line.valor));
      row.append(left,right);costLines.append(row);
    }
    if(!(p.desglose||[]).length){
      const info=document.createElement('p');info.className='hint';
      info.textContent='No hay ingredientes de este producto valorados con las facturas disponibles.';
      costLines.append(info);
    }
    const missing=document.createElement('p');missing.className='hint';
    missing.textContent='Falta confirmar: '+p.faltan;
    costLines.append(missing);
    $('rxFactored').textContent=partial===null?'Sin valor confirmado':shown(partial);
    $('rxTotalCost').textContent=all===null?'Por completar':shown(all);
    $('rxAssumptionNote').textContent=other===null?
      'Falta información para estimar el costo completo. No voy a inventar la ganancia de este producto.':
      'Para este EJEMPLO he supuesto '+fmt(other)+' netos para ingredientes y envases pendientes'+
       (expense>0?', más '+fmt(expense)+' de otros gastos por venderlo.':'.')+
       ' Todavía no están confirmados con facturas.';
    $('rxMargin').textContent=all===null?'Por calcular':fmt(price/1.19-all);
    $('rxPriceLow').textContent=all===null?'Por calcular':fmt(Math.ceil(all*1.19/.35/100)*100/(gross?1:1.19));
    $('rxPriceSuggested').textContent=all===null?'Por calcular':fmt(Math.ceil(all*1.19/.25/100)*100/(gross?1:1.19));
    $('rxExtraHelp').textContent=proteinNotPricedLabel(p)?
      'Todavía no conocemos el costo de esta proteína. No es seguro sugerir un costo completo ni un precio mínimo/máximo hasta registrar su compra.':
      p.tipo==='otros'?
      'Todavía no hay una receta con costo para este producto. Solo se puede simular si conocemos todos sus ingredientes y sus gastos.':
      'El valor sugerido es un SUPUESTO de prueba para lo que falta: '+p.faltan+
      ' No está comprobado en facturas; puedes corregirlo sin modificar la carta.';
    $('rxMarginDescription').textContent=all===null?
      'Faltan ingredientes valorizados, por lo tanto no sería correcto calcular una ganancia ni un precio mínimo/máximo para este producto.':
      'EJEMPLO, NO GANANCIA REAL: si prepararlo cuesta '+fmt(total)+' netos y hay '+
      fmt(expense)+' de otros gastos por unidad, te quedarían '+fmt(price/1.19-all)+
      ' antes de sueldos, arriendo y demás gastos no incluidos. El mínimo y máximo son una BANDA FINANCIERA ORIENTATIVA, no precios máximos del mercado.';
    $('rxTaxExplanation').textContent=gross?
      'Vista CON IVA: precio que cobra la carta al cliente; costos comprados se muestran con IVA del 19 % supuesto recuperable.':
      'Vista SIN IVA: venta y compras expresadas sin IVA. La cantidad que queda se calcula siempre con ingresos y costos netos, si el IVA es recuperable.';
  }
  function defaultExtraFor(p){
    if(!p||p.subtotal_facturas_estimado===null||
       proteinNotPricedLabel(p)||otherEstimateByType[p.tipo]===undefined)return null;
    const count=['clasico','premium','handroll','promocion'].includes(p.tipo)?
      Math.max(1,Number(p.rolls)||1):1;
    let value=otherEstimateByType[p.tipo]*count;
    if(p.tipo==='promocion'&&/koroke/i.test(p.nombre))value+=300;
    return value;
  }
  function choosePrice(sku){
    chosenProduct=prices.find(x=>x.sku===sku)||null;
    const extra=defaultExtraFor(chosenProduct);
    $('rxExtraEstimate').value=extra===null?'':String(extra);
    $('rxSaleExpense').value='0';
    renderComparison();
  }
  function showAllProducts(){
    const root=$('rxAllProducts');root.replaceChildren();
    const search=$('rxSearch').value.trim().toLocaleLowerCase('es');
    const selected=$('rxProduct'),current=selected.value;
    const filtered=prices.filter(p=>p.nombre.toLocaleLowerCase('es').includes(search));
    selected.replaceChildren();
    selected.add(new Option('Selecciona un producto',''));
    for(const p of filtered)selected.add(new Option(p.nombre+' · '+fmt(p.precio_carta),p.sku));
    if(filtered.some(p=>p.sku===current))selected.value=current;
    else if(filtered.length)selected.value=filtered[0].sku;
    if(!filtered.length){
      const p=document.createElement('p');p.className='hint';
      p.textContent=prices.length?'No se encontraron productos. Prueba otra palabra.':'Aún no se ha consultado la carta.';
      root.append(p);
    }
    for(const p of filtered){
      const row=document.createElement('div');row.className='rx-all-product';
      const info=document.createElement('div');const name=document.createElement('strong');
      name.textContent=p.nombre;
      const price=document.createElement('small');
      const other=defaultExtraFor(p),subtotal=p.subtotal_facturas_estimado;
      const sample=other===null?null:Number(subtotal)+other;
      price.textContent='Lo vendes en '+fmt(p.precio_carta)+
        ' · Costos con facturas: '+(subtotal===null?'pendientes':fmt(subtotal)+' (parcial)');
      info.append(name,price);
      if(sample!==null){
        const detail=document.createElement('small');
        detail.textContent='Costo total de EJEMPLO: '+fmt(sample)+
          ' · Mínimo orientativo: '+fmt(Math.ceil(sample*1.19/.35/100)*100)+
          ' · Máximo orientativo: '+fmt(Math.ceil(sample*1.19/.25/100)*100);
        info.append(detail);
      }
      const btn=document.createElement('button');btn.type='button';btn.className='soft';
      btn.textContent='Revisar';
      btn.onclick=()=>{
        selected.value=p.sku;
        choosePrice(p.sku);
        $('rxComparador').scrollIntoView({behavior:'smooth',block:'start'});
      };
      row.append(info,btn);root.append(row);
    }
    const target=selected.value;
    if(target!==chosenProduct?.sku)choosePrice(target);
  }
  async function loadPrices(){
    const seq=++priceSeq,branch=$('rxBranch').value,status=$('rxCatalogStatus');
    status.textContent='Consultando la carta y las facturas guardadas…';
    prices=[];chosenProduct=null;
    showAllProducts();renderComparison();
    try{
      if(!window.ukiRecetasPrivadas?.comparar)throw Error('Primero ingresa con Google y tu PIN de dueños.');
      const data=await window.ukiRecetasPrivadas.comparar(branch);
      if(seq!==priceSeq||branch!==$('rxBranch').value)return;
      if(!data||!Array.isArray(data.productos)||!data.soloLectura)
        throw Error('No fue posible verificar los precios.');
      prices=data.productos;
      prices.sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
      status.textContent=prices.length+' productos consultados. Los precios son de la carta; los costos todavía pueden ser parciales.';
      showAllProducts();
    }catch(e){
      if(seq!==priceSeq)return;
      status.textContent='No pudimos consultar los precios: '+String(e.message||e);
    }
  }
  function init(){
    if(!$('rxRecipes'))return;
    renderRecipes();
    window.ukiRecetarioAdmin={refresh:()=>{void refresh();void loadPrices();}};
    $('rxScope').addEventListener('change',()=>void refresh());
    $('rxRefresh').addEventListener('click',()=>void refresh());
    $('rxAddLine').addEventListener('click',()=>makeLine());
    $('rxCancel').addEventListener('click',closeEdit);
    $('rxSave').addEventListener('click',()=>void saveRecipe());
    $('rxBranch').addEventListener('change',()=>void loadPrices());
    $('rxReload').addEventListener('click',()=>void loadPrices());
    $('rxSearch').addEventListener('input',showAllProducts);
    $('rxProduct').addEventListener('change',()=>choosePrice($('rxProduct').value));
    for(const id of ['rxExtraEstimate','rxSaleExpense'])$(id).addEventListener('input',renderComparison);
    $('rxTax').addEventListener('change',renderComparison);
    const goCosts=()=>{
      document.querySelector('button[data-tab="negocios"]')?.click();
      const recipe=$('costRecetasPanel');
      if(recipe){recipe.open=true;recipe.scrollIntoView({behavior:'smooth',block:'start'});}
    };
    $('rxGoCosts').addEventListener('click',goCosts);
    $('rxGoCostDetails').addEventListener('click',goCosts);
    $('rxGoPurchases').addEventListener('click',()=>{
      document.querySelector('button[data-tab="facturas"]')?.click();
    });
    showAllProducts();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
