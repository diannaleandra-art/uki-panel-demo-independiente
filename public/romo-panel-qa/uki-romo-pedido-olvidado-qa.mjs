/**
 * Romo La Serena: copiar el formulario de "pedido olvidado" APROBADO en Uki.
 *
 * MISMO DESGLOSE: cierre, fecha/hora, código carta opcional, cliente,
 * productos, modalidad, envío, cobrado en el local, cobrado por otro local,
 * delivery recibido aquí, reparto realizado, responsable y motivo.
 *
 * Guardar una propuesta pendiente NO genera otro pedido ni venta ni altera
 * cierre físico/PDF, caja, repartidor, propinas o Mi Administración.
 * Uso: copia del estado cifrado Romo + guardado CAS del panel ya autorizado.
 */
const SUC='Romo’s Sushi La Serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const error=message=>{throw new Error(message)};
const check=(ok,msg)=>{if(!ok)error(msg)};
const str=(value,label,max,{required=false}={})=>{
 const s=String(value??'').trim().replace(/\s+/g,' ');
 check(s.length<=max&&(!required||s.length>0),label+' inválido o demasiado largo');
 return s;
};
const money=(value,label,{allowZero=true}={})=>{
 check(value!==null&&value!==''&&value!==undefined&&
  Number.isSafeInteger(value)&&value>=0&&value<=100000000,
  'Importe incorrecto: '+label);
 if(!allowZero)check(value>0,'Importe obligatorio: '+label);
 return value;
};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const normal=v=>String(v||'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const fechaSiguiente=(date)=>{
 const d=new Date(date+'T12:00:00Z');
 check(Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date,
  'El cierre original no tiene día operativo válido');
 return new Date(d.getTime()+86400000).toISOString().slice(0,10);
};
const sameTurn=(a,turno,cierreMs)=>a?.suc===SUC&&
 (a.turnoClave===turno||
  a.cierreMs===cierreMs&&a.fechaOperativa===turno.slice(0,10));

