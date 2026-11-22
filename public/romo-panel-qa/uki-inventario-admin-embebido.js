/* Uki Sushi · Administración de inventario dentro del panel operativo. */
(function(){
'use strict';
const API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const U=[['un','Unidades'],['kg','Kilos'],['g','Gramos'],['l','Litros'],['ml','Mililitros'],['porciones','Porciones']];
const C=[['ingrediente','Ingrediente'],['envase','Envase'],['otro','Otro insumo']];
const X={branch:'',items:[],reports:[],selected:'',busy:false,loaded:false,romoRevision:null,romoPlantilla:[]};
const $=id=>document.getElementById(id);
const panelBranch=()=>typeof S!=='undefined'&&S?.suc==='Romo’s Sushi La Serena'?'romo':typeof S!=='undefined'&&S?.suc==='Uki La Serena'?'serena':'arica';
function pick(xs){return xs.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('');}
function number(raw){const t=String(raw??'').trim();if(!/^\d{1,6}([.,]\d{1,3})?$/.test(t))throw Error('Cantidad inválida: máximo 3 decimales (ej.: 2,5).');const n=Number(t.replace(',','.'));if(n>100000)throw Error('Cantidad fuera de rango.');return n;}
function panel(){return [
'<div class="section-head" id="ukiInvSectionHead"><h2>📦 Inventario</h2><p>Existencias, conteos y reposición. No modifica pedidos ni caja.</p></div>',
'<div class="card" id="invRoot" style="padding:14px"><p class="mini-help" style="margin:2px 0 8px">📍 <b id="ukiInvSucursalActual"></b> · para cambiar de sucursal, usa «Salir».</p><select id="invBranch" hidden disabled aria-label="Sucursal de este panel"><option value="arica">Regimiento Arica</option><option value="serena">La Serena</option><option value="romo">Romo La Serena</option></select>',
'<p class="mini-help" style="margin:4px 0 9px">Administración: cuenta Google autorizada del panel. Trabajador: código exclusivo de inventario.</p>',
'<button id="invRefresh" class="sm ok" type="button">↻ Actualizar inventario</button>',
'<p id="invStatus" role="status" class="mini-help" style="margin:9px 0 0">Consultando inventario…</p></div>',
'<div class="card" id="ukiInvWorkerAccess" '+(panelBranch()==='romo'?'hidden ':'')+'style="padding:14px"><h3 style="margin:2px 0 5px;font-size:17px">👷 Inventario del trabajador</h3>',
'<p class="muted" style="margin:5px 0 10px">El trabajador cuenta y recibe mercadería con su código. Sus revisiones se consultan en «Revisiones y compras». No puede ver cierres.</p>',
'<a href="https://uki-sushi-inventario.vercel.app/" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#fff4e8;color:#8c4708;border:1px solid #edbd85;font-weight:700;text-decoration:none">Abrir acceso del trabajador</a></div>',
'<section class="card" id="romoInvWorkerAccess" hidden><h3>👷 Inventario del trabajador · Romo</h3><p class="muted">El mismo acceso de seis números que utiliza inventario Uki, pero configurado exclusivamente para Romo. No abre pedidos, caja ni cierres.</p>'+
'<p id="romoPinInventarioEstado" role="status" class="muted">Verificando configuración…</p>'+
'<div id="romoPinInventarioAlta" hidden><label>Crear PIN de inventario Romo (seis números)</label><input id="romoPinInventarioNuevo" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="••••••"><button class="sm ok" type="button" id="romoPinInventarioCrear">Crear código de Romo</button></div>'+
'<a href="/romo-panel-qa/romo-inventario-trabajador.html" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 15px;border-radius:10px;background:#b32133;color:#fff;font-weight:700;text-decoration:none;margin-top:9px">Abrir inventario del trabajador · Romo</a></section>',
'<div class="card" id="invAdmin" hidden><h2>Existencias y mínimos</h2><label for="invSearch">Buscar artículo</label><input id="invSearch" type="search" autocomplete="off" placeholder="Pollo, palta, aceite…">',
'<label for="invSelect">Artículo</label><select id="invSelect"></select><div id="invEditor" hidden>',
'<label for="invName">Nombre</label><input id="invName" maxlength="100"><label for="invCategory">Categoría</label><select id="invCategory">'+pick(C)+'</select>',
'<label for="invUnit">Unidad</label><select id="invUnit">'+pick(U)+'</select>',
'<div class="quick-grid"><div><label for="invStock">Cantidad actual</label><input id="invStock" inputmode="decimal" autocomplete="off"></div>',
'<div><label for="invMin">Mínimo de reposición</label><input id="invMin" inputmode="decimal" autocomplete="off"></div></div>',
'<p class="muted">Cambiar unidad no convierte las cantidades; escribe las cifras correctas.</p><button id="invSave" class="big" type="button">Guardar cambios</button>'+
'<div id="romoInvOperaciones" hidden><button id="romoInvDisponible" class="sm" type="button">Cambiar disponibilidad</button>'+
'<button id="romoInvArchivar" class="sm" type="button">Eliminar artículo</button></div></div>',
'<p class="mini-help">Disponible/Agotado sigue siendo manual. El stock nunca lo modifica automáticamente.</p></div>',
'<div class="card" id="romoInvBootstrap" hidden><h3>📦 Preparar inventario de Romo</h3>'+
'<p class="muted">Copia solo los nombres y unidades de los artículos existentes en Uki Regimiento Arica. <b>Las cantidades y los mínimos se dejan en cero</b>; ningún movimiento ni dinero de Uki se copia. Aparecerán como no disponibles hasta revisar el stock real.</p>'+
'<details><summary>Revisar lista de artículos antes de copiar</summary><ul id="romoInvPlantillaLista"></ul></details>'+
'<button id="romoInvPlantillaCargar" type="button" class="big">Copiar lista inicial sin existencias</button><p id="romoInvPlantillaEstado" role="status" class="muted"></p></div>',
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
 if(typeof S!=='undefined'&&S?.suc==='Romo’s Sushi La Serena')
  return requestRomo(action,data,branch);
 if(branch!==panelBranch())throw Error('Abre la sucursal correspondiente para consultar su inventario.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Inicia sesión Google en el panel. Solo administración autorizada puede editar inventario.');
 const res=await fetch(API,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({branch,action,...data})});
 const json=await res.json().catch(()=>({}));
 if(!res.ok||!json.ok)throw Error(json.error||'No se pudo consultar el inventario.');
 return json;
}

async function requestRomo(action,data={},branch=X.branch){
 if(branch!=='romo'||S?.suc!=='Romo’s Sushi La Serena')
  throw Error('Romo solo consulta y guarda su propio inventario.');
 const token=await window.ukiInventarioToken?.();
 if(typeof token!=='string'||token.length<30)
  throw Error('Inicia sesión con la cuenta Google autorizada de Romo.');
 const revision=X.romoRevision;
 const isRead=action==='articulos'||action==='reportes'||action==='inventario-completo';
 let body=null;
 if(!isRead){
  if(!Number.isSafeInteger(revision)||revision<0)
   throw Error('Primero actualiza el inventario de Romo.');
  const item=data.item;
  if(action==='crear-articulo'){
   const sku='r_'+globalThis.crypto.randomUUID().replace(/-/g,'');
   body={action:'alta',expectedRevision:revision,
    args:{sku,name:item.name,kind:item.category,stock_unit:item.stock_unit,
     stock_qty:item.stock_qty,min_stock_qty:item.min_stock_qty,available:true}};
  }else if(action==='editar-articulo'){
   const v=X.items.find(x=>x.sku===data.sku);
   if(!v||v.version!==revision)throw Error('Ficha desactualizada; vuelve a cargar.');
   body={action:'editar_completo',expectedRevision:revision,
    args:{sku:v.sku,name:item.name,kind:item.category,stock_unit:item.stock_unit,
     stock_qty:item.stock_qty,min_stock_qty:item.min_stock_qty}};
  }else if(action==='importar-base'){
   body={action:'importar_base',expectedRevision:revision,args:{source:'uki_arica_nombres'}};
  }else if(action==='romo-archivar'){
   body={action:'archivar',expectedRevision:revision,args:{sku:data.sku}};
  }else if(action==='romo-disponibilidad'){
   body={action:'disponibilidad',expectedRevision:revision,
    args:{sku:data.sku,available:data.available}};
  }else throw Error('Operación de inventario no autorizada para Romo.');
 }
 const response=await fetch('/api/romo-inventario-qa',{
  method:isRead?'GET':'POST',credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+token,...(isRead?{}:{'Content-Type':'application/json'})},
  ...(isRead?{}:{body:JSON.stringify(body)})
 });
 const dataRomo=await response.json().catch(()=>null);
 if(!response.ok||dataRomo?.ok!==true||dataRomo.storeId!=='romo:serena'){
  if(response.status===409)throw Error('Inventario modificado en otro teléfono. Actualiza antes de guardar.');
  throw Error(typeof dataRomo?.error==='string'?dataRomo.error:'No se confirmó la operación de inventario Romo (HTTP '+response.status+').');
 }
 if(isRead){
  const version=Number(dataRomo.revision),state=dataRomo.contenido;
  if(!Number.isSafeInteger(version)||version<0||state?.version!==1||
     !Array.isArray(state.items)||!Array.isArray(state.movimientos))
   throw Error('La respuesta de inventario no corresponde a Romo.');
  X.romoRevision=version;
  const items=state.items.filter(v=>!v.archived).map(v=>({...v,category:v.kind,inventory_only:true,version,available:v.available}));
  const porSku=new Map(state.items.map(v=>[v.sku,v]));
  const revisiones=state.movimientos.slice().reverse().map(m=>({
   tipo:m.tipo,sku:m.sku,nombre:m.despues?.name||m.antes?.name||porSku.get(m.sku)?.name||'',
   antes:m.antes??null,despues:m.despues??null,
   created_at:new Date(m.fechaMs).toISOString(),worker_name:m.worker_name||m.actor,summary:{sinMinimo:0,faltantes:[]}}));
  X.romoPlantilla=Array.isArray(dataRomo.plantilla_base)?dataRomo.plantilla_base:[];
  return {items,revisiones};
 }
 if(Number(dataRomo.revision)!==revision+1)
  throw Error('No se confirmó la revisión. Actualiza antes de reintentar.');
 X.romoRevision=dataRomo.revision;
 return dataRomo;
}
async function romoArticuloOperacion(action){
 const i=X.items.find(x=>x.sku===X.selected);
 if(!i||X.busy)return;
 const isArchive=action==='romo-archivar';
 if(!window.confirm(isArchive?
  '¿Eliminar «'+i.name+'» de la lista activa del inventario Romo? Sus movimientos históricos permanecen.':
  '¿Confirmas que «'+i.name+'» estará '+(i.available?'NO disponible':'disponible')+' en Romo?'))return;
 X.busy=true;status('Guardando exclusivamente en Romo…');
 try{
  await requestRomo(action,{sku:i.sku,available:!i.available});
  X.busy=false;
  await load();
  status('✓ Movimiento confirmado en inventario de Romo.');
 }catch(e){status('No se confirmó. Comprueba antes de repetir: '+String(e.message||e));}
 finally{X.busy=false}
}

function selection(){
 const item=X.items.find(v=>v.sku===X.selected);$('invEditor').hidden=!item;if(!item)return;
 $('invName').value=item.name;$('invName').disabled=!item.inventory_only;
 const romoOps=$('romoInvOperaciones');
 if(romoOps)romoOps.hidden=X.branch!=='romo';
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
  title.textContent=X.branch==='romo'?
   ({alta:'Artículo agregado',editar_completo:'Artículo editado',editar:'Edición',archivar:'Artículo eliminado',conteo:'Conteo',entrada:'Entrada',disponibilidad:'Disponibilidad',revision:'Revisión',importar_base:'Lista inicial'}[r.tipo]||r.tipo||'Movimiento')+' · '+(r.nombre||r.sku||'Inventario')+' · '+new Date(r.created_at).toLocaleString('es-CL',{timeZone:'America/Santiago'}):
   (r.worker_name||'Trabajador')+' · '+new Date(r.created_at).toLocaleString('es-CL',{timeZone:'America/Santiago'})+' · '+list.length+' para reponer';d.append(title);
  let p=document.createElement('p');p.className='muted';p.textContent=X.branch==='romo'?
    'Registrado por: '+(r.worker_name||'Cuenta autorizada'):(s.sinMinimo||0)+' sin mínimo configurado';d.append(p);
  if(X.branch==='romo'){
   const antes=r.antes,despues=r.despues;
   const cantidad=v=>v&&Number.isFinite(Number(v.stock_qty))?String(v.stock_qty)+' '+String(v.stock_unit||''):'—';
   if(antes||despues){
    const detalle=document.createElement('p');
    detalle.textContent='Existencia anterior: '+cantidad(antes)+' · Existencia posterior: '+cantidad(despues);
    d.append(detalle);
    if(antes&&despues&&antes.available!==despues.available){
     const disponibilidad=document.createElement('p');disponibilidad.textContent='Disponibilidad: '+(despues.available?'Disponible':'No disponible');d.append(disponibilidad);
    }
   }
  }
  for(const f of list){p=document.createElement('p');p.textContent=f.nombre+' · comprar '+(f.llevar===0?'al llegar al mínimo':f.llevar+' '+f.unidad);d.append(p);}
  target.append(d);
 }
}
async function load(){
 if(X.busy||!$('invRoot'))return;X.busy=true;$('invRefresh').disabled=true;
 const branch=X.branch,root=$('invRoot');status('Consultando inventario…');
 try{
  const snapshot=branch==='romo'?await request('inventario-completo',{},branch):null;
  const [a,r]=snapshot?[snapshot,snapshot]:await Promise.all([request('articulos',{},branch),request('reportes',{},branch)]);
  if(branch!==X.branch||branch!==panelBranch()||root!==$('invRoot'))return;
  X.items=a.items||[];X.reports=r.revisiones||[];X.loaded=true;
  const box=$('romoInvBootstrap');
  if(box){
   box.hidden=branch!=='romo'||X.items.length!==0||!X.romoPlantilla.length;
   if(!box.hidden){
    const list=$('romoInvPlantillaLista');
    list.replaceChildren(...X.romoPlantilla.map(item=>{
     const li=document.createElement('li');li.textContent=item.name+' · '+item.unit;return li;
    }));
   }
  }
  if(branch==='romo'&&$('invReportsBox'))$('invReportsBox').querySelector('h2').textContent='Historial de movimientos · Romo';
  $('invAdmin').hidden=false;$('invNewBox').hidden=false;$('invReportsBox').hidden=false;
  populate();reports();status('✓ '+X.items.length+' artículos · '+X.reports.length+' revisiones consultadas.');
  // Solo lectura de los faltantes de la MISMA sucursal Romo. No copia
  // existencias de Uki ni escribe datos; refresca el panel al terminar.
  if(branch==='romo')window.romoActualizarFaltantesQA?.();
 }catch(e){if(root===$('invRoot')&&branch===panelBranch()){X.loaded=false;$('invAdmin').hidden=true;$('invNewBox').hidden=true;$('invReportsBox').hidden=true;status(String(e.message||e));}}
 finally{X.busy=false;if($('invRefresh'))$('invRefresh').disabled=false;if($('invRoot')&&root!==$('invRoot')&&!X.loaded)void load();}
}
async function save(){
 const i=X.items.find(x=>x.sku===X.selected);if(!i||X.busy)return;let params;
 try{
  const stock_unit=$('invUnit').value,stock_qty=number($('invStock').value),min_stock_qty=number($('invMin').value);
  if(stock_unit!==i.stock_unit&&!confirm('¿Confirmas que estas cantidades corresponden a '+stock_unit+'? No se convierten automáticamente.'))return;
  params={sku:i.sku,expected_version:i.version};
  if(X.branch==='romo'&&!confirm('¿Confirmas que las cantidades y datos corresponden al inventario de Romo?'))return;
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
async function romoInicializarInventarioPlantilla(){
 const button=$('romoInvPlantillaCargar'),output=$('romoInvPlantillaEstado');
 if(X.branch!=='romo'||X.busy||X.items.length||!X.romoPlantilla.length)return;
 if(!window.confirm('¿Copiar '+X.romoPlantilla.length+
  ' nombres y unidades desde Uki Regimiento Arica? Romo empezará con cantidades y mínimos en 0 y sin productos disponibles. No se copiarán existencias ni movimientos.'))return;
 X.busy=true;button.disabled=true;output.textContent='Preparando artículos solo para Romo…';
 try{
  const result=await requestRomo('importar-base');
  if(result.change?.tipo!=='importar_base')throw Error('La importación no fue confirmada; revisa antes de repetir.');
  X.busy=false;await load();
  status('✓ Lista base creada para Romo. Ahora revisa existencias y mínimos con el trabajador.');
 }catch(e){output.textContent='No se confirmó la importación: '+String(e.message||e)}
 finally{X.busy=false;if(button.isConnected)button.disabled=false}
}
async function romoPinInventarioGestion(action,code){
 const token=await window.ukiInventarioToken?.();
 if(typeof token!=='string'||token.length<30)throw Error('Inicia sesión Google como dueño de Romo.');
 const response=await fetch('/api/romo-pin-inventario-qa',{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(action==='estado'?{action}:{action,codigo:code})
 });
 const value=await response.json().catch(()=>null);
 if(!response.ok||value?.ok!==true||value?.storeId!=='romo:serena')
  throw Error(typeof value?.error==='string'?value.error:'No fue posible confirmar el código de Romo (HTTP '+response.status+').');
 return value;
}
async function romoPinInventarioCargar(){
 const output=$('romoPinInventarioEstado'),alta=$('romoPinInventarioAlta');
 if(!output||X.branch!=='romo')return;
 output.textContent='Consultando acceso de inventario Romo…';
 try{const v=await romoPinInventarioGestion('estado');
  output.textContent=v.configurado?'PIN de inventario Romo configurado.':'Todavía no hay PIN de inventario Romo.';
  alta.hidden=!!v.configurado;
 }catch(e){output.textContent=String(e?.message||e);alta.hidden=true}
}
async function romoPinInventarioCrear(){
 const field=$('romoPinInventarioNuevo'),button=$('romoPinInventarioCrear');
 if(!/^\d{6}$/.test(field?.value||'')){alert('El PIN debe tener exactamente seis números.');return}
 if(!window.confirm('¿Crear este PIN exclusivo para los trabajadores de inventario Romo? No se podrá sobrescribir desde este formulario.'))return;
 button.disabled=true;
 try{await romoPinInventarioGestion('crear-codigo',field.value);
  field.value='';await romoPinInventarioCargar();
 }catch(e){alert(String(e?.message||e));}
 finally{button.disabled=false}
}
let mountedRoot=null;

// Costos privados: solo lectura y cambios de precio, nunca modifica stock.
function mountCosteo(){
 const root=$('invRoot');if(!root||$('invCosteo'))return;
 const active=X.branch;
 const isRomo=active==='romo';
 const store=isRomo?'romo:serena':'uki:'+active;
 const api=isRomo?'/api/romo-costeo-v1':'https://uki-sushi-inventario.vercel.app/api/uki-costeo-v1';
 const card=document.createElement('details');card.className='card';card.id='invCosteo';
 card.innerHTML='<summary><b>💰 Precios de compra y costos · Administración</b></summary><p class="muted">Registra el precio de una cantidad comprada. No cambia existencias ni precios de venta.</p><button type="button" class="sm" id="invCostLoad">Consultar costos</button><p role="status" id="invCostStatus" class="mini-help">Consulta con Google autorizado.</p><div id="invCostFields" hidden><label for="invCostItem">Ingrediente o insumo</label><select id="invCostItem"></select><label for="invCostUnit">Unidad de compra</label><select id="invCostUnit"></select><label for="invCostQty">Cantidad comprada</label><input id="invCostQty" inputmode="decimal"><label for="invCostPrice">Precio total en pesos</label><input id="invCostPrice" inputmode="numeric"><p id="invCostResult" class="mini-help"></p><button type="button" class="big" id="invCostSave">Guardar precio de compra</button></div>';
 root.after(card);
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
 function preview(){const n=numeric(el('invCostQty').value),p=numeric(el('invCostPrice').value),unit=el('invCostUnit').value;el('invCostResult').textContent=n>0&&Number.isSafeInteger(p)&&p>0?'Costo por '+unit+': 
 const root=$('invRoot');if(!root||root===mountedRoot)return;mountedRoot=root;
 const active=panelBranch();
 if(X.branch!==active){X.items=[];X.reports=[];X.selected='';X.loaded=false;X.romoRevision=null;X.romoPlantilla=[];}
 X.branch=active;
 mountCosteo();
 $('invBranch').value=active;
 $('invBranch').disabled=true;
 $('ukiInvSucursalActual').textContent=active==='romo'?'Romo’s Sushi La Serena':
  active==='serena'?'Uki La Serena':'Uki Regimiento Arica';
 if($('ukiInvWorkerAccess'))$('ukiInvWorkerAccess').hidden=active==='romo';
 if($('romoInvWorkerAccess'))$('romoInvWorkerAccess').hidden=active!=='romo';
 if(active==='romo'){
  $('romoPinInventarioCrear').onclick=()=>void romoPinInventarioCrear();
  void romoPinInventarioCargar();
 }
 $('invRefresh').onclick=()=>void load();$('invSearch').oninput=populate;
 if($('romoInvPlantillaCargar'))$('romoInvPlantillaCargar').onclick=()=>void romoInicializarInventarioPlantilla();
 $('invSelect').onchange=e=>{X.selected=e.target.value;selection();};
 $('invSave').onclick=()=>void save();$('invCreate').onclick=()=>void create();
 if($('romoInvDisponible'))$('romoInvDisponible').onclick=()=>void romoArticuloOperacion('romo-disponibilidad');
 if($('romoInvArchivar'))$('romoInvArchivar').onclick=()=>void romoArticuloOperacion('romo-archivar');
 if(X.loaded){$('invAdmin').hidden=false;$('invNewBox').hidden=false;$('invReportsBox').hidden=false;populate();reports();status('Inventario listo.');}
 else void load();
}
// Lectura local, sin token nuevo ni acceso a otras sucursales.
window.romoInventarioFaltantesSoloLecturaQA=function(){
 if(X.branch!=='romo'||S?.suc!=='Romo’s Sushi La Serena'||!X.loaded)return null;
 return Object.freeze({storeId:'romo:serena',revision:X.romoRevision,
   items:X.items.filter(v=>v.archived!==true).map(v=>Object.freeze({
     sku:String(v.sku),name:String(v.name),stock_unit:String(v.stock_unit||'un'),
     stock_qty:Number(v.stock_qty)||0,min_stock_qty:Number(v.min_stock_qty)||0
   }))});
};
window.ukiInventarioPanelHTML=panel;window.ukiInventarioMontar=mount;
})();+(p/n).toLocaleString('es-CL',{maximumFractionDigits:4}):'Completa cantidad y precio.';}
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
  re('invRecipeEstimate').textContent=r?.cost!=null?'Costo estimado de la receta: 
}

