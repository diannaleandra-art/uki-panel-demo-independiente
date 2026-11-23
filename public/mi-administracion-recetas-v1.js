// Apartado privado de consulta: gramajes confirmados y simulador de precios.
// No modifica carta publica, caja, inventario, cierres ni pedidos.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => Number.isFinite(n) ? '$' + Math.round(n).toLocaleString('es-CL') : '—';
  let recipes=[];
  let changing=null;
  let readEpoch=0;
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
  function renderExample(){
    const p=$('rxProduct'),price=$('rxPrice'),cost=$('rxCost'),tax=$('rxTax');
    if(!p||!price||!cost||!tax)return;
    const n=Number(price.value),cShown=Number(cost.value),hasPrice=price.value.trim()!==''&&Number.isFinite(n)&&n>0;
    const hasCost=cost.value.trim()!==''&&Number.isFinite(cShown)&&cShown>0;
    const gross=tax.value==='con';
    const saleNet=hasPrice?n/1.19:NaN;
    const cNet=hasCost?(gross?cShown/1.19:cShown):NaN;
    const costShown=hasCost?cShown:NaN;
    $('rxCostInputLabel').textContent=gross?'Me cuesta prepararlo, con IVA ($)':'Me cuesta prepararlo, sin IVA ($)';
    $('rxSaleLabel').textContent=gross?'Lo vendo en (con IVA)':'Lo vendo en (sin IVA)';
    $('rxSale').textContent=fmt(gross?n:saleNet);
    $('rxCostLabel').textContent=gross?'Me cuesta prepararlo (con IVA estimado)':'Me cuesta prepararlo (sin IVA)';
    $('rxCostShown').textContent=fmt(costShown);
    $('rxMargin').textContent=hasPrice&&hasCost?fmt(saleNet-cNet):'Sin costo completo';
    $('rxPriceSuggested').textContent=hasCost?fmt(Math.ceil((cNet*1.19/0.30)/100)*100):'Sin costo completo';
    $('rxPriceLow').textContent=hasCost?fmt(Math.ceil((cNet*1.19/0.35)/100)*100):'—';
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
    window.ukiRecetarioAdmin={refresh};
    $('rxScope').addEventListener('change',()=>void refresh());
    $('rxRefresh').addEventListener('click',()=>void refresh());
    $('rxAddLine').addEventListener('click',()=>makeLine());
    $('rxCancel').addEventListener('click',closeEdit);
    $('rxSave').addEventListener('click',()=>void saveRecipe());
    const select=$('rxProduct');
    let previousTax=$('rxTax').value;
    $('rxTax').addEventListener('change',()=>{
      const input=$('rxCost');
      if(input.value.trim()!=='' && Number.isFinite(Number(input.value)) && Number(input.value)>0){
        input.value=String(Math.round(Number(input.value)*(previousTax==='con'?1/1.19:1.19)));
      }
      previousTax=$('rxTax').value;
      renderExample();
    });
    for(let i=0;i<products.length;i++) select.add(new Option(products[i].name,String(i)));
    function chosen(){
      $('rxPrice').value=String(products[Number(select.value)||0].price);
      $('rxCost').value='';
      renderExample();
    }
    select.onchange=chosen;
    for(const id of ['rxCost','rxPrice'])$(id).addEventListener('input',renderExample);
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
