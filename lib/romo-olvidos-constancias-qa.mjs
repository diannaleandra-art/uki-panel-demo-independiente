/**
 * Romo La Serena · constancias verificables de pedidos olvidados de
 * cierres históricos, versión 2, 3, ... SIN abrir la caja antigua.
 * Una sola operación SQL atómica (sobres AES-GCM + registro inmutable).
 */
import {createHash} from 'node:crypto';
import {validateRomoEncryptedState} from './romo-estado-operativo-qa.mjs';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
const STORE='romo:serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const ALL_MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const LOCAL=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const need=(condition,message)=>{if(!condition)throw Error(message)};
const amount=(v,max=1000000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const map=(v)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).every(k=>ALL_MEDIOS.includes(k)&&amount(v[k]));
const sum=v=>Object.values(v).reduce((a,b)=>a+b,0);
const canonical=v=>JSON.stringify((function sort(x){
 if(Array.isArray(x))return x.map(sort);
 if(x&&typeof x==='object')return Object.fromEntries(
  Object.entries(x).sort(([a],[b])=>a.localeCompare(b))
   .map(([k,val])=>[k,sort(val)]));
 return x;
})(v));
const keys=[
 'origen','store_id','tipo','fuente_original','fuente_previa','fuente_unica',
 'turno_ref','version','solicitud_id','clave_olvido','fecha_cierre_ms',
 'fecha_operativa_original','fecha_pedido','modalidad',
 'productos','delivery','total','recibido_local','recibido_otro_local',
 'productos_local','productos_otro_local','delivery_local','delivery_otro_local',
 'medio_local','local_externo','reparto_realizado',
 'delivery_repartidor_por_conciliar','venta_original','venta_previa',
 'venta_rectificada','medios_previos','medios_rectificados',
 'fecha_confirmacion_ms','responsable','motivo','referencia_local',
 'referencia_externa','comprobante_original_conservado','sin_cobro_nuevo',
 'no_modifica_caja_actual','estado'
].sort();
export function validarConstanciaOlvidoRomoQA(d){
 need(d&&typeof d==='object'&&!Array.isArray(d)&&
  canonical(Object.keys(d).sort())===canonical(keys)&&
  JSON.stringify(d).length<7000&&
  d.origen==='romo'&&d.store_id===STORE&&
  d.tipo==='pedido_olvidado'&&d.estado==='pendiente_constancia_neon'&&
  d.comprobante_original_conservado===true&&
  d.sin_cobro_nuevo===true&&d.no_modifica_caja_actual===true,
  'La constancia histórica no pertenece a Romo o tiene campos no aprobados');
 need(TURN.test(d.turno_ref)&&
  d.fuente_original===STORE+'|'+d.turno_ref&&
  Number.isSafeInteger(d.version)&&d.version>=2&&d.version<=32&&
  d.fuente_unica===d.fuente_original+'|v'+d.version&&
  d.fuente_previa===(d.version===2?d.fuente_original:
   d.fuente_original+'|v'+(d.version-1))&&
  amount(d.solicitud_id)&&d.solicitud_id>0&&
  typeof d.clave_olvido==='string'&&/^[0-9a-f]{64}$/.test(d.clave_olvido),
  'No concuerda la secuencia original de comprobantes');
 need(d.fecha_operativa_original===d.turno_ref.slice(0,10)&&
  typeof d.fecha_pedido==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.fecha_pedido)&&
  ['Delivery','Retiro','Consumo en local'].includes(d.modalidad)&&
  (d.modalidad==='Delivery'?d.delivery>0:d.delivery===0)&&
  Number.isSafeInteger(d.fecha_cierre_ms)&&
  Number.isSafeInteger(d.fecha_confirmacion_ms)&&
  d.fecha_confirmacion_ms>d.fecha_cierre_ms,
  'Fecha o modalidad del pedido omitido incorrecta');
 const vals=['productos','delivery','total','recibido_local','recibido_otro_local',
  'productos_local','productos_otro_local','delivery_local','delivery_otro_local',
  'delivery_repartidor_por_conciliar'];
 need(vals.every(k=>amount(d[k],100000000))&&d.productos>0&&d.total>0&&
  d.total===d.productos+d.delivery&&
  d.recibido_local+d.recibido_otro_local===d.total&&
  d.productos_local+d.productos_otro_local===d.productos&&
  d.delivery_local+d.delivery_otro_local===d.delivery&&
  d.productos_local+d.delivery_local===d.recibido_local&&
  d.productos_otro_local+d.delivery_otro_local===d.recibido_otro_local,
  'Productos, delivery y cobros entre locales no cuadran');
 need(typeof d.reparto_realizado==='boolean'&&
  d.delivery_repartidor_por_conciliar===(d.reparto_realizado?d.delivery:0)&&
  (d.recibido_local===0?d.medio_local===null:
   LOCAL.includes(d.medio_local))&&
  (d.recibido_otro_local===0?d.local_externo===null:
   typeof d.local_externo==='string'&&d.local_externo.trim().length>=2),
  'Repartidor o medio de pago de la sucursal no verificado');
 for(const [value,req,label] of [
  [d.responsable,true,'responsable'],[d.motivo,true,'motivo'],
  [d.referencia_local,d.recibido_local>0,'comprobante local'],
  [d.referencia_externa,d.recibido_otro_local>0,'comprobante de otro local']]){
  need(typeof value==='string'&&(!req||value.trim().length>=
   (label==='responsable'?2:4))&&value.length<=
   (label==='motivo'?300:label==='responsable'?80:150),
   'Falta '+label+' de la conciliación histórica');
 }
 need(amount(d.venta_original)&&amount(d.venta_previa)&&
  amount(d.venta_rectificada)&&
  d.venta_rectificada===d.venta_previa+d.recibido_local&&
  map(d.medios_previos)&&map(d.medios_rectificados)&&
  sum(d.medios_previos)===d.venta_previa&&
  sum(d.medios_rectificados)===d.venta_rectificada,
  'La serie histórica no cuadra con la venta local');
 const union=new Set([...Object.keys(d.medios_previos),
  ...Object.keys(d.medios_rectificados)]);
 for(const medio of union){
  need((d.medios_rectificados[medio]||0)===(d.medios_previos[medio]||0)+
   (medio===d.medio_local?d.recibido_local:0),
   'No se permiten cambios en otros medios');
 }
 return Object.freeze({...d});
}
export async function confirmarConstanciaOlvidoRomoQA({
 db,identity,expectedRevision,snapshot,resumen
}={}){
 authorizeRomoOperation(identity,'romo','serena','owners.write');
 need(typeof db?.query==='function'&&Number.isSafeInteger(expectedRevision)&&
  expectedRevision>=1,'Falta revisión cifrada autorizada de Neon Romo');
 const sobre=validateRomoEncryptedState(snapshot);
 const d=validarConstanciaOlvidoRomoQA(resumen);
 const hash=createHash('sha256').update(JSON.stringify(sobre)).digest('hex');
 const rows=await db.query(
  'SELECT public.romo_confirmar_pedido_olvidado_versionado_v1('+
  '$1::bigint,$2::jsonb,$3::text,$4::jsonb,$5::text) AS recibo',
  [expectedRevision,JSON.stringify(sobre),hash,JSON.stringify(d),identity.userId]);
 need(Array.isArray(rows)&&rows.length===1&&rows[0]?.recibo,
  'No se confirmó la constancia del pedido olvidado');
 const result=typeof rows[0].recibo==='string'?
  JSON.parse(rows[0].recibo):rows[0].recibo;
 need(result.confirmado===true&&result.storeId===STORE&&
  result.fuenteOriginal===d.fuente_original&&
  result.fuenteVersion===d.fuente_unica&&
  result.version===d.version&&result.solicitudId===d.solicitud_id&&
  result.revision===expectedRevision+1&&
  result.ventaAnterior===d.venta_previa&&
  result.ventaRectificada===d.venta_rectificada&&
  result.cobroLocal===d.recibido_local&&
  result.cobroExterno===d.recibido_otro_local,
  'La respuesta de Neon no coincide: consultar antes de repetir');
 return Object.freeze({...result});
}
export async function consultarConstanciaOlvidoRomoQA({
 db,identity,fuenteOriginal,version
}={}){
 authorizeRomoOperation(identity,'romo','serena','owners.read');
 need(typeof db?.query==='function'&&
  typeof fuenteOriginal==='string'&&
  fuenteOriginal.startsWith(STORE+'|')&&
  TURN.test(fuenteOriginal.slice((STORE+'|').length))&&
  Number.isSafeInteger(version)&&version>=2&&version<=32,
  'Consulta de cierre/version inválida');
 const rows=await db.query(
  'SELECT v.version,v.fuente_unica,v.fuente_previa,v.solicitud_id,'+
  'v.version_venta_anterior,v.version_venta_rectificada,'+
  'v.sha_original,v.sha_previa,v.sha_snapshot,v.revision_original,'+
  'v.revision_neon,v.resumen,v.creado_en,'+
  'o.snapshot_sha256 AS hash_original,o.resumen AS resumen_original '+
  'FROM public.romo_pedidos_olvidados_versiones_v1 v '+
  'JOIN public.romo_cierres_constancia_v1 o ON '+
  'o.store_id=v.store_id AND o.source_key=v.fuente_original '+
  'WHERE v.store_id=$1 AND v.fuente_original=$2 '+
  'ORDER BY v.version ASC LIMIT 32',
  [STORE,fuenteOriginal]);
 need(Array.isArray(rows)&&rows.length<=31,
  'La cadena de versiones requiere conciliación');
 if(!rows.length)return Object.freeze({encontrado:false,fuenteOriginal});
 let anterior=fuenteOriginal,prevHash=null,ventaAnterior=null,recibo=null;
 const historia=[];
 for(let i=0;i<rows.length;i++){
  const x=rows[i],d=typeof x.resumen==='string'?JSON.parse(x.resumen):x.resumen;
  validarConstanciaOlvidoRomoQA(d);
  const original=typeof x.resumen_original==='string'?
   JSON.parse(x.resumen_original):x.resumen_original;
  need(x.version===i+2&&x.fuente_previa===anterior&&
   x.fuente_unica===fuenteOriginal+'|v'+(i+2)&&
   d.fuente_previa===anterior&&d.fuente_unica===x.fuente_unica&&
   d.venta_rectificada===Number(x.version_venta_rectificada)&&
   d.venta_previa===Number(x.version_venta_anterior)&&
   Number(x.revision_neon)>Number(x.revision_original)&&
   x.hash_original===x.sha_original&&
   original?.fuente_unica===fuenteOriginal&&
   original?.venta_total===d.venta_original&&
   (i===0?x.sha_previa===x.sha_original:
    x.sha_previa===prevHash&&d.venta_previa===ventaAnterior),
   'La constancia histórica no corresponde a la versión anterior');
  anterior=x.fuente_unica;prevHash=x.sha_snapshot;
  ventaAnterior=d.venta_rectificada;
  historia.push(Object.freeze({version:i+2,fuente:x.fuente_unica,
   ventaRectificada:d.venta_rectificada,recibidoLocal:d.recibido_local,
   recibidoOtroLocal:d.recibido_otro_local}));
  if(i+2===version)recibo=d;
 }
 need(!!recibo,'La versión solicitada aún no existe');
 return Object.freeze({encontrado:true,storeId:STORE,
  fuenteOriginal,fuenteVersion:recibo.fuente_unica,
  version,recibo:Object.freeze(recibo),
  originalConservado:true,
  versiones:Object.freeze(historia)});
}
