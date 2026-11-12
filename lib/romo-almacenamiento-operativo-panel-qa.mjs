/**
 * Conexión de QA del TERCER local al almacenamiento TOTAL cifrado ya
 * preparado en este mismo repositorio (public.romo_estado_operativo_v1).
 *
 * La foto cifrada representa el mismo estado operativo que el panel Uki:
 * pedidos, cobros, timbres y cierres. No integra el inventario ni la carta,
 * que necesitan su propio servicio. No crea otro panel.
 *
 * Esto se ejecutará en un backend que ya verificó Google y rol Neon de Romo.
 * No se incluye API, endpoint ni credenciales. No hace ninguna conexión aquí.
 * Solo una instancia de DB inyectada por el servidor, nunca por el navegador.
 */
import {
 ROMO_OPERATIVO_STORE_ID,readRomoOperativeState,
 saveRomoOperativeState
} from './romo-estado-operativo-qa.mjs';

export const ROMO_ALMACENAMIENTO_OPERATIVO_SOLO_QA=true;
export function crearAlmacenamientoOperativoRomoQA({db,identity}={}){
 if(!db||typeof db.query!=='function')
  throw Error('Falta conexión privada exclusiva de Romo');
 if(!identity||identity.brand!=='romo'||!Array.isArray(identity.branches)||
    !identity.branches.includes('serena'))
  throw Error('Identidad de Romo sin validación en servidor');
 return Object.freeze({
  storeId:ROMO_OPERATIVO_STORE_ID,
  async read({storeId,area,action,payload,fechaOperativa}={}){
   if(storeId!==ROMO_OPERATIVO_STORE_ID||area!=='operativo'||action!=='read'||
      payload!==null||fechaOperativa!==null)
    throw Error('La lectura del estado Romo pertenece únicamente a su local');
   const result=await readRomoOperativeState({db,identity});
   return Object.freeze({storeId:result.storeId,area:'operativo',
     revision:result.revision,snapshot:result.snapshot});
  },
  async write({storeId,area,action,payload,fechaOperativa}={}){
   if(storeId!==ROMO_OPERATIVO_STORE_ID||area!=='operativo'||action!=='save'||
      fechaOperativa!==null)
    throw Error('No se puede guardar un estado operativo de otro local');
   if(!payload||typeof payload!=='object'||Array.isArray(payload)||
      Object.keys(payload).sort().join('|')!=='expectedRevision|snapshot')
    throw Error('Se requiere únicamente el sobre cifrado y su revisión');
   const result=await saveRomoOperativeState({db,identity,
     expectedRevision:payload.expectedRevision,snapshot:payload.snapshot});
   return Object.freeze({storeId:result.storeId,area:'operativo',revision:result.revision});
  }
 });
}
