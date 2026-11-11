/* Uki Sushi · La MISMA recepción de factura en el panel normal y en el QR de trabajadores.
 * No crea un segundo registro: llama los mismos endpoints, tablas y reglas por sucursal.
 * Solo administración autorizada por Google puede usarla en este panel.
 */
(function(){
'use strict';
const anteriorMontar=window.ukiInventarioMontar;
if(typeof anteriorMontar!=='function')return;
const API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const MODULO='https://uki-sushi-inventario.vercel.app/uki-factura-interfaz-live.mjs?v=uki-facturas-montaje-admin-v2-20261111';
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
 if(!token)throw Error('Para recibir facturas desde el panel, entra con Google autorizado.');
 // Captura y valida la sucursal antes Y después de esperar Google.
 if(branch!==branchActual())throw Error('Cambió la sucursal antes de guardar.');
 const r=await fetch(API,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({...payload,branch,action})});
 const body=await r.json().catch(()=>({}));
 if(!r.ok||body.ok!==true)throw Error(body.error||'No se confirmó el registro de la factura.');
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
 const mini=$('ukiMiniInventario'),branch=branchActual();
 if(!mini||!['arica','serena'].includes(branch))return;
 if(estado.branch!==branch){
  // Nunca conservar un documento iniciado para un local en otro local.
  estado.branch=branch;estado.items=[];estado.form=null;estado.open=false;
 }
 let details=$('ukiFacturaAdminDetails');
 if(!details){
  details=document.createElement('details');details.id='ukiFacturaAdminDetails';
  details.style.cssText='border:1.5px solid #e5bb90;border-radius:14px;background:#fffaf5;margin:14px 0;padding:11px 13px';
  const summary=document.createElement('summary');
  summary.textContent='📷 Recibir mercadería con factura';
  summary.style.cssText='cursor:pointer;color:#87460f;font-size:16px;font-weight:800;padding:6px 0';
  const info=document.createElement('p');
  info.className='muted';info.textContent=
   'Disponible también para administración: foto, PDF o ingreso manual. Misma sucursal y mismo control de duplicados que el acceso del trabajador.';
  const status=document.createElement('p');status.id='ukiFacturaAdminEstado';
  status.className='mini-help';status.setAttribute('role','status');
  status.textContent='Abre este apartado para cargar las facturas.';
  const host=document.createElement('div');host.id='ukiFacturaAdminMount';
  details.append(summary,info,status,host);
  const antes=mini.querySelector('.uki-mini-fields');
  if(antes)mini.insertBefore(details,antes);else mini.append(details);
 }
 details.open=estado.open;
 if(estado.form&&details.open){
  const host=$('ukiFacturaAdminMount');
  if(host&&!estado.form.isConnected)host.append(estado.form);
 }
 details.ontoggle=()=>{
  estado.open=details.open;
  if(details.open)void mostrarFactura();
 };
 if(details.open)void mostrarFactura();
}
window.ukiInventarioMontar=montar;
})();
