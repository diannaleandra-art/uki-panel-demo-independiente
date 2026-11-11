/* Uki Sushi · Lista compacta e historial de inventarios; sólo dentro del panel actual. */
(function(){
'use strict';
const oldHTML=window.ukiInventarioPanelHTML,oldMount=window.ukiInventarioMontar;
if(typeof oldHTML!=='function'||typeof oldMount!=='function')return;
const API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const x={branch:'',items:[],loaded:false,loadedAt:null,limit:12,filter:'todos',query:'',editor:false,
 history:[],historyLoaded:false,historyOffset:0,historyTotal:0,busyHistory:false,
 selected:null,detailLimit:15,detailQuery:'',detailFilter:'todos'};
const $=id=>document.getElementById(id),exports=()=>window.ukiInventarioExportar;
const fmt=n=>Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:3});
const button=(caption,fn)=>{const el=document.createElement('button');el.type='button';el.className='sm';el.textContent=caption;el.onclick=fn;return el;};
const panel=[
'<style>',
'.uki-mini-list{display:grid;gap:7px;margin:10px 0}',
'.uki-mini-item{display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap;',
'padding:10px 12px;background:#fff;border:1px solid #e9dacd;border-radius:12px}',
'.uki-mini-info{flex:1 1 155px;min-width:0}',
'.uki-mini-info strong{display:block;font-size:14px;word-break:break-word}',
'.uki-mini-info small{display:block;font-size:12px;color:#766252;margin-top:4px}',
'.uki-mini-action{display:flex;flex-wrap:wrap;gap:7px;margin:11px 0}',
'.uki-mini-action button{min-height:42px;font-weight:750}',
'.uki-mini-item[data-estado="reponer"]{background:#fff7e7;border-color:#e9bb7e;border-left:5px solid #d88425}',
'.uki-mini-item[data-estado="bien"]{background:#f5fcf7;border-color:#c5e2ce;border-left:5px solid #6da37c}',
'.uki-mini-item[data-estado="sinminimo"]{background:#faf8f5;border-color:#ddd4cb;border-left:5px solid #a49b93}',
'.uki-mini-badge{display:inline-block;padding:6px 10px;border-radius:99px;font-weight:800;font-size:12px;white-space:nowrap}',
'.uki-mini-badge.reponer{background:#f9e0bb;color:#89520c}',
'.uki-mini-badge.bien{background:#d9f2e0;color:#2a7345}',
'.uki-mini-badge.sinminimo{background:#ebe6e0;color:#6d6259}',
'.uki-mini-resumen{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}',
'.uki-mini-resumen-item{border:1px solid #e0d3c9;border-radius:12px;padding:10px 7px;background:#fffaf6}',
'.uki-mini-resumen-item strong{display:block;font-size:19px;font-variant-numeric:tabular-nums}',
'.uki-mini-resumen-item small{display:block;font-size:12px;line-height:1.35;color:#6d5b4f}',
'.uki-mini-resumen-item.reponer{background:#fff2df;border-color:#e8c491;color:#995b15}',
'.uki-mini-resumen-item.bien{background:#f1faef;border-color:#c5dfbb;color:#407a44}',
'.uki-mini-resumen-item.sinminimo{background:#f3f0ed;border-color:#d8cfc7;color:#766356}',
'.uki-mini-manual{margin:14px 0;border:1.5px solid #e4bd91;border-radius:14px;background:#fffcf8;padding:10px 12px}',
'.uki-mini-manual summary{cursor:pointer;font-size:16px;font-weight:750;color:#824312;padding:7px 2px}',
'.uki-mini-manual h3{font-size:15px;margin:16px 0 7px;color:#59391c}',
'.uki-mini-manual p,.uki-mini-manual li{font-size:14px;line-height:1.6;color:#594c42}',
'.uki-mini-manual ol{margin:8px 0;padding-left:22px}',
'.uki-mini-manual li{padding:2px 0}',
'.uki-mini-manual .mini-nota{border-top:1px solid #eadacd;padding-top:10px;margin-top:12px}',

'.uki-mini-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
'.uki-mini-fields input,.uki-mini-fields select{min-width:0;width:100%;padding:10px}',
'@media(max-width:550px){.uki-mini-fields{grid-template-columns:1fr}}',
'</style>',
'<section class="card" id="ukiMiniInventario" hidden>',
'<h2>📦 Inventario · Lista rápida</h2>',
'<p class="muted">Busca un artículo y abre sólo el que necesites. Las cantidades no marcan productos como agotados automáticamente.</p>',
'<details class="uki-mini-manual" id="ukiManualInventario">',
'<summary>📖 ¿Cómo usar el inventario? · Manual rápido</summary>',
'<h3>👩‍💼 Administración (panel normal)</h3>',
'<ol>',
'<li>Revisa que arriba figure tu sucursal. El inventario de Regimiento Arica y La Serena es independiente.</li>',
'<li>En «Lista rápida», busca un artículo. «Bien» significa que supera el mínimo, «Reponer» que está en el mínimo o por debajo y «Sin mínimo» que aún no tiene una cantidad de referencia.</li>',
'<li>Toca «Editar» para corregir la cantidad actual, su unidad o el mínimo de reposición. Guardar la cantidad actual la establece directamente; no suma una entrada.</li>',
'<li>Usa «Agregar insumo al inventario» solo para nuevos artículos de inventario. No los agrega a la carta de clientes.</li>',
'<li>En «Revisiones y compras» puedes consultar faltantes e inventarios guardados por fecha y trabajador. PDF, Excel (.csv) y WhatsApp sirven para compartir reportes.</li>',
'</ol>',
'<h3>👷 Trabajadores (acceso con código)</h3>',
'<ol>',
'<li>Abre «Inventario del trabajador», elige sucursal e ingresa tu nombre y código de seis dígitos.</li>',
'<li>«Guardar conteo» reemplaza el saldo anterior por lo que realmente queda: si marca 10 kg y cuentas 6 kg, guarda 6 kg.</li>',
'<li>«Registrar entrada» suma solamente lo recibido: si quedan 6 kg y llegan 4 kg, el saldo pasa a 10 kg.</li>',
'<li>Al finalizar, guarda la revisión del turno y, si corresponde, comparte por WhatsApp. Revisa los artículos pendientes de contar antes de finalizar.</li>',
'</ol>',
'<h3>📷 Recibir mercadería con factura</h3>',
'<ol>',
'<li>Toma foto o sube PDF/XML. Revisa o ingresa manualmente los productos si la lectura no los identifica bien.</li>',
'<li>Confirma RUT del proveedor, folio y tipo de documento: se comparan con recepciones anteriores.</li>',
'<li>Relaciona cada línea con el artículo correcto. Si no existe, prepáralo en inventario con saldo inicial cero.</li>',
'<li>Indica cuánto llegó realmente y confirma la entrada una sola vez. Si llegó una entrega parcial, registra solo esa parte; la entrega posterior se revisa por separado.</li>',
'</ol>',
'<p class="mini-nota"><strong>Importante:</strong> contar reemplaza; recibir suma. No registres la misma mercadería por factura y además como entrada manual.</p>',
'<p><strong>Factura y gasto no son lo mismo:</strong> el inventario controla kilos y unidades; «Mi Administración» controla los importes pagados o pendientes.</p>',
'<p><strong>Carta:</strong> Disponible/Agotado se cambia manualmente y no depende de los kilos en inventario.</p>',
'<p><strong>Si la recepción con Google aún no abre:</strong> utiliza «Abrir acceso del trabajador» con el código de inventario y no repitas la entrada cuando el sistema se actualice.</p>',
'</details>',
'<div class="uki-mini-fields">',
'<div><label for="ukiMiniBuscar">Buscar artículo</label><input id="ukiMiniBuscar" type="search" placeholder="Pollo, palta, aceite…"></div>',
'<div><label for="ukiMiniFiltro">Mostrar</label><select id="ukiMiniFiltro">',
'<option value="todos">Todos</option><option value="reponer">Para reponer</option>',
'<option value="bien">Con existencias suficientes</option><option value="sinminimo">Sin mínimo configurado</option>',
'</select></div></div>',
'<p id="ukiMiniEstado" role="status" class="muted">Consultando…</p>',
'<div id="ukiMiniResumen" class="uki-mini-resumen" aria-label="Resumen visual de existencias"></div>',
'<div class="uki-mini-action"><button type="button" id="ukiMiniActualizar" class="sm">Actualizar lista</button>',
'<button type="button" id="ukiMiniExcel" class="sm">Excel (.csv)</button>',
'<button type="button" id="ukiMiniPDF" class="sm">PDF</button>',
'<button type="button" id="ukiMiniCompartir" class="sm">Compartir WhatsApp</button></div>',
'<div id="ukiMiniFilas" class="uki-mini-list"></div>',
'<button type="button" id="ukiMiniMas" class="sm" hidden>Mostrar 12 más</button>',
'</section>',
'<section class="card" id="ukiHistorial" hidden>',
'<h2>🗓️ Historial de inventarios</h2>',
'<p class="muted">Cada revisión conserva el conteo que se guardó, el responsable, la sucursal, el día, la fecha y la hora de Chile.</p>',
'<div class="uki-mini-fields">',
'<div><label for="ukiHistoriaDesde">Fecha desde</label><input id="ukiHistoriaDesde" type="date"></div>',
'<div><label for="ukiHistoriaHasta">Fecha hasta</label><input id="ukiHistoriaHasta" type="date"></div>',
'<div><label for="ukiHistoriaNombre">Trabajador (opcional)</label><input id="ukiHistoriaNombre" maxlength="60" type="search" placeholder="Nombre"></div>',
'</div>',
'<div class="uki-mini-action"><button id="ukiHistoriaBuscar" type="button" class="sm">Buscar inventarios</button>',
'<button id="ukiHistoriaLimpiar" type="button" class="sm">Quitar filtros</button></div>',
'<p id="ukiHistoriaEstado" role="status" class="muted">Selecciona tu sucursal para consultar.</p>',
'<div id="ukiHistoriaLista" class="uki-mini-list"></div>',
'<div class="uki-mini-action">',
'<button id="ukiHistoriaAnterior" type="button" class="sm" disabled>Anterior</button>',
'<button id="ukiHistoriaSiguiente" type="button" class="sm" disabled>Siguiente</button></div>',
'<div id="ukiHistorialDetalle" hidden>',
'<hr><h3>Inventario guardado</h3><p id="ukiHistorialFecha" class="muted"></p>',
'<div class="uki-mini-action"><button id="ukiDetalleExcel" type="button" class="sm">Excel (.csv)</button>',
'<button id="ukiDetallePDF" type="button" class="sm">Descargar PDF</button>',
'<button id="ukiDetalleCompartir" type="button" class="sm">Compartir WhatsApp</button></div>',
'<div class="uki-mini-fields">',
'<div><label for="ukiDetalleBuscar">Buscar artículo</label><input id="ukiDetalleBuscar" type="search" placeholder="Nombre"></div>',
'<div><label for="ukiDetalleFiltro">Estado</label><select id="ukiDetalleFiltro">',
'<option value="todos">Todos</option><option value="reponer">Para reponer</option>',
'<option value="bien">Suficientes</option><option value="sinminimo">Sin mínimo</option>',
'</select></div></div>',
'<div id="ukiDetalleResumen" class="uki-mini-resumen" aria-label="Resumen de la revisión guardada"></div>',
'<p id="ukiDetalleEstado" role="status" class="muted"></p><div id="ukiDetalleLista" class="uki-mini-list"></div>',
'<button id="ukiDetalleMas" type="button" class="sm" hidden>Mostrar 15 más</button>',
'</div></section>'
].join('');
window.ukiInventarioPanelHTML=()=>oldHTML()+panel;
const sucursal=()=>String($('invBranch')?.value||'arica');
const status=(id,s)=>{if($(id))$(id).textContent=s;};
const filtro=item=>{
 const min=Number(item.min_stock_qty)||0,qty=Number(item.stock_qty)||0;
 return min<=0?'sinminimo':qty<=min?'reponer':'bien';
};
const nombreNormal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const nombreSucursal=b=>exports().branchName(b);
async function request(action,payload={},b=sucursal()){
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Inicia sesión Google en el panel para consultar.');
 const r=await fetch(API,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({branch:b,action,...payload})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok)throw Error(data.error||'No se pudo consultar la información.');
 return data;
}
function fila(item,action=null){
 const row=document.createElement('div');row.className='uki-mini-item';
 const left=document.createElement('div');left.className='uki-mini-info';
 const title=document.createElement('strong');title.textContent=item.name;
 const desc=document.createElement('small');const min=Number(item.min_stock_qty)||0;
 desc.textContent='Quedan '+fmt(item.stock_qty)+' '+(item.stock_unit||'un')+
  ' · '+(min>0?'mínimo '+fmt(min)+' '+(item.stock_unit||'un'):'mínimo sin configurar');
 left.append(title,desc);
 const badge=document.createElement('small');
 badge.textContent=filtro(item)==='reponer'?'Reponer':filtro(item)==='bien'?'Bien':'Sin mínimo';
 badge.style.cssText='font-weight:700;color:#855526';
 row.append(left,badge);
 if(action)row.append(button(action.text,action.click));
 return row;
}
function renderCurrent(){
 const area=$('ukiMiniFilas');if(!area)return;area.replaceChildren();
 const found=x.items.filter(i=>(x.filter==='todos'||filtro(i)===x.filter)&&
  (!x.query||nombreNormal(i.name).includes(nombreNormal(x.query))))
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
 for(const item of found.slice(0,x.limit))area.append(fila(item,{text:'Editar',click:()=>edit(item.sku)}));
 if(!found.length)area.textContent='No se encontraron artículos.';
 $('ukiMiniMas').hidden=found.length<=x.limit;
 const missing=x.items.filter(i=>filtro(i)==='reponer').length;
 status('ukiMiniEstado',found.length+' artículos encontrados · '+missing+
  ' para reponer · mostrando '+Math.min(found.length,x.limit)+' de '+x.items.length+' del inventario.');
}
async function loadCurrent(){
 const b=sucursal();status('ukiMiniEstado','Cargando inventario de '+nombreSucursal(b)+'…');
 try{
  const data=await request('articulos',{},b);
  if(b!==sucursal())return;
  x.items=Array.isArray(data.items)?data.items:[];x.loaded=true;x.loadedAt=new Date().toISOString();renderCurrent();
 }catch(e){x.loaded=false;x.loadedAt=null;x.items=[];status('ukiMiniEstado','Error: '+String(e.message||e));$('ukiMiniFilas').replaceChildren();}
}
function edit(sku){
 const area=$('invAdmin'),sel=$('invSelect'),search=$('invSearch');
 if(!area||!sel||!search)return;
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
 if(![...sel.options].some(o=>o.value===sku)){
  status('ukiMiniEstado','Actualiza los artículos antes de editar.');return;
 }
 x.editor=true;area.style.display='';
 sel.value=sku;sel.dispatchEvent(new Event('change',{bubbles:true}));
 area.scrollIntoView({behavior:'smooth',block:'start'});
}
function currentSnapshot(){
 if(!x.loaded)throw Error('Primero carga el inventario actual.');
 return {branch:sucursal(),created_at:x.loadedAt,
  worker_name:'Consulta de administración (estado actual)',items:x.items};
}
async function exportar(tipo,report,output){
 try{
  if(!report)throw Error('Elige primero una revisión.');
  if(tipo==='excel')exports().excel(report);
  if(tipo==='pdf')exports().guardarPDF(report);
  if(tipo==='whatsapp'){
   const result=await exports().whatsapp(report);
   status(output,result==='texto'?'Se abrió WhatsApp con el resumen; descarga el PDF si necesitas adjuntarlo.':
    result==='archivo'?'Elige WhatsApp para compartir el PDF.':'Compartir cancelado.');
   return;
  }
  status(output,'Archivo preparado. Revisa las descargas del teléfono.');
 }catch(e){status(output,'No fue posible exportar: '+String(e.message||e));}
}
function tab(){return document.querySelector('[data-uki-tab][aria-pressed="true"]')?.dataset.ukiTab||'inventario';}
function show(){
 const t=tab();
 $('ukiMiniInventario').hidden=t!=='inventario';
 $('ukiHistorial').hidden=t!=='reportes';
 if($('invAdmin'))$('invAdmin').style.display=t==='inventario'&&x.editor?'':'none';
 if($('invReportsBox'))$('invReportsBox').style.display='none';
 if(t==='inventario'&&!x.loaded)void loadCurrent();
 if(t==='reportes'&&!x.historyLoaded)void loadHistory();
}
function fecha(fecha){const d=exports().fechaChile(fecha);return d.dia+' '+d.fecha+' · '+d.hora+' h (Chile)';}
function renderHistory(){
 const root=$('ukiHistoriaLista');root.replaceChildren();
 if(!x.history.length)root.textContent='No hay revisiones con esos filtros.';
 for(const revision of x.history){
  const row=document.createElement('div');row.className='uki-mini-item';
  const left=document.createElement('div');left.className='uki-mini-info';
  const title=document.createElement('strong');title.textContent=fecha(revision.created_at);
  const details=document.createElement('small');const summary=revision.summary||{};
  details.textContent=String(revision.worker_name||'Trabajador')+' · '+(Number(summary.productos)||0)+
   ' artículos · '+(summary.faltantes?.length||0)+' para reponer';
  left.append(title,details);row.append(left,button('Ver inventario',()=>void openRevision(revision.id)));
  root.append(row);
 }
 $('ukiHistoriaAnterior').disabled=x.busyHistory||x.historyOffset<=0;
 $('ukiHistoriaSiguiente').disabled=x.busyHistory||x.historyOffset+x.history.length>=x.historyTotal||!x.history.length;
 status('ukiHistoriaEstado',x.historyTotal+' revisiones históricas · página '+(Math.floor(x.historyOffset/25)+1)+
  ' · primero las más recientes.');
}
async function loadHistory(){
 if(x.busyHistory)return;
 x.busyHistory=true;const b=sucursal();
 status('ukiHistoriaEstado','Buscando revisiones de '+nombreSucursal(b)+'…');
 $('ukiHistoriaAnterior').disabled=true;$('ukiHistoriaSiguiente').disabled=true;
 try{
  const data=await request('historial',{desde:$('ukiHistoriaDesde').value,
   hasta:$('ukiHistoriaHasta').value,trabajador:$('ukiHistoriaNombre').value,
   offset:x.historyOffset},b);
  if(b!==sucursal())return;
  x.history=Array.isArray(data.revisiones)?data.revisiones:[];
  x.historyTotal=Number(data.total)||0;x.historyLoaded=true;
 }catch(e){x.historyLoaded=false;status('ukiHistoriaEstado','No se pudo consultar: '+String(e.message||e));}
 finally{x.busyHistory=false;if(x.historyLoaded&&b===sucursal())renderHistory();}
}
function renderDetail(){
 if(!x.selected)return;
 const target=$('ukiDetalleLista');target.replaceChildren();
 const filtered=exports().filas(x.selected).filter(it=>
  (x.detailFilter==='todos'||filtro({stock_qty:it.stock,min_stock_qty:it.minimum})===x.detailFilter)&&
  (!x.detailQuery||nombreNormal(it.name).includes(nombreNormal(x.detailQuery))));
 for(const it of filtered.slice(0,x.detailLimit)){
  target.append(fila({name:it.name,stock_qty:it.stock,
   stock_unit:it.unit,min_stock_qty:it.minimum}));
 }
 if(!filtered.length)target.textContent='Ningún artículo coincide con esta búsqueda.';
 $('ukiDetalleMas').hidden=filtered.length<=x.detailLimit;
 status('ukiDetalleEstado',filtered.length+' artículos · mostrando '+Math.min(x.detailLimit,filtered.length)+'.');
}
async function openRevision(id){
 const b=sucursal();status('ukiHistoriaEstado','Abriendo revisión histórica…');
 try{
  const response=await request('revision',{id:String(id)},b);
  if(b!==sucursal())return;
  x.selected={...response.revision,branch:b};x.detailQuery='';x.detailLimit=15;x.detailFilter='todos';
  $('ukiDetalleBuscar').value='';$('ukiDetalleFiltro').value='todos';
  $('ukiHistorialDetalle').hidden=false;
  status('ukiHistorialFecha',fecha(x.selected.created_at)+' · '+x.selected.worker_name+
   ' · '+nombreSucursal(b)+'. Es el inventario registrado ese día, no el stock actual.');
  renderDetail();renderHistory();$('ukiHistorialDetalle').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){status('ukiHistoriaEstado','No se pudo abrir el inventario: '+String(e.message||e));}
}
function mount(){
 oldMount();if(!$('ukiMiniInventario')||!exports())return;
 // Reordenar solamente contenedores existentes, conservando botones y eventos.
 const root=$('invRoot');
 if(root){
  let anterior=root;
  for(const id of ['ukiMiniInventario','invAdmin','invNewBox','ukiInvWorkerAccess']){
   const el=$(id);if(el){anterior.insertAdjacentElement('afterend',el);anterior=el;}
  }
 }
 x.branch=sucursal();x.loaded=false;x.loadedAt=null;x.historyLoaded=false;x.selected=null;x.editor=false;
 $('ukiMiniBuscar').oninput=e=>{x.query=e.target.value;x.limit=12;renderCurrent();};
 $('ukiMiniFiltro').onchange=e=>{x.filter=e.target.value;x.limit=12;renderCurrent();};
 $('ukiMiniActualizar').onclick=()=>void loadCurrent();
 $('ukiMiniMas').onclick=()=>{x.limit+=12;renderCurrent();};
 $('ukiMiniExcel').onclick=()=>void exportar('excel',x.loaded?currentSnapshot():null,'ukiMiniEstado');
 $('ukiMiniPDF').onclick=()=>void exportar('pdf',x.loaded?currentSnapshot():null,'ukiMiniEstado');
 $('ukiMiniCompartir').onclick=()=>void exportar('whatsapp',x.loaded?currentSnapshot():null,'ukiMiniEstado');
 $('ukiHistoriaBuscar').onclick=()=>{x.historyOffset=0;$('ukiHistorialDetalle').hidden=true;void loadHistory();};
 $('ukiHistoriaLimpiar').onclick=()=>{
  $('ukiHistoriaDesde').value='';$('ukiHistoriaHasta').value='';$('ukiHistoriaNombre').value='';
  x.historyOffset=0;$('ukiHistorialDetalle').hidden=true;void loadHistory();
 };
 $('ukiHistoriaAnterior').onclick=()=>{x.historyOffset=Math.max(0,x.historyOffset-25);void loadHistory();};
 $('ukiHistoriaSiguiente').onclick=()=>{x.historyOffset+=25;void loadHistory();};
 $('ukiDetalleBuscar').oninput=e=>{x.detailQuery=e.target.value;x.detailLimit=15;renderDetail();};
 $('ukiDetalleFiltro').onchange=e=>{x.detailFilter=e.target.value;x.detailLimit=15;renderDetail();};
 $('ukiDetalleMas').onclick=()=>{x.detailLimit+=15;renderDetail();};
 $('ukiDetalleExcel').onclick=()=>void exportar('excel',x.selected,'ukiDetalleEstado');
 $('ukiDetallePDF').onclick=()=>void exportar('pdf',x.selected,'ukiDetalleEstado');
 $('ukiDetalleCompartir').onclick=()=>void exportar('whatsapp',x.selected,'ukiDetalleEstado');
 $('invBranch')?.addEventListener('change',()=>{
  x.branch=sucursal();x.loaded=false;x.loadedAt=null;x.historyLoaded=false;x.historyOffset=0;
  x.selected=null;x.editor=false;x.limit=12;$('ukiHistorialDetalle').hidden=true;show();
 });
 for(const btn of document.querySelectorAll('[data-uki-tab]'))btn.addEventListener('click',show);
 $('invRefresh')?.addEventListener('click',()=>{if(tab()==='inventario')void loadCurrent();});
 show();
}
window.ukiInventarioMontar=mount;
})();