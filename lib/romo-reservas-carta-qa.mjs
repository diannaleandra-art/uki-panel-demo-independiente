/**
 * Reserva exclusiva Romo con el protocolo ya usado por Uki:
 * una sola persona atiende cada solicitud hasta guardarla o liberarla.
 * No convierte solicitudes en ventas ni toca caja/timbres.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
const STORE='romo:serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function verified({identity,db,id,claimToken}){
 const actor=authorizeRomoOperation(identity,'romo','serena','orders.accept');
 if(!db||typeof db.query!=='function')throw Error('Base Romo obligatoria');
 if(typeof id!=='string'||!UUID.test(id)||typeof claimToken!=='string'||!UUID.test(claimToken))
  throw Error('Solicitud o reserva Romo inválida');
 const hash=createHash('sha256').update('romo-carta-reserva-v1:'+claimToken).digest('hex');
 return {actor,id,hash};
}
function one(rows,id){
 if(!Array.isArray(rows)||rows.length>1)throw Error('Respuesta Romo inconsistente');
 if(!rows.length){
  const error=new Error('Solicitud reservada o procesada en otro dispositivo');
  error.code='ROMO_RESERVA_CONFLICT';throw error;
 }
 if(rows[0].id!==id)throw Error('Respuesta ajena a Romo');
 return rows[0];
}
export async function reservarSolicitudRomoQA(args={}){
 const {db}=args,{actor,id,hash}=verified(args);
 const rows=await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET reserva_token_hash=$3,reserva_hasta=NOW()+INTERVAL '30 minutes',actualizado_por=$4,actualizado_en=NOW() WHERE id=$1::uuid AND store_id=$2 AND estado='pendiente' AND (reserva_token_hash='' OR reserva_token_hash=$3) RETURNING id,reserva_hasta",
  [id,STORE,hash,actor.actorId]
 );
 const result=one(rows,id);
 return Object.freeze({storeId:STORE,id,estado:'reservada',
  reservaHasta:result.reserva_hasta,countsAsSale:false});
}
export async function liberarSolicitudRomoQA(args={}){
 const {db}=args,{id,hash}=verified(args);
 one(await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET reserva_token_hash='',reserva_hasta=NULL,actualizado_en=NOW() WHERE id=$1::uuid AND store_id=$2 AND estado='pendiente' AND reserva_token_hash=$3 RETURNING id",
  [id,STORE,hash]
 ),id);
 return Object.freeze({storeId:STORE,id,estado:'pendiente',
  liberada:true,countsAsSale:false});
}
/* La aceptación NO se expone a la API hasta confirmar en el servidor que
   el pedido está guardado en el estado operativo Romo y no sólo en un celular. */
export const ROMO_ACEPTACION_NO_CONECTADA=true;
