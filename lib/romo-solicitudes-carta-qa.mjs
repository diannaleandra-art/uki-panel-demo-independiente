/**
 * Romo La Serena: misma semántica de solicitudes iniciadas desde la carta Uki.
 * Una solicitud NO es una venta: no equivale a WhatsApp enviado, ni a timbre,
 * ni a un pedido aceptado, ni agrega ingresos a caja.
 *
 * Servidor exclusivo de Romo; ninguna tabla, token o branch de Uki se usa aquí.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
export const STORE='romo:serena';
export const ROMO_CARTA_SOLICITUD_ESTADO='pendiente';
const KEY=/^[A-Za-z0-9_-]{12,100}$/;
const CODE=/^[A-Za-z0-9_-]{3,60}$/;
const PHONE=/^[+0-9 ()-]{8,24}$/;
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const pick=(x,n)=>typeof x==='string'?x.trim().slice(0,n+1):'';
const inputKeys='cliente|codigoPedido|key|mensaje|storeId|telefono|totalIndicado';
export function prepararSolicitudRomoQA(body){
 if(!plain(body)||Object.keys(body).sort().join('|')!==inputKeys||
    body.storeId!==STORE)throw Error('Solicitud de otra sucursal o formulario incorrecto');
 const key=pick(body.key,100),codigo=pick(body.codigoPedido,60);
 const cliente=pick(body.cliente,80),telefono=pick(body.telefono,24);
 const mensaje=pick(body.mensaje,12000),total=body.totalIndicado;
 if(!KEY.test(key)||!CODE.test(codigo)||cliente.length<2||cliente.length>80||
    !PHONE.test(telefono)||mensaje.length<30||mensaje.length>12000||
    !mensaje.includes(codigo)||!mensaje.toLocaleLowerCase('es-CL').includes(cliente.toLocaleLowerCase('es-CL'))||
    !Number.isSafeInteger(total)||total<1||total>1000000)
  throw Error('Revisa los datos del pedido de Romo');
 return Object.freeze({storeId:STORE,key,codigo,cliente,telefono,mensaje,total,
  estado:'pendiente',whatsappConfirmado:false});
}
export function hashSolicitanteRomoQA(ip,salt){
 if(typeof ip!=='string'||ip.length<3||ip.length>80||
    typeof salt!=='string'||salt.length<24)
  throw Error('Protección antispam de Romo no configurada');
 return createHash('sha256').update('romo-carta:'+salt+':'+ip).digest('hex');
}
const READ='SELECT id,store_id,codigo_pedido,cliente,telefono,mensaje,total_indicado,estado,whatsapp_confirmado,creado_en FROM public.romo_solicitudes_carta_v1 WHERE store_id=$1 AND (estado=$2 OR creado_en>NOW()-INTERVAL \'14 days\') ORDER BY creado_en DESC LIMIT 100';
export async function leerSolicitudesRomoQA({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','orders.read');
 if(!db||typeof db.query!=='function')throw Error('Base Romo no disponible');
 const rows=await db.query(READ,[STORE,'pendiente']);
 if(!Array.isArray(rows)||rows.length>100||
    rows.some(r=>r.store_id!==STORE))throw Error('Bandeja de otra sucursal bloqueada');
 return Object.freeze({storeId:STORE,orders:rows.map(x=>({...x})),soloSolicitudes:true});
}
export async function ingresarSolicitudRomoQA({db,request,ip,salt}={}){
 if(!db||typeof db.query!=='function')throw Error('Base Romo no disponible');
 const order=prepararSolicitudRomoQA(request);
 const hash=hashSolicitanteRomoQA(ip,salt);
 const old=await db.query(
  'SELECT id,store_id,codigo_pedido,mensaje,estado FROM public.romo_solicitudes_carta_v1 WHERE request_key=$1 LIMIT 1',[order.key]);
 if(!Array.isArray(old)||old.length>1)throw Error('Solicitud Romo ambigua');
 const match=x=>x&&x.store_id===STORE&&x.codigo_pedido===order.codigo&&x.mensaje===order.mensaje;
 if(old.length){
  if(!match(old[0])){const e=Error('Clave de pedido reutilizada');e.code='ROMO_ORDER_DUPLICATE';throw e}
  return Object.freeze({storeId:STORE,id:old[0].id,estado:old[0].estado,repetido:true,
   countsAsSale:false,whatsappConfirmado:false});
 }
 const total=await db.query(
  "SELECT COUNT(*)::int AS n FROM public.romo_solicitudes_carta_v1 WHERE ip_hash=$1 AND creado_en>NOW()-INTERVAL '10 minutes'",[hash]);
 if(!Array.isArray(total)||total.length!==1)throw Error('No se pudo validar límite de solicitudes');
 if(Number(total[0].n)>=15){const e=Error('Demasiadas solicitudes');e.code='ROMO_ORDER_RATE';throw e}
 const inserted=await db.query(
  'INSERT INTO public.romo_solicitudes_carta_v1 (store_id,request_key,codigo_pedido,cliente,telefono,mensaje,total_indicado,ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (request_key) DO NOTHING RETURNING id,estado',
  [STORE,order.key,order.codigo,order.cliente,order.telefono,order.mensaje,order.total,hash]);
 if(!Array.isArray(inserted)||inserted.length>1)throw Error('No se pudo registrar la solicitud');
 if(inserted.length)return Object.freeze({storeId:STORE,id:inserted[0].id,estado:'pendiente',
  repetido:false,countsAsSale:false,whatsappConfirmado:false});
 const conflict=await db.query(
  'SELECT id,store_id,codigo_pedido,mensaje,estado FROM public.romo_solicitudes_carta_v1 WHERE request_key=$1 LIMIT 1',[order.key]);
 if(!Array.isArray(conflict)||conflict.length!==1||!match(conflict[0])){
  const e=Error('Clave de pedido reutilizada');e.code='ROMO_ORDER_DUPLICATE';throw e
 }
 return Object.freeze({storeId:STORE,id:conflict[0].id,estado:conflict[0].estado,
  repetido:true,countsAsSale:false,whatsappConfirmado:false});
}
export const ROMO_SOLICITUDES_NO_ABIERTAS=true;
