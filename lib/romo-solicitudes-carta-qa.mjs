/**
 * Recepción Romo La Serena · QA privada.
 * Exclusivamente la tabla romo_solicitudes_carta_v1 de Neon Romo.
 * La solicitud no es venta; la aceptación y el guardado cifrado son atómicos.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {validateRomoEncryptedState,romoOperativoConfig} from './romo-estado-operativo-qa.mjs';

const STORE='romo:serena',BRANCH='serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[A-Za-z0-9_-]{12,100}$/;
const fields=['cliente','codigoPedido','cotizacion','key','mensaje','storeId','telefono','totalIndicado'];
const fail=(status,message)=>Object.assign(new Error(message),{status});
const str=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max?v.trim():null;
const validId=id=>typeof id==='string'&&UUID.test(id);
const hashToken=t=>createHash('sha256').update('romo-carta-reserva-v1:'+t).digest('hex');
const dbCheck=db=>{if(!db||typeof db.query!=='function')throw fail(503,'Base Romo no disponible')};
const staff=(identity,action)=>authorizeRomoOperation(identity,'romo','serena',action);

export function romoSolicitudesConfig(env={}){
 const base=romoOperativoConfig(env);
 if(!base||(base.qaOnly?
  env.ROMO_SOLICITUDES_QA_ENABLED!=='true':
  env.ROMO_SOLICITUDES_LIVE_ENABLED!=='true'))return null;
 const carta=String(env.ROMO_CARTA_ALLOWED_ORIGIN||'');
 const panel=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const salt=String(env.ROMO_SOLICITUDES_RATE_SALT||'');
 const urlOk=v=>/^https:\/\/[A-Za-z0-9.-]+$/.test(v)&&!v.includes('..');
 if(!urlOk(carta)||!urlOk(panel)||salt.length<24)return null;
 return Object.freeze({...base,cartaOrigin:carta,panelOrigin:panel,rateSalt:salt});
}
export function validarSolicitudRomo(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||
   Object.keys(body).sort().join('|')!==fields.join('|'))throw fail(400,'Formato de solicitud inválido');
 if(body.storeId!==STORE||!KEY.test(body.key))throw fail(400,'Solicitud ajena a Romo');
 const codigo=str(body.codigoPedido,60),cliente=str(body.cliente,80);
 const telefono=typeof body.telefono==='string'&&body.telefono.length<=30?body.telefono.trim():null;
 const mensaje=str(body.mensaje,12000),total=body.totalIndicado;
 if(!codigo||!cliente||telefono===null||!mensaje||mensaje.length<30||
   !Number.isSafeInteger(total)||total<0||total>1000000000||
   !mensaje.includes(codigo)||!mensaje.toLowerCase().includes(cliente.toLowerCase()))
  throw fail(400,'Revisa el resumen de la solicitud');
 const c=body.cotizacion;
 if(!c||typeof c!=='object'||Array.isArray(c)||
   c.branch!=='serena'||!['delivery','retiro','consumo'].includes(c.mode)||
   !['efectivo','transferencia','debito','edenred','junaeb'].includes(c.payment)||
   !Number.isSafeInteger(c.revision)||c.revision<0||
   !/^[a-f0-9]{64}$/.test(String(c.baseSha256||''))||
   !Number.isSafeInteger(c.subtotalProductos)||c.subtotalProductos<1||
   !Number.isSafeInteger(c.deliveryFee)||c.deliveryFee<0||
   !Array.isArray(c.items)||c.items.length<1||c.items.length>35||
   JSON.stringify(c).length>160000)
   throw fail(400,'Falta la cotización íntegra del pedido de Romo');
 const cotizacionHash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return Object.freeze({key:body.key,codigo,cliente,telefono,mensaje,total,
   cotizacion:c,cotizacionHash});
}
export async function registrarSolicitudRomo({db,body,ipHash,cotizador}={}){
 dbCheck(db);
 const data=validarSolicitudRomo(body);
 if(typeof ipHash!=='string'||!/^[0-9a-f]{64}$/.test(ipHash))throw fail(400,'Identificador de solicitud inválido');
 const existing=await db.query('SELECT id,codigo_pedido,cliente,mensaje,total_indicado,estado,datos FROM public.romo_solicitudes_carta_v1 WHERE store_id=$1 AND request_key=$2 LIMIT 1',[STORE,data.key]);
 if(existing.length){
  const old=existing[0];
  const meta=typeof old.datos==='string'?JSON.parse(old.datos):old.datos;
  if(old.codigo_pedido!==data.codigo||old.cliente!==data.cliente||
     old.mensaje!==data.mensaje||Number(old.total_indicado)!==data.total||
     meta?.cotizacionHash!==data.cotizacionHash)
   throw fail(409,'Código ya utilizado por otra solicitud');
  return Object.freeze({ok:true,storeId:STORE,estado:old.estado,repetido:true,countsAsSale:false,whatsappConfirmado:false});
 }
 const counts=await db.query("SELECT COUNT(*)::integer AS n FROM public.romo_solicitudes_carta_v1 WHERE store_id=$1 AND ip_hash=$2 AND creado_en>now()-INTERVAL '10 minutes'",[STORE,ipHash]);
 if(Number(counts[0]?.n||0)>=15)throw fail(429,'Demasiadas solicitudes; utiliza WhatsApp');
 if(typeof cotizador!=='function')throw fail(503,'Cotizador Romo no configurado');
 let verified;
 try{verified=await cotizador({db,body})}
 catch{throw fail(503,'No se confirmó el precio del pedido en el servidor');}
 if(verified?.ok!==true||verified.verified!==true||
    verified.storeId!==STORE||verified.countsAsSale!==false||
    verified.revision!==data.cotizacion.revision||
    verified.baseSha256!==data.cotizacion.baseSha256||
    verified.total!==data.total||
    verified.subtotalProductos!==data.cotizacion.subtotalProductos||
    verified.deliveryFee!==data.cotizacion.deliveryFee||
    !Array.isArray(verified.detalles)||
    verified.detalles.length!==data.cotizacion.items.length)
   throw fail(409,'El importe no coincide con la carta vigente');
 const lineas=[...data.mensaje.matchAll(/Importe línea:\s*\$([0-9][0-9.,]*)/g)]
   .map(match=>Number(match[1].replace(/[^0-9]/g,'')));
 const pesos=n=>new Intl.NumberFormat('es-CL').format(n);
 if(lineas.length!==verified.detalles.length||
    lineas.some((n,i)=>n!==verified.detalles[i].totalLinea)||
    !data.mensaje.includes('Total productos: $'+pesos(verified.subtotalProductos))||
    (data.cotizacion.mode==='delivery'&&
     !data.mensaje.includes('Total con delivery: $'+pesos(verified.total))))
   throw fail(409,'La comanda no coincide con la cotización del servidor');
 const inserted=await db.query(
  "WITH lock_rev AS (SELECT revision,base_sha256 FROM public.romo_carta_ediciones_v1 WHERE store_id=$1 AND revision=$10 AND base_sha256=$11 FOR SHARE), allow AS (SELECT 1 FROM lock_rev) INSERT INTO public.romo_solicitudes_carta_v1(store_id,request_key,branch,codigo_pedido,cliente,telefono,mensaje,datos,total_indicado,ip_hash) SELECT $1,$2,'serena',$3,$4,$5,$6,$7::jsonb,$8,$9 FROM allow ON CONFLICT(request_key) DO NOTHING RETURNING id",
  [STORE,data.key,data.codigo,data.cliente,data.telefono,data.mensaje,
   JSON.stringify({origen:'carta-normal',whatsapp_confirmado:false,
     cotizacionHash:data.cotizacionHash,revision:verified.revision,
     base_sha256:verified.baseSha256,subtotal:verified.subtotalProductos,
     reparto:verified.deliveryFee,detalleVerificado:verified.detalles,
     items:data.cotizacion.items}),
   data.total,ipHash,verified.revision,verified.baseSha256]
 );
 if(!inserted.length)throw fail(409,'La solicitud ya existe; actualiza antes de repetir');
 return Object.freeze({ok:true,storeId:STORE,estado:'pendiente',repetido:false,countsAsSale:false,whatsappConfirmado:false});
}
export async function listarSolicitudesRomo({db,identity}={}){
 staff(identity,'orders.read');dbCheck(db);
 const rows=await db.query(
  "SELECT id,branch,codigo_pedido,cliente,telefono,mensaje,total_indicado,estado,motivo_rechazo,creado_en,(reserva_token_hash<>'' AND estado='pendiente') AS en_reserva,reserva_hasta,pedido_interno FROM public.romo_solicitudes_carta_v1 WHERE store_id=$1 AND branch='serena' AND (estado='pendiente' OR (estado IN('aceptada','rechazada') AND creado_en>now()-INTERVAL '14 days')) ORDER BY creado_en DESC LIMIT 100",[STORE]
 );
 return Object.freeze({ok:true,storeId:STORE,branch:BRANCH,ahoraServidor:new Date().toISOString(),orders:rows});
}
export async function reservarSolicitudRomo({db,identity,id,claimToken}={}){
 staff(identity,'orders.accept');dbCheck(db);
 if(!validId(id)||!validId(claimToken))throw fail(400,'Reserva inválida');
 const rows=await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET reserva_token_hash=$3,reserva_hasta=now()+INTERVAL '50 minutes',atendido_por=$4,actualizado_en=now() WHERE id=$1::uuid AND store_id=$2 AND branch='serena' AND estado='pendiente' AND (reserva_token_hash='' OR reserva_token_hash=$3) RETURNING id,reserva_hasta",
  [id,STORE,hashToken(claimToken),identity.userId]
 );
 if(!rows.length)throw fail(409,'Solicitud reservada o procesada; revisa antes de repetir');
 return {ok:true,storeId:STORE,estado:'reservada',id:rows[0].id,reserva_hasta:rows[0].reserva_hasta};
}
export async function liberarSolicitudRomo({db,identity,id,claimToken}={}){
 staff(identity,'orders.accept');dbCheck(db);
 if(!validId(id)||!validId(claimToken))throw fail(400,'Reserva inválida');
 const rows=await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET reserva_token_hash='',reserva_hasta=NULL,actualizado_en=now() WHERE id=$1::uuid AND store_id=$2 AND branch='serena' AND estado='pendiente' AND reserva_token_hash=$3 RETURNING id",
  [id,STORE,hashToken(claimToken)]
 );
 if(!rows.length)throw fail(409,'No se liberó la solicitud; revisa su estado');
 return {ok:true,storeId:STORE,estado:'pendiente',id:rows[0].id};
}
/**
 * Mismo principio aprobado en Uki: la reserva vencida NUNCA se libera
 * automáticamente. Recuperación explícita de dueños, con motivo, responsable
 * y constancia en la solicitud Romo. No registra pedidos ni dinero.
 */
