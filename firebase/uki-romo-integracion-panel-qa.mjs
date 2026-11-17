/**
 * Preparación del MISMO panel Uki con una tercera sucursal Romo.
 * Instala sólo un adaptador sin publicar. No añade un segundo panel,
 * no escribe Firebase/Firestore y NO habilita transacciones.
 */
import {crearPuenteRomoOperativoQA} from './uki-romo-operativo-qa.mjs';
import {crearSesionPanelUnicoRomoQA} from '../lib/romo-panel-unico-sesion-qa.mjs';
import {cartaRomoDisponibleQA,obtenerCartaRomoPanelQA} from './uki-romo-catalogo-qa.mjs';
import {crearTransaccionesPanelUnicoRomoQA} from './uki-romo-transacciones-panel-unico-qa.mjs';
import {crearBandejaRomoMismoPanelQA} from './uki-romo-recepcion-formulario-qa.mjs';
import {crearGuardadoRomoDesdeFormularioQA} from './uki-romo-guardado-atomico-qa.mjs';
import {obtenerTurnoRomoFolioQA} from './uki-romo-folio-turno-qa.mjs';
const unsupported=()=>{throw Error('Utiliza únicamente el cifrado de uki-sushi-local.html');};
const vault=crearPuenteRomoOperativoQA({
 cifrar:unsupported,descifrar:unsupported,validarEstado:()=>false
});
const session=crearSesionPanelUnicoRomoQA({
 vault,
 validarEstado:(datos,sucursal)=>{
  const func=window.ukiRomoValidarEstadoSucursalQA;
  return typeof func==='function'&&func(datos,sucursal)===true;
 },
 desbloquearSobre:unsupported,
 prepararEstadoInicial:unsupported
});
window.ukiRomoSesionRemotaQA=session;

window.ukiRomoCatalogoDisponibleQA=cartaRomoDisponibleQA;
window.ukiRomoCatalogoLeerQA=()=>obtenerCartaRomoPanelQA();

/**
 * Misma sesión de Romo y mismo estado visible del panel aprobado Uki.
 * El factory permanece DESACTIVADO por defecto; no hay URL POST activa.
 * Cuando se autorice el piloto, los cobros y movimientos se confirman
 * en Neon ANTES de reemplazar la vista, nunca mediante guardarEnLocalStorage.
 */
window.ukiRomoTransaccionesPanelUnicoQA=crearTransaccionesPanelUnicoRomoQA({
 sesion:session,
 obtenerVisible:()=>{
  const visible=window.ukiQAGet?.();
  if(visible?.suc!=='Romo’s Sushi La Serena')return null;
  const remoto=session.estado();
  return {revision:remoto.revision,estado:visible.estado};
 },
 validarEstado:(datos,sucursal)=>
  window.ukiRomoValidarEstadoSucursalQA?.(datos,sucursal)===true,
 aplicarConfirmado:async({estado,revision,tipo,detalle})=>{
  const aplicar=window.ukiRomoAplicarConfirmadoPanelUnicoQA;
  if(typeof aplicar!=='function')throw Error('No se puede confirmar la pantalla');
  await aplicar({estado,revision,tipo,detalle});
 }
});

/*
 * Aceptación de solicitudes de carta Romo: NO emplear session.guardar()
 * porque dejaría pendiente el estado de la solicitud. Usa reserva y PATCH
 * atómico del backend con expectedRevision. Después verifica el ciphertext
 * exacto con un GET a Neon ANTES de instalar el pedido en el panel.
 *
 * Desactivado por defecto. No se puede invocar desde consulta pública QA.
 */
const bandejaRomoPanelUnicoQA=crearBandejaRomoMismoPanelQA();
const visibleRomoPanelUnicoQA=()=>{
 const v=window.ukiQAGet?.();
 if(v?.suc!=='Romo’s Sushi La Serena')return null;
 return {revision:session.estado().revision,estado:v.estado};
};
window.ukiRomoSolicitudesGuardarPanelUnicoQA=crearGuardadoRomoDesdeFormularioQA({
 bandeja:bandejaRomoPanelUnicoQA,
 estadoVisible:visibleRomoPanelUnicoQA,
 validarEstado:(datos,sucursal)=>
  window.ukiRomoValidarEstadoSucursalQA?.(datos,sucursal)===true,
 contextoPedido:async({estado,draft})=>{
  const registradoEn=Date.now(),fechaOperativa=String(estado?.fechaOperativa||'');
  const folio=obtenerTurnoRomoFolioQA(estado,{fechaOperativa,registradoEn});
  return {numeroTurno:folio.numero,turnoClave:folio.clave,registradoEn,
   fechaISO:new Date(registradoEn).toISOString(),
   // No convertir solicitudes en ventas pagadas sin cobro real confirmado.
   confirmoPago:false,confirmoDiferenciaTotal:false};
 },
 cifrarEstado:async(estado)=>{
  const visible=visibleRomoPanelUnicoQA();
  if(!visible||session.coincideEstadoOperativo(visible.estado)!==true)
   throw Error('Hay cambios sin confirmar. Reabre Romo antes de aceptar la solicitud');
  const revision=session.estado().revision;
  return session.prepararSobreParaSolicitud(estado,{expectedRevision:revision});
 },
 aplicarConfirmado:async({estado,revision,snapshot,expectedRevision,pedidoId})=>{
  await session.confirmarGuardadoAtomico({estado,revision,snapshot,expectedRevision});
  const aplicar=window.ukiRomoAplicarConfirmadoPanelUnicoQA;
  if(typeof aplicar!=='function')throw Error('No está disponible el panel operativo de Romo');
  await aplicar({estado,revision,tipo:'pedido_carta',detalle:{pedidoId}});
 }
});
