/** Aclaración del cierre, exactamente como Uki: nota, no movimiento financiero.
 * El panel de Romo es responsable de confirmar la copia mediante CAS Neon.
 */
const SUC='Romo’s Sushi La Serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const need=(v,m)=>{if(!v)throw Error(m)};
const field=(v,max,n)=>{
 const text=String(v??'').trim().replace(/\s+/g,' ');
 need(text.length>0&&text.length<=max,n+' obligatorio o demasiado largo');
 return text;
};
export function prepararAclaracionCierreRomoQA(estado,{
 turnoClave,dato,correcto,responsable,motivo,registradoEn
}={}){
 need(estado?.suc===SUC&&Array.isArray(estado.cierres)&&
  estado.cierres.every(c=>c?.suc===SUC)&&
  (estado.ajustesHistoricos===undefined||
   Array.isArray(estado.ajustesHistoricos)&&
   estado.ajustesHistoricos.every(a=>a?.suc===SUC))&&
  Number.isSafeInteger(estado.nextId)&&estado.nextId>=1,
  'Se requiere la copia original de Romo');
 need(typeof turnoClave==='string'&&TURN.test(turnoClave),
  'Identificador de turno inválido');
 const matching=estado.cierres.filter(c=>c.turnoClave===turnoClave);
 need(matching.length===1,'Cierre del turno ausente o duplicado');
 const original=matching[0];
 need(original.fechaOperativa===turnoClave.slice(0,10)&&
  Number.isSafeInteger(original.fechaMs)&&original.fechaMs>0&&
  Number.isSafeInteger(registradoEn)&&registradoEn>=original.fechaMs,
  'Fecha del cierre o de aclaración inconsistente');
 const note={
  dato:field(dato,100,'Dato'),
  correcto:field(correcto,200,'Valor correcto'),
  responsable:field(responsable,100,'Responsable'),
  motivo:field(motivo,300,'Motivo')
 };
 if(!Array.isArray(estado.ajustesHistoricos))estado.ajustesHistoricos=[];
 need(!estado.ajustesHistoricos.some(a=>a.tipo==='cierre_aclarado'&&
  a.turnoClave===turnoClave&&
  a.dato===note.dato&&a.correcto===note.correcto&&
  a.responsable===note.responsable&&a.motivo===note.motivo),
  'La misma aclaración ya figura en Historial');
 const item={
  id:estado.nextId++,suc:SUC,tipo:'cierre_aclarado',turnoClave,
  cierreMs:original.fechaMs,fechaOperativa:original.fechaOperativa,
  fechaISO:new Date(registradoEn).toISOString(),registradoEn,...note
 };
 estado.ajustesHistoricos.push(item);
 return Object.freeze({tipo:item.tipo,turnoClave,id:item.id,
  responsable:item.responsable,fechaISO:item.fechaISO});
}


/**
 * BLOQUE 1 · Romo · propuesta de rectificación monetaria POSTERIOR al cierre.
 * Refleja la distinción aprobada en Uki: nota de aclaración != dinero.
 * Solo deja una solicitud auditada PENDIENTE en ajustesHistoricos (CAS Neon
 * del panel); NO altera el cierre original, el pedido, las ventas, los
 * timbres, la Caja acumulada ni Mi Administración. NO es comprobante v2.
 */
const METODOS_RECTIFICACION=new Set([
 'Efectivo','Transferencia','Débito','Edenred','Otros'
]);
const entero=(v,max,label)=>{
 need(v!==''&&v!==null&&v!==undefined&&Number.isSafeInteger(Number(v))&&
  Number(v)>=0&&Number(v)<=max,'Importe inválido de '+label);
 return Number(v);
};
const clonar=x=>JSON.parse(JSON.stringify(x));

