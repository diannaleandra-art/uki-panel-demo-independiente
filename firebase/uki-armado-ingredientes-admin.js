/* Uki · Administración de INGREDIENTES DEL ARMADO.
 * No agrega productos independientes ni toca inventario/caja/cierres.
 * Se incrusta dentro de la pestaña ya existente Carta y precios. */
(function(){
'use strict';
const API='https://uki-sushi-inventario.vercel.app/api/uki-ingredientes-armado-live';
const categories=[['vegetal','Vegetal'],['proteina','Proteína'],['envoltura','Envoltura']];
const surfaces=[['classic','Sushi clásico'],['premium','Sushi premium'],['monthly','Promos del mes'],['handroll','Handrolls'],['burger','Sushi Burger'],['gohan','Gohan']];
const state={branch:'',items:[],busy:false};
const get=id=>document.getElementById(id);
const branch=()=>get('invBranch')?.value||(typeof S!=='undefined'&&S?.suc==='Uki La Serena'?'serena':'arica');
function status(message){if(get('ukiIngEstado'))get('ukiIngEstado').textContent=message}
function pesos(value){return '$'+Number(value).toLocaleString('es-CL')}
const html=[
 '<details class="card" id="ukiArmadoIngredientes" style="margin-top:15px;border:1.5px solid #e5a560">',
 '<summary style="font-size:16px;font-weight:700;cursor:pointer">🥑 Administrar ingredientes del armado</summary>',
 '<p class="muted">Agrega vegetales, proteínas o envolturas para elegir dentro de cada roll, handroll o preparación. No es un producto independiente ni modifica inventario.</p>',
 '<p class="muted">Cada sucursal tiene sus opciones. «Incluida» significa $0 adicional; «Con recargo» exige indicar el precio exacto.</p>',
 '<p id="ukiIngSucursal" class="mini-help"></p>',
 '<div class="card" id="ukiIngNuevo" style="padding:10px;background:#fffaf5">',
 '<b>＋ Nuevo ingrediente</b>',
 '<label>Nombre<input data-uki-ingredient="name" type="text" maxlength="70" placeholder="Ej. Frutilla" autocomplete="off"></label>',
 '<label>Categoría<select data-uki-ingredient="category"><option value="vegetal">Vegetal</option><option value="proteina">Proteína</option><option value="envoltura">Envoltura</option></select></label>',
 '<label>Valor<select data-uki-ingredient="mode"><option value="included">Incluida · $0 adicional</option><option value="charge">Con recargo</option></select></label>',
 '<label data-uki-ingredient-charge-label hidden>Recargo por preparación ($)<input data-uki-ingredient="surcharge" type="number" inputmode="numeric" min="1" max="50000" step="1" placeholder="Ingresa el valor"></label>',
 '<fieldset data-uki-ingredient-surfaces style="border:1px solid #eadfd2;border-radius:10px;margin:10px 0"><legend>Aparece en</legend>',
 ...surfaces.map(([id,label])=>'<label style="display:flex;gap:9px;align-items:center;padding:4px 0"><input style="width:auto;min-height:0" type="checkbox" value="'+id+'" '+(id==='classic'?'checked':'')+'>'+label+'</label>'),
 '</fieldset>',
 '<label style="display:flex;gap:8px;align-items:center"><input data-uki-ingredient="available" type="checkbox" checked style="width:auto;min-height:0"> Disponible para elegir</label>',
 '<button class="sm ok" type="button" id="ukiIngCrear" style="width:100%">Agregar ingrediente</button>',
 '</div>',
 '<p role="status" id="ukiIngEstado" class="muted">Pulsa Actualizar para consultar ingredientes configurados.</p>',
 '<button type="button" class="sm" id="ukiIngActualizar">Actualizar ingredientes</button>',
 '<div id="ukiIngLista"></div>',
 '</details>'
].join('');
const categoryOptions=()=>categories.map(([k,v])=>({k,v}));
function makeSelect(options,value){
 const element=document.createElement('select');
 for(const [k,label]of options){const o=document.createElement('option');o.value=k;o.textContent=label;element.append(o)}
 element.value=value;return element;
}
function makeInput(label,value,maxLength=70){
 const container=document.createElement('label');
 container.textContent=label;
 const input=document.createElement('input');input.value=value||'';input.maxLength=maxLength;
 container.append(input);return {container,input};
}
function syncCategory(box){
 const category=box.querySelector('[data-uki-ingredient="category"]')?.value;
 const allowed={vegetal:surfaces.map(x=>x[0]),proteina:['classic','premium','monthly','handroll','burger'],envoltura:['classic','premium','monthly','handroll']};
 for(const input of box.querySelectorAll('[data-uki-ingredient-surfaces] input')){
  const ok=(allowed[category]||[]).includes(input.value);
  input.disabled=!ok;input.closest('label').hidden=!ok;
  if(!ok)input.checked=false;
 }
}
function syncMode(box){
 const mode=box.querySelector('[data-uki-ingredient="mode"]');
 const label=box.querySelector('[data-uki-ingredient-charge-label]');
 if(label)label.hidden=mode?.value!=='charge';
}
function getPayload(box){
 const name=box.querySelector('[data-uki-ingredient="name"]')?.value.trim().replace(/\s+/g,' ');
 const category=box.querySelector('[data-uki-ingredient="category"]')?.value;
 const mode=box.querySelector('[data-uki-ingredient="mode"]')?.value;
 const charge=box.querySelector('[data-uki-ingredient="surcharge"]');
 const surcharge=mode==='charge'?Number(charge?.value):0;
 const selected=[...box.querySelectorAll('[data-uki-ingredient-surfaces] input:checked')].map(x=>x.value);
 const available=box.querySelector('[data-uki-ingredient="available"]')?.checked===true;
 if(!name||name.length<2||name.length>70||!categories.some(x=>x[0]===category))throw Error('Escribe nombre y categoría válidos');
 if(!selected.length)throw Error('Selecciona al menos una preparación');
 if(!Number.isSafeInteger(surcharge)||surcharge<0||surcharge>50000||(mode==='charge'&&surcharge<1))
  throw Error('Indica el precio del recargo en pesos chilenos. No inventaremos un valor.');
 return {name,category,surcharge,surfaces:selected,available};
}
async function request(action,fields,chosen=branch()){
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Accede como administradora con Google para gestionar ingredientes.');
 const r=await fetch(API,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({branch:chosen,action,...fields}),signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.ok!==true)throw Error(data.error||'No se pudo guardar. Ningún ingrediente cambió.');
 return data;
}
async function load(){
 if(state.busy||!get('ukiIngLista'))return;
 const selected=branch();state.branch=selected;state.busy=true;
 status('Consultando ingredientes de '+(selected==='arica'?'Regimiento Arica':'La Serena')+'…');
 try{
  const data=await request('listar',{},selected);if(selected!==branch())return;
  state.items=Array.isArray(data.items)?data.items:[];
  render();status('✓ '+state.items.length+' ingrediente(s) configurados en esta sucursal. El stock nunca cambia la disponibilidad.');
 }catch(e){status('No se pudieron consultar ingredientes: '+String(e.message||e));}
 finally{state.busy=false;}
}
async function send(action,box,record){
 if(state.busy)return;
 let item;try{item=getPayload(box)}catch(e){status(String(e.message));return}
 const selected=branch();state.busy=true;status('Guardando '+item.name+'…');
 try{
  const fields=action==='crear'?{item}:{item,sku:record.sku,expected_version:record.version};
  await request(action,fields,selected);
  if(selected!==branch())return;
  state.busy=false;await load();
  status('✓ Ingrediente '+(action==='crear'?'agregado':'actualizado')+' para '+(selected==='arica'?'Regimiento Arica':'La Serena')+'.');
  if(action==='crear'){
   box.querySelector('[data-uki-ingredient="name"]').value='';
   get('ukiArmadoIngredientes').open=true;
  }
 }catch(e){status('No se guardó: '+String(e.message||e))}
 finally{state.busy=false;}
}
function render(){
 const target=get('ukiIngLista');if(!target)return;
 target.replaceChildren();
 if(!state.items.length){const p=document.createElement('p');p.className='muted';p.textContent='Sin ingredientes agregados. Los ingredientes originales de Uki siguen disponibles.';target.append(p);return;}
 for(const item of state.items){
  const wrapper=document.createElement('details');wrapper.className='card';wrapper.style.cssText='padding:10px;margin:8px 0';
  const title=document.createElement('summary');title.style.cursor='pointer';
  title.textContent=item.name+' · '+(categories.find(x=>x[0]===item.category)?.[1]||item.category)+' · '+(item.surcharge?pesos(item.surcharge):'Incluida')+' · '+(item.available?'Disponible':'Agotado');
  wrapper.append(title);
  const form=document.createElement('div');form.style.cssText='display:grid;gap:8px;padding-top:9px';
  const n=makeInput('Nombre del ingrediente',item.name);n.input.dataset.ukiIngredient='name';form.append(n.container);
  const categoryLabel=document.createElement('label');categoryLabel.textContent='Categoría';
  const category=makeSelect(categories,item.category);category.dataset.ukiIngredient='category';categoryLabel.append(category);form.append(categoryLabel);
  const modeLabel=document.createElement('label');modeLabel.textContent='Valor';
  const mode=makeSelect([['included','Incluida · $0 adicional'],['charge','Con recargo']],item.surcharge?'charge':'included');
  mode.dataset.ukiIngredient='mode';modeLabel.append(mode);form.append(modeLabel);
  const priceLabel=document.createElement('label');priceLabel.textContent='Recargo por preparación ($)';priceLabel.dataset.ukiIngredientChargeLabel='';
  const price=document.createElement('input');price.type='number';price.inputMode='numeric';price.min='1';price.max='50000';price.value=item.surcharge||'';price.dataset.ukiIngredient='surcharge';
  priceLabel.append(price);form.append(priceLabel);
  const field=document.createElement('fieldset');field.dataset.ukiIngredientSurfaces='';field.style.cssText='border:1px solid #eadfd2;border-radius:10px;padding:8px';
  const legend=document.createElement('legend');legend.textContent='Aparece en';field.append(legend);
  for(const [id,label]of surfaces){const row=document.createElement('label');row.style.cssText='display:flex;gap:8px;align-items:center;padding:4px 0';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=item.surfaces.includes(id);input.style.cssText='width:auto;min-height:0';row.append(input,document.createTextNode(label));field.append(row)}
  form.append(field);
  const availableLabel=document.createElement('label');availableLabel.style.cssText='display:flex;gap:8px;align-items:center';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.available===true;checkbox.dataset.ukiIngredient='available';checkbox.style.cssText='width:auto;min-height:0';availableLabel.append(checkbox,document.createTextNode('Disponible para elegir'));form.append(availableLabel);
  const button=document.createElement('button');button.type='button';button.className='sm ok';button.textContent='Guardar cambios';button.onclick=()=>send('editar',form,item);form.append(button);
  mode.onchange=()=>syncMode(form);category.onchange=()=>syncCategory(form);syncMode(form);syncCategory(form);wrapper.append(form);target.append(wrapper);
 }
}
function mount(){
 const host=get('ukiPreciosPanel');if(!host)return;
 if(!get('ukiArmadoIngredientes')){
  host.insertAdjacentHTML('beforeend',html);
  const block=get('ukiIngNuevo'),mode=block.querySelector('[data-uki-ingredient="mode"]');
  mode.onchange=()=>syncMode(block);block.querySelector('[data-uki-ingredient="category"]').onchange=()=>syncCategory(block);syncMode(block);syncCategory(block);
  get('ukiIngCrear').onclick=()=>send('crear',block);
  get('ukiIngActualizar').onclick=()=>load();
 }
 const selected=branch();const statusText=get('ukiIngSucursal');
 if(statusText)statusText.textContent='Sucursal: '+(selected==='arica'?'Uki Regimiento Arica':'Uki La Serena');
 const tab=document.querySelector('[data-uki-tab="precios"]');
 if(tab&&!tab.dataset.ukiIngredientesListener){
  tab.dataset.ukiIngredientesListener='1';tab.addEventListener('click',()=>void load());
 }
}
const prevMount=window.ukiInventarioMontar;
if(typeof prevMount!=='function')return;
window.ukiInventarioMontar=function(...args){const out=prevMount(...args);mount();return out};
})();