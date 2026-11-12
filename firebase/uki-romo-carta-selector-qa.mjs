/**
 * Carta y precios de Romo: montaje únicamente VISUAL en el panel único Uki.
 * No crea segundo panel, no llama APIs, no usa localStorage, no escribe en Neon.
 * No es autorización: el ingreso de pruebas solo comprueba la contraseña.
 * Hasta validación Google + rol Neon, únicamente vista de catálogo vacío.
 */
import {montarVistaCartaRomoEnPanelUnicoQA} from
  './romo-carta-qa/romo-carta-vista-embebida-qa.mjs';

export const ROMO_CARTA_SELECTOR_SOLO_QA=true;
const STORE='romo:serena';

export function montarCartaRomoDesdeSelectorQA({
  document,selectorValido=false,ingresoLocalVerificado=false,qaOnly=false
}={}){
 if(qaOnly!==true||selectorValido!==true||ingresoLocalVerificado!==true)
  return Object.freeze({montado:false,razon:'Ingreso de pruebas no confirmado'});
 if(!document?.body?.classList?.contains('romo-qa'))
  return Object.freeze({montado:false,razon:'Romo no es el local seleccionado'});
 const host=document.getElementById?.('ukiPreciosPanel');
 if(!host||!document.getElementById('romoLaSerenaPreparacionQA'))
  return Object.freeze({montado:false,razon:'No existe la sección Carta y precios de Romo'});
 // Conexión cerrada: sin token Google y sin rol Neon comprobado no se leen
 // productos reales ni se ofrecen botones de modificación.
 const container=montarVistaCartaRomoEnPanelUnicoQA({
  document,storeId:STORE,snapshot:null
 });
 // Se reemplaza la indicación provisional al terminar la carga visual.
 const waiting=host.querySelector?.('[role="status"]');
 if(waiting?.textContent?.includes('Preparando vista de solo lectura de Romo'))waiting.remove();
 return Object.freeze({montado:true,soloLectura:true,storeId:STORE,
  mensaje:container?.textContent||''});
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
 // El módulo puede cargarse después del primer render en iPhone.
 window.ukiRomoCartaQAMontar();
}
