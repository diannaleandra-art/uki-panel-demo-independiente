/* Control manual de disponibilidad para la carta Uki. No depende de las existencias. */
(function(){
 'use strict';
 const API='https://uki-sushi-inventario.vercel.app/api/uki-disponibilidad-live';
 const state={branch:'',items:[],busy:false,search:'',filter:'all',loaded:false};
 const get=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const oldHtml=window.ukiInventarioPanelHTML,oldMount=window.ukiInventarioMontar;
 if(typeof oldHtml!=='function'||typeof oldMount!=='function')return;
 window.ukiInventarioPanelHTML=()=>oldHtml()+[
 '<div class="card" id="ukiCartaDisponibilidad">',
 '<h2>🟠 Carta y disponibilidad</h2>',
 '<p class="muted">Marca qué productos, proteínas, vegetales y envolturas puede elegir el cliente. Cada sucursal es independiente. No cambia el inventario ni los precios.</p>',
 '<p class="mini-help">Sucursal: <b id="ukiDispSucursal"></b></p>',
 '<div class="quick-grid"><div><label for="ukiDispBuscar">Buscar en la carta</label><input id="ukiDispBuscar" placeholder="Ej.: Camarón, Gohan, 24 piezas" autocomplete="off" type="search"></div>',
 '<div><label for="ukiDispTipo">Mostrar</label><select id="ukiDispTipo"><option value="all">Todo</option><option value="product">Productos y promociones</option><option value="ingredient">Proteínas, vegetales y envolturas</option></select></div></div>',
 '<p id="ukiDispMensaje" class="muted" role="status">Cargando estado de la carta…</p>',
 '<button type="button" class="sm" id="ukiDispRefrescar">Actualizar disponibilidad</button>',
 '<div id="ukiDispLista" style="margin-top:12px"></div>',
 '<p class="mini-help">Cuando marques Agotado se desactiva esa opción para la sucursal. Volver a disponible es manual; no depende del stock.</p>',
 '</div>'
 ].join('');
 const label=b=>b==='serena'?'La Serena':'Regimiento Arica';
 function sucursal(){return get('invBranch')?.value||((typeof S!=='undefined'&&S.suc==='Uki La Serena')?'serena':'arica');}
 function info(t){const n=get('ukiDispMensaje');if(n)n.textContent=t;}
 async function call(action,data={},branch=state.branch){
  const token=await window.ukiInventarioToken?.();
  if(!token)throw Error('Inicia sesión con Google para administrar la disponibilidad.');
  const r=await fetch(API,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({branch,action,...data})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body.ok)throw Error(body.error||'No se pudo guardar la disponibilidad.');
  return body;
 }
 function pintar(){
  const box=get('ukiDispLista');if(!box)return;box.replaceChildren();
  const search=state.search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const filtered=state.items.filter(item=>(state.filter==='all'||(state.filter==='ingredient')===(item.kind==='ingredient'))&&
   (!search||(item.name+' '+item.sku+' '+item.group).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search)));
  if(!filtered.length){const p=document.createElement('p');p.textContent='No se encontraron productos en esta categoría.';box.append(p);return;}
  for(const item of filtered){
   const row=document.createElement('div');row.className='row';row.style.alignItems='center';row.style.padding='12px 0';
   const name=document.createElement('div');name.style.flex='1';
   const b=document.createElement('b');b.textContent=item.name;name.append(b);
   const sub=document.createElement('small');sub.style.display='block';sub.style.marginTop='3px';sub.style.color='#766659';sub.textContent=(item.group||item.kind)+' · '+(item.available?'Disponible':'Agotado');name.append(sub);
   const btn=document.createElement('button');btn.className='sm'+(item.available?'':' ok');btn.type='button';
   btn.textContent=item.available?'Marcar agotado':'Volver a disponible';btn.disabled=state.busy;
   btn.onclick=()=>void marcar(item);
   row.append(name,btn);box.append(row);
  }
  info(filtered.length+' opciones mostradas · '+state.items.filter(x=>!x.available).length+' agotadas en '+label(state.branch)+'.');
 }
 async function cargar(){
  if(state.busy)return;
  state.busy=true;state.branch=sucursal();
  const branch=state.branch,btn=get('ukiDispRefrescar');
  if(btn)btn.disabled=true;
  if(get('ukiDispSucursal'))get('ukiDispSucursal').textContent=label(branch);
  info('Consultando disponibilidad de '+label(branch)+'…');
  try{
   const data=await call('listar',{},branch);
   if(branch!==sucursal())return;
   state.items=Array.isArray(data.items)?data.items:[];state.loaded=true;pintar();
  }catch(e){state.items=[];state.loaded=false;get('ukiDispLista')?.replaceChildren();info('No se pudo consultar: '+String(e.message||e));}
  finally{state.busy=false;if(btn)btn.disabled=false;}
 }
 async function marcar(item){
  if(state.busy)return;
  const branch=state.branch;
  state.busy=true;info('Guardando '+item.name+'…');pintar();
  try{
   const result=await call('marcar',{sku:item.sku,available:!item.available,expected_version:item.version},branch);
   if(branch!==state.branch)return;
   item.available=result.available;item.version=result.version;pintar();
   info('✓ '+item.name+' está '+(item.available?'disponible':'agotado')+' en '+label(branch)+'. La carta consultará este cambio automáticamente.');
  }catch(e){info('No se cambió la disponibilidad: '+String(e.message||e));}
  finally{state.busy=false;}
 }
 function montar(){
  oldMount();
  if(!get('ukiCartaDisponibilidad'))return;
  const branch=get('invBranch');
  if(branch&&!branch.dataset.ukiDisponibilidad){
   branch.dataset.ukiDisponibilidad='1';
   branch.addEventListener('change',()=>{
    state.branch=sucursal();state.loaded=false;state.items=[];void cargar();
   });
  }
  get('ukiDispBuscar').value=state.search;get('ukiDispBuscar').oninput=e=>{state.search=e.target.value;pintar();};
  get('ukiDispTipo').value=state.filter;get('ukiDispTipo').onchange=e=>{state.filter=e.target.value;pintar();};
  get('ukiDispRefrescar').onclick=()=>void cargar();
  if(state.loaded&&state.branch===sucursal()){get('ukiDispSucursal').textContent=label(state.branch);pintar();}
  else void cargar();
 }
 window.ukiInventarioMontar=montar;
})();