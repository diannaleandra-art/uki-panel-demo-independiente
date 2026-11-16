/**
 * Rectificación administrativa acotada de pedidos YA PAGADOS en Romo.
 * Reutiliza editarPedido() de Uki. NO permite cambiar dinero, timbres,
 * clientes ni ventas, solo referencia de mesa y km de recorrido.
 * Puro: prepara una copia; el CAS Neon lo efectúa el panel al confirmar.
 */
const SUC='Romo’s Sushi La Serena';
const fail=message=>{throw new Error(message);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const n=x=>Number(x)||0;
const t=x=>String(x??'').trim();
function amount(x){const z=Number(x);return Number.isSafeInteger(z)&&z>=0?z:null;}
const lines=p=>(p||[]).map(x=>({
  medio:String(x?.medio||''),
  monto:Number(x?.monto)||0
}));
const products=p=>(p||[]).map(x=>({
  nombre:String(x?.nombre||''),
  cantidad:Number(x?.cantidad),
  precioUnit:Number(x?.precioUnit),
  detalle:String(x?.detalle||'')
}));
const draftProducts=d=>(d?.items||[]).filter(x=>t(x?.nombre)).map(x=>({
  nombre:String(x.nombre),cantidad:Number(x.cant),
  precioUnit:Number(x.precio),detalle:String(x.det||'')
}));
export function clasificarCorreccionPagadaRomoQA(previo,draft){
 if(!previo||!draft||typeof draft!=='object')fail('Pedido o formulario inválido');
 const basicos=[
  ['cliente',t(previo.cliente),t(draft.cliente)],
  ['WhatsApp',t(previo.telefono),t(draft.telefono)],
  ['código carta',t(previo.codigoCarta),t(draft.codigoCarta)],
  ['código cliente',t(previo.codigoCliente),t(draft.codigoCliente)],
  ['sucursal origen de la carta',t(previo.sucursalCarta),t(draft.sucursalCarta)],
  ['fecha original',t(previo.fechaISO),t(draft.fecha)],
  ['modalidad',t(previo.modalidad),t(draft.modalidad)],
  ['medio de productos',t(previo.medio||'Efectivo'),t(draft.medio||'Efectivo')],
  ['medio de delivery',t(previo.medioEnvio||'Efectivo'),t(draft.medioEnvio||'Efectivo')],
  ['mensaje original',String(previo.textoOriginal||''),String(draft.texto||'')]
 ];
 const protegidos=basicos.filter(([,a,b])=>a!==b).map(([name])=>name);
 if(!equal(products(previo.productos),draftProducts(draft)))
  protegidos.push('armado, productos, cantidades o precios');
 if(!equal(lines(previo.pagosProductos),lines(draft.pagosProductos)))
  protegidos.push('pagos mixtos de productos');
 if(!equal(lines(previo.pagosEnvio),lines(draft.pagosEnvio)))
  protegidos.push('pagos mixtos de delivery');
 if(!!previo.pagado!==!!draft.pagado)protegidos.push('estado de pago');
 if((amount(draft.envio)??-1)!==(previo.modalidad==='Delivery'?n(previo.envio):0))
  protegidos.push('tarifa de delivery');
 if(!!previo.productosPagadosOtroLocal!==!!draft.productosPagadosOtroLocal||
    !!previo.envioPagadoOtroLocal!==!!draft.envioPagadoOtroLocal||
    t(previo.localPagoExterno)!==t(draft.localPagoExterno)||
    t(previo.montoProductosOtroLocal)!==t(draft.montoProductosOtroLocal)||
    t(previo.montoEnvioOtroLocal)!==t(draft.montoEnvioOtroLocal))
  protegidos.push('pagos de otros locales');
 if(!!draft.mixtoProductos!==(Array.isArray(previo.pagosProductos)&&previo.pagosProductos.length>0)||
    !!draft.mixtoEnvio!==(Array.isArray(previo.pagosEnvio)&&previo.pagosEnvio.length>0))
  protegidos.push('modo de pagos mixtos');
 const propinaMode=previo.propinaModo||((n(previo.propina)>0)?'otro':'ninguna');
 const tip=propinaMode==='diez'?Math.round(n(previo.subtotal)*0.1):
  propinaMode==='otro'?n(previo.propina):0;
 if(t(draft.propinaModo||'ninguna')!==propinaMode||
   (draft.propinaModo==='otro'&&n(draft.propinaPersonalizada)!==tip)||
   t(draft.medioPropina||'Efectivo')!==t(previo.medioPropina||'Efectivo'))
  protegidos.push('propina');
 if(!equal(previo.qrSolicitudes||[],draft.qrSolicitudes||[]))
  protegidos.push('solicitudes QR');
 const subtotal=draftProducts(draft).reduce((a,p)=>a+p.cantidad*p.precioUnit,0);
 if(!Number.isSafeInteger(subtotal)||subtotal!==Number(previo.subtotal)||
   amount(previo.total)===null||
   Number(previo.total)!==subtotal+(previo.modalidad==='Delivery'?n(previo.envio):0)+n(previo.propina))
  protegidos.push('total o subtotal');
 const referencia=t(draft.mesaReferencia),km=t(draft.kmRecorrido);
 if(referencia.length>100||km.length>30)protegidos.push('longitud de referencia');
 if(previo.modalidad!=='Consumo en local'&&referencia!==t(previo.mesaReferencia))
  protegidos.push('referencia fuera de mesa');
 if(previo.modalidad!=='Delivery'&&km!==t(previo.kmRecorrido))
  protegidos.push('recorrido fuera de delivery');
 if(!!draft.ajusteCajaRegularizado||draft.cartaSolicitudRemotaId||draft.cartaReservaToken)
  protegidos.push('conciliación o solicitud comercial');
 const cambios=[];
 if(referencia!==t(previo.mesaReferencia))cambios.push('referencia de mesa');
 if(km!==t(previo.kmRecorrido))cambios.push('recorrido informativo');
 return Object.freeze({permitida:protegidos.length===0&&cambios.length>0,
  cambios:Object.freeze(cambios),protegidos:Object.freeze(protegidos),
  sinCambiarCaja:protegidos.length===0,subtotal,venta:Number(previo.total)});
}
export function prepararRectificacionInformativaRomoQA({
 estado,pedidoId,draft,responsable,foto,turnoCerrado=false,
 fecha=new Date().toISOString(),registradoEn=Date.now()
}={}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos)||!Number.isSafeInteger(pedidoId)||
    pedidoId<1||typeof foto!=='function')fail('Estado o pedido Romo inválido');
 const lista=estado.pedidos.filter(p=>p?.suc===SUC&&p.id===pedidoId);
 if(lista.length!==1)fail('Pedido inexistente o duplicado');
 const p=lista[0];
 if(!p.pagado||p.estado==='Cancelado'||p.esPremio||turnoCerrado||
    (Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length>0)||
    p.ajusteCobroPendiente)
  fail('Pedido pagado requiere la vía de conciliación; no se modificó');
 if(draft?.editando!==pedidoId)fail('El formulario pertenece a otro pedido');
 const autor=t(responsable);
 if(autor.length<2||autor.length>80)fail('Responsable obligatorio, entre 2 y 80 caracteres');
 if(!Number.isSafeInteger(registradoEn)||registradoEn<=0||
    !Number.isFinite(Date.parse(fecha)))fail('Fecha de auditoría inválida');
 const result=clasificarCorreccionPagadaRomoQA(p,draft);
 if(result.protegidos.length)
  fail('No se modificó caja ni venta. Usa la conciliación financiera para: '+
    result.protegidos.join(', '));
 if(!result.permitida)fail('No hay cambios administrativos para guardar');
 const nuevo={...p,
  mesaReferencia:t(draft.mesaReferencia),
  kmRecorrido:t(draft.kmRecorrido)
 };
 const antes=foto(p),despues=foto(nuevo);
 if(equal(antes,despues))fail('No se detectó cambio en el pedido');
 const audit={tipo:'correccion_administrativa_pagada',responsable:autor,
  fecha,registradoEn,motivo:'Referencia administrativa; sin cambio de caja',
  anterior:antes,nuevo:despues};
 nuevo.historialCambios=[...(Array.isArray(p.historialCambios)?p.historialCambios:[]),audit];
 nuevo.correccionesTurno=[...(Array.isArray(p.correccionesTurno)?p.correccionesTurno:[]),
  {tipo:audit.tipo,responsable:autor,fechaISO:fecha,registradoEn,
   nota:audit.motivo,antes,despues,saldoPendiente:0}];
 estado.pedidos[estado.pedidos.indexOf(p)]=nuevo;
 return Object.freeze({pedidoId,cambios:result.cambios,ventaIntacta:true,
  sinCobro:true,despues});
}
