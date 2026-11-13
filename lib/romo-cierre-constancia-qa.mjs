
/** Constancia atómica de cierre Romo: importes agregados, nunca clientes.
 * Neon no puede descifrar caja AES-GCM; el recibo ata los montos declarados
 * por el panel autenticado a la misma escritura CAS del cierre.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {validateRomoEncryptedState} from './romo-estado-operativo-qa.mjs';
export const ROMO_RECIBOS_CIERRE_HABILITADO_QA=false;
const STORE='romo:serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const methods=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000000;
const fail=x=>{throw Error(x)};
export class RomoCierreConstanciaConflictoQA extends Error{
 constructor(){super('Cierre Romo ya registrado o desactualizado; recarga antes de continuar.');
 this.code='REVISION_CONFLICTO'}
}
const canonical=x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
export function normalizarResumenCierreRomoQA(resumen,turnoId){
 if(!resumen||resumen.origen!=='romo'||resumen.store_id!==STORE||
  resumen.sucursal!=='serena'||resumen.estado!=='pendiente_confirmacion_neon'||
  resumen.turno_ref!==turnoId||resumen.fuente_unica!==STORE+'|'+turnoId||
  !TURN.test(turnoId)||!turnoId.startsWith(resumen.fecha_operativa+'@'))
  fail('El resumen no corresponde al turno Romo');
 const inicio=Number(turnoId.split('@')[1]);
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',
  year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(inicio));
 if(local!==resumen.fecha_operativa||!Number.isSafeInteger(inicio)||
  !Number.isSafeInteger(resumen.fecha_cierre_ms)||
  resumen.fecha_cierre_ms<=inicio)fail('Fecha de cierre inconsistente');
 const fields=['venta_total','pedidos','gastos_cierre','delivery_por_pagar','propinas',
  'retiros','caja_chica_inicial','caja_chica_gastos','efectivo_contado'];
 for(const k of fields)if(!money(resumen[k]))fail('Importe incorrecto: '+k);
 if(resumen.pedidos>10000||!Number.isSafeInteger(resumen.diferencia_efectivo)||
  Math.abs(resumen.diferencia_efectivo)>1000000000)fail('Diferencia inválida');
 if(!resumen.medios||typeof resumen.medios!=='object'||Array.isArray(resumen.medios))
  fail('Sin medios de pago válidos');
 const medios={};
 for(const [k,n] of Object.entries(resumen.medios)){
  if(!methods.has(k)||!money(n))fail('Medio de pago inválido');
  medios[k]=n;
 }
 if(Object.values(medios).reduce((a,b)=>a+b,0)!==resumen.venta_total)
  fail('Los medios de pago no cuadran');
 return Object.freeze({
  origen:'romo',store_id:STORE,sucursal:'serena',
  estado:'pendiente_confirmacion_neon',fecha_operativa:resumen.fecha_operativa,
  turno_ref:turnoId,fuente_unica:STORE+'|'+turnoId,
  fecha_cierre_ms:resumen.fecha_cierre_ms,
  venta_total:resumen.venta_total,pedidos:resumen.pedidos,medios,
  gastos_cierre:resumen.gastos_cierre,delivery_por_pagar:resumen.delivery_por_pagar,
  propinas:resumen.propinas,retiros:resumen.retiros,
  caja_chica_inicial:resumen.caja_chica_inicial,caja_chica_gastos:resumen.caja_chica_gastos,
  efectivo_contado:resumen.efectivo_contado,diferencia_efectivo:resumen.diferencia_efectivo
 });
}
export function constanciaResumenCoincideRomoQA(recibo,resumen){
 const original={...resumen,estado:'pendiente_confirmacion_neon'};
 const normalized=normalizarResumenCierreRomoQA(original,resumen?.turno_ref);
 if(!recibo||recibo.store_id!==STORE||recibo.source_key!==normalized.fuente_unica||
  recibo.turno_ref!==normalized.turno_ref||
  Number(recibo.revision_neon)!==resumen.revision_neon)return false;
 const s=typeof recibo.resumen==='string'?JSON.parse(recibo.resumen):recibo.resumen;
 return canonical(s||{})===canonical(normalized);
}
export async function consultarConstanciaRomoQA({dbRomo,resumen}={}){
 if(typeof dbRomo?.query!=='function')fail('Falta Neon exclusivo de Romo');
 const rows=await dbRomo.query(
  'SELECT store_id,source_key,turno_ref,revision_neon,resumen FROM public.romo_cierres_constancia_v1 WHERE store_id=$1 AND source_key=$2 LIMIT 1',
  [STORE,STORE+'|'+resumen?.turno_ref]);
 if(!Array.isArray(rows)||rows.length!==1||
  !constanciaResumenCoincideRomoQA(rows[0],resumen))
  fail('No se confirmó esta constancia de cierre en Neon de Romo');
 return Object.freeze({verificada:true,turno_ref:resumen.turno_ref,
  revision_neon:resumen.revision_neon});
}
export async function confirmarCierreConConstanciaRomoQA({
 db,identity,expectedRevision,snapshot,turnoId,resumen
}={}){
 authorizeRomoOperation(identity,'romo','serena','cash.close');
 if(typeof db?.query!=='function'||!Number.isSafeInteger(expectedRevision)||
  expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER)
  fail('Revisión CAS inválida');
 const envelope=validateRomoEncryptedState(snapshot);
 const p=normalizarResumenCierreRomoQA(resumen,turnoId);
 const checksum=createHash('sha256').update(JSON.stringify(envelope)).digest('hex');
 const sql=
  'WITH pendientes AS (SELECT COUNT(*)::integer AS n FROM public.romo_solicitudes_carta_v1 '+
  "WHERE store_id=$1 AND branch='serena' AND estado='pendiente'), "+
  'guardado AS (UPDATE public.romo_estado_operativo_v1 SET '+
  'revision=revision+1,snapshot=$3::jsonb,actualizado_por=$4,actualizado_en=now() '+
  'WHERE store_id=$1 AND revision=$2 AND (SELECT n FROM pendientes)=0 '+
  'AND NOT EXISTS (SELECT 1 FROM public.romo_cierres_constancia_v1 '+
  'WHERE store_id=$1 AND source_key=$5) RETURNING revision), '+
  'recibo AS (INSERT INTO public.romo_cierres_constancia_v1 '+
  '(store_id,source_key,turno_ref,fecha_operativa,revision_neon,'+
  'snapshot_sha256,resumen,creado_por_uid) '+
  'SELECT $1,$5,$6,$7::date,guardado.revision,$8,$9::jsonb,$4 '+
  'FROM guardado RETURNING source_key) '+
  'SELECT (SELECT n FROM pendientes) AS pendientes,'+
  '(SELECT revision FROM guardado) AS revision,'+
  '(SELECT source_key FROM recibo) AS recibo';
 const rows=await db.query(sql,[STORE,expectedRevision,JSON.stringify(envelope),
  identity.userId,p.fuente_unica,turnoId,p.fecha_operativa,checksum,JSON.stringify(p)]);
 if(!Array.isArray(rows)||rows.length!==1)fail('No se confirmó el cierre');
 if(Number(rows[0].pendientes)>0){
  const e=Error('Quedan solicitudes pendientes');e.code='ROMO_CIERRE_PENDIENTES';throw e;
 }
 if(Number(rows[0].revision)!==expectedRevision+1||
  rows[0].recibo!==p.fuente_unica)throw new RomoCierreConstanciaConflictoQA();
 return Object.freeze({storeId:STORE,revision:expectedRevision+1,
  turnoId,estado:'cierre_confirmado',constancia:true});
}
