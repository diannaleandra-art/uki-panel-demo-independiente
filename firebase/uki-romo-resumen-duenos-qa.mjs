/**
 * Salida PRIVADA de cierre Romo para Mi Administración.
 * Adaptador de solo datos: nunca accede a la red ni escribe en Uki o Neon.
 * NO equivale a un cierre recibido en Mi Administración.
 *
 * Se ejecuta sobre el cierre ya calculado por el motor Romo; el comprobante
 * de revisión de Neon se agrega SOLO después de confirmar el guardado.
 */
export const ROMO_FINANZAS_DUENOS_LIVE_HABILITADO_QA=false;
const SUC='Romo’s Sushi La Serena';
const STORE='romo:serena';
const METHODS=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const ok=(v,m)=>{if(!v)throw Error(m)};
const amount=(v,n)=>{
 ok(Number.isSafeInteger(v)&&v>=0&&v<=1000000000,'Importe inválido de '+n);
 return v;
};
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T12:00:00Z'))&&
 new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const receiptValue=x=>x&&x.storeId===STORE&&
 x.estado==='cierre_confirmado'&&
 Number.isSafeInteger(x.revision)&&x.revision>=1&&
 typeof x.turnoId==='string';
export function prepararResumenCierreRomoDuenosQA(cierre){
 ok(cierre?.suc===SUC,'El cierre no pertenece a Romo La Serena');
 const fecha=cierre.fechaOperativa;
 ok(day(fecha),'La fecha del cierre Romo no es válida');
 const turno=cierre.turnoClave;
 ok(typeof turno==='string'&&
  /^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(turno)&&
  turno.startsWith(fecha+'@'),'La identidad del turno es inválida');
 const inicio=Number(turno.slice(11));
 ok(Number.isSafeInteger(inicio)&&inicio>0&&
  Number.isSafeInteger(cierre.fechaMs)&&cierre.fechaMs>inicio,
  'No se confirmó el momento del cierre');
 const ventas=amount(cierre.venta,'ventas');
 const pedidos=amount(cierre.pedidos,'pedidos');
 ok(pedidos<=10000,'Cantidad de pedidos fuera de rango');
 const medios={};
 ok(cierre.medios&&typeof cierre.medios==='object'&&!Array.isArray(cierre.medios),
  'Falta desglose de cobros de Romo');
 for(const [medio,valor] of Object.entries(cierre.medios)){
  ok(METHODS.has(medio),'Medio de pago Romo desconocido');
  medios[medio]=amount(valor,'medio '+medio);
 }
 ok(Object.values(medios).reduce((sum,n)=>sum+n,0)===ventas,
  'Los medios no cuadran con la venta de Romo');
 const gastos=amount(cierre.gastos,'gastos');
 const reparto=amount(cierre.delivery,'pago al repartidor');
 const propinas=amount(cierre.propinas,'propinas');
 const retiros=amount(cierre.retiros,'retiros');
 const diferencia=Number(cierre.diferenciaEfectivo);
 ok(Number.isSafeInteger(diferencia)&&Math.abs(diferencia)<=1000000000,
  'La diferencia de efectivo es inválida');
 const contado=amount(cierre.efectivoContado,'efectivo contado');
 ok(diferencia===0||(typeof cierre.obs==='string'&&cierre.obs.trim().length>=3),
  'La diferencia requiere un motivo registrado');
 // La venta ya contiene los cobros a clientes. Ni reparto, ni propinas,
 // ni gastos, ni caja chica son ingresos adicionales.
 const dat={
  origen:'romo',store_id:STORE,sucursal:'serena',fecha_operativa:fecha,
  turno_ref:turno,fecha_cierre_ms:cierre.fechaMs,
  fuente_unica:STORE+'|'+turno,
  venta_total:ventas,pedidos,medios:Object.freeze(medios),
  gastos_cierre:gastos,delivery_por_pagar:reparto,propinas,retiros,
  efectivo_contado:contado,diferencia_efectivo:diferencia,
  caja_chica_inicial:amount(cierre.cajaChicaInicial??0,'caja chica inicial'),
  caja_chica_gastos:amount(cierre.cajaChicaGastos??0,'caja chica gastos'),
  estado:'pendiente_confirmacion_neon'
 };
 return Object.freeze(dat);
}
export function vincularResumenConfirmadoRomoDuenosQA(resumen,confirmacionNeon){
 ok(resumen?.origen==='romo'&&resumen.store_id===STORE&&
  resumen.estado==='pendiente_confirmacion_neon',
  'El resumen no está preparado por el motor Romo');
 ok(receiptValue(confirmacionNeon)&&
  confirmacionNeon.turnoId===resumen.turno_ref,
  'Se requiere confirmación de Neon del mismo turno');
 return Object.freeze({...resumen,
  estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',
  revision_neon:confirmacionNeon.revision
 });
}