export async function recuperarReservaRomo({
 db,identity,id,nombreResponsable,motivo,confirmoSinPedido
}={}){
 staff(identity,'orders.accept');dbCheck(db);
 if(identity?.role!=='duenos')throw fail(403,'Solo dueños recuperan reservas');
 const responsable=str(nombreResponsable,80),razon=str(motivo,200);
 if(!validId(id)||!responsable||responsable.length<3||
    !razon||razon.length<5||confirmoSinPedido!==true)
  throw fail(400,'Debes comprobar pedido e historial e identificar responsable y motivo');
 const rows=await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET reserva_token_hash='',reserva_hasta=NULL,atendido_por=$5,actualizado_en=now(),datos=jsonb_set(COALESCE(datos,'{}'::jsonb),'{recuperacionesReserva}',COALESCE(datos->'recuperacionesReserva','[]'::jsonb)||jsonb_build_array(jsonb_build_object('responsable',$3,'motivo',$4,'usuario',$5,'fecha',now())),true) WHERE id=$1::uuid AND store_id=$2 AND branch='serena' AND estado='pendiente' AND reserva_token_hash<>'' AND reserva_hasta<=now() AND pedido_interno IS NULL RETURNING id",
  [id,STORE,responsable,razon,identity.userId]
 );
 if(rows.length!==1)throw fail(409,'La reserva cambió o tiene un pedido registrado; actualiza');
 return {ok:true,storeId:STORE,branch:BRANCH,estado:'pendiente',
  reservaLiberada:true,id:rows[0].id};
}