export function prepararPedidoOlvidadoRomoQA(estado,{
 turnoClave,fechaPedido,codigoCarta='',cliente='',detalle,
 modalidad,subtotal,envio=0,recibidoLocal,
 deliveryCobradoLocal=0,medioLocal='Efectivo',
 localExterno='',repartoRealizado=false,pagoCompletoConfirmado=false,
 responsable,motivo,registradoEn=Date.now()
}={}){
 check(estado?.suc===SUC&&
  ['pedidos','cierres'].every(k=>Array.isArray(estado[k])&&
   estado[k].every(x=>x?.suc===SUC))&&
  (estado.ajustesHistoricos===undefined||Array.isArray(estado.ajustesHistoricos)&&
   estado.ajustesHistoricos.every(x=>x?.suc===SUC))&&
  Number.isSafeInteger(estado.nextId)&&estado.nextId>0,
  'Solo se puede registrar la copia cifrada independiente de Romo');
 check(typeof turnoClave==='string'&&TURN.test(turnoClave),
  'Selecciona un cierre original válido de Romo');
 const cierres=estado.cierres.filter(c=>c.turnoClave===turnoClave);
 check(cierres.length===1,'No existe un cierre original único');
 const c=cierres[0],dia=turnoClave.slice(0,10),turnoInicio=Number(turnoClave.split('@')[1]);
 check(c.fechaOperativa===dia&&c.inicioTurnoMs===turnoInicio&&
  Number.isSafeInteger(c.fechaMs)&&c.fechaMs>turnoInicio&&
  Number.isSafeInteger(registradoEn)&&registradoEn>=c.fechaMs,
  'No se verificaron las horas y la fecha del turno cerrado');
 check(typeof fechaPedido==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaPedido)&&
  Number(fechaPedido.slice(11,13))<=23&&Number(fechaPedido.slice(14,16))<=59,
  'Indica la fecha y hora original del pedido');
 const diaPedido=fechaPedido.slice(0,10);
 check(diaPedido===dia||diaPedido===fechaSiguiente(dia),
  'La fecha del pedido no pertenece al turno cerrado');
 // No inventar timestamp de compra: conservar texto datetime-local tal como
 // hace Uki. Si se parsea en Safari, rechazar fechas futuras al cierre.
 const instante=new Date(fechaPedido).getTime();
 if(Number.isFinite(instante)){
  check(instante>=turnoInicio-60000&&instante<=c.fechaMs+60000,
   'La hora del pedido es posterior al cierre o anterior a su apertura');
 }
 const code=str(codigoCarta,'Código carta',35);
 const customer=str(cliente,'Cliente',80);
 const text=str(detalle,'Productos',200,{required:true});
 check(['Delivery','Retiro','Consumo en local'].includes(modalidad),
  'La entrega no coincide con la modalidad de Uki');
 const productos=money(subtotal,'total productos',{allowZero:false});
 const delivery=money(envio,'delivery',{allowZero:modalidad!=='Delivery'});
 check(modalidad==='Delivery'||delivery===0,
  'No puede haber delivery en un pedido de retiro o consumo');
 const total=productos+delivery;
 check(Number.isSafeInteger(total)&&total<=100000000,
  'Los totales del pedido omitido no cuadran');
 const enRomo=money(recibidoLocal,'cobrado en Romo');
 check(enRomo<=total,'El cobro registrado en Romo supera al pedido');
 const externo=total-enRomo;
 const deliveryRomo=money(deliveryCobradoLocal,'delivery cobrado en Romo');
 check(deliveryRomo<=delivery&&deliveryRomo<=enRomo&&
  enRomo-deliveryRomo<=productos,
  'El delivery no coincide con el pago a Romo');
 const deliveryExterno=delivery-deliveryRomo;
 const productosLocal=enRomo-deliveryRomo;
 const productosExterno=externo-deliveryExterno;
 check(productosLocal>=0&&productosExterno>=0&&
  productosLocal+productosExterno===productos&&
  deliveryRomo+deliveryExterno===delivery,
  'No cuadran productos y delivery entre ambos locales');
 const origen=str(localExterno,'Local que cobró el resto',80);
 check(externo===0||origen.length>0,
  'Debes identificar el otro local que recibió el resto');
 check(externo>0||origen.length===0,
  'No asignes otro local si cobraste el total en Romo');
 check(enRomo===0||MEDIOS.includes(medioLocal),
  'Indica el medio realmente cobrado en Romo');
 check(repartoRealizado===true||repartoRealizado===false,
  'Confirma si el repartidor realizó el delivery');
 check(modalidad==='Delivery'||repartoRealizado===false,
  'No asignes repartidor a un retiro/consumo en local');
 check(pagoCompletoConfirmado===true,
  'Antes de guardar verifica que el importe completo ya fue pagado');
 const actor=str(responsable,'Responsable',80,{required:true});
 const reason=str(motivo,'Motivo',300,{required:true});
 check(actor.length>=2&&reason.length>=4,
  'Identifica quién corrige el olvido y por qué');
 const ajustes=estado.ajustesHistoricos||[];
 // La corrección del mismo cierre no puede saltarse una versión pendiente.
 check(!ajustes.some(a=>sameTurn(a,turnoClave,c.fechaMs)&&
  ['rectificacion_monetaria_pendiente','rectificacion_monetaria_confirmada',
   'pedido_olvidado'].includes(a.tipo)),
  'Este cierre tiene otra corrección de dinero; concilia su versión antes');
 check(!c.rectificacion,'Hay una versión histórica pendiente de revisar');
 if(code){
  const duplicated=[...estado.pedidos,...ajustes].some(x=>
   normal(x.codigoCarta)===normal(code));
  check(!duplicated,'Este código de carta ya existe en Romo');
 }
 // Sin código, detectar reintento idéntico antes de incrementar nextId.
 const clave=[turnoClave,fechaPedido,normal(text),normal(customer),
  modalidad,productos,delivery,enRomo,medioLocal,normal(origen)].join('|');
 check(!ajustes.some(x=>
  x?.suc===SUC&&x.tipo==='pedido_olvidado_romo_pendiente'&&
  x.claveOlvido===clave),'El pedido omitido ya figura en Historial');
 // Solo UNA solicitud pendiente por cierre: ningún recibo v3 fue aún aprobado.
 check(!ajustes.some(x=>sameTurn(x,turnoClave,c.fechaMs)&&
  ['pedido_olvidado_romo_pendiente','pedido_olvidado_romo_confirmado'].includes(x.tipo)),
  'Ya existe un pedido olvidado pendiente de conciliar en este cierre');
 const item={
  id:estado.nextId++,suc:SUC,
  tipo:'pedido_olvidado_romo_pendiente',estado:'pendiente_conciliacion',
  turnoClave,fuenteOriginal:'romo:serena|'+turnoClave,
  cierreMs:c.fechaMs,fechaOperativa:dia,fechaPedido,
  fechaISO:new Date(registradoEn).toISOString(),registradoEn,
  codigoCarta:code,cliente:customer,detalle:text,modalidad,
  subtotal:productos,envio:delivery,total,pagado:true,
  recibidoLocal:enRomo,recibidoOtroLocal:externo,
  productosCobradosLocal:productosLocal,
  productosCobradosOtroLocal:productosExterno,
  deliveryCobradoLocal:deliveryRomo,
  deliveryCobradoOtroLocal:deliveryExterno,
  medioLocal:enRomo?medioLocal:null,localExterno:origen,
  repartoRealizado,responsable:actor,motivo:reason,
  claveOlvido:clave,
  versionPropuesta:2,comprobanteOriginalConservado:true,
  soloPropuesta:true,dineroRegistrado:false,
  repartoConciliado:false,
  requiereConstanciaVersionada:true,
  noEsVentaDelTurnoActual:true
 };
 if(!Array.isArray(estado.ajustesHistoricos))estado.ajustesHistoricos=[];
 estado.ajustesHistoricos.push(item);
 return Object.freeze({id:item.id,turnoClave,fechaOperativa:dia,
  tipo:item.tipo,estado:item.estado,total,recibidoLocal:enRomo,
  recibidoOtroLocal:externo,
  deliveryPendiente:repartoRealizado?delivery:0,
  noEsVentaNueva:true,noAlteraCierreOriginal:true,
  noMueveCaja:true,requiereConciliacion:true});
}

