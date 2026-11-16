/**
 * Romo La Serena — conciliación de una diferencia YA pendiente en un pedido pagado.
 * Reutiliza el mecanismo oficial de Uki "ajusteCobroPendiente" y las líneas de
 * medios del pedido. No crea pedido, cargo, devolución bancaria, timbre ni caja.
 * El movimiento físico debe haber ocurrido ANTES de confirmarlo en el panel.
 * Preparador puro: se aplica únicamente por guardado CAS cifrado de Neon Romo.
 */
const SUC='Romo’s Sushi La Serena';
const fail=mensaje=>{throw Error(mensaje);};
const assert=(ok,mensaje)=>{if(!ok)fail(mensaje);};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const amount=(x,etiqueta,max=3000000)=>{
 const n=Number(x);
 assert(x!==undefined&&x!==null&&x!==''&&Number.isSafeInteger(n)&&
  n>=0&&n<=max,'Importe inválido: '+etiqueta);
 return n;
};
const group=(lista,medios)=>{
 const salida=Object.fromEntries(medios.map(m=>[m,0]));
 for(const {medio,monto} of lista)salida[medio]+=monto;
 return salida;
};
function lines(p,tipo,total,medios){
 const esEnvio=tipo==='envio',key=esEnvio?'pagosEnvio':'pagosProductos';
 const medioKey=esEnvio?'medioEnvio':'medio';
 const mixto=p[key];
 assert(mixto===undefined||Array.isArray(mixto),'Los pagos mixtos no están íntegros');
 if(total===0){
  assert(!mixto?.length,'No se puede registrar medio de pago sin importe');
  return [];
 }
 if(mixto?.length){
  assert(mixto.length>=2&&mixto.length<=6,'Número de medios mixtos inválido');
  const lista=mixto.map(x=>{
   assert(isObject(x)&&medios.includes(x.medio),'Medio mixto no autorizado');
   const monto=amount(x.monto,'medio mixto');
   assert(monto>0,'Importe mixto debe ser positivo');
   return {medio:x.medio,monto};
  });
  assert(lista.reduce((n,x)=>n+x.monto,0)===total,
   'El pago mixto no coincide con el total real');
  return lista;
 }
 const medio=String(p[medioKey]||'');
 assert(medios.includes(medio),'Medio de cobro no permitido');
 return [{medio,monto:total}];
}
export function revisarConciliacionRealRomoQA(estado,pedidoId,{
 mediosProductos,mediosDelivery,turnoCerrado=false
}={}){
 assert(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
  Array.isArray(estado.cierres)&&Array.isArray(estado.propinas)&&
  isObject(estado.cajasDiarias)&&
  estado.pedidos.every(x=>x?.suc===SUC),'La caja no pertenece a Romo La Serena');
 assert(Array.isArray(mediosProductos)&&mediosProductos.length>0&&
  new Set(mediosProductos).size===mediosProductos.length&&
  Array.isArray(mediosDelivery)&&mediosDelivery.length>0&&
  new Set(mediosDelivery).size===mediosDelivery.length&&
  mediosDelivery.every(m=>mediosProductos.includes(m)),
  'No se han recibido los medios oficiales de cobro');
 assert(Number.isSafeInteger(pedidoId)&&pedidoId>0,'Folio inválido');
 const encontrados=estado.pedidos.filter(x=>x.id===pedidoId&&x.suc===SUC);
 assert(encontrados.length===1,'El pedido no existe o se encuentra duplicado');
 const p=encontrados[0],q=p.ajusteCobroPendiente;
 assert(p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio&&
  !/^PRUEBA\b/i.test(String(p.cliente||'')),
  'No se puede conciliar un pedido de prueba, cancelado o no pagado');
 assert(isObject(q)&&q.estado==='pendiente'&&isObject(q.recibido),
  'No existe una diferencia de cobro pendiente');
 assert(!p.productosPagadosOtroLocal&&!p.envioPagadoOtroLocal&&
  !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),
  'Cuentas de mesa QR y pagos de otro local requieren su propia conciliación');
 const turno=String(p.turnoClave||'');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 assert(turno.length>=12&&!turnoCerrado&&
  caja?.turnoAbierto===true&&caja.baseConfirmada===true&&
  caja.turnoId===turno&&!estado.cierres.some(c=>c?.suc===SUC&&c.turnoClave===turno),
  'El turno original debe seguir abierto, con base confirmada y sin cierre');
 const subtotal=amount(p.subtotal,'productos');
 assert(Array.isArray(p.productos)&&p.productos.length>0&&
  p.productos.every(x=>Number.isSafeInteger(Number(x.cantidad))&&
   Number(x.cantidad)>0&&Number.isSafeInteger(Number(x.precioUnit))&&
   Number(x.precioUnit)>0)&&
  p.productos.reduce((sum,x)=>sum+Number(x.cantidad)*Number(x.precioUnit),0)===subtotal,
  'El detalle de productos no cuadra con la venta');
 const envio=p.modalidad==='Delivery'?amount(p.envio,'reparto',4000):0;
 const propina=amount(p.propina??0,'propina',1000000);
 assert(amount(p.total,'total')===subtotal+envio+propina,
  'El total del pedido no coincide con su detalle');
 const esperado=group([
  ...lines(p,'productos',subtotal,mediosProductos),
  ...lines(p,'envio',envio,mediosDelivery)
 ],mediosProductos);
 const recibido=Object.fromEntries(mediosProductos.map(m=>[m,0]));
 for(const [medio,monto] of Object.entries(q.recibido)){
  assert(mediosProductos.includes(medio),'El medio anterior no está autorizado');
  recibido[medio]=amount(monto,'cobro original por '+medio);
 }
 const suma=x=>Object.values(x).reduce((n,v)=>n+v,0);
 const diferencia=suma(recibido)-suma(esperado);
 assert(Number.isSafeInteger(q.saldo)&&q.saldo===diferencia&&
  diferencia!==0&&Math.abs(diferencia)<=3000000,
  'La diferencia pendiente no coincide con el cobro recibido');
 const movimientos=mediosProductos.flatMap(medio=>{
  const delta=esperado[medio]-recibido[medio];
  return delta===0?[]:[Object.freeze({
   medio,accion:delta>0?'cobro_adicional':'devolucion',monto:Math.abs(delta)
  })];
 });
 assert(movimientos.length>0,'No hay dinero pendiente por conciliar');
 return Object.freeze({
  pedidoId,turnoClave:turno,saldoPendiente:diferencia,
  recibido:Object.freeze(recibido),esperado:Object.freeze(esperado),
  movimientos:Object.freeze(movimientos),
  noCreaCobro:true,requiereConfirmacionReal:true
 });
}
export function prepararConciliacionRealRomoQA(estado,{
 pedidoId,mediosProductos,mediosDelivery,turnoCerrado=false,
 responsable,confirmaciones,confirmoMovimientoReal=false,
 registradoEn,fechaISO,foto
}={}){
 assert(confirmoMovimientoReal===true,'Debes confirmar que el dinero ya se entregó o recibió');
 const autor=String(responsable||'').trim();
 assert(autor.length>=2&&autor.length<=80,'Identifica al responsable del movimiento');
 assert(Number.isSafeInteger(registradoEn)&&registradoEn>0&&
  typeof fechaISO==='string'&&Number.isFinite(Date.parse(fechaISO)),
  'Fecha del movimiento inválida');
 assert(typeof foto==='function','Falta auditoría original del pedido');
 const plan=revisarConciliacionRealRomoQA(estado,pedidoId,{
  mediosProductos,mediosDelivery,turnoCerrado
 });
 assert(Array.isArray(confirmaciones)&&
  confirmaciones.length===plan.movimientos.length,
  'Confirma por separado todos los movimientos y medios');
 const clave=x=>x.medio+'|'+x.accion+'|'+x.monto;
 const autorizados=new Set(plan.movimientos.map(clave));
 assert(confirmaciones.every(x=>isObject(x)&&x.confirmado===true&&
  autorizados.has(clave(x)))&&
  new Set(confirmaciones.map(clave)).size===autorizados.size,
  'Las devoluciones y cobros confirmados no coinciden con los medios pendientes');
 const pedido=estado.pedidos.find(p=>p.suc===SUC&&p.id===pedidoId);
 const original=JSON.parse(JSON.stringify(pedido.ajusteCobroPendiente));
 const antes=foto(pedido);
 const movimientos=plan.movimientos.map(x=>({...x,confirmado:true}));
 pedido.ajusteCobroPendiente=null;
 const despues=foto(pedido);
 const evento={
  tipo:'conciliacion_diferencia_real',
  accion:plan.saldoPendiente>0?'devolucion_confirmada':'cobro_adicional_confirmado',
  fecha:fechaISO,fechaISO,registradoEn,responsable:autor,
  motivo:'Movimiento ya realizado; conciliación por medio de pago, sin segundo pedido',
  saldoAnterior:plan.saldoPendiente,saldoPendiente:0,
  recibidoAntes:{...plan.recibido},recibidoDespues:{...plan.esperado},
  ajusteAnterior:original,movimientos,anterior:antes,nuevo:despues
 };
 pedido.historialCambios=[...(Array.isArray(pedido.historialCambios)?
  pedido.historialCambios:[]),evento].slice(-100);
 pedido.correccionesTurno=[...(Array.isArray(pedido.correccionesTurno)?
  pedido.correccionesTurno:[]),
  {tipo:evento.tipo,accion:evento.accion,fechaISO,registradoEn,
   responsable:autor,nota:evento.motivo,importe:plan.saldoPendiente,
   recibidoAntes:evento.recibidoAntes,recibidoDespues:evento.recibidoDespues,
   movimientos,antes,despues,saldoPendiente:0}];
 return Object.freeze({pedidoId,turnoClave:plan.turnoClave,
  conciliado:true,noCreaCobro:true,registradoEn,
  movimientos:plan.movimientos,ventaSinDuplicar:true});
}
