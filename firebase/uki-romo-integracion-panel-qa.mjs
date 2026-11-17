/**
 * Preparación del MISMO panel Uki con una tercera sucursal Romo.
 * Instala sólo un adaptador sin publicar. No añade un segundo panel,
 * no escribe Firebase/Firestore y NO habilita transacciones.
 */
import {crearPuenteRomoOperativoQA} from './uki-romo-operativo-qa.mjs';
import {crearSesionPanelUnicoRomoQA} from '../lib/romo-panel-unico-sesion-qa.mjs';
import {cartaRomoDisponibleQA,obtenerCartaRomoPanelQA} from './uki-romo-catalogo-qa.mjs';
import {crearTransaccionesPanelUnicoRomoQA} from './uki-romo-transacciones-panel-unico-qa.mjs';
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
