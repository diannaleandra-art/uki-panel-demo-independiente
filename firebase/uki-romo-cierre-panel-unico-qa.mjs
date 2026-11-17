/**
 * Cierre definitivo de Romo dentro del MISMO panel Uki (solo preparación QA).
 * No es la escritura genérica: usa el endpoint atómico que guarda snapshot +
 * constancia en una única operación CAS de Neon Romo.
 *
 * Desactivado por defecto. No habilitar con el puente GET entre proyectos:
 * POST sólo puede ejecutarse en el origen Romo autorizado por el servidor.
 */
import {prepararCierreDefinitivoRomoQA} from './uki-romo-cierre-definitivo-qa.mjs';
import {
 prepararResumenCierreRomoDuenosQA,
 vincularResumenConfirmadoRomoDuenosQA
} from './uki-romo-resumen-duenos-qa.mjs';

export const ROMO_CIERRE_PANEL_UNICO_QA_HABILITADO=false;
const SUC='Romo’s Sushi La Serena';
const STORE='romo:serena';
const ENDPOINT='/api/romo-cierre-definitivo-qa';
const check=(v,msg)=>{if(!v)throw Error(msg)};
const clone=v=>JSON.parse(JSON.stringify(v));

/**
 * No expone un URL arbitrario, evita POST entre los proyectos Uki y Romo.
 * El servidor valida por separado entorno, origen, identidad dueños y CAS.
 */
export function crearCierrePanelUnicoRomoQA({
 habilitado=ROMO_CIERRE_PANEL_UNICO_QA_HABILITADO,
 sesion,obtenerVisible,validarEstado,aplicarConfirmado,
 getGoogleToken=()=>globalThis.window?.ukiInventarioToken?.(),
 fetchFn=(url,init)=>globalThis.fetch(url,init)
}={}){
 let ocupado=false,bloqueadoHastaReabrir=false;
 const disponible=()=>habilitado===true&&
  sesion?.disponible?.()===true&&
  typeof sesion?.estado==='function'&&
  typeof sesion?.coincideEstadoOperativo==='function'&&
  typeof sesion?.prepararSobreParaSolicitud==='function'&&
  typeof sesion?.confirmarGuardadoAtomico==='function'&&
  typeof obtenerVisible==='function'&&
  typeof validarEstado==='function'&&
  typeof aplicarConfirmado==='function'&&
  typeof getGoogleToken==='function'&&
  typeof fetchFn==='function';
 async function cerrar({datos,confirmoCierreReal=false}={}){
  check(disponible(),'El cierre definitivo Romo no está habilitado en el panel único');
  check(!ocupado&&!bloqueadoHastaReabrir,
   'Reabre Romo y consulta Historial y Neon antes de repetir un cierre');
  check(confirmoCierreReal===true,'Confirma expresamente el cierre definitivo real');
  ocupado=true;
  try{
   const visible=obtenerVisible(),remote=sesion.estado();
   check(remote.storeId===STORE&&!remote.conflicto&&
    Number.isSafeInteger(remote.revision)&&remote.revision>=1&&
    visible?.revision===remote.revision&&visible?.estado?.suc===SUC&&
    validarEstado(visible.estado,SUC)===true,
    'El estado visible de Romo no coincide con Neon');
   check(sesion.coincideEstadoOperativo(visible.estado)===true,
    'Hay cambios de caja o pedidos pendientes de confirmar');
   // Nunca modificar la pantalla antes de confirmar Neon.
   const copia=clone(visible.estado),expectedRevision=remote.revision;
   const detalle=prepararCierreDefinitivoRomoQA(copia,datos);
   const resumen=prepararResumenCierreRomoDuenosQA(detalle.cierre);
   check(detalle.turnoId===resumen.turno_ref,
    'El resumen y el turno no coinciden');
   const snapshot=await sesion.prepararSobreParaSolicitud(copia,{expectedRevision});
   const token=await getGoogleToken();
   check(typeof token==='string'&&token.length>=30,
    'Accede con Google antes de confirmar el cierre');
   check(sesion.estado().revision===expectedRevision&&
    obtenerVisible()?.revision===expectedRevision,
    'La revisión cambió durante la preparación del cierre');
   // A partir de aquí cualquier error o corte de red requiere relectura:
   // el servidor pudo confirmar aunque la respuesta no llegara al móvil.
   bloqueadoHastaReabrir=true;
   const response=await fetchFn(ENDPOINT,{
    method:'POST',cache:'no-store',credentials:'omit',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({expectedRevision,snapshot,
     turnoId:detalle.turnoId,resumen})
   });
   if(!response?.ok)
    throw Error('No se confirmó el cierre. Reabre Romo, revisa Historial y Neon');
   const resultado=await response.json();
   check(resultado?.ok===true&&resultado.storeId===STORE&&
    resultado.estado==='cierre_confirmado'&&resultado.constancia===true&&
    resultado.turnoId===detalle.turnoId&&
    resultado.revision===expectedRevision+1,
    'Respuesta de cierre no verificable: revisa Neon antes de repetir');
   // Relee ciphertext EXACTO desde Neon antes de actualizar el panel.
   await sesion.confirmarGuardadoAtomico({
    expectedRevision,revision:resultado.revision,snapshot,estado:copia
   });
   const confirmado=vincularResumenConfirmadoRomoDuenosQA(resumen,resultado);
   await aplicarConfirmado({
    estado:copia,revision:resultado.revision,tipo:'cierre_definitivo',
    detalle:{turnoId:detalle.turnoId,resumen:confirmado}
   });
   bloqueadoHastaReabrir=false;
   return Object.freeze({ok:true,storeId:STORE,turnoId:detalle.turnoId,
    revision:resultado.revision,resumen:confirmado});
  }finally{ocupado=false;}
 }
 return Object.freeze({disponible,cerrar});
}
