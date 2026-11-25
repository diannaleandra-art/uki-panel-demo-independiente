/**
 * Conciliación preparatoria de cancelación de Romo.
 * Calcula la versión que debe quedar en Pedidos e Historial del mismo
 * panel Uki, SIN tocar el estado original, Neon, caja ni otra sucursal.
 *
 * No constituye autorización de escritura: el servidor no puede
 * inspeccionar el contenido del sobre AES-GCM del panel.
 */
import {prepararCancelacionRomoQA} from './uki-romo-cancelacion-atomica-qa.mjs';
import {comprobarSoloCancelacionRomoQA} from './uki-romo-cancelacion-diff-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const clon=value=>JSON.parse(JSON.stringify(value));
const fallo=mensaje=>{throw Error(mensaje)};

export function prepararConciliacionCancelacionRomoQA(estado,datos={}){
 if(!estado||typeof estado!=='object'||Array.isArray(estado)||estado.suc!==SUC)
  fallo('Debe abrirse el estado confirmado de Romo La Serena');
 const anterior=clon(estado);
 const copia=clon(estado);
 const pedidoId=Number(datos.pedidoId);
 const prev=(anterior.pedidos||[]).find(p=>p?.id===pedidoId&&p?.suc===SUC);
 if(!prev)fallo('Pedido no encontrado en la copia cifrada de Romo');
 const estadoAnterior=prev.estado;
 const historialAntes=Array.isArray(prev.historialCambios)?prev.historialCambios.length:0;
 const cambio=prepararCancelacionRomoQA(copia,datos);
 const exacto=comprobarSoloCancelacionRomoQA(anterior,copia,datos);
 if(exacto.ok!==true||exacto.afectaCaja!==false)
  fallo('No se pudo aislar una sola cancelación');
 const siguiente=copia.pedidos.find(p=>p?.id===pedidoId&&p?.suc===SUC);
 const historialDespues=siguiente?.historialCambios;
 const evento=historialDespues?.[historialDespues.length-1];
 if(!['Pendiente','Entregado'].includes(estadoAnterior)||siguiente?.estado!=='Cancelado'||
    !Array.isArray(historialDespues)||
    historialDespues.length!==Math.min(100,historialAntes+1)||
    evento?.tipo!=='cancelacion'||
    evento?.anterior!==estadoAnterior||evento?.nuevo!=='Cancelado'||
    evento?.responsable!==String(datos.responsable||'').trim()||
    evento?.motivo!==String(datos.motivo||'').trim()||
    evento?.categoria!==String(datos.categoria||'').trim().toLowerCase())
  fallo('La cancelación no coincide con el historial esperado');
 if(JSON.stringify(anterior)!==JSON.stringify(estado))
  fallo('El estado Romo cambió durante la preparación');
 return Object.freeze({
  estadoPropuesto:copia,
  resumen:Object.freeze({
   pedidoId,categoria:evento.categoria,antes:estadoAnterior,despues:'Cancelado',
   historialAntes,historialDespues:historialDespues.length,
   cobro:false,devolucion:false,modificacionCaja:false,
   guardadoEnNeon:false,verificacion:'solo_preparacion_local',
   comprobacionDeCambios:exacto.operacion
  })
 });
}
