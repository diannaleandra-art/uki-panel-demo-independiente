import {clasificarCorreccionPagadaRomoQA} from './uki-romo-edicion-pagada-qa.mjs';
import {calcularDiferenciaPagadaRomoQA} from './uki-romo-diferencias-financieras-qa.mjs';
/**
 * Romo La Serena: reutilizar el formulario de PROPINA MANUAL oficial Uki.
 * Recibe una COPIA de estado; sin escritura directa. Solo el CAS Neon
 * del panel confirma un registro REAL y único, aparte de ventas/delivery.
 */
const SUC='Romo’s Sushi La Serena';
import './uki-romo-transferencias-qa.js';
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const n=x=>String(x??'').trim();
export function prepararPropinaManualRomoQA(estado,{
 referencia,monto,concepto,medio,responsable,registradoEn,
 confirmarRecibida=false
}={}){
 assert(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
   Array.isArray(estado.propinas)&&Array.isArray(estado.cierres)&&
   estado.cajasDiarias&&typeof estado.cajasDiarias==='object',
   'No existe un estado de caja Romo independiente');
 assert(estado.pedidos.every(p=>p?.suc===SUC)&&
   estado.propinas.every(p=>p?.suc===SUC),
   'Se detectaron datos de otra sucursal');
 assert(confirmarRecibida===true,'No confirmaste haber recibido realmente la propina');
 assert(Number.isSafeInteger(monto)&&monto>=1&&monto<=10000000,
   'Monto de propina inválido');
 assert(MEDIOS.includes(medio),'El medio de la propina no está permitido');
 assert(n(concepto).length>=3&&n(concepto).length<=150,'Escribe el concepto de la propina');
 assert(n(responsable).length>=2&&n(responsable).length<=80,
   'Identifica quién recibió el dinero');
 assert(Number.isSafeInteger(registradoEn)&&registradoEn>0&&
   Number.isFinite(new Date(registradoEn).getTime()),
   'Hora de recepción inválida');
 const text=n(referencia);
 assert(text.length>0&&text.length<=80,'Indica el número del pedido');
 const prefCarta=/^carta\b/i.test(text);
 const prefInterno=/^(?:interno|pedido\s+interno)\b/i.test(text);
 const ref=text.replace(/^(?:carta|pedido\s+interno|interno)\s*#?\s*/i,'')
   .replace(/^#/,'').trim();
 assert(ref&&ref.length<=60,'Escribe el folio de carta o pedido interno');
 const pedidos=estado.pedidos.filter(p=>
   prefCarta?String(p.codigoCarta||'')===ref:
   prefInterno?String(p.id)===ref:
   String(p.id)===ref||String(p.codigoCarta||'')===ref);
 assert(pedidos.length===1,
   pedidos.length?'El número es ambiguo: especifica Carta o Interno':
   'El pedido no existe en Romo La Serena');
 const p=pedidos[0],turno=String(p.turnoClave||'');
 assert(p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio,
   'Solo un pedido pagado y vigente admite propina manual');
 assert(!p.ajusteCobroPendiente&&
   !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),
   'Revisa los ajustes o las mesas QR antes de registrar otra propina');
 assert(!Number(p.propina||0)&&
   !estado.propinas.some(x=>Number(x.pedidoId)===Number(p.id)),
   'Este pedido ya tiene propina; no registres otra');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 assert(caja?.turnoAbierto===true&&caja.baseConfirmada===true&&
   caja.turnoId===turno&&Number.isSafeInteger(caja.inicioMs)&&
   registradoEn>=caja.inicioMs,
   'El turno del pedido no está abierto o su base no fue confirmada');
 assert(!estado.cierres.some(c=>c?.suc===SUC&&c.turnoClave===turno),
   'El pedido pertenece a un cierre definitivo');
 const oldLength=estado.propinas.length;
 let id=registradoEn;
 while(estado.propinas.some(x=>x.id===id))id++;
 const fila={
  suc:SUC,id,fechaISO:new Date(registradoEn).toISOString(),
  registradoEn,monto,medio,pedidoId:p.id,
  codigoCarta:p.codigoCarta||'',concepto:n(concepto),
  origen:'manual',responsable:n(responsable)
 };
 estado.propinas.push(fila);
 assert(estado.propinas.length===oldLength+1,'No se pudo agregar la propina');
 // No modificar pedido, venta, medios del pedido, fidelidad ni cierre.
 return Object.freeze({pedidoId:p.id,codigoCarta:fila.codigoCarta,monto,
  medio,concepto:fila.concepto,registroId:id,
  propinaUnica:true,noEsVenta:true});
}


/**
 * Corrección de propina YA REGISTRADA en un pedido pagado, usando el mismo
 * formulario de Uki. No crea una segunda propina ni afecta ventas/productos.
 * Solo valida una COPIA: el controlador confirma con CAS cifrado Neon Romo.
 */
export function prepararCorreccionPropinaPagadaRomoQA(estado,{
 pedidoId,draft,responsable,motivo,confirmacionReal=false,foto,
 mediosProductos,mediosDelivery,turnoCerrado=false,
 registradoEn=Date.now(),fechaISO=new Date(registradoEn).toISOString()
}={}){
 assert(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
  Array.isArray(estado.propinas)&&Array.isArray(estado.cierres)&&
  estado.cajasDiarias&&typeof estado.cajasDiarias==='object'&&
  estado.pedidos.every(x=>x?.suc===SUC)&&estado.propinas.every(x=>x?.suc===SUC),
  'Solo se puede corregir la propina en el estado aislado de Romo');
 assert(Number.isSafeInteger(pedidoId)&&pedidoId>0&&
  Number(draft?.editando)===pedidoId&&typeof foto==='function',
  'Pedido o formulario de propina incorrecto');
 const pedidos=estado.pedidos.filter(x=>x.id===pedidoId&&x.suc===SUC);
 assert(pedidos.length===1,'El pedido no existe o se duplicó');
 const p=pedidos[0],turno=String(p.turnoClave||'');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 assert(p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio&&
  !/^PRUEBA\b/i.test(n(p.cliente))&&!p.ajusteCobroPendiente&&
  !p.productosPagadosOtroLocal&&!p.envioPagadoOtroLocal&&
  !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),
  'Solo pedidos reales pagados de Romo, sin QR, cobro externo ni ajuste pendiente');
 assert(turno&&caja?.turnoAbierto===true&&caja.baseConfirmada===true&&
  caja.turnoId===turno&&Number.isSafeInteger(caja.inicioMs)&&
  !turnoCerrado&&!estado.cierres.some(c=>c.suc===SUC&&c.turnoClave===turno),
  'La caja original debe estar abierta, con base confirmada y sin cierre');
 const actor=n(responsable),reason=n(motivo);
 assert(actor.length>=2&&actor.length<=80&&reason.length>=4&&reason.length<=250,
  'Identifica al responsable y escribe el motivo de corrección');
 assert(Number.isSafeInteger(registradoEn)&&registradoEn>caja.inicioMs&&
  Number.isFinite(Date.parse(fechaISO)),
  'Fecha del registro no corresponde al turno');
 const registradas=estado.propinas.filter(x=>Number(x.pedidoId)===pedidoId);
 assert(registradas.length===1&&registradas[0].origen==='pedido',
  'La propina debe tener un único registro original del pedido; la propina manual se corrige aparte');
 const registro=registradas[0],original=Number(p.propina);
 const tiempoOriginal=Number(registro.registradoEn)||Date.parse(registro.fechaISO||'');
 assert(Number.isSafeInteger(tiempoOriginal)&&tiempoOriginal>=caja.inicioMs&&
  tiempoOriginal<=registradoEn,
  'La propina original no corresponde al turno abierto');
 assert(Number.isSafeInteger(original)&&original>0&&original<=1000000&&
  registro.monto===original&&MEDIOS.includes(registro.medio)&&
  n(p.medioPropina||'Efectivo')===registro.medio,
  'El pedido y la propina original no cuadran; revisa Caja antes de corregir');
 const modo=String(draft.propinaModo||'ninguna');
 assert(['ninguna','diez','otro'].includes(modo),'Modo de propina no permitido');
 const subtotal=Number(p.subtotal);
 assert(Number.isSafeInteger(subtotal)&&subtotal>=0,'Subtotal no confirmado');
 const nuevoMonto=modo==='ninguna'?0:modo==='diez'?
  Math.round(subtotal*0.1):Number(draft.propinaPersonalizada);
 const medioNuevo=n(draft.medioPropina||'Efectivo');
 assert(Number.isSafeInteger(nuevoMonto)&&nuevoMonto>=0&&nuevoMonto<=1000000&&
  MEDIOS.includes(medioNuevo),'Monto o medio de propina no permitido');
 // El formulario de Uki admite correcciones del pedido completo, pero ESTE
 // botón solo permite la propina; otras diferencias conservan su bloqueo.
 const clas=clasificarCorreccionPagadaRomoQA(p,draft);
 assert(clas.cambios.length===0&&clas.protegidos.length===1&&
  clas.protegidos[0]==='propina','Hay otros cambios en la venta pagada; no se guardó la propina');
 const plan=calcularDiferenciaPagadaRomoQA(p,draft,{mediosProductos,mediosDelivery});
 assert(plan.original.productos===plan.propuesto.productos&&
  plan.original.delivery===plan.propuesto.delivery&&
  plan.original.propina===original&&plan.propuesto.propina===nuevoMonto&&
  plan.propina.medioAnterior===registro.medio&&
  plan.propina.medioPropuesto===medioNuevo&&
  plan.diferencias.every(x=>x.diferencia===0)&&
  plan.propuesto.total-plan.original.total===nuevoMonto-original,
  'La corrección alteraría productos, delivery o medios que no son propina');
 const diferencia=nuevoMonto-original;
 assert(diferencia!==0||medioNuevo!==registro.medio,'No hay cambios para conciliar');
 assert(diferencia===0||medioNuevo===registro.medio,
  'No mezcles cambio de monto con cambio de medio: corrige primero uno y luego el otro');
 assert(confirmacionReal===true,
  diferencia<0?'Confirma que la devolución de propina realmente se efectuó':
  diferencia>0?'Confirma que la propina adicional realmente fue recibida':
  'Confirma el medio por el que realmente se recibió la propina');
 const nuevoTotal=Number(p.total)+diferencia;
 assert(Number.isSafeInteger(nuevoTotal)&&nuevoTotal>=0&&nuevoTotal<=3000000,
  'El total del pedido tras la propina no es válido');
 const antes=foto(p);
 const beforeTip={id:registro.id,monto:registro.monto,medio:registro.medio,
  origen:registro.origen,fechaISO:registro.fechaISO,registradoEn:registro.registradoEn};
 const actualizado={...p,propina:nuevoMonto,medioPropina:medioNuevo,
  propinaModo:modo,propinaPersonalizada:modo==='otro'?nuevoMonto:'',
  total:nuevoTotal};
 globalThis.ukiRomoTransferenciasQA.invalidar(p,actualizado,registradoEn);
 const after=foto(actualizado);
 const evento={
  tipo:'correccion_propina_pagada',fecha:fechaISO,fechaISO,registradoEn,
  responsable:actor,motivo:reason,anterior:antes,nuevo:after,
  importeOriginal:original,importeNuevo:nuevoMonto,
  medioAnterior:registro.medio,medioNuevo,
  diferencia,confirmacionReal:true,
  accion:diferencia<0?'devolucion_propina_realizada':
   diferencia>0?'propina_adicional_recibida':'rectificacion_medio_propina'
 };
 actualizado.historialCambios=[...(Array.isArray(p.historialCambios)?p.historialCambios:[]),evento];
 actualizado.correccionesTurno=[...(Array.isArray(p.correccionesTurno)?p.correccionesTurno:[]),
  {tipo:evento.tipo,accion:evento.accion,fechaISO,registradoEn,
   responsable:actor,nota:reason,antes,despues:after,diferencia,
   importeOriginal:original,importeNuevo:nuevoMonto,
   medioAnterior:registro.medio,medioNuevo,saldoPendiente:0}];
 const cambioRegistro={tipo:evento.tipo,fechaISO,registradoEn,responsable:actor,
  motivo:reason,antes:beforeTip,despues:{...beforeTip,monto:nuevoMonto,medio:medioNuevo},
  confirmacionReal:true};
 const fila={...registro,monto:nuevoMonto,medio:medioNuevo,
  historialCorrecciones:[...(Array.isArray(registro.historialCorrecciones)?
   registro.historialCorrecciones:[]),cambioRegistro]};
 // Preservar mismo ID y fecha del registro, sin crear nueva propina.
 estado.pedidos[estado.pedidos.indexOf(p)]=actualizado;
 estado.propinas[estado.propinas.indexOf(registro)]=fila;
 assert(estado.propinas.length===registradas.length+
   estado.propinas.filter(x=>Number(x.pedidoId)!==pedidoId).length,
  'La corrección duplicó una propina');
 return Object.freeze({pedidoId,propinaId:registro.id,
  montoAnterior:original,montoNuevo:nuevoMonto,medioAnterior:registro.medio,
  medioNuevo,diferencia,accion:evento.accion,
  mismaPropina:true,noEsVenta:true,noCreaCobro:true});
}


