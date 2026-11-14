/**
 * Preparación del MISMO panel Uki con una tercera sucursal Romo.
 * Instala sólo un adaptador sin publicar. No añade un segundo panel,
 * no escribe Firebase/Firestore y NO habilita transacciones.
 */
import {crearPuenteRomoOperativoQA} from './uki-romo-operativo-qa.mjs';
import {crearSesionPanelUnicoRomoQA} from '../lib/romo-panel-unico-sesion-qa.mjs';
import {cartaRomoDisponibleQA,obtenerCartaRomoPanelQA} from './uki-romo-catalogo-qa.mjs';
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
