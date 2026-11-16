/**
 * Romo · confirmación histórica de pedido olvidado con comprobante versionado.
 * NO se está recibiendo dinero ahora: el pago declarado pertenece al cierre
 * ANTIGUO y se acreditó antes de la rectificación. No sumar al turno actual.
 * El estado cifrado y el comprobante se grabarán juntos en un único CAS Neon.
 */
export const ROMO_OLVIDO_CONSTANCIA_PREPARADA_QA=true;
const SUC='Romo’s Sushi La Serena',STORE='romo:serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const must=(v,m)=>{if(!v)throw Error(m)};
const integer=(v,name,max=1000000000)=>{
 must(Number.isSafeInteger(v)&&v>=0&&v<=max,'Importe inválido: '+name);
 return v;
};
const clean=(v,min,max,name)=>{
 const s=String(v??'').trim().replace(/\s+/g,' ');
 must(s.length>=min&&s.length<=max,name+' obligatorio o demasiado largo');
 return s;
};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function prepararConfirmacionOlvidoRomoQA(estado,{
 solicitudId,responsable,motivoConfirmacion,
 referenciaPagoLocal='',referenciaPagoExterno='',
 pagoHistoricoVerificado=false,autorizaDuenos=false,
 registradoEn=Date.now()
}={}){
 must(estado?.suc===SUC&&
  ['ajustesHistoricos','pedidos','cierres'].every(k=>
   Array.isArray(estado[k])&&estado[k].every(x=>x?.suc===SUC)),
  'Solo el estado cifrado exclusivo de Romo puede conciliarse');
 must(Number.isSafeInteger(solicitudId)&&solicitudId>0&&
  Number.isSafeInteger(registradoEn)&&registradoEn>1700000000000,
  'Solicitud o fecha de confirmación inválidas');
 must(pagoHistoricoVerificado===true&&autorizaDuenos===true,
  'La dueña debe comprobar el pago histórico y autorizar esta rectificación');
 const actor=clean(responsable,2,80,'Responsable');
 const reason=clean(motivoConfirmacion,4,300,'Motivo de conciliación');
 const solicitudes=estado.ajustesHistoricos.filter(x=>x.id===solicitudId&&
  x.tipo==='pedido_olvidado_romo_pendiente');
 must(solicitudes.length===1,'La solicitud no está pendiente o está duplicada');
 const a=solicitudes[0];
 must(a.estado==='pendiente_conciliacion'&&a.soloPropuesta===true&&
  a.dineroRegistrado===false&&a.comprobanteOriginalConservado===true&&
  a.pagado===true&&a.requiereConstanciaVersionada===true,
  'La solicitud no está intacta o ya fue conciliada');
 const turno=String(a.turnoClave||'');
 must(TURN.test(turno)&&a.fuenteOriginal===STORE+'|'+turno&&
  Number.isSafeInteger(a.versionPropuesta)&&
  a.versionPropuesta>=2&&a.versionPropuesta<=32,
  'No hay versión consecutiva del cierre original');
 const c=estado.cierres.filter(x=>x.turnoClave===turno);
 must(c.length===1&&c[0].fechaOperativa===turno.slice(0,10)&&
  c[0].fechaMs===a.cierreMs&&
  Number.isSafeInteger(c[0].inicioTurnoMs)&&
  c[0].inicioTurnoMs===Number(turno.split('@')[1])&&
  a.registradoEn>=c[0].fechaMs&&registradoEn>=a.registradoEn,
  'El pedido olvidado no coincide con el cierre único');
 must(!c[0].rectificacion&&
  !estado.ajustesHistoricos.some(x=>x.turnoClave===turno&&
   ['rectificacion_monetaria_pendiente','rectificacion_monetaria_confirmada',
   'pedido_olvidado'].includes(x.tipo)),
  'El cierre ya tiene otro tipo de rectificación: revisar antes');
 const anteriores=estado.ajustesHistoricos.filter(x=>x.turnoClave===turno&&
  x.tipo==='pedido_olvidado_romo_confirmado')
  .sort((a,b)=>a.versionConfirmada-b.versionConfirmada);
 must(a.versionPropuesta===anteriores.length+2&&anteriores.length<=30&&
  anteriores.every((x,i)=>x.versionConfirmada===i+2&&
   x.reciboVerificadoEnNeon===true&&x.constanciaVersionada===true&&
   x.fuenteRectificacion===STORE+'|'+turno+'|v'+(i+2)),
  'Las constancias anteriores están incompletas o fuera de orden');
 const duplicated=[...anteriores,...estado.ajustesHistoricos.filter(x=>
  x.tipo==='pedido_olvidado_romo_pendiente'&&x.id!==solicitudId&&
  x.turnoClave===turno)];
 must(!duplicated.some(x=>x.claveOlvido===a.claveOlvido||
  (a.codigoCarta&&x.codigoCarta===a.codigoCarta)),
  'Ya existe este pedido en otra constancia');
 const productos=integer(a.subtotal,'productos',100000000),
  envio=integer(a.envio,'delivery',100000000),
  total=integer(a.total,'total',100000000),
  local=integer(a.recibidoLocal,'cobro Romo',100000000),
  externo=integer(a.recibidoOtroLocal,'cobro externo',100000000);
 must(productos>0&&total===productos+envio&&
  local+externo===total&&
  ['Delivery','Retiro','Consumo en local'].includes(a.modalidad)&&
  (a.modalidad==='Delivery'?envio>0:envio===0),
  'El total del pedido histórico no cuadra');
 const deliveryLocal=integer(a.deliveryCobradoLocal,'delivery Romo'),
  deliveryExterno=integer(a.deliveryCobradoOtroLocal,'delivery externo'),
  productosLocal=integer(a.productosCobradosLocal,'productos Romo'),
  productosExterno=integer(a.productosCobradosOtroLocal,'productos externos');
 must(deliveryLocal+deliveryExterno===envio&&
  productosLocal+productosExterno===productos&&
  deliveryLocal+productosLocal===local&&
  deliveryExterno+productosExterno===externo,
  'Productos y delivery se mezclaron entre locales');
 must(a.repartoRealizado===true||a.repartoRealizado===false,
  'Se requiere constancia de la entrega o reparto');
 const refLocal=local>0?
  clean(referenciaPagoLocal,4,150,'Referencia del pago recibido en Romo'):
  '';
 const refExterno=externo>0?
  clean(referenciaPagoExterno,4,150,'Confirmación de pago en otro local'):
  '';
 must(local===0||MEDIOS.includes(a.medioLocal),
  'Medio realmente recibido en Romo incorrecto');
 must(externo===0||clean(a.localExterno,2,80,'Otro local').length>0,
  'Falta identificar al local que recibió el dinero');
 must(typeof a.claveOlvido==='string'&&a.claveOlvido.length>10&&
  a.claveOlvido.length<800,'Identificador de deduplicación inválido');
 const importeOriginal=integer(c[0].venta,'venta original');
 must(c[0].medios&&typeof c[0].medios==='object'&&
  Object.values(c[0].medios).every(x=>Number.isSafeInteger(x)&&x>=0)&&
  Object.values(c[0].medios).reduce((v,x)=>v+x,0)===importeOriginal,
  'La fotografía original del cierre no cuadra');
 // Cada versión acumula TODOS los olvidos confirmados del mismo cierre,
 // manteniendo el original. Esto es contabilidad HISTÓRICA, no caja nueva.
 const cobroPrevio=anteriores.reduce((v,x)=>v+x.recibidoLocal,0);
 const ventaAnterior=importeOriginal+cobroPrevio;
 const ventaNueva=ventaAnterior+local;
 must(Number.isSafeInteger(ventaNueva)&&ventaNueva<=1000000000,
  'Los totales históricos superan el máximo');
 const medios={...c[0].medios};
 for(const x of anteriores){
  if(x.recibidoLocal)medios[x.medioLocal]=(medios[x.medioLocal]||0)+x.recibidoLocal;
 }
 const previosMedios={...medios};
 if(local)medios[a.medioLocal]=(medios[a.medioLocal]||0)+local;
 must(Object.values(previosMedios).reduce((v,x)=>v+x,0)===ventaAnterior&&
  Object.values(medios).reduce((v,x)=>v+x,0)===ventaNueva,
  'Los medios históricos no cuadran');
 const version=a.versionPropuesta;
 const previa=version===2?STORE+'|'+turno:STORE+'|'+turno+'|v'+(version-1);
 const fuente=STORE+'|'+turno+'|v'+version;
 const ahora=new Date(registradoEn).toISOString();
 const next={...a,
  tipo:'pedido_olvidado_romo_confirmado',estado:'confirmada',
  soloPropuesta:false,dineroRegistrado:false,
  reciboVerificadoEnNeon:true,constanciaVersionada:true,
  requiereConstanciaVersionada:false,noEsVentaDelTurnoActual:true,
  versionConfirmada:version,fuentePrevia:previa,
  fuenteRectificacion:fuente,confirmadoEn:registradoEn,
  confirmadoFechaISO:ahora,aprobadoPor:actor,
  motivoConfirmacion:reason,referenciaPagoLocal:refLocal,
  referenciaPagoExterno:refExterno,ventaAnterior,ventaRectificada:ventaNueva,
  repartoConciliado:false
 };
 estado.ajustesHistoricos[estado.ajustesHistoricos.indexOf(a)]=next;
 // La constancia SQL no contiene nombres de clientes ni texto del producto.
 const idReferencia=STORE+'|'+turno+'|'+solicitudId;
 const resumen={
  origen:'romo',store_id:STORE,tipo:'pedido_olvidado',
  fuente_original:STORE+'|'+turno,
  fuente_previa:previa,fuente_unica:fuente,
  turno_ref:turno,version,solicitud_id:solicitudId,
  clave_olvido:idReferencia,
  fecha_cierre_ms:c[0].fechaMs,
  fecha_operativa_original:c[0].fechaOperativa,
  fecha_pedido:a.fechaPedido,modalidad:a.modalidad,
  productos,delivery:envio,total,
  recibido_local:local,recibido_otro_local:externo,
  productos_local:productosLocal,productos_otro_local:productosExterno,
  delivery_local:deliveryLocal,delivery_otro_local:deliveryExterno,
  medio_local:a.medioLocal||null,local_externo:a.localExterno||null,
  reparto_realizado:a.repartoRealizado,
  delivery_repartidor_por_conciliar:a.repartoRealizado?envio:0,
  venta_original:importeOriginal,venta_previa:ventaAnterior,
  venta_rectificada:ventaNueva,medios_previos:previosMedios,
  medios_rectificados:medios,fecha_confirmacion_ms:registradoEn,
  responsable:actor,motivo:reason,referencia_local:refLocal,
  referencia_externa:refExterno,comprobante_original_conservado:true,
  sin_cobro_nuevo:true,no_modifica_caja_actual:true,
  estado:'pendiente_constancia_neon'
 };
 return Object.freeze({solicitudId,turnoClave:turno,version,
  fuentePrevia:previa,fuenteRectificacion:fuente,
  ventaAnterior,ventaRectificada:ventaNueva,
  recibidoLocal:local,recibidoOtroLocal:externo,
  valorDeliveryRepartidorPendiente:next.repartoRealizado?envio:0,
  sinMovimientoNuevo:true,sinVentaTurnoActual:true,
  noModificaOriginal:true,resumen:Object.freeze(resumen)});
}
