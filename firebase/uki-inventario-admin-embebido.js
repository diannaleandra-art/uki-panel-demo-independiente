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