/**
 * Mismo formulario de propinas de Caja Uki: rectificar una propina MANUAL
 * ya guardada sin eliminarla ni insertar otra. Mantiene venta y timbres.
 * Nunca envía dinero; requiere confirmación de movimiento ocurrido.
 */
export function prepararCorreccionPropinaManualRomoQA(estado,{
 referencia,monto,medio,concepto,responsable,motivo,
 confirmacionReal=false,registradoEn=Date.now(),
 fechaISO=new Date(registradoEn).toISOString(),foto
}={}){
 assert(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
  Array.isArray(estado.propinas)&&Array.isArray(estado.cierres)&&
  estado.cajasDiarias&&typeof estado.cajasDiarias==='object'&&
  estado.pedidos.every(x=>x?.suc===SUC)&&estado.propinas.every(x=>x?.suc===SUC),
  'Solo puede corregirse una propina de Romo La Serena');
 assert(Number.isSafeInteger(registradoEn)&&registradoEn>0&&
  Number.isFinite(Date.parse(fechaISO))&&typeof foto==='function',
  'Fecha o auditoría no válida');
 const actor=n(responsable),reason=n(motivo);
 assert(actor.length>=2&&actor.length<=80&&
  reason.length>=4&&reason.length<=250,
  'Responsable y motivo de la corrección obligatorios');
 assert(Number.isSafeInteger(monto)&&monto>=0&&monto<=1000000&&
  MEDIOS.includes(medio)&&n(concepto).length>=3&&n(concepto).length<=150,
  'Propina corregida, medio o concepto no permitido');
 const text=n(referencia);
 assert(text.length>0&&text.length<=80,'Escribe el mismo folio de la propina original');
 const prefCarta=/^carta\b/i.test(text),prefInterno=/^(?:interno|pedido\s+interno)\b/i.test(text);
 const ref=text.replace(/^(?:carta|pedido\s+interno|interno)\s*#?\s*/i,'')
  .replace(/^#/,'').trim();
 assert(ref.length>0&&ref.length<=60,'Folio inválido');
 const pedidos=estado.pedidos.filter(p=>
  prefCarta?String(p.codigoCarta||'')===ref:
  prefInterno?String(p.id)===ref:
  String(p.id)===ref||String(p.codigoCarta||'')===ref);
 assert(pedidos.length===1,'No se identificó un pedido único de Romo');
 const p=pedidos[0],turno=String(p.turnoClave||'');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 assert(p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio&&
  !/^PRUEBA\b/i.test(n(p.cliente))&&!p.ajusteCobroPendiente&&
  !p.productosPagadosOtroLocal&&!p.envioPagadoOtroLocal&&
  !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),
  'Solo pedidos pagados reales sin otro ajuste ni QR');
 assert(turno&&caja?.turnoAbierto===true&&caja.baseConfirmada===true&&
  caja.turnoId===turno&&Number.isSafeInteger(caja.inicioMs)&&
  registradoEn>caja.inicioMs&&!estado.cierres.some(c=>
   c.suc===SUC&&c.turnoClave===turno),
  'Turno cerrado o sin base confirmada; no modificar propina');
 assert(!Number(p.propina||0),
  'Existe propina dentro del pedido: utiliza su formulario original');
 const registros=estado.propinas.filter(x=>Number(x.pedidoId)===Number(p.id));
 assert(registros.length===1&&registros[0].origen==='manual',
  'No hay una propina manual única para corregir');
 const previo=registros[0];
 const tiempoAnterior=Number(previo.registradoEn)||Date.parse(previo.fechaISO||'');
 assert(Number.isSafeInteger(tiempoAnterior)&&tiempoAnterior>=caja.inicioMs&&
  tiempoAnterior<=registradoEn,
  'La propina manual original pertenece a otro turno');
 assert(Number.isSafeInteger(previo.monto)&&previo.monto>=0&&
  MEDIOS.includes(previo.medio)&&
  estado.propinas.filter(x=>String(x.id)===String(previo.id)).length===1,
  'El registro anterior es ambiguo o no válido');
 const diferencia=monto-previo.monto;
 const cambioMedio=medio!==previo.medio;
 assert(diferencia!==0||cambioMedio||n(concepto)!==n(previo.concepto),
  'No hay corrección de propina para guardar');
 assert(diferencia===0||!cambioMedio,
  'No cambies importe y medio a la vez: primero confirma un movimiento y después corrige la clasificación');
 assert(confirmacionReal===true,
  'Antes de guardar verifica que el dinero se movió de verdad o que la clasificación es correcta');
 const antes=foto(p);
 const antesPropina={id:previo.id,monto:previo.monto,medio:previo.medio,
  concepto:previo.concepto,registradoEn:previo.registradoEn,fechaISO:previo.fechaISO};
 const despuesPropina={...antesPropina,monto,medio,concepto:n(concepto)};
 const movimiento={
  tipo:'correccion_propina_manual',fecha:fechaISO,fechaISO,registradoEn,
  responsable:actor,motivo:reason,
  accion:diferencia>0?'propina_adicional_recibida':
   diferencia<0?'devolucion_propina_realizada':
   cambioMedio?'rectificacion_medio_propina':'rectificacion_concepto_propina',
  montoAnterior:previo.monto,montoNuevo:monto,
  medioAnterior:previo.medio,medioNuevo:medio,diferencia,
  anterior:antesPropina,nuevo:despuesPropina,
  confirmacionReal:true
 };
 const nuevaFila={...previo,monto,medio,concepto:n(concepto),
  historialCorrecciones:[...(Array.isArray(previo.historialCorrecciones)?
   previo.historialCorrecciones:[]),movimiento]};
 const nuevoPedido={...p,
  historialCambios:[...(Array.isArray(p.historialCambios)?p.historialCambios:[]),
   {...movimiento,anterior:antes,nuevo:foto(p)}],
  correccionesTurno:[...(Array.isArray(p.correccionesTurno)?p.correccionesTurno:[]),
   {tipo:movimiento.tipo,accion:movimiento.accion,fechaISO,registradoEn,
    responsable:actor,nota:reason,montoAnterior:previo.monto,montoNuevo:monto,
    medioAnterior:previo.medio,medioNuevo:medio,diferencia,
    antes,despues:foto(p),saldoPendiente:0}]
 };
 // MISMO pedido y MISMA propina. Fecha original no cambia; reporte recalcula.
 estado.pedidos[estado.pedidos.indexOf(p)]=nuevoPedido;
 estado.propinas[estado.propinas.indexOf(previo)]=nuevaFila;
 return Object.freeze({pedidoId:p.id,registroId:previo.id,
  montoAnterior:previo.monto,montoNuevo:monto,medioAnterior:previo.medio,
  medioNuevo:medio,diferencia,accion:movimiento.accion,
  mismaPropina:true,noEsVenta:true,noCreaCobro:true});
}
