/**
 * Pedido manual PENDIENTE de Romo con el mismo formato de Uki.
 * Copia fiel de las reglas restrictivas del flujo de la réplica QA;
 * no registra pagos ni transforma solicitudes de carta en pedidos manuales.
 */
import {obtenerTurnoRomoFolioQA} from './uki-romo-folio-turno-qa.mjs';
const SUC='Romo’s Sushi La Serena';
const permitir=(ok,msg)=>{if(!ok)throw Error(msg)};
const entero=(value,min,max)=>value!==''&&value!==null&&value!==undefined&&
 Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
const texto=(value,max)=>String(value??'').trim().slice(0,max);
const medios=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros']);
const entrega=new Set(['Retiro','Delivery','Consumo en local']);

export function prepararPedidoManualPendienteRomoQA(estado,{
 draft,registradoEn,fechaOperativa,confirmoSinPago=false
}={}){
 permitir(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
  estado.pedidos.every(p=>p?.suc===SUC)&&
  Number.isSafeInteger(estado.nextId)&&estado.nextId>0,
  'Se requiere el estado cifrado exclusivo de Romo');
 permitir(confirmoSinPago===true,'Confirma que este pedido quedará sin pagar');
 permitir(draft&&typeof draft==='object'&&!Array.isArray(draft)&&
  !draft.editando&&!draft.pagado&&!draft.cartaSolicitudRemotaId&&
  !draft.cartaReservaToken&&!(draft.qrSolicitudes||[]).length&&
  !draft.productosPagadosOtroLocal&&!draft.envioPagadoOtroLocal&&
  !draft.mixtoProductos&&!draft.mixtoEnvio&&
  (draft.propinaModo===undefined||draft.propinaModo==='ninguna')&&
  !(Number(draft.propinaPersonalizada)||0),
  'Pedido manual: sin cobros, QR, propinas ni reservas de carta');
 // Los códigos enviados por la carta se atienden por reserva+PATCH atómico,
 // nunca como pedido manual, para no duplicar solicitudes pendientes.
 permitir(!texto(draft.codigoCarta,60),'Utiliza la bandeja de carta para pedidos con código');
 permitir(entrega.has(draft.modalidad)&&
  texto(draft.cliente,80).length>0&&String(draft.cliente).length<=80&&
  medios.has(draft.medio),'Completa cliente, modalidad y medio previsto');
 permitir(!/^\s*\*?\s*UKI\s+SUSHI\b/im.test(String(draft.texto||'')),
  'El mensaje pertenece a Uki, no a Romo');
 const rows=Array.isArray(draft.items)?draft.items.filter(x=>texto(x?.nombre,180)):[];
 permitir(rows.length>0&&rows.length<=50,'Revisa la lista de productos');
 const productos=rows.map(x=>{
  permitir(!/^Pedido WhatsApp \(revisar detalle\)$/i.test(String(x.nombre||''))&&
   String(x.nombre).length<=180&&String(x.det||'').length<=900&&
   entero(x.cant,1,100)&&entero(x.precio,1,1000000),
   'Revisa armado, cantidad y precio del producto');
  return {nombre:texto(x.nombre,180),cantidad:Number(x.cant),
   precioUnit:Number(x.precio),detalle:String(x.det||'')};
 });
 const subtotal=productos.reduce((n,x)=>n+x.cantidad*x.precioUnit,0);
 const envio=draft.modalidad==='Delivery'?Number(draft.envio):0;
 permitir(entero(draft.modalidad==='Delivery'?draft.envio:0,0,4000)&&
  (draft.modalidad!=='Delivery'||envio>0),
  'Confirma el valor del delivery de Romo');
 const total=subtotal+envio;
 permitir(entero(total,1,3000000),'Total del pedido inválido');
 permitir(entero(registradoEn,1,8640000000000000),'Fecha de recepción inválida');
 const turno=obtenerTurnoRomoFolioQA(estado,{fechaOperativa,registradoEn});
 const id=estado.nextId;
 permitir(!estado.pedidos.some(p=>p.id===id),'Folio interno duplicado');
 const fechaISO=texto(draft.fecha,45)||new Date(registradoEn).toISOString();
 permitir(Number.isFinite(Date.parse(fechaISO)),'Fecha de pedido inválida');
 const pedido={
  id,numeroTurno:turno.numero,turnoClave:turno.clave,
  suc:SUC,fechaISO,registradoEn,
  cliente:texto(draft.cliente,80),telefono:texto(draft.telefono,30),
  codigoCliente:texto(draft.codigoCliente,24),codigoCarta:'',
  cartaSolicitudRemotaId:'',cartaReservaToken:'',qrSolicitudes:[],
  sucursalCarta:'',mesaReferencia:draft.modalidad==='Consumo en local'?
   texto(draft.mesaReferencia,50):'',
  modalidad:draft.modalidad,envio,kmRecorrido:texto(draft.kmRecorrido,32),
  medio:draft.medio,medioEnvio:draft.medioEnvio||'Efectivo',
  pagado:false,estado:'Pendiente',productos,
  subtotal,total,propina:0,propinaModo:'ninguna',medioPropina:'Efectivo',
  textoOriginal:String(draft.texto||'').slice(0,12000),esPremio:false
 };
 estado.pedidos.push(pedido);
 estado.nextId=id+1;
 return Object.freeze({pedidoId:id,total,estado:'Pendiente',pagado:false});
}