export async function rechazarSolicitudRomo({db,identity,id,motivo}={}){
 staff(identity,'orders.reject');dbCheck(db);
 const reason=str(motivo,200);
 if(!validId(id)||!reason)throw fail(400,'Indica el motivo de rechazo');
 const rows=await db.query(
  "UPDATE public.romo_solicitudes_carta_v1 SET estado='rechazada',motivo_rechazo=$3,reserva_token_hash='',reserva_hasta=NULL,atendido_por=$4,actualizado_en=now() WHERE id=$1::uuid AND store_id=$2 AND branch='serena' AND estado='pendiente' AND reserva_token_hash='' RETURNING id",
  [id,STORE,reason,identity.userId]
 );
 if(!rows.length)throw fail(409,'Solicitud en revisión o procesada');
 return {ok:true,storeId:STORE,estado:'rechazada',id:rows[0].id};
}
/**
 * UNA sentencia SQL: (1) reserva válida (2) guarda snapshot completo
 * cifrado con CAS (3) marca aceptada el mismo pedido. Si falla cualquiera
 * se revierte todo el statement. No marca "pagado": eso lo decide el
 * formulario habitual de Uki dentro del snapshot, tras verificar importes.
 */
export async function aceptarYGuardarSolicitudRomo({
 db,identity,id,claimToken,pedidoId,expectedRevision,snapshot
}={}){
 staff(identity,'orders.accept');staff(identity,'cash.write');dbCheck(db);
 if(!validId(id)||!validId(claimToken)||!/^[0-9]{1,12}$/.test(String(pedidoId||''))||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
    expectedRevision>Number.MAX_SAFE_INTEGER-1)
  throw fail(400,'Faltan datos del pedido guardado');
 const encrypted=validateRomoEncryptedState(snapshot);
 const args=[id,STORE,hashToken(claimToken),String(pedidoId),identity.userId,
  expectedRevision,JSON.stringify(encrypted)];
 const insert=expectedRevision===0;
 const sql=insert?
  "WITH selected AS (SELECT id FROM public.romo_solicitudes_carta_v1 WHERE id=$1::uuid AND store_id=$2 AND estado='pendiente' AND reserva_token_hash=$3 AND reserva_hasta>now() FOR UPDATE), saved AS (INSERT INTO public.romo_estado_operativo_v1 (store_id,revision,snapshot,actualizado_por) SELECT $2,1,$7::jsonb,$5 WHERE EXISTS (SELECT 1 FROM selected) ON CONFLICT(store_id) DO NOTHING RETURNING revision), accepted AS (UPDATE public.romo_solicitudes_carta_v1 SET estado='aceptada',pedido_interno=$4,reserva_token_hash='',reserva_hasta=NULL,atendido_por=$5,actualizado_en=now() WHERE id IN(SELECT id FROM selected) AND EXISTS(SELECT 1 FROM saved) RETURNING id,pedido_interno) SELECT accepted.id,accepted.pedido_interno,saved.revision FROM accepted CROSS JOIN saved" :
  "WITH selected AS (SELECT id FROM public.romo_solicitudes_carta_v1 WHERE id=$1::uuid AND store_id=$2 AND estado='pendiente' AND reserva_token_hash=$3 AND reserva_hasta>now() FOR UPDATE), saved AS (UPDATE public.romo_estado_operativo_v1 SET revision=revision+1,snapshot=$7::jsonb,actualizado_por=$5,actualizado_en=now() WHERE store_id=$2 AND revision=$6 AND EXISTS(SELECT 1 FROM selected) RETURNING revision), accepted AS (UPDATE public.romo_solicitudes_carta_v1 SET estado='aceptada',pedido_interno=$4,reserva_token_hash='',reserva_hasta=NULL,atendido_por=$5,actualizado_en=now() WHERE id IN(SELECT id FROM selected) AND EXISTS(SELECT 1 FROM saved) RETURNING id,pedido_interno) SELECT accepted.id,accepted.pedido_interno,saved.revision FROM accepted CROSS JOIN saved";
 const rows=await db.query(sql,args);
 if(rows.length!==1||Number(rows[0].revision)!==expectedRevision+1)
  throw fail(409,'No se confirmó el guardado. Revisa pedido, caja e historial antes de repetir');
 return {ok:true,storeId:STORE,id:rows[0].id,pedido_interno:rows[0].pedido_interno,
  revision:Number(rows[0].revision),estado:'aceptada'};
}
