/**
 * Romo La Serena · QA: guardado seguro desde el formulario existente de Uki.
 * Conserva el estado anterior hasta confirmación de Neon. CERRADO por defecto.
 */
import {verificarBorradorRomoAntesGuardarQA} from './uki-romo-recepcion-formulario-qa.mjs';
import {construirCandidatoRomoFormatoUkiQA} from './uki-romo-pedido-formato-qa.mjs';
export const ROMO_GUARDADO_ATOMICO_HABILITADO_QA=false;
const SUC='Romo’s Sushi La Serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clone=x=>JSON.parse(JSON.stringify(x));
const need=(ok,msg)=>{if(!ok)throw Error(msg)};
export class RomoGuardadoInciertoQA extends Error{
 constructor(message){super(message);this.code='ROMO_REVISAR_SOLICITUD';}
}
export class RomoYaGuardadoQA extends Error{
 constructor(message,pedidoId){super(message);this.code='ROMO_CONFIRMADO_RECARGAR';this.pedidoId=pedidoId;}
}
/**
 * construirCandidato usa las reglas del mismo ndGuardar de Uki sobre UNA COPIA.
 * aplicarConfirmado actualiza el panel solo despues de aceptar en Neon.
 * Nunca usar localStorage como confirmación de una operación Romo.
 */
export function crearGuardadoRomoDesdeFormularioQA({
 habilitado=ROMO_GUARDADO_ATOMICO_HABILITADO_QA,bandeja,
 construirCandidato,contextoPedido,cifrarEstado,validarEstado,estadoVisible,aplicarConfirmado,
 nuevoToken=()=>globalThis.crypto.randomUUID()
}={}){
 const disponible=()=>habilitado===true&&bandeja?.disponible?.()===true;
 // Conserva el constructor anterior; si el panel proporciona el folio y
 // turno real de Uki, usa el constructor equivalente para Romo.
 const preparar=typeof construirCandidato==='function'?construirCandidato:
  typeof contextoPedido==='function'?
   async({estado,draft})=>construirCandidatoRomoFormatoUkiQA({
    estado,draft,contexto:await contextoPedido({estado,draft})
   }):null;
 let ocupado=false;
 return Object.freeze({
  disponible,
  async guardarSolicitud({solicitud,draft,estado,revision,snapshotAnterior=null,
    confirmoArmado=false,confirmoImportes=false}={}){
   need(disponible(),'Guardado Romo deshabilitado');
   need(!ocupado,'Ya se esta guardando una solicitud');
   need([preparar,cifrarEstado,validarEstado,estadoVisible,aplicarConfirmado]
     .every(f=>typeof f==='function'),'Falta conexion del formulario habitual');
   need(solicitud?.estado==='pendiente'&&UUID.test(String(solicitud.id||'')),'Solicitud no pendiente');
   need(Number.isSafeInteger(revision)&&revision>=0,'Revision invalida');
   need(validarEstado(estado,SUC),'Estado no pertenece a Romo');
   const original=clone(estado),firma=JSON.stringify(original),id=solicitud.id;
   verificarBorradorRomoAntesGuardarQA(draft,{solicitudId:id,confirmoArmado,confirmoImportes});
   need(!original.pedidos.some(p=>p.suc===SUC&&p.cartaSolicitudRemotaId===id),
     'Esta solicitud ya tiene un pedido incluso si fue cancelado');
   ocupado=true;
   try{
    const candidato=clone(original),draftAislado=clone(draft);
    const created=await preparar({estado:candidato,draft:draftAislado});
    const pedidoId=Number(created?.pedidoId);
    need(Number.isSafeInteger(pedidoId)&&pedidoId>0,'Falta numero de pedido interno');
    need(validarEstado(candidato,SUC),'Estado candidato invalido');
    const prevIds=new Set(original.pedidos.map(x=>x.id));
    const nuevos=candidato.pedidos.filter(x=>!prevIds.has(x.id));
    need(nuevos.length===1&&nuevos[0].id===pedidoId&&nuevos[0].suc===SUC&&
      nuevos[0].cartaSolicitudRemotaId===id,'No se creo exactamente un pedido Romo');
    need(Array.isArray(nuevos[0].productos)&&nuevos[0].productos.length>0&&
      Number.isSafeInteger(Number(nuevos[0].total))&&
      (nuevos[0].pagado===true||nuevos[0].pagado===false),'Venta candidata incompleta');
    const sigueIgual=()=>estadoVisible()?.revision===revision&&
      JSON.stringify(estadoVisible()?.estado)===firma;
    need(sigueIgual(),'Romo cambio durante la revision');
    const snapshot=await cifrarEstado(candidato,snapshotAnterior);
    need(snapshot?.sucursal===SUC&&snapshot?.formato==='uki-v813-browser',
      'Respaldo cifrado de otra sucursal');
    need(sigueIgual(),'Romo cambio durante el cifrado');
    const claimToken=nuevoToken();
    need(typeof claimToken==='string'&&UUID.test(claimToken),'Reserva invalida');
    await bandeja.reservar(id,claimToken);
    // No liberar automáticamente: una interrupcion posterior puede ser incierta.
    let resultado;
    try{
     need(sigueIgual(),'Romo cambio despues de reservar');
     resultado=await bandeja.confirmarGuardado({id,claimToken,pedidoId:String(pedidoId),
       expectedRevision:revision,snapshot});
     need(resultado?.estado==='aceptada'&&resultado.pedido_interno===String(pedidoId)&&
       resultado.revision===revision+1,'No se confirmo el pedido exacto');
    }catch(error){
     throw new RomoGuardadoInciertoQA(
      'Revisa la bandeja, caja e historial antes de volver a intentar: '+String(error.message||error)
     );
    }
    if(!sigueIgual())throw new RomoYaGuardadoQA(
      'Pedido confirmado en Romo. Actualiza la vista, no lo registres de nuevo.',pedidoId);
    try{
     await aplicarConfirmado({estado:candidato,revision:resultado.revision,pedidoId,solicitudId:id});
    }catch{
     throw new RomoYaGuardadoQA(
      'Pedido confirmado en Romo, pero no se actualizo la pantalla. Recarga.',pedidoId);
    }
    return Object.freeze({ok:true,estado:'aceptada',pedidoId,revision:resultado.revision});
   }finally{ocupado=false;}
  }
 });
}
