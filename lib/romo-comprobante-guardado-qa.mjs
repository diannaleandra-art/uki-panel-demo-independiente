/**
 * Comprobante privado de guardado cifrado en Romo.
 *
 * Neon no puede inspeccionar el contenido de AES-GCM. Este comprobante
 * demuestra exclusivamente que un actor autenticado guardó una revisión
 * cifrada y la vinculó con un identificador de solicitud.
 * NO asegura que el contenido cifrado incluya ese pedido: el panel debe
 * guardar el pedido REAL antes de solicitar el comprobante al servidor.
 *
 * Cerrado por defecto. No activar la API sin prueba E2E del guardado.
 */
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

const STORE='romo:serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PEDIDO=/^[0-9]{1,12}$/;
const MAX_AGE_SECONDS=300;
const safe=(s)=>typeof s==='string'&&s.length>0&&s.length<1300;
function validated({db,identity,requestId,claimToken,pedidoId,secret}){
 const actor=authorizeRomoOperation(identity,'romo','serena','orders.accept');
 if(!db||typeof db.query!=='function')throw Error('Base Romo no disponible');
 if(!UUID.test(requestId||'')||!UUID.test(claimToken||'')||
    !PEDIDO.test(pedidoId||'')||typeof secret!=='string'||secret.length<32)
  throw Error('Solicitud, pedido o firma privada inválidos');
 return {actor,hash:createHash('sha256').update('romo-carta-reserva-v1:'+claimToken).digest('hex')};
}
async function persisted(db,revision,actor){
 if(!Number.isSafeInteger(revision)||revision<1)
  throw Error('Revisión operativa inválida');
 const rows=await db.query(
  'SELECT revision, actualizado_por FROM public.romo_estado_operativo_v1 WHERE store_id=$1 LIMIT 1',
  [STORE]
 );
 if(!Array.isArray(rows)||rows.length!==1||
    Number(rows[0].revision)!==revision||rows[0].actualizado_por!==actor)
  throw Error('No se confirmó la revisión guardada de Romo');
}
function signature(text,secret){
 return createHmac('sha256',secret).update(text).digest('base64url');
}
export async function emitirComprobanteRomoQA({
 db,identity,requestId,claimToken,pedidoId,secret,savedResult,
 now=Date.now()
}={}){
 const {actor,hash}=validated({db,identity,requestId,claimToken,pedidoId,secret});
 if(savedResult?.storeId!==STORE||!Number.isSafeInteger(savedResult.revision))
  throw Error('Solo se emiten comprobantes tras guardar el estado real');
 await persisted(db,savedResult.revision,actor.actorId);
 const data={v:1,storeId:STORE,requestId,pedidoId,actorId:actor.actorId,
  revision:savedResult.revision,hash,iat:Math.floor(now/1000)};
 const text=Buffer.from(JSON.stringify(data)).toString('base64url');
 return Object.freeze({comprobante:text+'.'+signature(text,secret),
  storeId:STORE,revision:data.revision,expiresAt:(data.iat+MAX_AGE_SECONDS)*1000});
}
export async function aceptarConComprobanteRomoQA({
 db,identity,requestId,claimToken,pedidoId,secret,comprobante,
 now=Date.now()
}={}){
 const {actor,hash}=validated({db,identity,requestId,claimToken,pedidoId,secret});
 if(!safe(comprobante))throw Error('Falta comprobante del pedido guardado');
 const [content,mac,extra]=comprobante.split('.');
 if(!content||!mac||extra!==undefined||content.length>950||mac.length>100)
  throw Error('Comprobante Romo no reconocido');
 const expected=Buffer.from(signature(content,secret));
 const received=Buffer.from(mac);
 if(expected.length!==received.length||!timingSafeEqual(expected,received))
  throw Error('Comprobante Romo sin firma válida');
 let data;
 try{data=JSON.parse(Buffer.from(content,'base64url').toString('utf8'))}
 catch{throw Error('Comprobante Romo no legible')}
 if(!data||Object.keys(data).sort().join('|')!==
    'actorId|hash|iat|pedidoId|requestId|revision|storeId|v'||
    data.v!==1||data.storeId!==STORE||data.requestId!==requestId||
    data.pedidoId!==pedidoId||data.actorId!==actor.actorId||
    data.hash!==hash||!Number.isSafeInteger(data.iat)||
    now/1000<data.iat-30||now/1000>data.iat+MAX_AGE_SECONDS)
  throw Error('Comprobante Romo no corresponde a esta solicitud');
 await persisted(db,data.revision,actor.actorId);
 const rows=await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET estado='aceptada',pedido_interno=$4,reserva_token_hash='',reserva_hasta=NULL,actualizado_por=$5,actualizado_en=NOW() WHERE id=$1::uuid AND store_id=$2 AND estado='pendiente' AND reserva_token_hash=$3 AND EXISTS (SELECT 1 FROM public.romo_estado_operativo_v1 WHERE store_id=$2 AND revision=$6 AND actualizado_por=$5) RETURNING id,estado,pedido_interno",
  [requestId,STORE,hash,pedidoId,actor.actorId,data.revision]
 );
 if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==requestId||
    rows[0].estado!=='aceptada'||rows[0].pedido_interno!==pedidoId){
  const error=new Error('Solicitud reservada o procesada en otro dispositivo');
  error.code='ROMO_ACEPTACION_CONFLICT';throw error;
 }
 return Object.freeze({storeId:STORE,id:requestId,estado:'aceptada',
  pedidoInterno:pedidoId,countsAsSale:false,whatsappConfirmado:false});
}
export const ROMO_COMPROBANTE_SIN_ACTIVAR=true;
