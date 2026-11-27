/* Panel normal. No intercepta los guardados de venta ni los timbres. */
(function(){
'use strict';
const API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const $=id=>document.getElementById(id);
const suc=()=>typeof S!=='undefined'?S.suc:null;
const view=()=>typeof S!=='undefined'?S.vista:'';
const branch=()=>({'Uki Regimiento Arica':'arica','Uki La Serena':'serena','Romo’s Sushi La Serena':'serena'})[suc()];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hour=t=>new Date(t).toLocaleString('es-CL',{timeZone:'America/Santiago'});
const nt=(v,max=3)=>Number(v).toLocaleString('es-CL',{maximumFractionDigits:max});
const clp=v=>'$'+nt(v,0);
const reasons={personal:'Colación del personal',regalo:'Regalo o cortesía',reposicion:'Reposición',otro:'Otro motivo',venta:'Ventas'};
const types={'roll-clasico':'Roll clásico',premium:'Roll premium','otro-sushi':'Otro sushi','otro-producto':'Otro producto'};
const brands={'uki:arica':'Uki Regimiento Arica','uki:serena':'Uki La Serena','romo:serena':'Romo La Serena'};
const pairs=o=>Object.entries(o);
function el(tag,t){const a=document.createElement(tag);if(t!==undefined)a.textContent=t;return a;}
function button(label,fn){const a=el('button',label);a.type='button';a.className='sm';a.onclick=fn;return a;}
function field(parent,label,key,choices=null,type='text'){
 const wrap=el('label',label),input=el(choices?'select':'input');
 input.dataset.field=key;
 if(choices)for(const [value,name] of choices)input.add(new Option(name,value));
 else input.type=type;
 wrap.append(input);parent.append(wrap);return input;
}
function card(id,title){const node=el('section');node.id=id;node.className='card';node.append(el('h3',title));return node;}
function statusIn(node){const p=el('p');p.setAttribute('role','status');node.append(p);return p;}
async function request(action,body={}){
 const start=suc(),b=branch(),token=await window.ukiInventarioToken?.();
 if(!b||!token||start!==suc())throw Error('Abre la sucursal con Google autorizado.');
 const res=await fetch(API,{method:'POST',cache:'no-store',credentials:'omit',headers:{
  'Content-Type':'application/json',Authorization:'Bearer '+token
 },body:JSON.stringify({...body,action,branch:b}),signal:AbortSignal.timeout(15000)});
 const data=await res.json().catch(()=>null);
 if(start!==suc())throw Error('Cambió la sucursal. Vuelve a abrir la sección.');
 if(!res.ok||data?.ok!==true)throw Object.assign(Error(data?.error||'No se confirmó el registro. Verifica la conexión.'),{status:res.status});
 return data;
}
let draft=null;
function labelItem(i){
 return i.nombre||[types[i.tipo],i.proteina,i.vegetal,i.envoltura,i.conQueso?'':'sin queso'].filter(Boolean).join(' · ');
}
function newForm(root){
 const node=card('ukiSinCobroEntrada','Productos sin cobro');
 const toggler=button('Registrar productos sin cobro',()=>{section.hidden=!section.hidden;toggler.setAttribute('aria-expanded',String(!section.hidden));});
 toggler.setAttribute('aria-expanded','false');node.append(toggler);
 const section=el('div');section.hidden=true;node.append(section);
 section.append(el('p','Usa este registro para lo que ya se preparó sin cobrar los productos. No crea una venta, no requiere timbre y no cambia el stock contado.'));
 const form=el('form');section.append(form);
 const top=el('fieldset');top.style.cssText='min-width:0;border:0;margin:0;padding:0';
 form.append(top);
 const reason=field(top,'Motivo','motivo',pairs({...reasons,venta:'Ventas'}).filter(([k])=>k!=='venta'));
 const person=field(top,'¿Quién recibió o comió?','persona');person.maxLength=90;
 const note=field(top,'Detalle o motivo','nota');note.maxLength=180;
 const origin=field(top,'Número o código del pedido original','original');origin.maxLength=40;
 const products=el('div');top.append(products);
 const delivery=field(top,'Entrega','entrega',[['local','Consumo en local'],['retiro','Retiro'],['delivery','Delivery']]);
 const shipping=el('div');top.append(shipping);
 const mode=field(shipping,'¿Quién paga el delivery?','modalidad',[['cliente','Lo pagó el cliente'],['local','El local cubre el envío'],['gratis','Sin pago de delivery']]);
 const address=field(shipping,'Dirección o referencia (opcional)','direccion');address.maxLength=170;
 const amount=field(shipping,'Importe del envío','monto',null,'number');amount.min='0';amount.max='1000000';amount.step='1';amount.inputMode='numeric';
 const payment=field(shipping,'Medio recibido','medio',['Efectivo','Transferencia','Débito','Crédito','Otro'].map(x=>[x,x]));
 const bank=field(shipping,'Confirmo que recibí el pago del delivery','recibido',null,'checkbox');
 const add=button('+ Agregar otro producto',()=>{if(products.children.length<12)addRow();});top.append(add);
 const submit=el('button','Confirmar preparación sin cobro');submit.type='submit';submit.className='big';top.append(submit);
 const state=statusIn(form),actions=el('div');form.append(actions);
 const update=()=>{
  person.required=reason.value==='personal';note.required=reason.value==='otro';
  origin.required=reason.value==='reposicion';origin.parentElement.hidden=!origin.required;
  shipping.hidden=delivery.value!=='delivery';
  amount.parentElement.hidden=mode.value==='gratis';
  amount.required=!shipping.hidden&&mode.value==='cliente';
  payment.parentElement.hidden=bank.parentElement.hidden=mode.value!=='cliente';
  for(const select of products.querySelectorAll('[data-field=tipo]')){
   const other=select.querySelector('[value=otro-producto]');
   if(other)other.disabled=reason.value==='personal';
   if(other?.disabled&&select.value==='otro-producto'){select.value='otro-sushi';select.onchange();}
  }
 };
 function addRow(value={}){
  const row=el('div');row.className='card';products.append(row);
  const type=field(row,'Producto preparado','tipo',pairs(types));
  const q=field(row,'Cantidad','cantidad',null,'number');q.min='1';q.max='100';q.required=true;q.value=String(value.cantidad||1);
  const name=field(row,'Nombre del producto','nombre');name.maxLength=100;name.value=value.nombre||'';
  const roll=el('div');row.append(roll);
  const p=field(roll,'Proteína','proteina',[['pollo','Pollo'],['kanicama','Kanicama'],['carne','Carne'],['camaron','Camarón'],['cerdo','Cerdo'],['salmon','Salmón'],['pulpo','Pulpo'],['berenjena crispy','Berenjena crispy'],['vegetariana','Vegetariana']]);
  const v=field(roll,'Vegetal','vegetal',[['palta','Palta'],['pepino','Pepino'],['cebollin','Cebollín'],['sin vegetal','Sin vegetal']]);
  const e=field(roll,'Envoltura','envoltura',[['panko','Panko'],['tempura','Tempura'],['sin envoltura','Sin envoltura']]);
  const c=field(roll,'Con queso crema','conQueso',null,'checkbox');c.checked=value.conQueso!==false;
  row.append(button('Quitar de este registro',()=>{if(products.children.length>1)row.remove();}));
  type.value=value.tipo||'roll-clasico';p.value=value.proteina||'pollo';v.value=value.vegetal||'palta';e.value=value.envoltura||'panko';
  type.onchange=()=>{roll.hidden=type.value.startsWith('otro-');name.required=roll.hidden;name.parentElement.hidden=!name.required;};type.onchange();update();
 }
 function capture(){
  const items=[...products.children].map(row=>{
   const v=key=>row.querySelector('[data-field='+key+']');
   return {tipo:v('tipo').value,cantidad:Number(v('cantidad').value),nombre:v('nombre').value,
    proteina:v('proteina').value,vegetal:v('vegetal').value,envoltura:v('envoltura').value,conQueso:v('conQueso').checked};
  });
  const d=delivery.value==='delivery',charged=d&&mode.value==='cliente';
  return {motivo:reason.value,persona:person.value,nota:note.value,original:reason.value==='reposicion'?origin.value:'',
   items,entrega:{tipo:delivery.value,modo:d?mode.value:'ninguno',monto:d&&mode.value!=='gratis'?Number(amount.value):0,
    medio:charged?payment.value:'',recibido:charged&&bank.checked,direccion:d?address.value:''}};
 }
 const mounted=suc();
 const savedDraft=draft?.store===mounted?draft:null;
 const values=savedDraft?.body;
 if(values){
  reason.value=values.motivo;person.value=values.persona;note.value=values.nota;origin.value=values.original;
  delivery.value=values.entrega.tipo;if(values.entrega.modo!=='ninguno')mode.value=values.entrega.modo;
  amount.value=values.entrega.monto||'';payment.value=values.entrega.medio||'Efectivo';address.value=values.entrega.direccion;
  bank.checked=values.entrega.recibido===true;values.items.forEach(addRow);section.hidden=false;toggler.setAttribute('aria-expanded','true');
 }else addRow();
 reason.onchange=delivery.onchange=mode.onchange=update;update();
 form.oninput=()=>{if(draft?.store===mounted&&draft.sent)return;draft={store:mounted,body:capture()};};
 form.onsubmit=async event=>{
  event.preventDefault();if(top.disabled)return;
  const body=capture(),signature=JSON.stringify(body);
  if(body.entrega.modo==='cliente'&&!body.entrega.recibido){state.textContent='Primero confirma que recibiste el pago del delivery.';return;}
  if(draft?.store===mounted&&draft.sent&&draft.signature!==signature){
   state.textContent='El guardado anterior quedó sin confirmar. Restituye esos datos y vuelve a confirmarlo con la misma referencia antes de registrar otro.';
   return;
  }
  const request_id=draft?.store===mounted&&draft.signature===signature?draft.id:crypto.randomUUID();
  draft={store:mounted,body,id:request_id,signature,sent:true};
  top.disabled=true;state.textContent='Guardando preparación…';actions.replaceChildren();
  try{
   const r=await request('guardar-salida-sin-cobro',{...body,request_id});
   if(r.id!==request_id)throw Error('La referencia devuelta no coincide.');
   draft=null;state.textContent='✓ Preparación guardada · '+r.id.slice(0,8)+' · Sin venta, sin timbre y sin cambio de stock.';
   const copy=button('Copiar comanda',async()=>{
    const info=[reasons[body.motivo]+' · '+r.id.slice(0,8),body.persona,
     ...body.items.map(i=>i.cantidad+' × '+labelItem(i)),body.entrega.tipo==='delivery'?'Delivery · '+body.entrega.direccion:body.entrega.tipo,body.nota].filter(Boolean).join('\n');
    try{await navigator.clipboard.writeText(info);state.textContent='Comanda copiada.';}
    catch{state.textContent='No fue posible copiar la comanda desde este navegador.';}
   });
   const next=button('Registrar otra preparación',()=>{node.remove();newForm(root);$('ukiSinCobroEntrada').querySelector('button').click();});
   actions.append(copy,next);
  }catch(error){
   state.textContent='No se confirmó: '+error.message;
   if([400,403,409].includes(error.status))draft.sent=false;
   top.disabled=false;
  }
 };
 root.insertAdjacentElement('afterend',node);
}
function table(root,headers){
 const wrapper=el('div');wrapper.style.cssText='overflow-x:auto;margin:12px 0';
 const t=el('table');t.style.cssText='width:100%;border-collapse:collapse';
 const h=el('thead'),tr=el('tr');
 for(const s of headers){const cell=el('th',s);cell.scope='col';cell.style.cssText='padding:8px;white-space:nowrap;text-align:left;border-bottom:1px solid #b9b2ae';tr.append(cell);}
 h.append(tr);const b=el('tbody');t.append(h,b);wrapper.append(t);root.append(wrapper);
 return {row(values){const r=el('tr');for(const s of values){const td=el('td',s);td.style.cssText='vertical-align:top;padding:8px;border-bottom:1px solid #dedad7';r.append(td);}b.append(r);},
 clear(){b.replaceChildren();}};
}
function drawReport(root,data){
 root.replaceChildren(el('p',hour(data.start)+' → '+hour(data.end)+' (Chile)'));
 root.append(el('p',data.hasClose?'Compara las salidas registradas con el conteo del cierre.':'Sin cierre en esta fecha. El stock contado y su diferencia quedan pendientes.'));
 if(!data.openingDay)root.append(el('p','Sin conteo anterior. Todavía no se puede verificar el saldo inicial.'));
 root.append(el('h4','Consumo estimado por ingrediente preparado'));
 const prepared=table(root,['Marca','Motivo','Ingrediente','Consumo']);
 for(const s of data.prepared||[])prepared.row([brands[s.store]||s.store,reasons[s.motivo]||s.motivo,s.ingredient,nt(s.grams)+' g']);
 if(!data.prepared?.length)root.append(el('p','No hay cantidades de recetas verificadas para el período.'));
 for(const s of data.sales||[])root.append(el('p',(brands[s.store]||s.store)+' · '+s.reason+
  (s.partialWindow?' Solo hay ventas sincronizadas de '+hour(s.start)+' a '+hour(s.end)+'.':'')));
 if(data.itemsPending)root.append(el('p',data.itemsPending+' producto(s) sin cobro con receta parcial o sin receta. No se inventaron los gramajes faltantes.'));
 root.append(el('h4','Comparación con el inventario físico'));
 root.append(el('p','Las cantidades de receta se comparan solo cuando hay una equivalencia confirmada entre peso preparado y peso de inventario. El saldo esperado es parcial. Una diferencia no se descuenta ni confirma una pérdida.'));
 const search=el('input');search.type='search';search.placeholder='Buscar insumo, por ejemplo pollo';search.setAttribute('aria-label','Buscar insumo para comparar');root.append(search);
 const t=table(root,['Insumo','Había','Entró','Ventas estimadas','Colaciones','Regalos','Reposición / otros','Merma','Traspaso entra / sale','Debería quedar (parcial)','Quedó contado','Diferencia por revisar']);
 const showMore=button('Mostrar más',()=>{limit+=20;draw();});root.append(showMore);
 let limit=20;
 function draw(){
  t.clear();
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matches=data.rows.filter(row=>norm(row.name).includes(norm(search.value))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  for(const r of matches.slice(0,limit)){
   const f=v=>v===null||v===undefined?'—':nt(v)+' '+r.unit;
   t.row([r.name,f(r.initial),f(r.received),f(r.sales),f(r.staff),f(r.gift),f(r.replacement)+' / '+f(r.other),
    f(r.justified?.waste),f(r.justified?.transferIn)+' / '+f(r.justified?.transferOut),f(r.expected),f(r.final),f(r.difference)]);
  }
  showMore.hidden=matches.length<=limit;
 }
 search.oninput=()=>{limit=20;draw();};draw();
 const regs=data.sinCobro||[];root.append(el('h4','Productos sin cobro de este local'));
 if(!regs.length)root.append(el('p','No se registraron preparaciones sin cobro en este período.'));
 else{
  const t=table(root,['Hora y referencia','Motivo / persona','Productos','Entrega']);
  for(const row of regs){
   const d=row.detalle,e=d.entrega;
   t.row([hour(row.createdAt)+' · '+row.id.slice(0,8),[reasons[d.motivo],d.persona,d.original?'Pedido '+d.original:'',d.nota].filter(Boolean).join(' · '),
    d.items.map(i=>i.cantidad+' × '+labelItem(i)).join(' | '),
    e.modo==='cliente'?'Solo envío recibido '+clp(e.monto)+' · '+e.medio:e.modo==='local'?'Envío cubierto por el local · '+clp(e.monto):e.tipo+' · sin cobro']);
  }
 }
}
function mountReport(calendar){
 if($('ukiConsumoPorDia'))return;
 const node=card('ukiConsumoPorDia','Consumo por día');
 const text=el('p','Ventas, consumos sin cobro y conteo físico en una misma consulta. No modifica existencias.');
 const content=el('div'),state=statusIn(node);node.append(text,content);
 let run=0;
 const go=button('Ver consumo del día',async()=>{
  const actual=++run, dia=$('ukiInvDia')?.value||today();state.textContent='Consultando '+dia+'…';content.replaceChildren();
  try{const r=await request('consumo-por-dia',{dia});if(actual!==run||!node.isConnected)return;state.textContent='Día consultado '+dia;drawReport(content,r);}
  catch(error){if(actual===run&&node.isConnected)state.textContent=error.message;}
 });
 node.insertBefore(go,state);
 // Mantener el reporte dentro de la misma tarjeta que contiene el calendario, incluso si cambia de pestaña.
 calendar.append(node);
 calendar.addEventListener('change',e=>{if(e.target.id==='ukiInvDia'&&content.childNodes.length)queueMicrotask(()=>go.click());});
 calendar.addEventListener('click',e=>{
  if(['ukiInvDiaAnterior','ukiInvDiaHoy','ukiInvDiaSiguiente'].includes(e.target.id)&&content.childNodes.length)queueMicrotask(()=>go.click());
 });
}
function mountShipping(root){
 if($('ukiCajaSoloEnvios'))return;
 const node=card('ukiCajaSoloEnvios','Delivery de productos sin cobro');
 node.append(el('p','Aquí se ven los envíos cobrados y los que cubrió el local. Este registro es separado y no se suma al total del cierre de caja.'));
 const inp=field(node,'Fecha','dia',null,'date');inp.value=today();inp.max=today();
 const state=statusIn(node),content=el('div');node.append(content);
 let run=0;
 const load=button('Consultar delivery',async()=>{
  const current=++run;state.textContent='Consultando…';content.replaceChildren();
  try{
   const data=await request('delivery-sin-cobro',{dia:inp.value});
   if(current!==run||!node.isConnected)return;
   state.textContent='Recibido de clientes: '+clp(data.rows.filter(r=>r.modo==='cliente').reduce((s,r)=>s+r.monto,0));
   if(!data.rows.length){content.textContent='No hay envíos registrados para esta fecha.';return;}
   const t=table(content,['Hora','Motivo','Envío']);
   for(const r of data.rows)t.row([hour(r.createdAt)+' · '+r.id.slice(0,8),reasons[r.motivo],
    r.modo==='cliente'?clp(r.monto)+' recibido · '+r.medio:r.modo==='local'?clp(r.monto)+' cubierto por el local':'Sin pago']);
  }catch(error){if(current===run)state.textContent=error.message;}
 });
 node.insertBefore(load,state);root.insertAdjacentElement('afterend',node);
}
function setup(){
 const app=$('app');if(!app)return;
 let scheduled=false;
 const mount=()=>{
  scheduled=false;
  if(!branch())return;
  const calendar=$('ukiInvCalendario');
  if(calendar&&view()==='inventario')mountReport(calendar);
  const heading=app.querySelector('.section-head');
  if(view()==='nuevo'&&heading&&!$('ukiSinCobroEntrada')&&typeof D!=='undefined'&&!D.editando&&!D.cartaSolicitudRemotaId&&
   heading.querySelector('h2')?.textContent.trim()==='Nuevo pedido')newForm(heading);
  if(view()==='caja'&&heading)mountShipping(heading);
 };
 const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(mount);}});
 observer.observe(app,{subtree:true,childList:true});mount();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
