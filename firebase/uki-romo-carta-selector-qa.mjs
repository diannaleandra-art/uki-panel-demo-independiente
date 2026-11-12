/**
 * Tercera entrada en el MISMO panel: administración de Romo La Serena.
 * Se renderiza la plantilla ORIGINAL de Uki (window.ukiInventarioPanelHTML)
 * y sus 4 secciones. No se monta window.ukiInventarioMontar, pues sus
 * rutas siguen apuntando a Neon Uki y nunca deben usarse en Romo.
 *
 * El módulo sólo maneja navegación de presentación. Todo campo que
 * podría escribir una venta, inventario, timbre o promoción está desactivado.
 * Sin servicios externos, sin productos inventados y sin credenciales.
 */
export const ROMO_CARTA_SELECTOR_SOLO_QA=true;
const STORE='romo:serena';
const TABS=Object.freeze([
 ['precios','Carta y precios'],
 ['disponibilidad','Disponible / Agotado'],
 ['inventario','Inventario'],
 ['reportes','Revisiones y compras']
]);
const SHOW={
 precios:['ukiPreciosPanel'],
 disponibilidad:['ukiCartaDisponibilidad'],
 inventario:['ukiInvSectionHead','invRoot','invAdmin','invNewBox','ukiInvWorkerAccess','ukiMiniInventario'],
 reportes:['ukiReponerPanel','ukiHistorial','invReportsBox']
};
const IDS=[...new Set(Object.values(SHOW).flat())];
const $=(document,id)=>document.getElementById(id);
function quitarPizzasDeRomo(document){
 for(const option of document.querySelectorAll('#ukiPreciosPanel option[value="pizza"], #ukiPreciosPanel option[value="pizzas"]'))
  option.remove();
 const productSearch=$(document,'ukiPriceSearch');
 if(productSearch)productSearch.placeholder='Gohan, burger, 24 piezas…';
 const newName=$(document,'ukiPriceNewName');
 if(newName)newName.placeholder='Ej. Gohan especial Romo';
 const addBox=$(document,'ukiPriceAddBox');
 if(addBox){
  const intro=addBox.querySelector('p.muted');
  if(intro)intro.textContent='Mismas opciones de Uki, con productos exclusivos de Romo y sin pizzas.';
 }
}
function bloqueado(document){
 const area=$(document,'app');
 if(!area)return;
 const buttons=area.querySelectorAll('button');
 for(const b of buttons)b.disabled=true;
 for(const el of area.querySelectorAll('input, select, textarea'))el.disabled=true;
 for(const a of area.querySelectorAll('a[href]')){
  a.removeAttribute('href');a.setAttribute('aria-disabled','true');
 }
 for(const form of area.querySelectorAll('form'))form.addEventListener('submit',e=>e.preventDefault());
}
function setStatus(document,id,message){
 const el=$(document,id);if(el)el.textContent=message;
}
export function montarCartaRomoDesdeSelectorQA({
 document,selectorValido=false,ingresoLocalVerificado=false,qaOnly=false
}={}){
 if(qaOnly!==true||selectorValido!==true||ingresoLocalVerificado!==true)
  return Object.freeze({montado:false,razon:'Ingreso de pruebas no confirmado'});
 if(!document?.body?.classList?.contains('romo-qa'))
  return Object.freeze({montado:false,razon:'Romo no es el local seleccionado'});
 const host=$(document,'ukiInvTabs'),price=$(document,'ukiPreciosPanel');
 if(!host||!price||!$(document,'romoLaSerenaPreparacionQA'))
  return Object.freeze({montado:false,razon:'No está disponible la plantilla original de Uki'});
 // Nunca invocar el montaje real de Uki. Aún conectaría Arica o Serena.
 bloqueado(document);
 quitarPizzasDeRomo(document);
 const header=host.querySelector('h2');
 if(header)header.textContent='Administrar Romo’s Sushi';
 setStatus(document,'ukiInvSucursalActiva','Sucursal actual: Romo’s Sushi La Serena · Balmaceda 1612.');
 setStatus(document,'ukiInvSucursalActual','Romo’s Sushi La Serena');
 setStatus(document,'ukiPriceMessage','Catálogo Romo todavía no conectado. Se conservarán los productos y promociones propios.');
 setStatus(document,'ukiReponerEstado','Compras y reposición de Romo pendientes de conexión independiente.');
 setStatus(document,'invStatus','Inventario de Romo pendiente de conexión independiente.');
 const promos=$(document,'ukiPromosListaResumen');
 if(promos)promos.textContent='Las promociones de Romo aparecerán aquí al conectar su propio catálogo.';
 const search=$(document,'ukiPromoBuscar');
 if(search)search.disabled=true;
 let activeTab='precios';
 function choose(tab){
  if(!TABS.some(([id])=>id===tab))return false;
  activeTab=tab;
  for(const [id,name] of TABS){
   const button=host.querySelector('[data-uki-tab="'+id+'"]');
   if(button){
    const current=id===tab;
    button.disabled=false;button.setAttribute('aria-pressed',String(current));
    if(current)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
    const title=button.querySelector('strong');
    if(title)title.textContent=(current?'✓ ':'')+name;
   }
  }
  const data=TABS.find(x=>x[0]===tab);
  setStatus(document,'ukiAdminCurrentTitle',data[1]);
  const descriptions={
   precios:'Productos, ingredientes, promociones y descuentos de Romo',
   disponibilidad:'Los agotados se gestionarán por sucursal',
   inventario:'Existencias y conteos de Romo',
   reportes:'Revisiones y compras independientes'
  };
  setStatus(document,'ukiAdminCurrentDescription',descriptions[tab]);
  for(const id of IDS){
   const element=$(document,id);if(!element)continue;
   const visible=(SHOW[tab]||[]).includes(id);
   element.style.display=visible?'':'none';
   if(id==='ukiHistorial')element.hidden=!visible;
  }
  return true;
 }
 for(const [id] of TABS){
  const button=host.querySelector('[data-uki-tab="'+id+'"]');
  if(button)button.onclick=()=>{choose(id);button.scrollIntoView?.({block:'nearest'})};
 }
 const change=$(document,'ukiAdminCambiar');
 if(change){
  change.disabled=false;
  change.onclick=()=>host.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 choose(activeTab);
 const waiting=price.querySelector?.('[role="status"]');
 if(waiting?.textContent?.includes('Preparando vista de solo lectura de Romo'))waiting.remove();
 // El retorno no representa una autorización de Neon, solo un montaje visual.
 return Object.freeze({montado:true,soloLectura:true,storeId:STORE,tabs:TABS.map(x=>x[0])});
}
if(typeof window!=='undefined'){
 window.ukiRomoCartaQAMontar=()=>{
  if(typeof window.ukiRomoCartaQAContexto!=='function')return false;
  const context=window.ukiRomoCartaQAContexto();
  const result=montarCartaRomoDesdeSelectorQA({
   document,selectorValido:context?.storeId===STORE,
   ingresoLocalVerificado:context?.localProofOk===true,
   qaOnly:context?.qaOnly===true
  });
  return result.montado===true;
 };
 window.ukiRomoCartaQAMontar();
}