/**
 * Informe informativo inspirado en ukiCierreInformeVigente:
 * NO sustituye el cierre hasta que exista una constancia versionada,
 * y no contabiliza dinero declarado pero aún no conciliado.
 */
export function previsualizarPedidosOlvidadosRomoQA(estado,turnoClave){
 check(estado?.suc===SUC&&Array.isArray(estado.cierres)&&
   Array.isArray(estado.ajustesHistoricos),'Falta Historial de Romo');
 const matching=estado.cierres.filter(c=>c.suc===SUC&&c.turnoClave===turnoClave);
 check(matching.length===1,'Cierre histórico único no encontrado');
 const original=matching[0];
 const rows=estado.ajustesHistoricos.filter(a=>a.suc===SUC&&
  a.tipo==='pedido_olvidado_romo_pendiente'&&
  sameTurn(a,turnoClave,original.fechaMs));
 let total=0,local=0,fuera=0,paraRepartidor=0;
 const vistos=new Set();
 for(const r of rows){
  check(Number.isSafeInteger(r.id)&&!vistos.has(r.id)&&
   r.estado==='pendiente_conciliacion'&&r.soloPropuesta===true&&
   r.dineroRegistrado===false,'Pedido olvidado duplicado o registrado incorrectamente');
  vistos.add(r.id);
  total+=money(r.total,'total del pedido omitido');
  local+=money(r.recibidoLocal,'cobro local propuesto');
  fuera+=money(r.recibidoOtroLocal,'cobro externo propuesto');
  if(r.repartoRealizado)paraRepartidor+=money(r.envio,'repartidor pendiente');
 }
 check(local+fuera===total,'Los medios declarados no cuadran');
 return Object.freeze({turnoClave,soloConsulta:true,
  cierreOriginalVenta:money(original.venta,'venta original'),
  cierreOriginalEfectivoContado:money(original.efectivoContado,'arqueo original'),
  pedidosPendientes:rows.length,
  valorPedidosPendientes:total,cobradoLocalPorConciliar:local,
  cobradoOtroLocalPorConciliar:fuera,
  repartoPorConciliar:paraRepartidor,
  ventaHistoricaRectificadaSoloPropuesta:original.venta+local,
  modificoCierre:false,esRecibo:false});
}
