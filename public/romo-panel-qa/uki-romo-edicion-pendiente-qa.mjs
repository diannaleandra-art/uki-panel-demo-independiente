/**
 * Romo La Serena: edición de un pedido pendiente NO pagado usando el objeto D
 * del mismo formulario de Uki y una copia del estado cifrado de Romo.
 * Solo prepara la copia: SIN escrituras, cierre, cobros ni timbres.
 * La única confirmación válida ocurre después del CAS en Neon Romo.
 */
const SUC='Romo’s Sushi La Serena';
const MODES=new Set(['Retiro','Delivery','Consumo en local']);
const PAYMENTS=new Set(['Efectivo','Transferencia','Débito','Edenred','Junaeb','Otros','Uber Eats','PedidosYa','Rappi']);
const DELIVERY_PAYMENTS=new Set(['Efectivo','Transferencia','Débito','Edenred','Junaeb','Otros']);
const BAD=/^Pedido WhatsApp \(revisar detalle\)$/i;
const CLIENTE_MAX=80;
const int=x=>Number.isSafeInteger(x);
const json=x=>JSON.parse(JSON.stringify(x));
function required(ok,message){if(!ok)throw Error(message);}
const text=(x,limit)=>String(x??'').trim().slice(0,limit);
function noCobros(o){
 return o&&o.pagado!==true&&!o.esPremio&&
   !(Array.isArray(o.pagosProductos)&&o.pagosProductos.length)&&
   !(Array.isArray(o.pagosEnvio)&&o.pagosEnvio.length)&&
   !o.productosPagadosOtroLocal&&!o.envioPagadoOtroLocal&&
   !Number(o.propina)&&!o.ajusteCobroPendiente;
}
/**
 * Recibe un snapshot estructurado por datosSoloSucursal().
 * foto debe ser la función YA existente ukiFotoCorreccionPedido.
 * El botón Guardar no muta el estado visible hasta confirmar sesión.guardar.
 */
