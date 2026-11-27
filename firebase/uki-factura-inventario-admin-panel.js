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
const sucursalNombre=b=>b==='serena'?'Uki La Serena':'Uki Regimiento Arica';
function mensaje(texto){
 const el=$('ukiFacturaAdminEstado');
 if(el)el.textContent=texto;
}
async function solicitar(action,payload={},branch=estado.branch){
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
async function cargarArticulos(branch){
 const result=await solicitar('articulos',{},branch);
 if(branch!==estado.branch)return;
 estado.items=result.items||[];
}
function actualizarPanel(branch){
 if(branch!==estado.branch)return;
 // Actualiza existencias y reportes existentes sin volver a registrar mercadería.
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
  link.href='https://uki-sushi-inventario.vercel.app/';
  link.target='_blank';link.rel='noopener noreferrer';
  link.textContent='Abrir recepción de mercadería con código';
  link.style.cssText='display:inline-block;max-width:100%;padding:11px 13px;margin:5px 0;'+
   'background:#fff1de;color:#87460f;border:1px solid #d9ae85;border-radius:10px;'+
   'font-weight:750;text-decoration:none';
  const info=document.createElement('p');
  info.className='muted';
  info.textContent='Selecciona '+sucursalNombre(estado.branch)+
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
  if(!estado.modulo)estado.modulo=import(MODULO);
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
function montar(){
 anteriorMontar();
 const anchor=$('ukiAdminViewHeader'),mini=$('ukiMiniInventario'),branch=branchActual();
 if(!anchor||!mini||!['arica','serena'].includes(branch))return;
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
  cargar:()=>solicitar('articulos',{},branch),
  guardar:({base,cantidad,unidad,sku,expected_version},snapshot)=>{
   if(!local())throw Error('Cambió el local.');
   const payload={cantidad,unidad,sku,expected_version};
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

 factura.open=estado.open;
 factura.addEventListener('toggle',()=>{
  estado.open=factura.open;
  if(factura.open){manual.open=false;void mostrarFactura();}
 });
 if(factura.open)void mostrarFactura();
}
window.ukiInventarioMontar=montar;
})();