export function prepararPropuestaRectificacionMonetariaCierreRomoQA(estado,{
 turnoClave,pedidoId,clase,medio,monto,responsable,motivo,
 registradoEn
}={}){
 need(estado?.suc===SUC&&Array.isArray(estado.cierres)&&
  Array.isArray(estado.pedidos)&&Array.isArray(estado.ajustesHistoricos)&&
  Number.isSafeInteger(estado.nextId)&&estado.nextId>0&&
  estado.cierres.every(c=>c?.suc===SUC)&&
  estado.pedidos.every(p=>p?.suc===SUC)&&
  estado.ajustesHistoricos.every(a=>a?.suc===SUC),
  'La rectificación exige datos independientes y completos de Romo');
 need(typeof turnoClave==='string'&&TURN.test(turnoClave),
  'El cierre necesita una clave de turno real');
 const cierres=estado.cierres.filter(c=>c.turnoClave===turnoClave);
 need(cierres.length===1,'No existe un cierre definitivo único del turno');
 const cierre=cierres[0],fuenteOriginal='romo:serena|'+turnoClave;
 need(cierre.fechaOperativa===turnoClave.slice(0,10)&&
  Number.isSafeInteger(cierre.fechaMs)&&cierre.fechaMs>0&&
  Number.isSafeInteger(cierre.inicioTurnoMs)&&
  cierre.inicioTurnoMs<cierre.fechaMs&&
  turnoClave===cierre.fechaOperativa+'@'+cierre.inicioTurnoMs,
  'La fecha/hora del cierre original no está confirmada');
 need(Number.isSafeInteger(registradoEn)&&registradoEn>=cierre.fechaMs&&
  Number.isFinite(new Date(registradoEn).getTime()),
  'La propuesta debe registrarse después del cierre original');
 need(Number.isSafeInteger(pedidoId)&&pedidoId>0,
  'Indica el pedido original que se rectificará');
 need(!cierre.rectificacion&&
  !estado.ajustesHistoricos.some(a=>
   a?.suc===SUC&&
   ['pedido_olvidado','pedido_olvidado_romo_pendiente',
    'pedido_olvidado_romo_confirmado'].includes(a.tipo)&&
   (a.turnoClave===turnoClave||
    Number(a.cierreMs)===cierre.fechaMs)),
  'El cierre ya tiene un pedido olvidado por conciliar: primero revisa su versión');
 const pedidos=estado.pedidos.filter(p=>p.id===pedidoId&&p.turnoClave===turnoClave);
 need(pedidos.length===1,'El pedido debe pertenecer únicamente al turno cerrado');
 const p=pedidos[0];
 const enCierre=Array.isArray(cierre.detalle?.pedidos)?
  cierre.detalle.pedidos.filter(x=>Number(x.id)===pedidoId):[];
 need(enCierre.length===1&&enCierre[0].pagado===true&&
  Number.isSafeInteger(enCierre[0].total)&&enCierre[0].total===p.total,
  'El pedido pagado no coincide con la fotografía del cierre; requiere revisión');
 need(p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio&&
  !/^PRUEBA\b/i.test(String(p.cliente||''))&&
  !p.ajusteCobroPendiente&&!p.productosPagadosOtroLocal&&
  !p.envioPagadoOtroLocal&&
  !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),
  'Los pedidos de prueba, QR, cobros externos o diferencias abiertas se revisan por separado');
 const montoOriginalProductos=entero(p.subtotal,100000000,'productos');
 need(montoOriginalProductos>0&&
  entero(p.envio??0,100000000,'delivery')>=0&&
  entero(p.propina??0,100000000,'propina')>=0,
  'No se verificó la separación de productos, delivery y propina');
 need(Number.isSafeInteger(p.total)&&p.total===
  montoOriginalProductos+(p.modalidad==='Delivery'?Number(p.envio||0):0)+
  Number(p.propina||0),
  'El total original no cuadra con productos, delivery y propina');
 need(['devolucion','cobro_adicional'].includes(clase),
  'La rectificación debe ser devolución o cobro adicional real');
 need(METODOS_RECTIFICACION.has(medio),
  'Solo métodos de cobro ya aprobados, fuera de aplicaciones');
 const importe=entero(monto,100000000,'diferencia');
 need(importe>0,'La diferencia debe ser mayor que cero');
 if(clase==='devolucion'){
  need(importe<=montoOriginalProductos,
   'Una devolución de productos no puede superar sus productos cobrados');
  const mediosPedido=new Set([
   ...(Array.isArray(p.pagosProductos)&&p.pagosProductos.length?
      p.pagosProductos.map(x=>x.medio):[p.medio])
  ]);
  need(mediosPedido.has(medio),
   'La devolución debe asociarse a un medio con cobro original de productos');
  const porMedio=Array.isArray(p.pagosProductos)&&p.pagosProductos.length?
   p.pagosProductos.filter(x=>x.medio===medio).reduce((n,x)=>n+Number(x.monto||0),0):
   montoOriginalProductos;
  need(Number.isSafeInteger(porMedio)&&porMedio>0&&importe<=porMedio,
   'La devolución supera lo realmente cobrado en ese medio por el pedido');
 }
 const medios=cierre.medios;
 need(medios&&typeof medios==='object'&&!Array.isArray(medios)&&
  Object.values(medios).every(v=>Number.isSafeInteger(v)&&v>=0),
  'El cierre original no tiene medios de pago verificables');
 const originalVenta=entero(cierre.venta,1000000000,'venta original');
 need(Object.values(medios).reduce((a,b)=>a+b,0)===originalVenta,
  'Los medios originales no suman la venta guardada');
 const delta=clase==='cobro_adicional'?importe:-importe;
 need((medios[medio]||0)+delta>=0&&
  originalVenta+delta>=0&&originalVenta+delta<=1000000000,
  'La diferencia supera el cobro original disponible de este medio');
 // Evitar propuestas repetidas o simultáneas para este cierre. Las
 // correcciones solo tendrán recibo versionado tras conciliación completa.
 need(!estado.ajustesHistoricos.some(a=>a.turnoClave===turnoClave&&
  ['rectificacion_monetaria_pendiente','rectificacion_monetaria_confirmada'].includes(a.tipo)),
  'Ya existe una rectificación monetaria de este cierre: revisar antes de crear otra');
 const responsableLimpio=field(responsable,80,'Responsable');
 const motivoLimpio=field(motivo,300,'Motivo');
 need(motivoLimpio.length>=4,
  'Describe por qué corresponde rectificar dinero después del cierre');
 const despuesMedios={...medios,[medio]:Number(medios[medio]||0)+delta};
 need(Object.values(despuesMedios).reduce((a,b)=>a+b,0)===originalVenta+delta,
  'Los medios de la propuesta no concilian con la venta propuesta');
 const antes={pedidos:cierre.pedidos,venta:originalVenta,
  final:cierre.final,medios:clonar(medios),
  efectivoContado:cierre.efectivoContado,
  fechaMs:cierre.fechaMs,fechaOperativa:cierre.fechaOperativa,
  diferenciaEfectivo:cierre.diferenciaEfectivo};
 const despues={
  // Simulación únicamente: NO es libro de caja ni comprobante confirmado.
  venta:originalVenta+delta,medios:despuesMedios,
  final:Number.isSafeInteger(cierre.final)?cierre.final+delta:null,
  efectivoContadoOriginal:cierre.efectivoContado
 };
 const item={
  id:estado.nextId++,suc:SUC,tipo:'rectificacion_monetaria_pendiente',
  estado:'pendiente_conciliacion',turnoClave,fechaOperativa:cierre.fechaOperativa,
  cierreMs:cierre.fechaMs,fuenteOriginal,versionPropuesta:2,
  pedidoId,clase,medio,monto:importe,delta,responsable:responsableLimpio,
  motivo:motivoLimpio,registradoEn,fechaISO:new Date(registradoEn).toISOString(),
  comprobanteOriginalConservado:true,esSoloPropuesta:true,
  dineroRegistrado:false,requiereConciliacion:true,
  requiereConstanciaVersionada:true,requiereAprobacionDuenos:true,
  antes,propuesta:despues
 };
 estado.ajustesHistoricos.push(item);
 return Object.freeze({id:item.id,turnoClave,pedidoId,versionPropuesta:2,
  pendiente:true,delta,medio,
  totalPropuesto:despues.venta,
  esSoloPropuesta:true,comprobanteOriginalConservado:true,
  sinMovimientoDeCaja:true,sinNuevaVenta:true});
}
