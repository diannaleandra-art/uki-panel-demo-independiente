/* Uki Sushi · La MISMA recepción de factura en el panel normal y en el QR de trabajadores.
 * No crea un segundo registro: llama los mismos endpoints, tablas y reglas por sucursal.
 * Solo administración autorizada por Google puede usarla en este panel.
 */
(function(){
'use strict';
const anteriorMontar=window.ukiInventarioMontar;
if(typeof anteriorMontar!=='function')return;
const API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const MODULO='https://uki-sushi-inventario.vercel.app/uki-factura-interfaz-live.mjs?v=20261127-factura-precisa-v1';
const $=id=>document.getElementById(id);
const estado={branch:'',items:[],form:null,open:false,loading:null,modulo:null};
const branchActual=()=>String($('invBranch')?.value||'');
const sucursalNombre=b=>b==='romo'?'Romo La Serena':b==='serena'?'Uki La Serena':'Uki Regimiento Arica';
function mensaje(texto){
 const el=$('ukiFacturaAdminEstado');
 if(el)el.textContent=texto;
}
async function solicitar(action,payload={},branch=estado.branch){
 if(branch==='romo'){
  if(branch!==branchActual()||typeof S==='undefined'||S.suc!=='Romo’s Sushi La Serena')throw Error('Abre Romo');
  const token=await window.ukiInventarioToken?.();if(!token||branch!==branchActual()||S.suc!=='Romo’s Sushi La Serena')throw Error('Ingresa con Google autorizado de Romo');
  const read=action==='articulos',url=read?'/api/romo-inventario-qa':'/api/romo-inventario-facturas';
  const r=await fetch(url,{method:read?'GET':'POST',cache:'no-store',headers:{Authorization:'Bearer '+token,...(read?{}:{'Content-Type':'application/json'})},...(read?{}:{body:JSON.stringify({...payload,action,...(action==='factura-preparar-articulos'?{expectedRevision:estado.revision}:{})})})});
  const json=await r.json().catch(()=>({}));if(!r.ok||json.ok!==true||json.storeId!=='romo:serena')throw Error(json.error||'No se confirmó el registro de Romo');
  if(branch!==branchActual()||S.suc!=='Romo’s Sushi La Serena')throw Error('Cambió la sucursal; actualiza antes de repetir');
  if(read){estado.revision=Number(json.revision);if(!Number.isSafeInteger(estado.revision)||!Array.isArray(json.contenido?.items))throw Error('Inventario sin confirmar');return {items:json.contenido.items.filter(x=>!x.archived).map(x=>({...x,category:x.kind,kind:'inventory',version:estado.revision}))};}
  if(!['factura-consultar','factura-historial'].includes(action)){
   // No actualizar versiones a ciegas tras un reintento: recargar el estado completo.
   if(json.duplicada===true||json.revision!==estado.revision+1){
    const refreshed=await solicitar('articulos',{},branch);estado.items=refreshed.items;
   }else{
    estado.revision=json.revision;estado.items=estado.items.map(x=>({...x,version:json.revision}));
    if(json.item)estado.items=estado.items.map(x=>x.sku===json.item.sku?json.item:x);
   }
  }
  return json;
 }
 if(!['arica','serena'].includes(branch)||branch!==branchActual())
  throw Error('Cambió la sucursal. Abre nuevamente la factura en el local correcto.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Ingresa al panel con Google autorizado.');
 // Captura y valida la sucursal antes Y después de esperar Google.
 if(branch!==branchActual())throw Error('Cambió la sucursal antes de guardar.');
 const r=await fetch(API,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({...payload,branch,action})});
 const body=await r.json().catch(()=>({}));
 if(!r.ok||body.ok!==true||(action==='recibir-panel'&&body.branch!==branch))throw Error(body.error||'El servidor no confirmó la operación.');
 if(branch!==branchActual())throw Error('Cambió la sucursal. Actualiza inventario para comprobar las entradas.');
 return body;
}
async function solicitarManualRomo(write){
 const local=()=>branchActual()==='romo'&&typeof S!=='undefined'&&S.suc==='Romo’s Sushi La Serena';
 if(!local())throw Error('Abre el inventario de Romo.');
 const token=await window.ukiInventarioToken?.();
 if(!token||!local())throw Error('Ingresa con Google autorizado de Romo.');
 const request=async(url,data)=>{
  const r=await fetch(url,{method:data?'POST':'GET',cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
   ...(data?{body:JSON.stringify(data)}:{})});
  const d=await r.json().catch(()=>null);
  if(!local())throw Error('Cambió el local.');
  if(!r.ok||d?.ok!==true)throw Error(d?.error||'No se confirmó la operación de Romo.');
  return d;
 };
 const compartida=async(action,payload={})=>{
  const d=await request(API,{...payload,action,branch:'serena'});
  if(d.branch!=='serena')throw Error('No se confirmó la bodega de La Serena.');
  return d;
 };
 if(!write){
  // Consultar el perfil que ya usa «Existencias» antes de preparar la entrada.
  const d=await request('/api/romo-inventario-qa');
  if(d.storeId!=='romo:serena'||typeof d.bodegaCompartida!=='boolean')
   throw Error('No se confirmó el inventario de Romo.');
  if(d.bodegaCompartida)return {...await compartida('articulos'),perfil:'romo-compartido'};
  if(!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.contenido?.items))
   throw Error('No se confirmó la revisión de Romo.');
  return {perfil:'romo-independiente',items:d.contenido.items.filter(x=>!x.archived).map(x=>({...x,version:d.revision}))};
 }
 const {payload,base,snapshot}=write;
 if(snapshot.perfil==='romo-compartido')return compartida('recibir-panel',payload);
 if(snapshot.perfil!=='romo-independiente')throw Error('Actualiza las existencias de Romo.');
 const old=snapshot.items.find(x=>x.sku===payload.sku);
 if(!old)throw Error('Artículo no encontrado en Romo.');
 // El servidor valida la revisión y rechaza escritura si ahora se usa bodega compartida.
 const d=await request('/api/romo-inventario-qa',{action:'entrada',expectedRevision:payload.expected_version,
  args:{sku:payload.sku,cantidad:base}});
 if(d.storeId!=='romo:serena'||d.revision!==payload.expected_version+1||
    d.change?.sku!==payload.sku||d.change?.tipo!=='entrada')throw Error('No se confirmó el nuevo saldo de Romo.');
 const item={sku:payload.sku,version:d.revision,stock_qty:Math.round((Number(old.stock_qty)+base)*1000)/1000};
 snapshot.items=snapshot.items.map(x=>x.sku===item.sku?{...x,...item}:x);
 return {item};
}
async function cargarArticulos(branch){
 const result=await solicitar('articulos',{},branch);
 if(branch!==estado.branch)return;
 estado.items=result.items||[];
}
function actualizarPanel(branch){
 if(branch!==estado.branch)return;
 // Actualiza existencias y reportes existentes sin volver a registrar mercadería.
 if(branch==='romo'){ $('invRefresh')?.click();$('ukiMiniActualizar')?.click();return; }
 void cargarArticulos(branch).then(()=>{
  if(branch!==estado.branch)return;
  $('invRefresh')?.click();
  $('ukiMiniActualizar')?.click();
 }).catch(e=>mensaje('La entrada quedó registrada. Actualiza inventario: '+e.message));
}
function guardado(result){
 if(result?.item){
  estado.items=estado.items.map(x=>x.sku===result.item.sku?{...x,...result.item}:x);
 }
 actualizarPanel(estado.branch);
}
function nuevos(items){
 const lista=new Map(estado.items.map(x=>[x.sku,x]));
 for(const x of items||[])if(x?.sku)lista.set(x.sku,x);
 estado.items=[...lista.values()];
 actualizarPanel(estado.branch);
}
function usarRecepcionPorCodigo(razon){
 // Cuando Vercel sirve todavía la versión anterior, no llamar a una función
 // que exige el elemento #items del QR. Mantener acceso funcional al trabajador.
 const host=$('ukiFacturaAdminMount');
 if(host){
  host.replaceChildren();
  const link=document.createElement('a');
  link.href=estado.branch==='romo'?'/romo-panel-qa/romo-inventario-trabajador.html':'https://uki-sushi-inventario.vercel.app/';
  link.target='_blank';link.rel='noopener noreferrer';
  link.textContent=estado.branch==='romo'?'Abrir inventario del trabajador (conteo manual)':'Abrir recepción de mercadería con código';
  link.style.cssText='display:inline-block;max-width:100%;padding:11px 13px;margin:5px 0;'+
   'background:#fff1de;color:#87460f;border:1px solid #d9ae85;border-radius:10px;'+
   'font-weight:750;text-decoration:none';
  const info=document.createElement('p');
  info.className='muted';
  info.textContent=estado.branch==='romo'?'La recepción de factura no está disponible aquí. No registres la misma entrega dos veces. El acceso de trabajador permite conteo manual.':'Selecciona '+sucursalNombre(estado.branch)+
   ' e ingresa con el código de inventario. La recepción se guarda en el mismo stock; no la registres dos veces.';
  host.append(link,info);
 }
 mensaje(razon);
}
async function mostrarFactura(){
 const branch=branchActual(),contenedor=$('ukiFacturaAdminMount');
 if(!contenedor||!contenedor.isConnected||!$('ukiFacturaAdminDetails')?.open)return;
 if(branch!==estado.branch)return;
 if(estado.form){
  if(!estado.form.isConnected)contenedor.append(estado.form);
  mensaje('Recepción de factura lista para '+sucursalNombre(branch)+'.');
  return;
 }
 if(estado.loading)return estado.loading;
 estado.loading=(async()=>{
  mensaje('Cargando recepción de facturas…');
  // Reutilizar el módulo del QR. No hay una copia distinta de la lógica de facturas.
  if(!estado.modulo||estado.moduloBranch!==branch){estado.modulo=import(branch==='romo'?'./uki-factura-interfaz-live.mjs?v=20261127-factura-precisa-v1':MODULO);estado.moduloBranch=branch;}
  const [lib]=await Promise.all([estado.modulo,cargarArticulos(branch)]);
  if(branch!==estado.branch||!contenedor.isConnected||!$('ukiFacturaAdminDetails')?.open)return;
  if(lib.facturaAdmiteMontajeAdmin!==true){
   usarRecepcionPorCodigo('El servicio de facturas aún está actualizándose. El acceso con código sigue disponible y registra en el mismo inventario.');
   return;
  }
  lib.iniciarFacturaLive({
   getBranch:()=>branchActual()===branch?branch:'',
   getItems:()=>estado.items,
   post:(action,payload)=>solicitar(action,payload,branch),
   onSaved:guardado,
   onItemsCreated:nuevos,
   mountTarget:contenedor
  });
  estado.form=contenedor.querySelector('#facturaQA');
  mensaje('Factura disponible en '+sucursalNombre(branch)+'. Puedes tomar foto, subir archivo o ingresar líneas manuales.');
 })().catch(e=>{
  usarRecepcionPorCodigo('No se pudo cargar aquí la recepción de facturas. Puedes usar el acceso con código mientras se completa la actualización. Detalle: '+String(e.message||e).slice(0,140));
 }).finally(()=>{estado.loading=null});
 return estado.loading;
}
function historialRecepcionRomo(host){
 const details=document.createElement('details');details.className='card';details.id='romoFacturasHistorial';
 const summary=document.createElement('summary');summary.textContent='Historial de recepción por proveedor y folio';details.append(summary);
 const field=(label,type)=>{const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;l.append(i);details.append(l);return i;};
 const buscar=field('Buscar RUT, folio o producto','search'),desde=field('Desde (última recepción)','date'),hasta=field('Hasta','date');
 const status=document.createElement('p');status.setAttribute('role','status');const list=document.createElement('div');
 let offset=0,busy=false,total=0;
 const button=(text,callback)=>{const b=document.createElement('button');b.type='button';b.className='sm';b.textContent=text;b.onclick=callback;details.append(b);return b;};
 const consultar=button('Buscar',()=>{offset=0;void load();}),anterior=button('Anterior',()=>{offset=Math.max(0,offset-25);void load();}),siguiente=button('Siguiente',()=>{if(offset+25<total){offset+=25;void load();}});
 anterior.disabled=siguiente.disabled=true;
 details.append(status,list);
 const note=document.createElement('p');note.className='muted';note.textContent='Este historial confirma mercadería recibida, no importes pagados. La compra se registra una sola vez en Mi Administración.';
 const admin=document.createElement('a');admin.href='https://uki-sushi-inventario.vercel.app/mi-administracion-duenos.html';admin.target='_blank';admin.rel='noopener noreferrer';admin.textContent='Abrir compras y facturas en Mi Administración';details.append(note,admin);
 async function load(){if(busy||!details.isConnected||branchActual()!=='romo')return;busy=true;consultar.disabled=anterior.disabled=siguiente.disabled=true;status.textContent='Consultando Romo…';
  try{const d=await solicitar('factura-historial',{buscar:buscar.value,desde:desde.value,hasta:hasta.value,offset},'romo');if(!details.isConnected)return;
   if(!Number.isSafeInteger(d.total)||!Array.isArray(d.documentos))throw Error('Historial no confirmado');
   total=d.total;list.replaceChildren();
   for(const doc of d.documentos){const box=document.createElement('details'),title=document.createElement('summary');title.textContent='RUT '+doc.rut+' · Folio '+doc.folio+' · '+doc.lineas+' líneas';box.append(title);for(const e of doc.entregas){const p=document.createElement('p');p.textContent='Línea '+e.linea+' / entrega '+e.entrega+' · '+e.descripcion+' · '+e.cantidad+' '+e.unidad+' · '+new Date(e.fechaMs).toLocaleString('es-CL',{timeZone:'America/Santiago'});box.append(p);}list.append(box);}
   status.textContent=total?total+' documentos · página '+(Math.floor(offset/25)+1):'Sin recepciones registradas en este filtro.';
  }catch(e){list.replaceChildren();status.textContent=String(e.message||e);total=0;}
  finally{busy=false;consultar.disabled=false;anterior.disabled=offset===0;siguiente.disabled=offset+25>=total;}
 }
 details.ontoggle=()=>{if(details.open)void load();};host.append(details);
}
function montar(){
 anteriorMontar();
 const anchor=$('ukiAdminViewHeader'),mini=$('ukiMiniInventario'),branch=branchActual();
 if(!anchor||!mini||!['arica','serena','romo'].includes(branch))return;
 if(estado.branch!==branch){
  // Nunca conservar un documento iniciado para un local en otro local.
  estado.branch=branch;estado.items=[];estado.form=null;estado.open=false;
 }
 const previo=$('ukiRecepcionPanel');
 if(previo?.dataset.sucursal===branch)return;
 previo?.remove();
 const section=document.createElement('section');section.id='ukiRecepcionPanel';section.className='card';
 section.dataset.sucursal=branch;
 section.hidden=!document.querySelector('[data-uki-tab="recibir"][aria-pressed="true"]');
 anchor.after(section);
 const guia=document.createElement('p');
 guia.className='muted';guia.textContent='Elige una opción por entrega. Si ya la registraste en el enlace del equipo, no la ingreses otra vez.';
 section.append(guia);
 function apartado(id,titulo){
  const details=document.createElement('details');details.id=id;
  details.style.cssText='border:1.5px solid #e5bb90;border-radius:14px;background:#fffaf5;margin:10px 0;padding:10px 13px;min-width:0';
  const summary=document.createElement('summary');summary.textContent=titulo;
  summary.style.cssText='cursor:pointer;color:#75441d;font-size:16px;font-weight:800;padding:9px 0';
  details.append(summary);section.append(details);return details;
 }
 const manual=apartado('ukiManualAdminDetails','Registrar manualmente');
 const factura=apartado('ukiFacturaAdminDetails','Registrar con factura');
 const local=()=>section.isConnected&&branch===branchActual()&&branch===estado.branch;
 const manualForm=window.ukiMontarRecepcionManual?.({
  host:manual,local,
  cargar:()=>branch==='romo'?solicitarManualRomo(): solicitar('articulos',{},branch),
  guardar:({base,cantidad,unidad,sku,expected_version},snapshot)=>{
   if(!local())throw Error('Cambió el local.');
   const payload={cantidad,unidad,sku,expected_version};
   if(branch==='romo')return solicitarManualRomo({payload,base,snapshot});
   return solicitar('recibir-panel',payload,branch);
  },
  alGuardar:()=>{
   // Actualizar las consultas existentes. La entrada ya se registró una sola vez.
   $('invRefresh')?.click();
   $('ukiMiniActualizar')?.click();
  }
 });
 manual.addEventListener('toggle',()=>{
  if(manual.open){factura.open=false;manualForm?.cargar();}
 });
 const info=document.createElement('p');
 info.className='muted';info.textContent='Toma una foto, sube el archivo o escribe los productos de la factura. Confirma el folio y las cantidades para evitar duplicados.';
 const status=document.createElement('p');status.id='ukiFacturaAdminEstado';
 status.className='mini-help';status.setAttribute('role','status');
 const host=document.createElement('div');host.id='ukiFacturaAdminMount';
 factura.append(info,status,host);
 const historial=$('ukiHistorial');
 if(branch==='romo'&&historial&&!$('romoFacturasHistorial'))historialRecepcionRomo(historial);
 factura.open=estado.open;
 factura.addEventListener('toggle',()=>{
  estado.open=factura.open;
  if(factura.open){manual.open=false;void mostrarFactura();}
 });
 if(factura.open)void mostrarFactura();
}
window.ukiInventarioMontar=montar;
})();
