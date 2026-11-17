/**
 * Mismo panel Uki, tercera sucursal Romo. Transacciones de Caja y cobros.
 * No reimplementa recetas ni precios: reutiliza los candidatos ya aprobados.
 * La única escritura del estado pasa por session.guardar(copia), que cifra
 * AES-GCM y actualiza en Neon con expectedRevision (CAS).
 *
 * NO habilitar desde la vista de consulta, ni usar para aceptar solicitudes
 * de la carta: esas requieren reservar + aceptar en UNA sentencia atómica.
 */
import {moverCajaRomoCandidatoQA} from './uki-romo-movimientos-atomicos-qa.mjs';
import {prepararCobroPendienteRomoQA} from './uki-romo-cobro-pendiente-qa.mjs';
import {prepararPedidoManualPendienteRomoQA} from './uki-romo-pedido-manual-panel-unico-qa.mjs';

const SUCURSAL='Romo’s Sushi La Serena';
export const ROMO_TRANSACCIONES_PANEL_UNICO_QA_HABILITADAS=false;
const requerir=(condicion,mensaje)=>{if(!condicion)throw Error(mensaje)};
const clonar=valor=>JSON.parse(JSON.stringify(valor));

export class RomoConfirmacionInciertaPanelUnicoQA extends Error{
 constructor(){
  super('No se puede confirmar el resultado. Reabre Romo, revisa Neon, pedido y Caja antes de reintentar.');
  this.code='ROMO_REVISAR_NEON_ANTES_DE_REPETIR';
 }
}
export class RomoConfirmadoReleerPanelUnicoQA extends Error{
 constructor(){
  super('Neon confirmó el cambio, pero la pantalla no se actualizó. Reabre sin repetir el cobro.');
  this.code='ROMO_CONFIRMADO_RELEER';
 }
}

/**
 * obtenerVisible devuelve {revision,estado} perteneciente SOLO a Romo.
 * No puede leer `S.pedidos` de Uki ni guardar en localStorage.
 * Session debe ser crearSesionPanelUnicoRomoQA, no un objeto de caja Uki.
 */
export function crearTransaccionesPanelUnicoRomoQA({
 habilitado=ROMO_TRANSACCIONES_PANEL_UNICO_QA_HABILITADAS,
 sesion,obtenerVisible,validarEstado,aplicarConfirmado,
 prepararMovimiento=moverCajaRomoCandidatoQA,
 prepararCobro=prepararCobroPendienteRomoQA,
 prepararPedidoManual=prepararPedidoManualPendienteRomoQA
}={}){
 let ocupado=false,bloqueadoPorIncertidumbre=false;
 const disponible=()=>habilitado===true&&
  sesion?.disponible?.()===true&&typeof sesion?.guardar==='function'&&
  typeof sesion?.estado==='function'&&
  typeof obtenerVisible==='function'&&typeof validarEstado==='function'&&
  typeof aplicarConfirmado==='function';
 async function ejecutar(tipo,datos,confirmacion){
  requerir(disponible(),'Las operaciones de Romo no están habilitadas en el panel único');
  requerir(confirmacion===true,'Confirma la operación real antes de registrarla');
  requerir(!ocupado,'Hay otra operación de Romo pendiente de confirmar');
  requerir(!bloqueadoPorIncertidumbre,
   'Operación anterior con resultado incierto: recarga Neon antes de continuar');
  const remote=sesion.estado(),visible=obtenerVisible();
  requerir(remote?.storeId==='romo:serena'&&remote?.conflicto!==true&&
   Number.isSafeInteger(remote.revision)&&remote.revision>=1,
   'Abre una sesión Neon Romo inicializada y sin conflictos');
  requerir(visible?.revision===remote.revision&&
   validarEstado(visible.estado,SUCURSAL)===true&&
   visible.estado?.suc===SUCURSAL&&
   visible.estado.pedidos.every(p=>p?.suc===SUCURSAL),
   'Los datos visibles no corresponden a la misma revisión de Romo');
  const antes=JSON.stringify(visible.estado);
  const copia=clonar(visible.estado);
  ocupado=true;
  try{
   const detalle=tipo==='cobro'?
    prepararCobro(copia,{...datos,confirmoRecepcion:true}):
    tipo==='pedido_manual'?
     prepararPedidoManual(copia,{...datos,confirmoSinPago:true}):
     prepararMovimiento(copia,{tipo:datos?.tipo,datos:datos?.datos});
   requerir(validarEstado(copia,SUCURSAL)===true,
    'El resultado no corresponde a Romo');
   const vigente=()=>sesion.estado().revision===remote.revision&&
    sesion.estado().conflicto!==true&&
    obtenerVisible()?.revision===remote.revision&&
    JSON.stringify(obtenerVisible()?.estado)===antes;
   requerir(vigente(),'La caja de Romo cambió durante la preparación');
   // Sin mutar la UI: el cifrado y el CAS se producen DENTRO de session.guardar.
   let confirmado;
   try{confirmado=await sesion.guardar(copia)}
   catch{
    bloqueadoPorIncertidumbre=true;
    throw new RomoConfirmacionInciertaPanelUnicoQA();
   }
   if(confirmado?.ok!==true||confirmado?.changed!==true||
      confirmado.revision!==remote.revision+1){
    bloqueadoPorIncertidumbre=true;
    throw new RomoConfirmacionInciertaPanelUnicoQA();
   }
   // El resultado ya se guardó. Nunca volver a enviar el mismo dinero.
   if(obtenerVisible()?.revision!==remote.revision||
      JSON.stringify(obtenerVisible()?.estado)!==antes){
    bloqueadoPorIncertidumbre=true;
    throw new RomoConfirmadoReleerPanelUnicoQA();
   }
   try{await aplicarConfirmado({
    estado:copia,revision:confirmado.revision,detalle,tipo
   })}
   catch{
    bloqueadoPorIncertidumbre=true;
    throw new RomoConfirmadoReleerPanelUnicoQA();
   }
   return Object.freeze({ok:true,storeId:'romo:serena',revision:confirmado.revision,
    detalle,tipo});
  }finally{ocupado=false}
 }
 return Object.freeze({
  disponible,
  estado:()=>Object.freeze({ocupado,bloqueadoPorIncertidumbre}),
  // Pedido nuevo con forma Uki: se guarda SIN PAGO y con folio de turno real.
  guardarPedidoManual:({draft,fechaOperativa,registradoEn,
   confirmoPedidoPendiente=false}={})=>
   ejecutar('pedido_manual',{draft,fechaOperativa,registradoEn},confirmoPedidoPendiente),
  // Solo cobro de un pedido pendiente ya existente; nunca inventar ventas.
  confirmarCobro:({datos,confirmoRecepcion=false}={})=>
   ejecutar('cobro',datos,confirmoRecepcion),
  // Gastos/retiros/deliverys/propinas aplican las validaciones ya existentes.
  guardarMovimiento:({tipo,datos,confirmoOperacion=false}={})=>
   ejecutar('movimiento',{tipo,datos},confirmoOperacion)
 });
}
