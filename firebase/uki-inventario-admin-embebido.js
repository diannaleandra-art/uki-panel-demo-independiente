/* Uki Sushi · Administración de inventario dentro del panel operativo. */
(function(){
'use strict';
const API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const U=[['un','Unidades'],['kg','Kilos'],['g','Gramos'],['l','Litros'],['ml','Mililitros'],['porciones','Porciones']];
const C=[['ingrediente','Ingrediente'],['envase','Envase'],['otro','Otro insumo']];
const X={branch:'',items:[],reports:[],selected:'',busy:false,loaded:false};
const $=id=>document.getElementById(id);
const panelBranch=()=>typeof S!=='undefined'&&S?.suc==='Uki La Serena'?'serena':'arica';
function pick(xs){return xs.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('');}
function number(raw){const t=String(raw??'').trim();if(!/^\d{1,6}([.,]\d{1,3})?$/.test(t))throw Error('Cantidad inválida: máximo 3 decimales (ej.: 2,5).');const n=Number(t.replace(',','.'));if(n>100000)throw Error('Cantidad fuera de rango.');return n;}
function panel(){return [
'<div class="section-head" id="ukiInvSectionHead"><h2>📦 Inventario</h2><p>Existencias, conteos y reposición. No modifica pedidos ni caja.</p></div>',
'<div class="card" id="invRoot" style="padding:14px"><p class="mini-help" style="margin:2px 0 8px">📍 <b id="ukiInvSucursalActual"></b> · para cambiar de sucursal, usa «Salir».</p><select id="invBranch" hidden disabled aria-label="Sucursal de este panel"><option value="arica">Regimiento Arica</option><option value="serena">La Serena</option></select>',
'<p class="mini-help" style="margin:4px 0 9px">Administración: cuenta Google autorizada del panel. Trabajador: código exclusivo de inventario.</p>',
'<button id="invRefresh" class="sm ok" type="button">↻ Actualizar inventario</button>',
'<p id="invStatus" role="status" class="mini-help" style="margin:9px 0 0">Consultando inventario…</p></div>',
'<div class="card" id="ukiInvWorkerAccess" style="padding:14px"><h3 style="margin:2px 0 5px;font-size:17px">👷 Inventario del trabajador</h3>',
'<p class="muted" style="margin:5px 0 10px">El trabajador cuenta y recibe mercadería con su código. Sus revisiones se consultan en «Revisiones y compras». No puede ver cierres.</p>',
'<a href="https://uki-sushi-inventario.vercel.app/" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#fff4e8;color:#8c4708;border:1px solid #edbd85;font-weight:700;text-decoration:none">Abrir acceso del trabajador</a></div>',
'<div class="card" id="invAdmin" hidden><h2>Existencias y mínimos</h2><label for="invSearch">Buscar artículo</label><input id="invSearch" type="search" autocomplete="off" placeholder="Pollo, palta, aceite…">',
'<label for="invSelect">Artículo</label><select id="invSelect"></select><div id="invEditor" hidden>',
'<label for="invName">Nombre</label><input id="invName" maxlength="100"><label for="invCategory">Categoría</label><select id="invCategory">'+pick(C)+'</select>',
'<label for="invUnit">Unidad</label><select id="invUnit">'+pick(U)+'</select>',
'<div class="quick-grid"><div><label for="invStock">Cantidad actual</label><input id="invStock" inputmode="decimal" autocomplete="off"></div>',
'<div><label for="invMin">Mínimo de reposición</label><input id="invMin" inputmode="decimal" autocomplete="off"></div></div>',
'<p class="muted">Cambiar unidad no convierte las cantidades; escribe las cifras correctas.</p><button id="invSave" class="big" type="button">Guardar cambios</button></div>',
'<p class="mini-help">Disponible/Agotado sigue siendo manual. El stock nunca lo modifica automáticamente.</p></div>',
'<div class="card" id="invNewBox" hidden><details><summary style="cursor:pointer;font-weight:700">＋ Agregar insumo al inventario</summary>',
'<label for="invNewName">Nombre</label><input id="invNewName" maxlength="100"><label for="invNewCat">Categoría</label><select id="invNewCat">'+pick(C)+'</select>',
'<label for="invNewUnit">Unidad</label><select id="invNewUnit">'+pick(U)+'</select>',
'<div class="quick-grid"><div><label for="invNewStock">Cantidad inicial</label><input id="invNewStock" value="0" inputmode="decimal"></div>',
'<div><label for="invNewMin">Mínimo</label><input id="invNewMin" value="0" inputmode="decimal"></div></div>',
'<button type="button" id="invCreate" class="big">Agregar al inventario</button></details></div>',
'<div class="card" id="invReportsBox" hidden><h2>Revisiones de trabajadores</h2><div id="invReports"></div></div>'
].join('');}
function status(msg){if($('invStatus'))$('invStatus').textContent=msg;}
async function request(action,data={},branch=X.branch){
 if(branch!==panelBranch())throw Error('Abre la sucursal correspondiente para consultar su inventario.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Inicia sesión Google en el panel. Solo administración autorizada puede editar inventario.');
 const res=await fetch(API,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({branch,action,...data})});
 const json=await res.json().catch(()=>({}));
 if(!res.ok||!json.ok)throw Error(json.error||'No se pudo consultar el inventario.');
 return json;
}
function selection(){
 const item=X.items.find(v=>v.sku===X.selected);$('invEditor').hidden=!item;if(!item)return;
 $('invName').value=item.name;$('invName').disabled=!item.inventory_only;
 $('invCategory').value=item.category||'ingrediente';$('invCategory').disabled=!item.inventory_only;
 $('invUnit').value=item.stock_unit;$('invStock').value=String(item.stock_qty).replace('.',',');$('invMin').value=String(item.min_stock_qty).replace('.',',');
}
function populate(){
 const sel=$('invSelect');sel.replaceChildren(new Option('Selecciona el artículo…',''));
 const q=String($('invSearch').value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let n=0;for(const item of X.items){
  if(q&&!String(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q))continue;
  sel.add(new Option(item.name+' · '+item.stock_unit,item.sku));n++;
 }
 if(!n)sel.add(new Option('Sin coincidencias',''));
 if([...sel.options].some(o=>o.value===X.selected&&X.selected))sel.value=X.selected;else X.selected='';
 selection();
}
function reports(){
 const target=$('invReports');target.replaceChildren();
 if(!X.reports.length){const p=document.createElement('p');p.textContent='Aún no hay revisiones guardadas en esta sucursal.';target.append(p);return;}
 for(const r of X.reports.slice(0,20)){
  const d=document.createElement('details');d.className='card';
  const title=document.createElement('summary'),s=r.summary||{},list=s.faltantes||[];
  title.textContent=(r.worker_name||'Trabajador')+' · '+new Date(r.created_at).toLocaleString('es-CL',{timeZone:'America/Santiago'})+' · '+list.length+' para reponer';d.append(title);
  let p=document.createElement('p');p.className='muted';p.textContent=(s.sinMinimo||0)+' sin mínimo configurado';d.append(p);
  for(const f of list){p=document.createElement('p');p.textContent=f.nombre+' · comprar '+(f.llevar===0?'al llegar al mínimo':f.llevar+' '+f.unidad);d.append(p);}
  target.append(d);
 }
}
async function load(){
 if(X.busy||!$('invRoot'))return;X.busy=true;$('invRefresh').disabled=true;
 const branch=X.branch;status('Consultando inventario…');
 try{
  const [a,r]=await Promise.all([request('articulos',{},branch),request('reportes',{},branch)]);
  if(branch!==X.branch)return;
  X.items=a.items||[];X.reports=r.revisiones||[];X.loaded=true;
  $('invAdmin').hidden=false;$('invNewBox').hidden=false;$('invReportsBox').hidden=false;
  populate();reports();status('✓ '+X.items.length+' artículos · '+X.reports.length+' revisiones consultadas.');
 }catch(e){X.loaded=false;$('invAdmin').hidden=true;$('invNewBox').hidden=true;$('invReportsBox').hidden=true;status(String(e.message||e));}
 finally{X.busy=false;if($('invRefresh'))$('invRefresh').disabled=false;}
}
async function save(){
 const i=X.items.find(x=>x.sku===X.selected);if(!i||X.busy)return;let params;
 try{
  const stock_unit=$('invUnit').value,stock_qty=number($('invStock').value),min_stock_qty=number($('invMin').value);
  if(stock_unit!==i.stock_unit&&!confirm('¿Confirmas que estas cantidades corresponden a '+stock_unit+'? No se convierten automáticamente.'))return;
  params={sku:i.sku,expected_version:i.version};
  if(i.inventory_only)params.item={name:$('invName').value.trim(),category:$('invCategory').value,stock_unit,stock_qty,min_stock_qty};
  else Object.assign(params,{stock_unit,stock_qty,min_stock_qty});
 }catch(e){status(String(e.message));return;}
 X.busy=true;$('invSave').disabled=true;status('Guardando…');
 try{await request(i.inventory_only?'editar-articulo':'configurar-unidad',params);X.busy=false;await load();status('✓ Cantidad y mínimo guardados correctamente.');}
 catch(e){status('No se guardó: '+String(e.message||e));}
 finally{X.busy=false;if($('invSave'))$('invSave').disabled=false;}
}
async function create(){
 if(X.busy)return;let item;
 try{
  item={name:$('invNewName').value.trim(),category:$('invNewCat').value,stock_unit:$('invNewUnit').value,stock_qty:number($('invNewStock').value),min_stock_qty:number($('invNewMin').value)};
  if(item.name.length<2||item.name.length>100)throw Error('Escribe un nombre entre 2 y 100 caracteres.');
 }catch(e){status(String(e.message));return;}
 X.busy=true;$('invCreate').disabled=true;status('Creando artículo…');
 try{
  await request('crear-articulo',{item});$('invNewName').value='';$('invNewStock').value='0';$('invNewMin').value='0';
  X.busy=false;await load();status('✓ Artículo «'+item.name+'» agregado solo al inventario.');
 }catch(e){status('No se agregó: '+String(e.message||e));}
 finally{X.busy=false;if($('invCreate'))$('invCreate').disabled=false;}
}

// Costos privados: solo lectura y cambios de precio, nunca modifica stock.
function mountCosteo(){
 const root=$('invRoot');if(!root)return;
 const old=$('invCosteo');
 if(old&&old.__ukiInventarioRaiz===root&&old.__ukiSucursal===X.branch)return;
 if(old)old.remove();
 const active=X.branch;
 const isRomo=active==='romo';
 const store=isRomo?'romo:serena':'uki:'+active;
 const api=isRomo?'/api/romo-costeo-v1':'https://uki-sushi-inventario.vercel.app/api/uki-costeo-v1';
 const card=document.createElement('details');card.className='card';card.id='invCosteo';
 card.innerHTML='<summary><b>💰 Precios de compra y costos · Administración</b></summary><p class="muted">Registra el precio de una cantidad comprada. No cambia existencias ni precios de venta.</p><button type="button" class="sm" id="invCostLoad">Consultar costos</button><p role="status" id="invCostStatus" class="mini-help">Consulta con Google autorizado.</p><div id="invCostFields" hidden><label for="invCostItem">Ingrediente o insumo</label><select id="invCostItem"></select><label for="invCostUnit">Unidad de compra</label><select id="invCostUnit"></select><label for="invCostQty">Cantidad comprada</label><input id="invCostQty" inputmode="decimal"><label for="invCostPrice">Precio total en pesos</label><input id="invCostPrice" inputmode="numeric"><p id="invCostResult" class="mini-help"></p><button type="button" class="big" id="invCostSave">Guardar precio de compra</button></div>';
 root.after(card);
 card.__ukiInventarioRaiz=root;card.__ukiSucursal=X.branch;
 let rows=[],prices=[],busy=false;
 const within=()=>card.isConnected&&X.branch===active&&panelBranch()===active;
 const el=id=>card.querySelector('#'+id);
 const status=s=>{if(within())el('invCostStatus').textContent=s;};
 const groups={kg:['kg','g'],g:['kg','g'],l:['l','ml'],ml:['l','ml'],un:['un']};
 const labels={kg:'Kilogramos',g:'Gramos',l:'Litros',ml:'Mililitros',un:'Unidades'};
 const numeric=s=>{const t=String(s).trim();return /^\d+(?:[.,]\d{1,6})?$/.test(t)?Number(t.replace(',','.')):NaN;};
 async function call(action,extra={}){
  if(!within())throw Error('Cambió la sucursal.');
  const token=await window.ukiInventarioToken?.();if(!token||!within())throw Error('Ingresa con Google autorizado.');
  const response=await fetch(api,{method:'POST',cache:'no-store',credentials:'omit',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({branch:active,action,...extra})});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true||result.store!==store)throw Error(typeof result?.error==='string'?result.error:'Costos todavía no disponibles.');
  if(!within())throw Error('Cambió la sucursal.');
  return result;
 }
 function opt(select,value,name){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);}
 function preview(){const n=numeric(el('invCostQty').value),p=numeric(el('invCostPrice').value),unit=el('invCostUnit').value;el('invCostResult').textContent=n>0&&Number.isSafeInteger(p)&&p>0?'Costo por '+unit+': $'+(p/n).toLocaleString('es-CL',{maximumFractionDigits:4}):'Completa cantidad y precio.';}
 function select(){
  const item=rows.find(x=>x.sku===el('invCostItem').value),p=prices.find(x=>x.sku===item?.sku);
  el('invCostUnit').replaceChildren();for(const u of groups[item?.stock_unit]||[])opt(el('invCostUnit'),u,labels[u]);
  el('invCostUnit').value=p&&groups[item?.stock_unit]?.includes(p.unit)?p.unit:item?.stock_unit||'';
  el('invCostQty').value=p?String(p.quantity):'';el('invCostPrice').value=p?String(p.price):'';preview();
 }
 async function loadCosts(){
  if(busy)return;busy=true;el('invCostLoad').disabled=true;el('invCostSave').disabled=true;status('Consultando…');
  try{const a=await call('listar');rows=(a.items||[]).filter(x=>groups[x.stock_unit]);prices=a.prices||[];const field=el('invCostItem');const prev=field.value;field.replaceChildren();for(const i of rows)opt(field,i.sku,i.name);if(rows.some(i=>i.sku===prev))field.value=prev;el('invCostFields').hidden=!rows.length;select();status(rows.length?'Costos de esta sucursal.':'No hay insumos con unidades compatibles.');}
  catch(e){if(within()){el('invCostFields').hidden=true;status(e.message);}}
  finally{busy=false;if(within()){el('invCostLoad').disabled=false;el('invCostSave').disabled=false;}}
 }
 async function saveCost(){
  if(busy||!within())return;const sku=el('invCostItem').value,unit=el('invCostUnit').value,quantity=numeric(el('invCostQty').value),price=numeric(el('invCostPrice').value);
  if(!(quantity>0)||!Number.isSafeInteger(price)||price<=0){status('Revisa cantidad y precio total.');return;}
  const revision=Number(prices.find(x=>x.sku===sku)?.revision||0);
  busy=true;el('invCostSave').disabled=true;el('invCostLoad').disabled=true;status('Guardando precio…');
  try{const a=await call('guardar-precio',{sku,unit,quantity,price,revision});prices=prices.filter(x=>x.sku!==sku).concat(a.price);status('Precio confirmado. Existencias sin cambios.');}
  catch(e){status(e.message);}
  finally{busy=false;if(within()){el('invCostSave').disabled=false;el('invCostLoad').disabled=false;}}
 }
 el('invCostLoad').onclick=()=>void loadCosts();
 el('invCostSave').onclick=()=>void saveCost();
 el('invCostItem').onchange=select;
 for(const id of ['invCostQty','invCostPrice','invCostUnit'])el(id).oninput=preview;

 // Recetas de productos: borrador privado, sin descontar existencias.
 const recipeBox=document.createElement('details');recipeBox.id='invRecipeBox';
 recipeBox.style.marginTop='16px';
 recipeBox.innerHTML='<summary><b>🍣 Recetas y costos por producto</b></summary><p class="muted">Selecciona un producto y registra todos sus ingredientes e insumos por unidad vendida. Para sushi personalizado, usa una variante que describa el armado completo. No se aplican costos a ventas automáticamente.</p><button type="button" class="sm" id="invRecipeLoad">Consultar recetas</button><p role="status" id="invRecipeStatus" class="mini-help"></p><fieldset id="invRecipeFields" hidden style="border:0;padding:0;margin:0;min-width:0"><label for="invRecipeProduct">Producto o promoción</label><select id="invRecipeProduct"></select><label for="invRecipeVariant">Variante de receta</label><input id="invRecipeVariant" list="invRecipeVariants" maxlength="180" value="base" placeholder="Ej.: pollo panko"><datalist id="invRecipeVariants"></datalist><button type="button" id="invRecipeChoose" class="sm">Abrir variante</button><div id="invRecipeLines"></div><button type="button" class="sm" id="invRecipeAdd">＋ Agregar insumo</button><p class="mini-help" id="invRecipeEstimate"></p><button type="button" id="invRecipeSave" class="big">Guardar receta en borrador</button><button type="button" class="sm ok" id="invRecipeConfirm">Confirmar receta guardada</button></fieldset>';
 card.append(recipeBox);
 let recipeProducts=[],recipeItems=[],recipes=[],recipeBusy=false,loadedProduct='',loadedVariant='',loadedRevision=0;
 const re=id=>recipeBox.querySelector('#'+id);
 const rs=s=>{if(within())re('invRecipeStatus').textContent=s;};
 function recipeLock(b){recipeBusy=b;re('invRecipeFields').disabled=b;re('invRecipeLoad').disabled=b;}
 function recipeLine(data={}){
  const line=document.createElement('div');line.className='card';line.style.padding='9px';
  const product=document.createElement('select'),unit=document.createElement('select'),quantity=document.createElement('input'),remove=document.createElement('button');
  product.setAttribute('aria-label','Insumo de receta');unit.setAttribute('aria-label','Unidad de ingrediente');quantity.setAttribute('aria-label','Cantidad por producto');quantity.inputMode='decimal';quantity.placeholder='Cantidad';remove.type='button';remove.className='sm';remove.textContent='Quitar insumo';
  opt(product,'','Elegir ingrediente');for(const i of recipeItems)opt(product,i.sku,i.name);
  if(data.sku&&!recipeItems.some(i=>i.sku===data.sku))opt(product,data.sku,'Insumo no disponible: '+data.sku);
  product.value=data.sku||'';
  function units(preferred){unit.replaceChildren();const item=recipeItems.find(i=>i.sku===product.value);for(const u of groups[item?.stock_unit]||[])opt(unit,u,labels[u]);if(preferred&&Array.from(unit.options).some(o=>o.value===preferred))unit.value=preferred;else if(item)unit.value=item.stock_unit;}
  units(data.unit);quantity.value=data.quantity??'';product.onchange=()=>units();remove.onclick=()=>line.remove();
  for(const node of [product,quantity,unit,remove])line.append(node);
  line.readRecipe=()=>({sku:product.value,unit:unit.value,quantity:numeric(quantity.value)});
  re('invRecipeLines').append(line);
 }
 function variants(){const p=re('invRecipeProduct').value,list=re('invRecipeVariants');list.replaceChildren();opt(list,'base','Receta base');for(const r of recipes.filter(r=>r.product_sku===p&&r.variant_key!=='base'))opt(list,r.variant_key,r.variant_key);}
 function openRecipe(){
  loadedProduct=re('invRecipeProduct').value;loadedVariant=re('invRecipeVariant').value.trim()||'base';re('invRecipeVariant').value=loadedVariant;
  const r=recipes.find(r=>r.product_sku===loadedProduct&&r.variant_key===loadedVariant);
  loadedRevision=Number(r?.revision||0);re('invRecipeLines').replaceChildren();
  for(const row of r?.recipe_lines||[])recipeLine(row);
  if(!r)recipeLine();
  re('invRecipeEstimate').textContent=r?.cost!=null?'Costo estimado de la receta: $'+Number(r.cost).toLocaleString('es-CL')+' · '+(r.confirmed?'Confirmada':'Borrador'):'Costo pendiente de ingredientes, precios o configuración.';
  rs(r?'Receta existente. Cualquier edición queda como borrador.':'Nueva variante de receta.');
 }
 async function loadRecipes(){
  if(recipeBusy)return;recipeLock(true);rs('Consultando productos e ingredientes…');
  try{const [catalog,inventory]=await Promise.all([call('listar-recetas'),call('listar')]);recipeProducts=catalog.products||[];recipes=catalog.recipes||[];recipeItems=(inventory.items||[]).filter(i=>groups[i.stock_unit]);const field=re('invRecipeProduct'),prev=field.value;field.replaceChildren();for(const p of recipeProducts)opt(field,p.sku,p.name+(p.source==='borrador'?' · borrador de carta':''));if(recipeProducts.some(p=>p.sku===prev))field.value=prev;re('invRecipeFields').hidden=!recipeProducts.length;if(recipeProducts.length){variants();openRecipe();}else rs('No hay productos registrados en la carta.');}
  catch(e){if(within()){re('invRecipeFields').hidden=true;rs(e.message);}}
  finally{if(within())recipeLock(false);}
 }
 async function saveRecipe(){
  if(recipeBusy||!within())return;
  if(loadedProduct!==re('invRecipeProduct').value||loadedVariant!==re('invRecipeVariant').value.trim()){rs('Abre la variante indicada antes de guardar.');return;}
  const lines=Array.from(re('invRecipeLines').children).map(x=>x.readRecipe());
  if(!lines.length||lines.some(x=>!x.sku||!x.unit||!(x.quantity>0))){rs('Completa los ingredientes, unidades y cantidades.');return;}
  recipeLock(true);rs('Guardando receta…');
  try{const a=await call('guardar-receta',{productSku:loadedProduct,variantKey:loadedVariant,revision:loadedRevision,lines});recipes=recipes.filter(r=>!(r.product_sku===loadedProduct&&r.variant_key===loadedVariant)).concat(a.recipe);variants();openRecipe();rs('Receta guardada como borrador. No modifica stock ni caja.');}
  catch(e){rs(e.message);}
  finally{if(within())recipeLock(false);}
 }
 re('invRecipeLoad').onclick=()=>void loadRecipes();
 re('invRecipeProduct').onchange=()=>{re('invRecipeVariant').value='base';variants();openRecipe();};
 re('invRecipeChoose').onclick=openRecipe;
 re('invRecipeAdd').onclick=()=>{if(re('invRecipeLines').children.length<100)recipeLine();};
 re('invRecipeSave').onclick=()=>void saveRecipe();
 re('invRecipeConfirm').onclick=async()=>{
  if(recipeBusy||!within())return;
  const r=recipes.find(x=>x.product_sku===loadedProduct&&x.variant_key===loadedVariant);
  if(!r||r.confirmed||loadedProduct!==re('invRecipeProduct').value||loadedVariant!==re('invRecipeVariant').value.trim()){rs('Abre una receta borrador guardada antes de confirmar.');return;}
  const current=Array.from(re('invRecipeLines').children).map(x=>x.readRecipe());
  const normalize=a=>JSON.stringify(a.map(x=>({sku:x.sku,unit:x.unit,quantity:Number(x.quantity)})));
  if(normalize(current)!==normalize(r.recipe_lines)){rs('Guarda los cambios antes de confirmar.');return;}
  if(!window.confirm('¿Confirmas que esta receta incluye todos los ingredientes, salsas y envases de la variante indicada?'))return;
  recipeLock(true);rs('Confirmando receta completa…');
  try{const a=await call('confirmar-receta',{productSku:loadedProduct,variantKey:loadedVariant,revision:loadedRevision,confirmar:true});recipes=recipes.filter(x=>!(x.product_sku===loadedProduct&&x.variant_key===loadedVariant)).concat(a.recipe);openRecipe();rs('Receta confirmada. No se modificó el inventario.');}
  catch(e){rs(e.message);}finally{if(within())recipeLock(false);}
 };


 // Consulta privada de rentabilidad estimada, sin modificar pedidos ni inventario.
 const report=document.createElement('details');report.style.marginTop='16px';
 report.innerHTML='<summary><b>📊 Consumo y rentabilidad por pedido</b></summary><p class="muted">Consulta pedidos pagados y entregados disponibles en este panel. Usa precios actuales; no representa costos históricos ni descuenta existencias.</p><label for="invProfitFrom">Desde</label><input id="invProfitFrom" type="date"><label for="invProfitTo">Hasta</label><input id="invProfitTo" type="date"><button type="button" class="sm" id="invProfitLoad">Consultar pedidos</button><p role="status" id="invProfitStatus"></p><div id="invProfitFields" hidden><label for="invProfitOrder">Pedido</label><select id="invProfitOrder"></select><div id="invProfitChoices"></div><button type="button" class="sm ok" id="invProfitCalc">Calcular pedido</button><div id="invProfitResult"></div><div id="invProfitTotal"></div></div>';
 card.append(report);
 const pe=id=>report.querySelector('#'+id);
 const ps=s=>{if(within())pe('invProfitStatus').textContent=s;};
 const localDate=v=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));}catch{return '';}};
 const fmtMoney=v=>v==null?'Pendiente de precio':'$'+Number(v).toLocaleString('es-CL');
 const countFmt=v=>Number(v).toLocaleString('es-CL',{maximumFractionDigits:4});
 let orders=[],confirmed=[],profitBusy=false,totals=new Map();
 pe('invProfitFrom').value=pe('invProfitTo').value=localDate(Date.now());
 const make=(tag,t)=>{const e=document.createElement(tag);if(t!=null)e.textContent=t;return e;};
 function selectedOrder(){return orders[Number(pe('invProfitOrder').value)];}
 function orderSignature(p){return JSON.stringify(p);}
 function sanitized(p){
  return {id:p.id,suc:p.suc,fechaISO:p.fechaISO,pagado:p.pagado,estado:p.estado,productos:(p.productos||[]).map(x=>({skuCarta:x.skuCarta,nombre:String(x.nombre||''),cantidad:Number(x.cantidad),precioUnit:Number(x.precioUnit),detalle:String(x.detalle||'')}))};
 }
 function currentOrders(){
  const start=pe('invProfitFrom').value,end=pe('invProfitTo').value;
  if(!start||!end||start>end)throw Error('Selecciona un período válido.');
  const current=typeof S!=='undefined'&&Array.isArray(S.pedidos)?S.pedidos:[];
  const seen=new Set();
  return current.filter(p=>p.suc===S.suc&&p.pagado===true&&p.estado==='Entregado'&&!p.esPremio&&localDate(p.fechaISO)>=start&&localDate(p.fechaISO)<=end).filter(p=>{const k=String(p.id)+'|'+String(p.fechaISO);if(seen.has(k))return false;seen.add(k);return true;}).map(sanitized);
 }
 function showTotals(){
  const a=[...totals.values()].filter(x=>x.status==='ready'),p=pe('invProfitTotal');p.replaceChildren();
  const rev=a.reduce((n,x)=>n+x.revenue,0),cost=a.length&&a.every(x=>x.cost!==null)?a.reduce((n,x)=>n+x.cost,0):null;
  p.append(make('h3','Resumen de pedidos calculados'),make('p',a.length+' de '+orders.length+' pedidos identificados del período · '+(orders.length-a.length)+' pendientes de cálculo'),make('p','Venta de productos: '+fmtMoney(rev)),make('p','Costo estimado: '+fmtMoney(cost)),make('b','Ganancia bruta estimada: '+fmtMoney(cost===null?null:rev-cost)),make('p','Solo incluye pedidos completos revisados en esta consulta. Excluye delivery, propinas, comisiones y otros gastos.'));
 }
 function showOrder(){
  const o=selectedOrder(),area=pe('invProfitChoices');area.replaceChildren();pe('invProfitResult').replaceChildren();if(!o)return;
  for(const [i,x] of o.productos.entries()){
   const div=make('div');div.className='card';div.append(make('b',x.cantidad+' × '+x.nombre));if(x.detalle)div.append(make('p',x.detalle));
   const select=make('select');select.setAttribute('aria-label','Variante para '+x.nombre);opt(select,'','Seleccionar receta comprobada');
   const variants=confirmed.filter(r=>r.product_sku===x.skuCarta);
   for(const [j,v] of variants.entries())opt(select,String(j),v.variant_key);
   div.append(select);
   div.getChoice=()=>{const v=select.value!==''?variants[Number(select.value)]:null;return v?{index:i,variant:v.variant_key,revision:Number(v.revision),verified:true}:null;};
   if(!variants.length)div.append(make('p','Sin receta confirmada o producto sin código. El costo queda pendiente.'));
   area.append(div);
  }
 }
 pe('invProfitLoad').onclick=async()=>{
  if(profitBusy)return;profitBusy=true;pe('invProfitLoad').disabled=true;pe('invProfitCalc').disabled=true;ps('Consultando…');
  try{const a=await call('listar-recetas');confirmed=(a.recipes||[]).filter(r=>r.confirmed===true);orders=currentOrders();totals.clear();const field=pe('invProfitOrder');field.replaceChildren();for(const [i,p] of orders.entries())opt(field,String(i),'#'+p.id+' · '+localDate(p.fechaISO));pe('invProfitFields').hidden=!orders.length;showOrder();showTotals();ps(orders.length?orders.length+' pedidos disponibles. Revisa las variantes de cada pedido.':'No hay pedidos pagados y entregados disponibles en este período.');}
  catch(e){if(within()){pe('invProfitFields').hidden=true;ps(e.message);}}
  finally{profitBusy=false;if(within()){pe('invProfitLoad').disabled=false;pe('invProfitCalc').disabled=false;}}
 };
 for(const id of ['invProfitFrom','invProfitTo'])pe(id).onchange=()=>{orders=[];totals.clear();pe('invProfitFields').hidden=true;ps('Consulta el nuevo período.');};
 pe('invProfitOrder').onchange=showOrder;
 pe('invProfitCalc').onclick=async()=>{
  if(profitBusy||!within())return;const order=selectedOrder();if(!order)return;
  const real=(S.pedidos||[]).find(p=>p.suc===S.suc&&p.id===order.id&&p.fechaISO===order.fechaISO);
  if(!real||orderSignature(sanitized(real))!==orderSignature(order)){ps('El pedido cambió. Consulta nuevamente el período.');return;}
  const choices=Array.from(pe('invProfitChoices').children).map(x=>x.getChoice()).filter(Boolean);
  profitBusy=true;pe('invProfitLoad').disabled=true;pe('invProfitCalc').disabled=true;pe('invProfitOrder').disabled=true;ps('Calculando…');
  try{const a=await call('proyectar-pedido',{order,choices});const r=a.projection,out=pe('invProfitResult');out.replaceChildren();totals.set(r.orderKey,r);
   if(r.status==='ready'){
    out.append(make('h3','Costo estimado del pedido'),make('p','Costo: '+fmtMoney(r.cost)),make('b','Ganancia bruta: '+fmtMoney(r.grossProfit)),make('h3','Comparación con existencias actuales'));
    for(const x of a.stock||[])out.append(make('p',x.name+' · consumo '+(x.required===null?'sin unidad compatible':countFmt(x.required)+' '+x.unit)+' · existencia '+(x.available===null?'sin dato':countFmt(x.available)+' '+x.unit)));
    out.append(make('p','Comparación informativa: las existencias pueden haber sido contadas después de preparar este pedido.'));
   }else out.append(make('p','Costo pendiente: completa la identificación de productos, recetas y precios de compra.'));
   showTotals();ps('Consulta finalizada. No se modificaron existencias.');
  }catch(e){ps(e.message);}
  finally{profitBusy=false;if(within()){pe('invProfitLoad').disabled=false;pe('invProfitCalc').disabled=false;pe('invProfitOrder').disabled=false;}}
 };


 // Punto de partida del consumo: solo preparación del registro, no activa descuentos.
 // Consulta automática de los pedidos disponibles; no certifica cobertura total.
 const daily=document.createElement('details');daily.style.marginTop='16px';
 daily.innerHTML='<summary><b>Consumo estimado por período · automático</b></summary><p>Usa las fechas del informe de pedidos anterior. Las recetas y precios son los vigentes; no descuenta stock ni confirma faltantes.</p><button type="button" class="sm ok">Calcular consumo</button> <button type="button" class="sm" id="invPhysicalCompare">Comparar últimos conteos</button><div role="status"></div><div class="daily-result"></div>';
 card.append(daily);
 const dailyBtn=daily.querySelector('button'),dailyStatus=daily.querySelector('[role=status]'),dailyOut=daily.querySelector('.daily-result');
 const physicalBtn=daily.querySelector('#invPhysicalCompare');
 async function runDaily(comparePhysical){
  if(!within()||dailyBtn.disabled||physicalBtn.disabled)return;
  dailyBtn.disabled=physicalBtn.disabled=true;dailyOut.replaceChildren();dailyStatus.textContent='Calculando consumo…';
  try{
   const start=pe('invProfitFrom').value,end=pe('invProfitTo').value;
   if(!start||!end||start>end)throw Error('Selecciona un período válido.');
   const suc=S.suc,store=suc==='Romo’s Sushi La Serena'?'romo:serena':suc==='Uki La Serena'?'uki:serena':'uki:arica';
   const physical=comparePhysical?await call('consultar-periodo-fisico'):null;
   if(physical&&!physical.available){dailyStatus.textContent=physical.reason;return;}
   const source=(Array.isArray(S.pedidos)?S.pedidos:[]).filter(p=>p.suc===suc&&(physical?Date.parse(p.fechaISO)>Date.parse(physical.start)&&Date.parse(p.fechaISO)<=Date.parse(physical.end):localDate(p.fechaISO)>=start&&localDate(p.fechaISO)<=end));
   const seen=new Set(),list=[];let duplicates=0;
   for(const p of source){const key=String(p.id)+'|'+String(p.fechaISO);if(seen.has(key)){duplicates++;continue;}seen.add(key);list.push({...sanitized(p),esPremio:p.esPremio===true});}
   const ingredients=new Map();let calculated=0,pending=0,cost=0,allPriced=true;
   const inv=await call('listar');const names=new Map((inv.items||[]).map(i=>[i.sku,i.name]));
   for(let n=0;n<list.length;){
    const batch=[];while(n<list.length&&batch.length<20&&JSON.stringify({orders:[...batch,list[n]]}).length<38000){batch.push(list[n++]);}
    if(!batch.length){pending++;n++;continue;}
    const a=await call('proyectar-periodo',{orders:batch});
    if(!within()||S.suc!==suc||pe('invProfitFrom').value!==start||pe('invProfitTo').value!==end)throw Error('Cambió el período o la sucursal. Vuelve a calcular.');
    if(a.store!==store||!Array.isArray(a.consumption))throw Error('Respuesta no verificable.');
    calculated+=a.calculated;pending+=a.pending;
    if(a.calculated){if(a.cost===null)allPriced=false;else cost+=a.cost;}
    for(const x of a.consumption){const k=x.sku+'|'+x.unit,v=ingredients.get(k)||{...x,quantity:0};v.quantity+=x.quantity;ingredients.set(k,v);}
   }
   dailyOut.append(make('h3','Consumo identificado · '+(physical?new Date(physical.start).toLocaleString('es-CL',{timeZone:'America/Santiago'})+' a '+new Date(physical.end).toLocaleString('es-CL',{timeZone:'America/Santiago'}):start+' a '+end)),make('p',calculated+' pedidos calculados · '+pending+' pendientes · '+duplicates+' duplicados omitidos'),make('p','Costo estimado de pedidos calculados: '+(calculated&&allPriced?fmtMoney(cost):'No completo')));
   for(const x of ingredients.values()){const scale=['g','ml'].includes(x.unit)?1000:1;dailyOut.append(make('p',(names.get(x.sku)||x.sku)+' · '+countFmt(x.quantity/scale)+' '+(x.unit==='g'?'kg':x.unit==='ml'?'l':x.unit)));}
   if(physical){
    const u={kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],un:['un',1],porciones:['porciones',1]};
    dailyOut.append(make('h3','Comparación con conteos físicos'),make('p','Período delimitado por revisiones de inventario; pedidos según fecha de registro, no hora de preparación. Las diferencias son orientativas.'));
    const table=make('table'),head=make('tr');
    for(const title of ['Insumo','Inicial','Recibido','Quedó','Salida física','Venta identificada','Saldo estimado parcial','Diferencia preliminar'])head.append(make('th',title));table.append(head);
    for(const row of physical.rows||[]){
     const unit=u[row.unit],compatible=unit?[...ingredients.values()].filter(i=>i.sku===row.sku&&u[i.unit]?.[0]===unit[0]):[];
     const sales=compatible.length?compatible.reduce((v,i)=>v+i.quantity*u[i.unit][1]/unit[1],0):null;
     const estimated=row.outflow!==null&&sales!==null?row.opening+row.received-sales:null;
     const diff=estimated===null?null:estimated-row.closing;
     const qty=v=>v===null||v===undefined?'Pendiente':countFmt(v)+' '+row.unit;
     const tr=make('tr');for(const val of [row.name,qty(row.opening),qty(row.received),qty(row.closing),qty(row.outflow),qty(sales),qty(estimated),qty(diff)+(diff!==null&&row.unitCost!==null?' · '+fmtMoney(Math.round(diff*row.unitCost)):'')])tr.append(make('td',val));table.append(tr);
    }
    const scroll=make('div');scroll.style.overflowX='auto';scroll.append(table);dailyOut.append(scroll,make('p',physical.warning||'Comparación provisional; no acredita pérdidas.'));
   }
   dailyOut.append(make('p','Informe parcial de pedidos disponibles en el panel. No incluye ventas ausentes, ni permite determinar faltantes definitivos.'));
   dailyStatus.textContent='Consulta finalizada. No se modificaron existencias.';
  }catch(e){dailyOut.replaceChildren();dailyStatus.textContent=e.message;}
  finally{dailyBtn.disabled=physicalBtn.disabled=false;}
 }
 dailyBtn.onclick=()=>void runDaily(false);
 physicalBtn.onclick=()=>void runDaily(true);
 const startBox=document.createElement('details');startBox.style.marginTop='16px';
 startBox.innerHTML='<summary><b>Inicio del control de consumo</b></summary><p class="muted">Preparar el conteo físico inicial. Solo confirma al terminar la jornada, sin pedidos preparados pendientes. Esta etapa no activa descuentos de stock.</p><button type="button" class="sm" id="invStartLoad">Consultar inventario inicial</button><p role="status" id="invStartStatus"></p><div id="invStartReview" hidden><div id="invStartItems"></div><label><input id="invStartCounted" type="checkbox"> Confirmo que las cantidades coinciden con el conteo físico.</label><label><input id="invStartNoPending" type="checkbox"> No quedan pedidos preparados pendientes de registrar.</label><button type="button" class="sm ok" id="invStartConfirm">Registrar punto inicial</button></div>';
 card.append(startBox);
 const se=id=>startBox.querySelector('#'+id);
 let startToken=null,startBusy=false;
 const ss=v=>{if(within())se('invStartStatus').textContent=v;};
 function showStart(v){
  startToken=null;se('invStartReview').hidden=true;
  se('invStartCounted').checked=false;se('invStartNoPending').checked=false;
  const list=se('invStartItems');list.replaceChildren();
  if(v.existing){ss('Punto inicial registrado: '+new Date(v.existing.cutoff).toLocaleString('es-CL',{timeZone:'America/Santiago'})+'. El descuento automático sigue desactivado.');return;}
  const items=v.snapshot?.items||[];
  if(!items.length){ss('No hay artículos configurados.');return;}
  for(const i of items){const row=document.createElement('p');row.textContent=i.name+' · '+Number(i.quantity).toLocaleString('es-CL',{maximumFractionDigits:4})+' '+i.unit;list.append(row);}
  startToken=v.token;se('invStartReview').hidden=false;ss('Revisa '+items.length+' artículos antes de confirmar.');
 }
 se('invStartLoad').onclick=async()=>{
  if(startBusy)return;startBusy=true;se('invStartLoad').disabled=true;se('invStartConfirm').disabled=true;startToken=null;se('invStartReview').hidden=true;ss('Consultando…');
  try{showStart(await call('consultar-inicio'));}catch(e){ss(e.message);}
  finally{startBusy=false;if(within()){se('invStartLoad').disabled=false;se('invStartConfirm').disabled=false;}}
 };
 se('invStartConfirm').onclick=async()=>{
  if(startBusy||!within()||!startToken)return;
  if(!se('invStartCounted').checked||!se('invStartNoPending').checked){ss('Confirma ambas verificaciones.');return;}
  if(!window.confirm('¿Registrar este conteo como punto de inicio? No se descontará stock ni se habilitará consumo automático.'))return;
  startBusy=true;se('invStartLoad').disabled=true;se('invStartConfirm').disabled=true;ss('Registrando…');
  try{showStart(await call('confirmar-inicio',{token:startToken,confirmar:true,sinPendientes:true}));}
  catch(e){startToken=null;se('invStartReview').hidden=true;ss(e.message+' Consulta nuevamente el inventario.');}
  finally{startBusy=false;if(within()){se('invStartLoad').disabled=false;se('invStartConfirm').disabled=false;}}
 };

}

