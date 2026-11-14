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
 if(typeof S!=='undefined'&&S?.suc==='Romo’s Sushi La Serena')throw Error('El inventario de Romo se conecta solo a su base propia, no a Uki.');
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
function mount(){
 if(!$('invRoot'))return;
 const active=panelBranch();
 if(X.branch!==active){X.items=[];X.reports=[];X.selected='';X.loaded=false;}
 X.branch=active;
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