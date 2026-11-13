/**
 * QA solamente: almacenamiento privado de cierres Romo separado de Uki.
 * La función debe llamarse EXCLUSIVAMENTE desde un backend con Google
 * validado + sesión privada PIN dueños verificada; NO desde el navegador.
 * No crea ventas en fin_movimientos; no se considera caja.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {consultarConstanciaRomoQA} from './romo-cierre-constancia-qa.mjs';
export const ROMO_CIERRES_DUENOS_WRITER_ENABLED_QA=false;
const STORE='romo:serena';
const methods=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const fail=(m)=>{throw Error(m)};
const validDate=(x)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const money=(x)=>Number.isSafeInteger(x)&&x>=0&&x<=1000000000;
const canonical=(o)=>JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b))));
export class RomoCierreDuplicadoDiferenteQA extends Error{
 constructor(){super('El mismo turno Romo ya existe con cifras diferentes; conciliar antes de guardar');
 this.code='ROMO_CIERRE_DATOS_DIFERENTES';}
}
export function prepararRegistroCierreRomoDuenosQA(resumen){
 if(!resumen||resumen.origen!=='romo'||resumen.store_id!==STORE||
  resumen.sucursal!=='serena'||resumen.estado!=='confirmado_en_romo_pendiente_de_sincronizar_duenos')
  fail('Este cierre no ha sido confirmado desde Romo en Neon');
 const turno=resumen.turno_ref,fecha=resumen.fecha_operativa;
 if(!validDate(fecha)||typeof turno!=='string'||
  !/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(turno)||
  !turno.startsWith(fecha+'@')||
  resumen.fuente_unica!==STORE+'|'+turno||
  !Number.isSafeInteger(resumen.revision_neon)||resumen.revision_neon<1)
  fail('No coincide el identificador único del turno Romo');
 const when=Number(turno.split('@')[1]);
 if(!Number.isSafeInteger(when)||when<1700000000000||
  !Number.isSafeInteger(resumen.fecha_cierre_ms)||resumen.fecha_cierre_ms<=when)
  fail('El momento del cierre Romo no es válido');
 const dateLocal=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',
  year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(when));
 if(dateLocal!==fecha)fail('El turno Romo pertenece a otra fecha local');
 const fields=['venta_total','pedidos','gastos_cierre','delivery_por_pagar',
  'propinas','retiros','caja_chica_inicial','caja_chica_gastos','efectivo_contado'];
 for(const field of fields)if(!money(resumen[field]))fail('Importe o conteo no válido: '+field);
 if(resumen.pedidos>10000)fail('Pedidos fuera de rango');
 if(!Number.isSafeInteger(resumen.diferencia_efectivo)||
   Math.abs(resumen.diferencia_efectivo)>1000000000)
  fail('La diferencia de caja no es válida');
 const medios=resumen.medios;
 if(!medios||typeof medios!=='object'||Array.isArray(medios))fail('Medios de pago no válidos');
 const pagos={};
 for(const [k,v] of Object.entries(medios)){
  if(!methods.has(k)||!money(v))fail('Medio de pago inválido');
  pagos[k]=v;
 }
 if(Object.values(pagos).reduce((a,b)=>a+b,0)!==resumen.venta_total)
  fail('Los pagos del cierre Romo no cuadran');
 // Solo datos financieros agregados, nunca datos de clientes ni contraseñas.
 return Object.freeze({
  store_id:STORE,source_key:resumen.fuente_unica,turno_ref:turno,
  fecha_operativa:fecha,fecha_cierre_ms:resumen.fecha_cierre_ms,
  revision_neon:resumen.revision_neon,venta_total:resumen.venta_total,
  pedidos:resumen.pedidos,medios:Object.freeze(pagos),
  gastos_cierre:resumen.gastos_cierre,delivery_por_pagar:resumen.delivery_por_pagar,
  propinas:resumen.propinas,retiros:resumen.retiros,
  caja_chica_inicial:resumen.caja_chica_inicial,
  caja_chica_gastos:resumen.caja_chica_gastos,
  efectivo_contado:resumen.efectivo_contado,
  diferencia_efectivo:resumen.diferencia_efectivo
 });
}
function iguales(a,b){
 const nums=['fecha_cierre_ms','venta_total','pedidos','gastos_cierre',
  'delivery_por_pagar','propinas','retiros','caja_chica_inicial',
  'caja_chica_gastos','efectivo_contado','diferencia_efectivo'];
 return a&&a.store_id===b.store_id&&a.source_key===b.source_key&&
  a.turno_ref===b.turno_ref&&
  String(a.fecha_operativa).slice(0,10)===b.fecha_operativa&&
  nums.every(k=>Number(a[k])===b[k])&&canonical(a.medios||{})===canonical(b.medios);
}
/* Solo llamar desde el backend tras verificar Google + sesión privada PIN.
 * No confía en la identidad declarada en body. La revisión queda auditada.
 * No actualiza la fila tras un duplicado ni modifica fin_movimientos. */
export async function guardarCierreRomoDuenosQA({
 db,dbRomo,identity,privateOwnerSessionVerified=false,resumen
}={}){
 if(!privateOwnerSessionVerified)
  fail('Se requiere sesión privada verificada de dueños');
 authorizeRomoOperation(identity,'romo','serena','owners.write');
 if(!db||typeof db.query!=='function')fail('Base privada de dueños no disponible');
 const c=prepararRegistroCierreRomoDuenosQA(resumen);
 await consultarConstanciaRomoQA({dbRomo,resumen});
 const sql='INSERT INTO public.fin_romo_cierres_live_v1 '+
  '(store_id,source_key,turno_ref,fecha_operativa,fecha_cierre_ms,revision_neon,'+
  'venta_total,pedidos,medios,gastos_cierre,delivery_por_pagar,propinas,retiros,'+
  'caja_chica_inicial,caja_chica_gastos,efectivo_contado,diferencia_efectivo,recibido_de_uid) '+
  'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18) '+
  'ON CONFLICT (source_key) DO NOTHING RETURNING source_key';
 const args=[
  c.store_id,c.source_key,c.turno_ref,c.fecha_operativa,c.fecha_cierre_ms,c.revision_neon,
  c.venta_total,c.pedidos,JSON.stringify(c.medios),c.gastos_cierre,c.delivery_por_pagar,
  c.propinas,c.retiros,c.caja_chica_inicial,c.caja_chica_gastos,
  c.efectivo_contado,c.diferencia_efectivo,identity.userId
 ];
 const result=await db.query(sql,args);
 if(!Array.isArray(result)||result.length>1)
  fail('No se confirmó el cierre privado de Romo');
 if(result.length===1&&result[0].source_key===c.source_key)
  return Object.freeze({registrado:true,duplicado:false,referencia:c.turno_ref});
 if(result.length!==0)fail('Respuesta de cierre privada inválida');
 const prior=await db.query(
  'SELECT * FROM public.fin_romo_cierres_live_v1 WHERE source_key=$1 LIMIT 1',
  [c.source_key]);
 if(!Array.isArray(prior)||prior.length!==1||!iguales(prior[0],c))
  throw new RomoCierreDuplicadoDiferenteQA();
 return Object.freeze({registrado:false,duplicado:true,referencia:c.turno_ref});
}