export function prepararEdicionPendienteRomoQA({
 estado,pedidoId,draft,responsable,foto,turnoCerrado=false,
 registradoEn=Date.now(),ahoraISO=new Date().toISOString(),
 codigoWhatsApp=()=>'',referenciaVisible=()=>true,permitirSinCambios=false,permitirEntregado=false
}={}){
 required(estado?.suc===SUC&&Array.isArray(estado.pedidos),'Copia de Romo requerida');
 required(int(pedidoId)&&pedidoId>0&&draft&&typeof draft==='object',
   'El pedido a editar no está identificado');
 required(typeof foto==='function','La auditoría oficial de Uki no está conectada');
 const matches=estado.pedidos.filter(p=>p?.suc===SUC&&p.id===pedidoId);
 required(matches.length===1,'El pedido se modificó o ya no existe en Romo');
 const previo=matches[0];
 required(!turnoCerrado&&(previo.estado==='Pendiente'||permitirEntregado===true&&previo.estado==='Entregado')&&noCobros(previo),
   'Esta edición no puede modificar pedidos pagados, entregados o de turnos cerrados');
 required(!Array.isArray(previo.qrSolicitudes)||previo.qrSolicitudes.length===0,
   'Las cuentas QR se editan mediante el procedimiento de mesas');
 required(draft.editando===pedidoId&&
   (!draft.cartaSolicitudRemotaId||String(draft.cartaSolicitudRemotaId)===String(previo.cartaSolicitudRemotaId||''))&&
   (!draft.cartaReservaToken||String(draft.cartaReservaToken)===String(previo.cartaReservaToken||''))&&
   (!Array.isArray(draft.qrSolicitudes)||draft.qrSolicitudes.length===0),
   'La edición está vinculada a otra solicitud o mesa QR');
 required(noCobros(draft)&&!draft.mixtoProductos&&!draft.mixtoEnvio&&
   (draft.propinaModo||'ninguna')==='ninguna'&&
   !Number(draft.propinaPersonalizada),
   'Confirma cobros, pagos mixtos y propinas en Caja; no mediante esta edición');
 const autor=text(responsable,80);
 required(autor.length>=2,'Identifica quién modifica el pedido');
 required(int(registradoEn)&&registradoEn>0&&
   typeof ahoraISO==='string'&&Number.isFinite(Date.parse(ahoraISO)),
   'Fecha de modificación no válida');
 const cliente=text(draft.cliente,CLIENTE_MAX);
 const telefono=text(draft.telefono,30);
 const codigo=text(draft.codigoCarta,80);
 required(cliente.length>=2&&String(draft.cliente||'').trim().length<=CLIENTE_MAX&&
   String(draft.telefono||'').trim().length<=30&&
   codigo===String(previo.codigoCarta||'')&&
   !BAD.test(cliente)&&!BAD.test(String(draft.texto||'')),
   'Revisa el cliente y conserva el código original del pedido');
 required(MODES.has(draft.modalidad)&&PAYMENTS.has(draft.medio)&&
   DELIVERY_PAYMENTS.has(draft.medioEnvio||'Efectivo'),
   'Modalidad o medio de pago no permitido; las apps no pagan delivery');
 required(String(draft.mesaReferencia||'').trim().length<=100,
   'La referencia de mesa es demasiado larga');
 const mesa=draft.modalidad==='Consumo en local'
  ?text(draft.mesaReferencia,100):'';
 const envio=draft.modalidad==='Delivery'?Number(draft.envio):0;
 required(int(envio)&&envio>=0&&envio<=4000&&
   (draft.modalidad!=='Delivery'||envio>0),
   'El delivery debe tener un monto confirmado dentro del límite');
 const entries=Array.isArray(draft.items)?draft.items.filter(p=>text(p?.nombre,200)):[];
 required(entries.length>0&&entries.length<=50,'Faltan los productos del pedido');
 const productos=entries.map(p=>{
  const nombre=text(p.nombre,180);
  const cantidad=Number(p.cant),unitario=Number(p.precio);
  const detalle=String(p.det||'');
  required(nombre&&String(p.nombre||'').trim().length<=180&&
    !BAD.test(nombre)&&int(cantidad)&&cantidad>0&&cantidad<=100&&
    int(unitario)&&unitario>=1&&unitario<=1000000&&detalle.length<=900,
    'Revisa cantidades, importes y armado de cada producto');
  return {nombre,cantidad,precioUnit:unitario,detalle,
   ...(typeof p.skuCarta==='string'&&p.skuCarta.length<=150?{skuCarta:p.skuCarta}:{}),
   ...(int(p.piezasUnidad)&&p.piezasUnidad>0?{piezasUnidad:p.piezasUnidad}:{}),
   ...(int(p.rollsUnidad)&&p.rollsUnidad>0?{rollsUnidad:p.rollsUnidad}:{})};
 });
 const subtotal=productos.reduce((a,p)=>a+p.cantidad*p.precioUnit,0);
 const total=subtotal+envio;
 required(int(subtotal)&&subtotal>0&&int(total)&&total<=3000000,
   'El total no es válido. No se modificó el pedido');
 const codigoCliente=String(codigoWhatsApp(telefono)||'');
 required(codigoCliente.length<=40&&referenciaVisible(previo)!==false,
   'No se puede verificar el código del cliente');
 const nuevo={
   ...previo,cliente,telefono,codigoCliente,modalidad:draft.modalidad,
   mesaReferencia:mesa,envio,
   kmRecorrido:draft.modalidad==='Delivery'?text(draft.kmRecorrido,30):'',
   medio:draft.medio,medioEnvio:draft.medioEnvio||'Efectivo',
   productos,subtotal,total
   // Las ventas, estados y pagos del pedido original permanecen intactos.
 };
 const antes=foto(previo),despues=foto(nuevo);
 if(JSON.stringify(antes)===JSON.stringify(despues)){
  required(permitirSinCambios===true,'No hay cambios para guardar');
  return Object.freeze({pedidoId,estado:estado.suc,autor,subtotal,total,sinCobro:true,sinCambios:true,antes,despues});
 }
 nuevo.correccionesTurno=[
   ...(Array.isArray(previo.correccionesTurno)?previo.correccionesTurno:[]),
   {tipo:'edicion_pedido_sin_pago',fechaISO:ahoraISO,
    registradoEn,responsable:autor,antes,despues,
    nota:'Edición desde el formulario oficial de Uki, sin pago'}
 ];
 // La bandeja de Romo ya utiliza historialCambios; no crear otra pantalla.
 // Este único evento corresponde a la misma corrección auditada arriba.
 nuevo.historialCambios=[
   ...(Array.isArray(previo.historialCambios)?previo.historialCambios:[]),
   {tipo:'edicion_pedido_sin_pago',fecha:ahoraISO,
    responsable:autor,anterior:antes,nuevo:despues,
    motivo:'Edición pendiente, sin cobro',registradoEn}
 ];
 const pos=estado.pedidos.indexOf(previo);
 estado.pedidos[pos]=nuevo;
 return Object.freeze({pedidoId,estado:estado.suc,autor,subtotal,total,
   sinCobro:true,antes,despues});
}
