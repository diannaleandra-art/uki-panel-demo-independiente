/**
 * Control local de cambios antes de cifrar una cancelación de Romo.
 * Una comprobación fallida impide enviar el sobre al servidor.
 *
 * Este control protege el flujo legítimo del navegador; el backend no puede
 * leer el contenido AES-GCM. NO se presenta como autorización de escritura
 * ni como prueba criptográfica verificable por Neon.
 */
import {prepararCancelacionRomoQA} from './uki-romo-cancelacion-atomica-qa.mjs';

const SUC='Romo’s Sushi La Serena';

const clonJSON=value=>{
 if(!value||typeof value!=='object'||Array.isArray(value))
  throw Error('Estado de Romo inválido antes de cancelar');
 return JSON.parse(JSON.stringify(value));
};

/**
 * Recalcula de forma determinista la ÚNICA modificación autorizada sobre
 * una copia no mutada del estado. Rechaza cambios en caja, otros pedidos,
 * pagos, propinas, inventario, cierres, historial ajeno y campos ocultos.
 */
export function comprobarSoloCancelacionRomoQA(anterior,candidato,datos={}){
 if(anterior?.suc!==SUC||candidato?.suc!==SUC)
  throw Error('Cancelación de una sucursal incorrecta');
 const previo=clonJSON(anterior),propuesto=clonJSON(candidato);
 const esperado=clonJSON(previo);
 const cambio=prepararCancelacionRomoQA(esperado,datos);
 if(JSON.stringify(esperado)!==JSON.stringify(propuesto))
  throw Error('La operación modifica otros datos de Romo. No se guardó nada.');
 return Object.freeze({
  ok:true,pedidoId:cambio.pedidoId,operacion:'cancelar_sin_cobro',
  afectaCaja:false,requiereRevisionNeon:true
 });
}
