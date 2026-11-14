/**
 * Apertura/cierre Romo: snapshot cifrado AES-GCM + revisión CAS.
 * Nunca modifica la pantalla antes de confirmación real de Neon.
 */
import {prepararAperturaTurnoRomoQA,prepararCierreDefinitivoRomoQA}
 from './uki-romo-cierre-definitivo-qa.mjs';
import {prepararResumenCierreRomoDuenosQA,vincularResumenConfirmadoRomoDuenosQA} from './uki-romo-resumen-duenos-qa.mjs';
export const ROMO_TURNOS_GUARDADO_HABILITADO_QA=false;
const SUC='Romo’s Sushi La Serena';
const check=(x,m)=>{if(!x)throw Error(m)};
export class RomoTurnoRevisionInciertaQA extends Error{
 constructor(){super('No se confirmó el cierre; consulta Neon e Historial antes de repetir.');
  this.code='ROMO_CIERRE_REVISAR_NEON'}
}
export class RomoTurnoConfirmadoReleerQA extends Error{
 constructor(){super('Neon confirmó el turno pero la pantalla cambió. Recarga sin repetir la operación.');
  this.code='ROMO_TURNO_CONFIRMADO_RECARGAR'}
}
export function crearGuardadoTurnosRomoQA({
 habilitado=ROMO_TURNOS_GUARDADO_HABILITADO_QA,
 servidor,estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado,
 consultarPendientes
}={}){
 let busy=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor?.guardarSobreCifrado==='function'&&
  typeof servidor?.guardarCierreSobreCifrado==='function';
 async function ejecutar(tipo,datos){
  check(disponible(),'La apertura y el cierre de Romo todavía no están habilitados');
  check(!busy,'Hay otra operación de turno en curso');
  check([estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado].every(
   x=>typeof x==='function'),'El panel no ha conectado el turno Romo');
  const previo=estadoVisible(),revision=previo?.revision;
  check(Number.isSafeInteger(revision)&&revision>=0&&
   validarEstado(previo?.estado,SUC),'Abre primero el estado de Romo en Neon');
  busy=true;
  try{
   const antes=JSON.stringify(previo.estado),copia=JSON.parse(antes);
   let resultado;
   if(tipo==='apertura'){
    resultado=prepararAperturaTurnoRomoQA(copia,datos);
   }else{
    check(typeof consultarPendientes==='function','Falta verificar la bandeja remota');
    // No se usa lista guardada en pantalla: consultar siempre de nuevo.
    const solicitudes=await consultarPendientes();
    check(Array.isArray(solicitudes)&&
     solicitudes.every(x=>x&&typeof x==='object'&&x.branch==='serena'),
     'No se pudo validar la bandeja Romo');
    check(!solicitudes.some(x=>x.estado==='pendiente'),
     'No se puede cerrar: hay solicitudes de carta pendientes o reservadas');
    resultado=prepararCierreDefinitivoRomoQA(copia,datos);
   }
   const resumenDuenosPendiente=tipo==='cierre'?prepararResumenCierreRomoDuenosQA(resultado.cierre):null;
   check(validarEstado(copia,SUC),'Cierre generado fuera de Romo');
   const intacto=()=>{
    const ahora=estadoVisible();
    return ahora?.revision===revision&&JSON.stringify(ahora.estado)===antes;
   };
   check(intacto(),'Romo cambió durante la preparación del turno');
   const snapshot=await cifrarEstado(copia);
   check(snapshot?.sucursal===SUC&&snapshot?.formato==='uki-v813-browser',
    'No se cifró correctamente el cierre Romo');
   check(intacto(),'El estado Romo cambió durante el cifrado');
   let confirmado;
   try{
    confirmado=tipo==='cierre'?
     await servidor.guardarCierreSobreCifrado({
      snapshot,revision,turnoId:resultado.turnoId,
      resumen:resumenDuenosPendiente
     }):
     await servidor.guardarSobreCifrado({snapshot,revision});
   }catch{
    // 409 y pérdida de respuesta requieren lectura del estado vigente,
    // nunca reintento automático de una operación de caja.
    throw new RomoTurnoRevisionInciertaQA();
   }
   if(confirmado?.revision!==revision+1)
    throw new RomoTurnoRevisionInciertaQA();
   if(!intacto())throw new RomoTurnoConfirmadoReleerQA();
   try{
    await aplicarConfirmado({estado:copia,revision:confirmado.revision,
     tipo,resultado});
   }catch{throw new RomoTurnoConfirmadoReleerQA()}
   // Solo se entrega un resumen de Romo tras la confirmación real del turno.
   // Queda PENDIENTE el transporte privado a Mi Administración.
   const resumenDuenosQA=tipo==='cierre'?
    vincularResumenConfirmadoRomoDuenosQA(resumenDuenosPendiente,
     confirmado):null;
   return Object.freeze({ok:true,tipo,revision:confirmado.revision,
    turnoId:resultado.turnoId,resultado,resumenDuenosQA});
  }finally{busy=false}
 }
 return Object.freeze({
  disponible,
  abrir:datos=>ejecutar('apertura',datos),
  cerrar:datos=>ejecutar('cierre',datos)
 });
}