function mount(){
 if(!$('invRoot'))return;
 const active=panelBranch();
 if(X.branch!==active){X.items=[];X.reports=[];X.selected='';X.loaded=false;}
 X.branch=active;
 mountCosteo();
 $('invBranch').value=active;
 $('invBranch').disabled=true;
 $('ukiInvSucursalActual').textContent=active==='serena'?'Uki La Serena':'Uki Regimiento Arica';
 $('invRefresh').onclick=()=>void load();$('invSearch').oninput=populate;
 $('invSelect').onchange=e=>{X.selected=e.target.value;selection();};
 $('invSave').onclick=()=>void save();$('invCreate').onclick=()=>void create();
 if(X.loaded){$('invAdmin').hidden=false;$('invNewBox').hidden=false;$('invReportsBox').hidden=false;populate();reports();status('Inventario listo.');}
 else void load();
}
window.ukiInventarioPanelHTML=panel;window.ukiInventarioMontar=mount;
})();
// Consumo informativo posterior a guardado confirmado; no modifica pedidos.
const ukiConsumoSyncRev=new Map(),ukiConsumoSyncBusy=new Set(),ukiConsumoPending=new Map();
async function ukiConsumoDrain(store){
 if(ukiConsumoSyncBusy.has(store))return;
 ukiConsumoSyncBusy.add(store);
 try{
  while(ukiConsumoPending.has(store)){
   const entry=ukiConsumoPending.get(store),payload=entry.payload,revision=payload.revision;
   if((ukiConsumoSyncRev.get(store)||0)>=revision){ukiConsumoPending.delete(store);continue;}
   let ok=false;
   try{
    const token=await window.ukiInventarioToken?.();
    if(token){
     const response=await fetch('https://uki-sushi-inventario.vercel.app/api/inventario-ventas-live',{method:'POST',cache:'no-store',credentials:'omit',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
     if(response.ok){const result=await response.json();ok=result.ok===true&&result.store===store&&(result.registered===true||result.unchanged===true);}
    }
   }catch{}
   if(ok)ukiConsumoSyncRev.set(store,revision);
   if(ukiConsumoPending.get(store)!==entry)continue;
   if(ok){ukiConsumoPending.delete(store);continue;}
   // Keep the last confirmed snapshot for the next event; one bounded retry.
   if(entry.attempts<1){entry.attempts++;setTimeout(()=>void ukiConsumoDrain(store),5000);}
   break;
  }
 }finally{ukiConsumoSyncBusy.delete(store);}
}
window.ukiPublicarConsumoLive=async function(state,suc,revision){
 const store={'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena','Romo’s Sushi La Serena':'romo:serena'}[suc];
 if(!store||!Number.isSafeInteger(revision)||revision<1||!Array.isArray(state?.pedidos)||(ukiConsumoSyncRev.get(store)||0)>=revision)return;
 const pending=ukiConsumoPending.get(store);
 if(pending?.payload.revision>=revision){if(pending.payload.revision===revision)await ukiConsumoDrain(store);return;}
 try{
  const now=Date.now(),start=now-7*86400000,facts=[],seen=new Set();
  for(const p of state.pedidos){
   const stamp=Date.parse(p?.fechaISO);
   if(p?.suc!==suc||!Number.isFinite(stamp)||stamp<=start||stamp>now)continue;
   const id=Number(p.id),at=new Date(stamp).toISOString(),key=id+'|'+at;
   if(!Number.isSafeInteger(id)||id<1||seen.has(key))continue;seen.add(key);
   const fact={id,at,state:p.estado==='Entregado'?'prepared':'review',rolls:[]};
   if(fact.state==='prepared'){
    const groups=ukiStatsGruposRegistrados(p,Array.isArray(p.productos)?p.productos:[],ukiStatsArmadoDigital(p.textoOriginal));
    if(groups)for(const g of groups){
     const match=ukiStatsClaveProducto(g.nombre).match(/^(clasico|premium) (\d{1,3}) piezas$/);
     if(!match)continue;
     const type=match[1]==='clasico'?'roll-clasico':'premium',n=Number(match[2])/(type==='premium'?10:12);
     if(!Number.isInteger(n)||n<1||g.rollRows.length!==n||!g.rollRows.every((r,i)=>r.index===i+1&&r.cantidad===g.cantidad))continue;
     const raw=g.lines.filter(l=>/^(?:(\d{1,3})\s*[×x]\s*)?Roll\s+\d{1,3}:/i.test(l));
     for(const [i,r] of g.rollRows.entries()){
      const name=ukiNombreStats(r.proteina),known=['pollo','carne','kanicama','camaron','cerdo','salmon','pulpo','berenjena crispy','vegetariano'];
      const protein=known.includes(name)&&raw.length===n&&!/\+/.test(raw[i].split('/')[0])?name:'desconocida';
      fact.rolls.push({type,protein,count:r.cantidad});
     }
    }
   }
   if(fact.rolls.length>120)fact.rolls=[];
   facts.push(fact);
  }
  if(facts.length>2000)return;
  const payload={store,revision,start:new Date(start).toISOString(),capturedAt:new Date(now).toISOString(),facts};
  if(JSON.stringify(payload).length>400000)return;
  ukiConsumoPending.set(store,{payload,attempts:0});
  await ukiConsumoDrain(store);
 }catch{}
};
