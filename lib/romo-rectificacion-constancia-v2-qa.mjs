/**
 * Romo La Serena · constancia v2 firmemente vinculada al cierre original.
 * Solo servidor, estado cifrado; NO hay pagos bancarios desde este módulo.
 * Una sola función SQL con bloqueo CAS conserva recibo original y crea v2.
 */
import {createHash} from 'node:crypto';
import {validateRomoEncryptedState} from './romo-estado-operativo-qa.mjs';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

const STORE='romo:serena';
const KEY=/^romo:serena\|\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const need=(v,msg)=>{if(!v)throw Error(msg)};
const money=(x,max=1000000000)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const moneyMap=(map)=>map&&typeof map==='object'&&!Array.isArray(map)&&
 Object.keys(map).length>0&&
 Object.keys(map).every(k=>['Efectivo','Transferencia','Débito','Edenred','Otros',
 'Uber Eats','PedidosYa','Rappi'].includes(k)&&money(map[k]));
export function validarReciboRectificacionRomoQA(x){
 need(x&&typeof x==='object'&&!Array.isArray(x)&&
  x.origen==='romo'&&x.store_id===STORE&&x.version===2&&
  x.estado==='pendiente_constancia_neon'&&
  x.dinero_real_confirmado===true&&x.comprobante_original_conservado===true,
  'Resumen de rectificación no confirmado');
 need(KEY.test(x.fuente_original)&&x.turno_ref===x.fuente_original.slice(12)&&
  x.fuente_unica===x.fuente_original+'|v2','Origen de cierre inválido');
 need(KEY.test('romo:serena|'+x.turno_movimiento)&&
  x.turno_movimiento!==x.turno_ref&&
  /^\d{4}-\d{2}-\d{2}$/.test(x.fecha_operativa_movimiento)&&
  x.turno_movimiento.startsWith(x.fecha_operativa_movimiento+'@'),
  'Turno real de dinero inválido');
 need(['devolucion','cobro_adicional'].includes(x.clase)&&
  MEDIOS.includes(x.medio)&&money(x.monto,100000000)&&x.monto>0&&
  x.delta===(x.clase==='devolucion'?-x.monto:x.monto),
  'Diferencia de dinero no válida');
 need(money(x.venta_original)&&money(x.venta_rectificada)&&
  x.venta_original+x.delta===x.venta_rectificada&&
  moneyMap(x.medios_original)&&moneyMap(x.medios_rectificados),
  'El total de la rectificación no coincide');
 const sum=x=>Object.values(x).reduce((n,v)=>n+v,0);
 need(sum(x.medios_original)===x.venta_original&&
  sum(x.medios_rectificados)===x.venta_rectificada,
  'Los medios no concuerdan con el total');
 const union=new Set([...Object.keys(x.medios_original),...Object.keys(x.medios_rectificados)]);
 for(const medio of union){
  need(Number(x.medios_rectificados[medio]||0)===
   Number(x.medios_original[medio]||0)+(medio===x.medio?x.delta:0),
   'El ajuste modifica otro medio de pago');
 }
 need(money(x.pedido_id)&&x.pedido_id>0&&
  Number.isSafeInteger(x.fecha_cierre_ms)&&
  Number.isSafeInteger(x.confirmado_en_ms)&&
  x.confirmado_en_ms>x.fecha_cierre_ms&&
  ['responsable','motivo','referencia'].every(k=>
   typeof x[k]==='string'&&x[k].trim().length>=
   (k==='motivo'||k==='referencia'?4:2)&&x[k].trim().length<=
   (k==='responsable'?80:k==='motivo'?300:150)),
  'Faltan responsable, evidencia o fecha real');
 return Object.freeze({...x});
}
export async function confirmarReciboRectificacionRomoQA({
 db,identity,expectedRevision,snapshot,resumen
}={}){
 authorizeRomoOperation(identity,'romo','serena','owners.write');
 need(typeof db?.query==='function'&&Number.isSafeInteger(expectedRevision)&&
  expectedRevision>0,'Revisión o base Neon Romo inválida');
 const encrypted=validateRomoEncryptedState(snapshot);
 const receipt=validarReciboRectificacionRomoQA(resumen);
 const hash=createHash('sha256').update(JSON.stringify(encrypted)).digest('hex');
 const rows=await db.query(
  'SELECT public.romo_confirmar_rectificacion_cierre_v2($1::bigint,$2::jsonb,'+
  '$3::text,$4::jsonb,$5::text) AS comprobante',
  [expectedRevision,JSON.stringify(encrypted),hash,JSON.stringify(receipt),identity.userId]
 );
 need(Array.isArray(rows)&&rows.length===1&&rows[0]?.comprobante,
  'Neon no confirmó la rectificación');
 const c=typeof rows[0].comprobante==='string'?
  JSON.parse(rows[0].comprobante):rows[0].comprobante;
 need(c.confirmado===true&&c.storeId===STORE&&
  c.original===receipt.fuente_original&&
  c.fuenteRectificacion===receipt.fuente_unica&&
  c.version===2&&c.revision===expectedRevision+1&&
  c.delta===receipt.delta&&c.medio===receipt.medio,
  'Respuesta de recibo v2 inconsistente: revisar Neon antes de repetir');
 return Object.freeze({...c,fuenteOriginal:receipt.fuente_original});
}
export async function consultarReciboRectificacionRomoQA({
 db,identity,fuenteOriginal
}={}){
 authorizeRomoOperation(identity,'romo','serena','owners.read');
 need(typeof db?.query==='function'&&KEY.test(String(fuenteOriginal||'')),
  'Se requiere el cierre original de Romo');
 const rows=await db.query(
  'SELECT fuente_unica,fuente_original,turno_ref,version,pedido_id,clase,medio,'+
  'importe,delta,revision_original,revision_neon,resumen,creado_en,'+
  'sha256_original,sha256_snapshot, '+
  '(SELECT snapshot_sha256 FROM public.romo_cierres_constancia_v1 o '+
  'WHERE o.store_id=$1 AND o.source_key=fuente_original) AS original_guardado_sha, '+
  '(SELECT resumen FROM public.romo_cierres_constancia_v1 o '+
  'WHERE o.store_id=$1 AND o.source_key=fuente_original) AS original_guardado_resumen '+
  'FROM public.romo_rectificaciones_cierre_v2 '+
  'WHERE store_id=$1 AND fuente_original=$2 ORDER BY version DESC LIMIT 1',
  [STORE,fuenteOriginal]
 );
 need(Array.isArray(rows)&&rows.length<=1,
  'La consulta de rectificación tiene un resultado inválido');
 if(!rows.length)return Object.freeze({encontrado:false,fuenteOriginal});
 const row=rows[0],data=typeof row.resumen==='string'?JSON.parse(row.resumen):row.resumen;
 const normalized=validarReciboRectificacionRomoQA(data);
 need(row.fuente_original===fuenteOriginal&&
  row.fuente_unica===normalized.fuente_unica&&
  Number(row.version)===2&&Number(row.delta)===normalized.delta&&
  Number(row.importe)===normalized.monto&&
  row.medio===normalized.medio&&
  Number.isSafeInteger(Number(row.revision_neon))&&
  Number(row.revision_neon)>Number(row.revision_original)&&
  row.original_guardado_sha===row.sha256_original&&
  (typeof row.original_guardado_resumen==='string'?
    JSON.parse(row.original_guardado_resumen):row.original_guardado_resumen)?.fuente_unica===fuenteOriginal&&
  Number((typeof row.original_guardado_resumen==='string'?
    JSON.parse(row.original_guardado_resumen):row.original_guardado_resumen)?.venta_total)===
    normalized.venta_original,
  'Constancia de rectificación no coincide con su origen');
 return Object.freeze({encontrado:true,fuenteOriginal,
  fuenteRectificacion:row.fuente_unica,
  version:2,revision:Number(row.revision_neon),
  comprobante:Object.freeze(normalized),
  huellaOriginal:String(row.sha256_original||''),
  huellaVersion:String(row.sha256_snapshot||'')});
}
