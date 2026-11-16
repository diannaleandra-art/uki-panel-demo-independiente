/**
 * Romo La Serena · propuesta de cierre rectificado v2, NO de segundo cierre.
 * Uso exclusivo en el mismo Historial de Caja de Uki, aislado en estado Romo.
 *
 * Requiere:
 *  - propuesta pendiente guardada en Neon antes de confirmar;
 *  - dueño y efectivo/transferencia YA entregado/recibido, evidencia;
 *  - turno ACTUAL distinto del original, abierto y base confirmada;
 *  - registro atómico posterior en Neon (snapshot cifrado CAS + recibo v2).
 *
 * No reabre ni muta el cierre ni el pedido originales. No genera venta nueva.
 */
export const ROMO_RECTIFICACION_VERSION_QA=2;
const SUC='Romo’s Sushi La Serena',STORE='romo:serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const need=(p,m)=>{if(!p)throw Error(m)};
const int=(v,name,min=0,max=1000000000)=>{
 need(Number.isSafeInteger(v)&&v>=min&&v<=max,'Importe no válido: '+name);
 return v;
};
const name=(v,label,min=2,max=250)=>{
 const s=String(v??'').trim().replace(/\s+/g,' ');
 need(s.length>=min&&s.length<=max,label+' obligatorio o demasiado largo');
 return s;
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const mediosVal=(m)=>{
 need(m&&typeof m==='object'&&!Array.isArray(m)&&
   Object.keys(m).length>=1&&Object.keys(m).every(x=>MEDIOS.includes(x)||
   ['Uber Eats','PedidosYa','Rappi'].includes(x))&&
   Object.values(m).every(v=>Number.isSafeInteger(v)&&v>=0),
   'Los medios originales no son válidos');
 return m;
};
const orderMap=(m)=>Object.fromEntries(Object.entries(m).sort(([a],[b])=>a.localeCompare(b)));
export function prepararConfirmacionRectificacionRomoQA(estado,{
 solicitudId,responsable,motivoMovimiento,referenciaMovimiento,
 confirmoMovimientoReal=false,fechaMs=Date.now()
}={}){
 need(estado?.suc===SUC&&
   ['pedidos','cierres','ajustesHistoricos','propinas','gastos','retiros'].every(x=>
    Array.isArray(estado[x])&&estado[x].every(y=>y?.suc===SUC))&&
   estado.cajasDiarias&&typeof estado.cajasDiarias==='object',
   'Los registros pertenecen exclusivamente a Romo');
 need(Number.isSafeInteger(solicitudId)&&solicitudId>0,'Solicitud de rectificación inválida');
 need(Number.isSafeInteger(fechaMs)&&fechaMs>1700000000000,
   'Hora de confirmación no válida');
 const quien=name(responsable,'Responsable',2,80);
 const detalle=name(motivoMovimiento,'Motivo de conciliación',4,300);
 const ref=name(referenciaMovimiento,'Referencia del dinero movido',4,150);
 need(confirmoMovimientoReal===true,
  'Solo confirmar si el dinero YA se entregó o recibió realmente');
 const solicitudes=estado.ajustesHistoricos.filter(a=>a.id===solicitudId&&
  a.tipo==='rectificacion_monetaria_pendiente');
 need(solicitudes.length===1&&solicitudes[0].estado==='pendiente_conciliacion',
  'La solicitud no está pendiente o ya se confirmó');
 const a=solicitudes[0],turno=String(a.turnoClave||'');
 need(TURN.test(turno)&&a.fuenteOriginal===STORE+'|'+turno&&
  a.versionPropuesta===2&&a.esSoloPropuesta===true&&
  a.dineroRegistrado===false&&a.comprobanteOriginalConservado===true,
  'La propuesta anterior no está íntegra');
 const cierres=estado.cierres.filter(c=>c.turnoClave===turno);
 need(cierres.length===1,'Cierre original no existe o está duplicado');
 const c=cierres[0],pedido=estado.pedidos.filter(p=>p.id===a.pedidoId&&
  p.turnoClave===turno&&p.pagado===true);
 need(pedido.length===1&&c.fechaMs===a.cierreMs&&
  c.fechaOperativa===turno.slice(0,10)&&fechaMs>c.fechaMs,
  'El pedido y el cierre original no corresponden a la misma jornada');
 need(!c.rectificacion&&c.inicioTurnoMs&&
  a.registradoEn>=c.fechaMs&&a.registradoEn<=fechaMs,
  'La hora de la propuesta y el cierre no concuerdan');
 need(estado.ajustesHistoricos.filter(x=>x.turnoClave===turno&&
  ['rectificacion_monetaria_pendiente','rectificacion_monetaria_confirmada'].includes(x.tipo)).length===1,
  'Ya existe otra rectificación del cierre original');
 const antes=a.antes,post=a.propuesta;
 const sum=m=>Object.values(m).reduce((v,n)=>v+n,0);
 need(antes&&post&&same(orderMap(mediosVal(antes.medios)),orderMap(mediosVal(c.medios)))&&
  int(c.venta,'venta original')===antes.venta&&
  int(antes.venta,'venta anterior')===sum(antes.medios)&&
  int(post.venta,'venta corregida')===sum(mediosVal(post.medios))&&
  c.efectivoContado===antes.efectivoContado,
  'La constancia original y los importes propuestos no coinciden');
 const delta=int(a.monto,'diferencia',1,100000000)*
  (a.clase==='cobro_adicional'?1:a.clase==='devolucion'?-1:0);
 need(delta!==0&&delta===a.delta&&MEDIOS.includes(a.medio)&&
  antes.venta+delta===post.venta&&
  Object.keys(post.medios).every(k=>
   Number(post.medios[k])===Number(antes.medios[k]||0)+(k===a.medio?delta:0)),
  'La propuesta rectificada altera otros medios o importes');
 const vigente=String(estado.fechaOperativa||'');
 const caja=estado.cajasDiarias[SUC+'|'+vigente],actual=String(caja?.turnoId||'');
 need(/^\d{4}-\d{2}-\d{2}$/.test(vigente)&&TURN.test(actual)&&
  actual.startsWith(vigente+'@')&&actual!==turno&&
  caja?.turnoAbierto===true&&caja.baseConfirmada===true&&
  Number.isSafeInteger(caja.inicioMs)&&fechaMs>=caja.inicioMs&&
  caja.turnoId===vigente+'@'+caja.inicioMs&&
  !estado.cierres.some(x=>x.turnoClave===actual),
  'Abre y confirma la caja real del turno en el que se concilia');
 // Uki permite turnos que atraviesan medianoche. Se conserva la
 // FECHA OPERATIVA del turno abierto, no la fecha civil del pago.
 need(fechaMs-caja.inicioMs<=36*60*60*1000&&
  caja.inicioMs>=c.fechaMs,
  'La caja del movimiento no corresponde al turno posterior al cierre');
 // No sumar a ventas del turno actual. Libro separado por source_key.
 const fuente=STORE+'|'+turno+'|v2',folioOriginal=STORE+'|'+turno;
 const nueva={...a,tipo:'rectificacion_monetaria_confirmada',
  estado:'confirmada',
  esSoloPropuesta:false,dineroRegistrado:true,
  requiereConciliacion:false,requiereConstanciaVersionada:false,
  fuenteRectificacion:fuente,fechaConciliacionISO:new Date(fechaMs).toISOString(),
  confirmadoEn:fechaMs,aprobadoPor:quien,
  motivoMovimiento:detalle,referenciaMovimiento:ref,
  turnoMovimiento:actual,fechaOperativaMovimiento:vigente,
  noEsVentaNueva:true,
  constanciaVersionada:true,versionConfirmada:2
 };
 const index=estado.ajustesHistoricos.indexOf(a);
 estado.ajustesHistoricos[index]=nueva;
 const resumen={
  origen:'romo',store_id:STORE,
  fuente_unica:fuente,fuente_original:folioOriginal,
  turno_ref:turno,version:2,pedido_id:a.pedidoId,
  clase:a.clase,medio:a.medio,monto:a.monto,delta,
  venta_original:antes.venta,venta_rectificada:post.venta,
  medios_original:orderMap(antes.medios),
  medios_rectificados:orderMap(post.medios),
  fecha_cierre_ms:c.fechaMs,
  turno_movimiento:actual,fecha_operativa_movimiento:vigente,
  confirmado_en_ms:fechaMs,responsable:quien,
  motivo:detalle,referencia:ref,
  comprobante_original_conservado:true,
  dinero_real_confirmado:true,
  estado:'pendiente_constancia_neon'
 };
 return Object.freeze({
  solicitudId,turnoOriginal:turno,turnoMovimiento:actual,
  monto:a.monto,medio:a.medio,delta,
  sinNuevaVenta:true,sinModificarCierreOriginal:true,
  resumen:Object.freeze(resumen)
 });
}