function mount(){
 const root=$('invRoot');if(!root||root===mountedRoot)return;mountedRoot=root;
 const active=panelBranch();
 if(X.branch!==active){X.items=[];X.reports=[];X.selected='';X.loaded=false;X.romoRevision=null;X.romoPlantilla=[];}
 X.branch=active;
 $('invBranch').value=active;
 $('invBranch').disabled=true;
 $('ukiInvSucursalActual').textContent=active==='romo'?'Romo’s Sushi La Serena':
  active==='serena'?'Uki La Serena':'Uki Regimiento Arica';
 if($('ukiInvWorkerAccess'))$('ukiInvWorkerAccess').hidden=active==='romo';
 if($('romoInvWorkerAccess'))$('romoInvWorkerAccess').hidden=active!=='romo';
 if(active==='romo'){
  $('romoPinInventarioCrear').onclick=()=>void romoPinInventarioCrear();
  void romoPinInventarioCargar();
 }
 $('invRefresh').onclick=()=>void load();$('invSearch').oninput=populate;
 if($('romoInvPlantillaCargar'))$('romoInvPlantillaCargar').onclick=()=>void romoInicializarInventarioPlantilla();
 $('invSelect').onchange=e=>{X.selected=e.target.value;selection();};
 $('invSave').onclick=()=>void save();$('invCreate').onclick=()=>void create();
 if($('romoInvDisponible'))$('romoInvDisponible').onclick=()=>void romoArticuloOperacion('romo-disponibilidad');
 if($('romoInvArchivar'))$('romoInvArchivar').onclick=()=>void romoArticuloOperacion('romo-archivar');
 if(X.loaded){$('invAdmin').hidden=false;$('invNewBox').hidden=false;$('invReportsBox').hidden=false;populate();reports();status('Inventario listo.');}
 else void load();
}
// Lectura local, sin token nuevo ni acceso a otras sucursales.
window.romoInventarioFaltantesSoloLecturaQA=function(){
 if(X.branch!=='romo'||S?.suc!=='Romo’s Sushi La Serena'||!X.loaded)return null;
 return Object.freeze({storeId:'romo:serena',revision:X.romoRevision,
   items:X.items.filter(v=>v.archived!==true).map(v=>Object.freeze({
     sku:String(v.sku),name:String(v.name),stock_unit:String(v.stock_unit||'un'),
     stock_qty:Number(v.stock_qty)||0,min_stock_qty:Number(v.min_stock_qty)||0
   }))});
};
window.ukiInventarioPanelHTML=panel;window.ukiInventarioMontar=mount;
})();+Number(r.cost).toLocaleString('es-CL')+' · '+(r.confirmed?'Confirmada':'Borrador'):'Costo pendiente de ingredientes, precios o configuración.';
  rs(r?'Receta existente. Cualquier edición queda como borrador.':'Nueva variante de receta.');
 }
 async function loadRecipes(){
  if(recipeBusy)return;recipeLock(true);rs('Consultando productos e ingredientes…');
  try{const [catalog,inventory]=await Promise.all([call('listar-recetas'),call('listar')]);recipeProducts=catalog.products||[];recipes=catalog.recipes||[];recipeItems=(inventory.items||[]).filter(i=>groups[i.stock_unit]);const field=re('invRecipeProduct'),prev=field.value;field.replaceChildren();for(const p of recipeProducts)opt(field,p.sku,p.name);if(recipeProducts.some(p=>p.sku===prev))field.value=prev;re('invRecipeFields').hidden=!recipeProducts.length;if(recipeProducts.length){variants();openRecipe();}else rs('No hay productos registrados en la carta.');}
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


}

