/* Uki Sushi · Organización del inventario, informes, disponibilidad y precios.
   No modifica pedidos, caja, reportes de ventas ni cierres. */
(function(){
'use strict';
const API='https://uki-sushi-inventario.vercel.app/api/uki-carta-precios-live';
const STOCK_API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const state={tab:'inventario',branch:'',items:[],query:'',group:'all',busy:false,ready:false};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const peso=n=>'$'+Number(n).toLocaleString('es-CL');
const units={un:'unidades',kg:'kg',g:'g',l:'litros',ml:'ml',porciones:'porciones'};
const menu=[
 ['precios','Carta y precios','Agregar productos y editar precios'],
 ['disponibilidad','Disponible / Agotado','Control manual de lo que puede pedir el cliente'],
 ['inventario','Inventario','Existencias, unidades y nuevos insumos'],
 ['reportes','Revisiones y compras','Faltantes para reponer y conteos del personal']
];
const prevPanel=window.ukiInventarioPanelHTML,prevMount=window.ukiInventarioMontar;
if(typeof prevPanel!=='function'||typeof prevMount!=='function')return;
const nav='<div class="card" id="ukiInvTabs"><h2>Administrar Uki Sushi</h2>'+
'<p class="muted">Elige qué necesitas. Carta e inventario se manejan por separado.</p>'+
'<div class="quick-grid" id="ukiInvTabButtons">'+menu.map(([id,label,description])=>
'<button type="button" class="quick" data-uki-tab="'+id+'" style="height:auto;min-height:95px;display:block;text-align:left">'+
'<strong>'+label+'</strong><small style="display:block;font-size:12px;margin-top:6px;line-height:1.35">'+description+'</small></button>').join('')+'</div></div>';
const pricesPanel=[
 '<div class="card" id="ukiPreciosPanel"><h2>🧾 Carta y precios</h2>',
 '<p class="mini-help">Estos son los productos que vendes, no los artículos del inventario. Los cambios serán independientes por sucursal. Solo administración Google.</p>',
 '<div class="quick-grid"><div><label for="ukiPriceSearch">Buscar producto</label><input id="ukiPriceSearch" type="search" placeholder="Pizza, gohan, 24 piezas…"></div>',
 '<div><label for="ukiPriceGroup">Categoría</label><select id="ukiPriceGroup">',
 '<option value="all">Todas las categorías</option><option value="pizza">Pizzas</option>',
 '<option value="dish">Entradas, gohan y burgers</option><option value="classic">Promos clásicas</option>',
 '<option value="premium">Premium</option><option value="monthly">Promos del mes</option>',
 '<option value="topping">Toppings</option><option value="extra">Salsas adicionales</option></select></div></div>',
 '<button class="sm" id="ukiPriceReload" type="button">Actualizar precios</button>',
 '<p id="ukiPriceMessage" role="status" class="muted">Carga los precios de la sucursal para comenzar.</p>',
 '<div id="ukiPriceList"></div>',
 '<details id="ukiPriceAddBox" class="card" style="margin-top:15px">',
 '<summary style="cursor:pointer;font-weight:700">＋ Agregar producto a la carta</summary>',
 '<p class="muted">Aquí agregas un producto para vender, no un ingrediente de inventario. De momento admite pizzas en Regimiento Arica y entradas simples.</p>',
 '<label for="ukiPriceNewKind">Categoría</label><select id="ukiPriceNewKind"><option value="pizza">Pizzas</option><option value="dish">Entradas simples</option></select>',
 '<label for="ukiPriceNewName">Nombre</label><input id="ukiPriceNewName" maxlength="100" placeholder="Ej. Pizza Cuatro Quesos">',
 '<label for="ukiPriceNewDesc">Descripción / ingredientes</label><textarea id="ukiPriceNewDesc" maxlength="500" rows="2" placeholder="Ingredientes del producto"></textarea>',
 '<label for="ukiPriceNewAmount">Precio en pesos chilenos</label><input id="ukiPriceNewAmount" type="number" min="1" max="1000000" inputmode="numeric" placeholder="10900">',
 '<button type="button" class="big" id="ukiPriceCreate">Agregar a la carta</button>',
 '</details></div>',
 '<div class="card" id="ukiReponerPanel"><h2>🛒 Qué comprar</h2>',
 '<p class="muted">Resumen por sucursal según el último saldo registrado y los mínimos configurados.</p>',
 '<button type="button" class="sm" id="ukiReponerReload">Actualizar faltantes</button>',
 '<p id="ukiReponerEstado" role="status">Consulta el inventario para ver los faltantes.</p>',
 '<div id="ukiReponerListado"></div>',
 '<p class="mini-help">Los faltantes no marcan productos como Agotados. La disponibilidad se cambia manualmente.</p>',
 '</div>'
].join('');
window.ukiInventarioPanelHTML=()=>nav+prevPanel()+pricesPanel;
function branch(){return $('invBranch')?.value||'arica';}
function info(id,message){const el=$(id);if(el)el.textContent=message;}
async function request(api,action,fields={}){
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Inicia sesión con Google como administradora de Uki Sushi.');
 const response=await fetch(api,{method:'POST',cache:'no-store',mode:'cors',
  credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({branch:state.branch,action,...fields})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw Error(data.error||'No se pudo consultar o guardar');
 return data;
}
function showTab(){
 for(const [id] of menu){
  const btn=document.querySelector('[data-uki-tab="'+id+'"]');
  if(btn){btn.setAttribute('aria-pressed',String(state.tab===id));btn.style.borderColor=state.tab===id?'#ed810e':'#e9ded4';
   btn.style.background=state.tab===id?'#fff0de':'#fff';}
 }
 const sections={
  precios:['ukiPreciosPanel'],
  disponibilidad:['ukiCartaDisponibilidad'],
  inventario:['invAdmin','invNewBox'],
  reportes:['invReportsBox','ukiReponerPanel']
 };
 for(const [tab,ids] of Object.entries(sections))
  for(const id of ids){const element=$(id);if(element)element.style.display=state.tab===tab?'':'none';}
 if(state.tab==='precios'&&!state.ready)void loadPrices();
 if(state.tab==='reportes')void loadReponer();
}
function line(price){
 const wrap=document.createElement('div');wrap.className='row';wrap.style.cssText='align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid #eee0d3;flex-wrap:wrap';
 const summary=document.createElement('div');summary.style.flex='1 1 130px';
 const name=document.createElement('b');name.textContent=price.name;
 const sub=document.createElement('small');sub.style.cssText='display:block;color:#756759';
 sub.textContent=(price.group||price.kind)+' · '+peso(price.price)+' · '+(price.available?'Disponible':'Agotado');
 summary.append(name,sub);
 const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='1000000';
 input.value=String(price.price);input.setAttribute('aria-label','Nuevo precio de '+price.name);
 input.style.cssText='width:115px;max-width:35%;flex:0 0 115px';
 const save=document.createElement('button');save.type='button';save.className='sm';save.textContent='Guardar precio';
 save.disabled=state.busy;
 save.onclick=async()=>{
  const amount=Number(input.value);
  if(!Number.isSafeInteger(amount)||amount<1||amount>1000000){info('ukiPriceMessage','Ingresa un precio válido en pesos.');return;}
  if(amount===Number(price.price)){info('ukiPriceMessage','El precio no ha cambiado.');return;}
  if(state.busy)return;
  const selectedBranch=state.branch;
  state.busy=true;save.disabled=true;info('ukiPriceMessage','Guardando '+price.name+'…');
  try{
   await request(API,'editar-precio',{sku:price.sku,expected_version:price.version,price:amount});
   if(selectedBranch!==branch())return;
   state.busy=false;await loadPrices(true);
   info('ukiPriceMessage','✓ Precio de '+price.name+' actualizado a '+peso(amount)+' en '+(selectedBranch==='arica'?'Regimiento Arica':'La Serena')+'.');
  }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message));}
  finally{state.busy=false;save.disabled=false;}
 };
 wrap.append(summary,input,save);
 if(price.custom){
  const details=document.createElement('details');details.style.cssText='width:100%;padding:7px 0 0';
  const title=document.createElement('summary');title.textContent='Editar nombre y descripción';details.append(title);
  const name=document.createElement('input');name.value=price.name;name.maxLength=100;
  name.setAttribute('aria-label','Nombre de '+price.name);
  const description=document.createElement('textarea');description.value=price.description||'';description.maxLength=500;description.rows=2;
  description.setAttribute('aria-label','Descripción de '+price.name);
  const button=document.createElement('button');button.className='sm';button.type='button';button.textContent='Guardar producto';
  button.onclick=async()=>{
   const next=name.value.trim(),amount=Number(input.value);
   if(next.length<2||!Number.isSafeInteger(amount)||amount<1||amount>1000000){
    info('ukiPriceMessage','Revisa nombre y precio.');return;
   }
   if(state.busy)return;state.busy=true;button.disabled=true;
   try{
    await request(API,'editar-producto',{sku:price.sku,expected_version:price.version,
     name:next,description:description.value.trim(),price:amount});
    state.busy=false;await loadPrices(true);
    info('ukiPriceMessage','✓ Producto actualizado.');
   }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message));}
   finally{state.busy=false;button.disabled=false;}
  };
  details.append(name,description,button);wrap.append(details);
 }
 return wrap;
}
function renderPrices(){
 const target=$('ukiPriceList');if(!target)return;
 target.replaceChildren();
 const query=state.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filtered=state.items.filter(x=>(state.group==='all'||x.kind===state.group)&&
  (!query||(x.name+' '+x.sku).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)));
 const title=document.createElement('p');title.className='muted';title.textContent=filtered.length+' productos encontrados';target.append(title);
 for(const item of filtered)target.append(line(item));
 if(!filtered.length){const p=document.createElement('p');p.textContent='No hay productos en esta búsqueda.';target.append(p);}
}
async function loadPrices(force=false){
 if(state.busy)return;
 state.branch=branch();const selected=state.branch;
 info('ukiPriceMessage','Cargando carta de '+(selected==='arica'?'Regimiento Arica':'La Serena')+'…');
 try{
  const data=await request(API,'listar');
  if(selected!==branch())return;
  state.items=Array.isArray(data.items)?data.items:[];state.ready=true;renderPrices();
  info('ukiPriceMessage','✓ '+state.items.length+' productos y precios de esta sucursal.');
 }catch(e){state.ready=false;state.items=[];
  info('ukiPriceMessage','No se pudo consultar: '+String(e.message));}
 const pizza=$('ukiPriceNewKind');
 if(pizza){const option=pizza.querySelector('option[value="pizza"]');if(option)option.disabled=selected!=='arica';
  if(selected!=='arica'&&pizza.value==='pizza')pizza.value='dish';}
}
async function create(){
 const kind=$('ukiPriceNewKind').value;
 const name=$('ukiPriceNewName').value.trim(),description=$('ukiPriceNewDesc').value.trim(),price=Number($('ukiPriceNewAmount').value);
 if(name.length<2||!Number.isSafeInteger(price)||price<1||price>1000000){
  info('ukiPriceMessage','Escribe un nombre y un precio válido.');return;
 }
 if(state.busy)return;
 state.busy=true;$('ukiPriceCreate').disabled=true;info('ukiPriceMessage','Agregando producto…');
 try{
  const result=await request(API,'crear-producto',{item:{kind,group:kind==='pizza'?'pizzas':'entradas',name,description,price}});
  $('ukiPriceNewName').value='';$('ukiPriceNewDesc').value='';$('ukiPriceNewAmount').value='';
  state.busy=false;await loadPrices(true);
  info('ukiPriceMessage','✓ «'+name+'» agregado a la carta de '+(state.branch==='arica'?'Regimiento Arica':'La Serena')+'.');
  $('ukiPriceAddBox').open=false;
 }catch(e){info('ukiPriceMessage','No se agregó: '+String(e.message));}
 finally{state.busy=false;$('ukiPriceCreate').disabled=false;}
}
async function loadReponer(){
 const selected=branch();state.branch=selected;
 info('ukiReponerEstado','Consultando faltantes…');
 try{
  const data=await request(STOCK_API,'articulos');
  if(selected!==branch())return;
  const all=data.items||[],configured=all.filter(i=>Number(i.min_stock_qty)>0);
  const short=configured.filter(i=>Number(i.stock_qty)<=Number(i.min_stock_qty))
    .sort((a,b)=>a.name.localeCompare(b.name,'es'));
  info('ukiReponerEstado',all.length+' artículos · '+short.length+' para reponer · '+
   (all.length-configured.length)+' sin mínimo configurado.');
  const root=$('ukiReponerListado');if(!root)return;root.replaceChildren();
  if(!short.length){root.textContent='✓ No hay faltantes según los mínimos registrados.';return;}
  for(const p of short){
   const row=document.createElement('p');row.style.cssText='padding:10px 0;border-bottom:1px solid #eee0d3;margin:0';
   const delta=Math.max(0,Number(p.min_stock_qty)-Number(p.stock_qty));
   row.textContent=p.name+' · Quedan '+Number(p.stock_qty).toLocaleString('es-CL')+' '+(units[p.stock_unit]||p.stock_unit)+
    ' · mínimo '+Number(p.min_stock_qty).toLocaleString('es-CL')+
    ' · '+(delta===0?'Mínimo alcanzado, comprar':('Faltan al menos '+delta.toLocaleString('es-CL')+' '+p.stock_unit));
   root.append(row);
  }
 }catch(e){info('ukiReponerEstado','No se pudo consultar: '+String(e.message));}
}
function mount(){
 prevMount();if(!$('ukiInvTabs'))return;
 state.branch=branch();
 document.querySelectorAll('[data-uki-tab]').forEach(btn=>btn.onclick=()=>{
  state.tab=btn.dataset.ukiTab;showTab();
 });
 const input=$('ukiPriceSearch'),select=$('ukiPriceGroup');
 if(input){input.value=state.query;input.oninput=e=>{state.query=e.target.value;renderPrices();};}
 if(select){select.value=state.group;select.onchange=e=>{state.group=e.target.value;renderPrices();};}
 $('ukiPriceReload').onclick=()=>void loadPrices(true);
 $('ukiPriceCreate').onclick=()=>void create();
 $('ukiReponerReload').onclick=()=>void loadReponer();
 const invBranch=$('invBranch');
 if(invBranch&&!invBranch.dataset.ukiPrecioObservador){
  invBranch.dataset.ukiPrecioObservador='1';
  invBranch.addEventListener('change',()=>{state.branch=branch();state.ready=false;state.items=[];
   if(state.tab==='precios')void loadPrices(true);
   if(state.tab==='reportes')void loadReponer();
  });
 }
 showTab();
}
window.ukiInventarioMontar=mount;
})();
