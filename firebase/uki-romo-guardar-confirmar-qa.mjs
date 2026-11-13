/**
 * Romo, MISMO motor de pedido Uki: coordinador de guardado cifrado y aceptación.
 * Por ahora solo QA. Los callbacks reales NO se conectan al botón de producción
 * hasta completar una prueba E2E con dos sesiones Google y misma caja.
 *
 * Una solicitud NO cuenta dos veces como venta. Aceptación remota sólo después
 * de haber confirmado la revisión cifrada guardada y el comprobante del servidor.
 */
import {validarPedidoGuardadoEnEstadoRomoQA} from './uki-romo-operativo-qa.mjs';
const STORE='romo:serena';
const isRevision=n=>Number.isSafeInteger(n)&&n>=0&&n<Number.MAX_SAFE_INTEGER;
export async function coordinarGuardadoYAceptacionRomoQA({
 estado,revision,solicitudCarta,guardarEstadoCifrado,confirmarEnBandeja
}={}){
 if(!isRevision(revision)||typeof guardarEstadoCifrado!=='function'||
    typeof confirmarEnBandeja!=='function')
  throw Error('Conexiones privadas de Romo no preparadas');
 // Ninguna API, caja ni token se utiliza si el pedido todavía no existe
 // en el estado que guardará el motor original.
 const enlace=validarPedidoGuardadoEnEstadoRomoQA(estado,solicitudCarta);
 let saved;
 try{
  saved=await guardarEstadoCifrado({estado,revision,solicitudCarta:enlace});
 }catch(error){
  return Object.freeze({storeId:STORE,estado:'guardado_no_confirmado',
   pedidoId:enlace.pedidoId,aceptada:false,cuentaVentaAdicional:false,
   requiereConciliacion:true});
 }
 // Un POST puede haber guardado la revisión aunque se pierda su respuesta.
 // NO repetir automáticamente, para no duplicar el pedido ni la caja.
 if(!saved||saved.revision!==revision+1||
    typeof saved.comprobante!=='string'||saved.comprobante.length<70||
    !Number.isFinite(saved.expiresAt)||saved.expiresAt<=Date.now()){
  return Object.freeze({storeId:STORE,estado:'respaldo_pendiente_de_conciliar',
   pedidoId:enlace.pedidoId,aceptada:false,cuentaVentaAdicional:false,
   requiereConciliacion:true});
 }
 let confirmation;
 try{
  confirmation=await confirmarEnBandeja({
   storeId:STORE,estado:'aceptada',id:enlace.requestId,
   claimToken:enlace.claimToken,pedidoId:enlace.pedidoId,
   comprobante:saved.comprobante
  });
 }catch(error){
  return Object.freeze({storeId:STORE,estado:'respaldo_guardado_solicitud_pendiente',
   revision:saved.revision,pedidoId:enlace.pedidoId,aceptada:false,
   cuentaVentaAdicional:false,requiereConciliacion:true});
 }
 if(confirmation?.storeId!==STORE||confirmation?.estado!=='aceptada'||
    String(confirmation.pedidoInterno)!==enlace.pedidoId||
    confirmation.countsAsSale!==false||
    confirmation.whatsappConfirmado!==false){
  return Object.freeze({storeId:STORE,estado:'respaldo_guardado_solicitud_pendiente',
   revision:saved.revision,pedidoId:enlace.pedidoId,aceptada:false,
   cuentaVentaAdicional:false,requiereConciliacion:true});
 }
 return Object.freeze({storeId:STORE,estado:'aceptada',revision:saved.revision,
  pedidoId:enlace.pedidoId,aceptada:true,
  cuentaVentaAdicional:false,requiereConciliacion:false});
}
export const ROMO_GUARDADO_Y_ACEPTACION_NO_PUBLICADOS=true;
if(typeof window!=='undefined'){
 // No habilitar operaciones por el solo hecho de incluir este módulo.
 window.ukiRomoConfirmacionDisponibleQA=()=>false;
}