function mount(){
 const root=$('invRoot');if(!root||root===mountedRoot)return;mountedRoot=root;
 const active=panelBranch();
 if(X.branch!==active){X.items=[];X.reports=[];X.selected='';X.loaded=false;X.romoRevision=null;X.romoPlantilla=[];}
 X.branch=active;
 $('invBranch').value=active;
 $('invBranch').disabled=true;
 $('ukiInvSucursalActual').textContent=active==='romo'?'Romo’s Sushi La Serena':
  active==='serena'?'Uki La Serena':'Uki Regimiento Arica';
 if($('ukiInvWorkerAccess'))$('ukiInvWorkerAccess').hidden=active==='romo';
 if($('romoInvWorkerAccess'))$('romoInvWorkerAccess').hidden=active!=='romo';
 if(active==='romo'){
  $('romoPinInventarioCrear').onclick=()=>void romoPinInventarioCrear();
  void romoPinInventarioCargar();
 }
 $('invRefresh').onclick=()=>void load();$('invSearch').oninput=populate;
 if($('romoInvPlantillaCargar'))$('romoInvPlantillaCargar').onclick=()=>void romoInicializarInventarioPlantilla();
 $('invSelect').onchange=e=>{X.selected=e.target.value;selection();};
 $('invSave').onclick=()=>void save();$('invCreate').onclick=()=>void create();
 if($('romoInvDisponible'))$('romoInvDisponible').onclick=()=>void romoArticuloOperacion('romo-disponibilidad');
 if($('romoInvArchivar'))$('romoInvArchivar').onclick=()=>void romoArticuloOperacion('romo-archivar');
 if(X.loaded){$('invAdmin').hidden=false;$('invNewBox').hidden=false;$('invReportsBox').hidden=false;populate();reports();status('Inventario listo.');}
 else void load();
}
// Lectura local, sin token nuevo ni acceso a otras sucursales.
window.romoInventarioFaltantesSoloLecturaQA=function(){
 if(X.branch!=='romo'||S?.suc!=='Romo’s Sushi La Serena'||!X.loaded)return null;
 return Object.freeze({storeId:'romo:serena',revision:X.romoRevision,
   items:X.items.filter(v=>v.archived!==true).map(v=>Object.freeze({
     sku:String(v.sku),name:String(v.name),stock_unit:String(v.stock_unit||'un'),
     stock_qty:Number(v.stock_qty)||0,min_stock_qty:Number(v.min_stock_qty)||0
   }))});
};
window.ukiInventarioPanelHTML=panel;window.ukiInventarioMontar=mount;
})();