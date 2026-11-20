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
'<button id="romoInvArchivar" class="sm" type="button">Archivar artículo</button></div></div>',
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
 const isRead=action==='articulos'||action==='reportes';
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
  if(action==='articulos'){
   X.romoPlantilla=Array.isArray(dataRomo.plantilla_base)?dataRomo.plantilla_base:[];
   return {items:state.items.filter(v=>!v.archived).map(v=>({
    ...v,category:v.kind,inventory_only:true,version,available:v.available
   }))};}
  return {revisiones:state.movimientos.slice().reverse().map(m=>({
   tipo:m.tipo,sku:m.sku,created_at:new Date(m.fechaMs).toISOString(),
   worker_name:m.actor,summary:{sinMinimo:0,faltantes:[]}
  }))};
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
  '¿Archivar «'+i.name+'» del inventario Romo? Sus movimientos históricos permanecen.':
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
   (r.tipo||'Movimiento')+' · '+(r.sku||'Artículo')+' · '+new Date(r.created_at).toLocaleString('es-CL',{timeZone:'America/Santiago'}):
   (r.worker_name||'Trabajador')+' · '+new Date(r.created_at).toLocaleString('es-CL',{timeZone:'America/Santiago'})+' · '+list.length+' para reponer';d.append(title);
  let p=document.createElement('p');p.className='muted';p.textContent=X.branch==='romo'?
    'Registrado por: '+(r.worker_name||'Cuenta autorizada'):(s.sinMinimo||0)+' sin mínimo configurado';d.append(p);
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
 }catch(e){X.loaded=false;$('invAdmin').hidden=true;$('invNewBox').hidden=true;$('invReportsBox').hidden=true;status(String(e.message||e));}
 finally{X.busy=false;if($('invRefresh'))$('invRefresh').disabled=false;}
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
function mount(){
 if(!$('invRoot'))return;
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