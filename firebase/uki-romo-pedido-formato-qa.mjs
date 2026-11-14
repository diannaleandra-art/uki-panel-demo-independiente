/**
 * Romo La Serena: construye UNA venta candidata con la estructura del
 * ndGuardar de Uki, en el estado ROMO aislado; no guarda en base ni caja visible.
 */
export const ROMO_CANDIDATO_QA_ACTIVO=false;
const SUC='Romo’s Sushi La Serena';
const medios=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const mediosEntrega=medios.filter(x=>!['Uber Eats','PedidosYa','Rappi'].includes(x));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const check=(v,m)=>{if(!v)throw Error(m)};
const entero=(v,k,min=0)=>{
 const n=Number(v);check(v!==''&&v!==undefined&&v!==null&&
  Number.isSafeInteger(n)&&n>=min&&n<=100000000,'Revisa importe o cantidad de '+k);
 return n;
};
const txt=(v,n=180)=>String(v??'').trim().slice(0,n);
const telefono=v=>{
 let s=String(v||'').replace(/\D/g,'');
 return /^09\d{8}$/.test(s)?'56'+s.slice(1):/^9\d{8}$/.test(s)?'56'+s:s;
};
function pagosQA(d,sub,envio){
 const medio=d.medio||'Efectivo',medioEnvio=d.medioEnvio||medio;
 const externosProd=!!d.productosPagadosOtroLocal,externosEnvio=!!d.envioPagadoOtroLocal;
 const otroProd=externosProd?entero(d.montoProductosOtroLocal==null||d.montoProductosOtroLocal===''?sub:d.montoProductosOtroLocal,'productos fuera',1):0;
 const otroEnvio=externosEnvio?entero(d.montoEnvioOtroLocal==null||d.montoEnvioOtroLocal===''?envio:d.montoEnvioOtroLocal,'envío fuera',1):0;
 check(otroProd<=sub&&otroEnvio<=envio,'Pago de otro local supera el pedido');
 const localPagoExterno=externosProd||externosEnvio?txt(d.localPagoExterno,80):'';
 check(!(externosProd||externosEnvio)||localPagoExterno,'Indica el local que recibió el pago');
 const calc=(monto,flag,lineas,metodo,validos,nombre)=>{
  if(!d.pagado){
   check(!flag&&!lineas?.length,'No registrar pago '+nombre+' sin cobro confirmado');
   return [];
  }
  if(monto===0){check(!flag&&!lineas?.length,'Cobro duplicado de '+nombre);return []}
  check(validos.includes(metodo),'Medio inválido de '+nombre);
  if(!flag){check(!lineas?.length,'Marca pago mixto de '+nombre);return []}
  check(Array.isArray(lineas)&&lineas.length>=1&&lineas.length<=6,
   'Revisa pago mixto '+nombre);
  const out=lineas.map(x=>{
   check(x&&validos.includes(x.medio),'Medio mixto inválido de '+nombre);
   return {medio:x.medio,monto:entero(x.monto,nombre,1)};
  });
  check(out.reduce((a,x)=>a+x.monto,0)===monto,'Los pagos mixtos de '+nombre+' no cuadran');
  return out;
 };
 if(!d.pagado)check(!externosProd&&!externosEnvio,'No se han confirmado pagos externos');
 const pagosProductos=calc(sub-otroProd,!!d.mixtoProductos,d.pagosProductos,medio,medios,'productos');
 const pagosEnvio=calc(envio-otroEnvio,!!d.mixtoEnvio,d.pagosEnvio,medioEnvio,mediosEntrega,'delivery');
 return {medio,medioEnvio,pagosProductos,pagosEnvio,
  productosPagadosOtroLocal:externosProd,montoProductosOtroLocal:otroProd,
  envioPagadoOtroLocal:externosEnvio,montoEnvioOtroLocal:externosEnvio?otroEnvio:'',
  localPagoExterno};
}
function timbreQA(p,d){
 const tel=telefono(d.telefono);
 if(!p.pagado||p.productosPagadosOtroLocal||tel.length<8)return;
 const firma=JSON.stringify([SUC,null,tel]);
 check(d.timbreAvisoAbiertoFirma===firma&&d.timbreAvisoConfirmadoFirma===firma&&
  Number.isFinite(Date.parse(d.timbreAvisoAbiertoEn))&&
  Number.isFinite(Date.parse(d.timbreAvisoConfirmadoEn))&&
  !!txt(d.timbreAvisoConfirmadoPor,80),
  'Envía y confirma el timbre por WhatsApp antes de guardar');
 const responsable=txt(d.timbreAvisoConfirmadoPor,80);
 p.timbreWhatsAppAbiertoEn=d.timbreAvisoAbiertoEn;p.timbreWhatsAppAbiertoPor=responsable;
 p.timbreEnviadoEn=d.timbreAvisoConfirmadoEn;p.timbreEnviadoPor=responsable;
 p.timbreReglaObligatoria=true;
 p.timbreEventos=[
  {tipo:'whatsapp_abierto',fecha:d.timbreAvisoAbiertoEn,responsable},
  {tipo:'declarado_enviado',fecha:d.timbreAvisoConfirmadoEn,responsable}];
}
export function efectosEnCopia(estado,p,stamp){
 if(!p.pagado)return;
 if(p.propina>0){
  estado.propinas.push({suc:SUC,id:stamp+p.id,pedidoId:p.id,
   fechaISO:p.fechaISO,registradoEn:stamp,monto:p.propina,medio:p.medioPropina,
   origen:'pedido',concepto:'Propina del pedido '+(p.codigoCarta?'Carta #'+p.codigoCarta:'#'+p.id)});
 }
 if(!p.cliente||p.productosPagadosOtroLocal)return;
 check(estado.clientes&&typeof estado.clientes==='object'&&!Array.isArray(estado.clientes),
  'Historial de clientes Romo no preparado');
 const tel=telefono(p.telefono),name=p.cliente.toLocaleLowerCase('es-CL');
 const matches=Object.entries(estado.clientes).filter(([,c])=>{
  const otro=telefono(c?.telefono);
  return tel.length>=8?otro===tel:!otro&&
   String(c?.nombre||'').toLocaleLowerCase('es-CL')===name&&
   !!p.codigoCliente&&String(c.codigoCliente||'')===p.codigoCliente;
 });
 check(matches.length<=1,'Cliente duplicado, requiere conciliación');
 const key=matches[0]?.[0]||(tel.length>=8?'telefono:'+tel:'codigo:'+p.codigoCliente+'|nombre:'+name);
 const c=estado.clientes[key]||{nombre:p.cliente,codigoCliente:p.codigoCliente,
  telefono:p.telefono,ventas:0,gastado:0,pedidos:0,ultimo:'',
  movimientos:[],canje6:false,canje10:false};
 check(Array.isArray(c.movimientos)&&
  !c.movimientos.some(m=>m.tipo==='venta'&&m.pedidoId===p.id),'Historial duplicado');
 const vence=new Date(stamp);vence.setMonth(vence.getMonth()+3);
 c.gastado=(Number(c.gastado)||0)+p.subtotal;c.pedidos=(Number(c.pedidos)||0)+1;
 c.ultimo=new Date(stamp).toLocaleDateString('es-CL');
 c.movimientos.push({tipo:'venta',fecha:new Date(stamp).toISOString(),
  vence:vence.toISOString(),pedidoId:p.id});
 estado.clientes[key]=c;
}
/**
 * Recibe el mismo borrador D preparado desde la carta y una copia del estado S.
 * contexto.turnoClave / numeroTurno DEBEN venir de las reglas vigentes de Uki.
 */
export async function construirCandidatoRomoFormatoUkiQA({estado,draft,contexto}={}){
 check(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&Array.isArray(estado.propinas)&&
  Number.isSafeInteger(estado.nextId)&&estado.nextId>0,'Estado no es Romo');
 check(estado.pedidos.every(p=>p?.suc===SUC),'Estado con pedidos de otra sucursal');
 check(draft?.sucursalCarta===SUC&&uuid.test(String(draft.cartaSolicitudRemotaId||''))&&
  !draft.editando,'Solicitud no pertenece a Romo');
 check(!estado.pedidos.some(p=>p.cartaSolicitudRemotaId===draft.cartaSolicitudRemotaId||
  p.id===estado.nextId),'Solicitud o folio duplicado');
 check(Number.isSafeInteger(contexto?.numeroTurno)&&contexto.numeroTurno>0&&
  typeof contexto.turnoClave==='string'&&contexto.turnoClave.length>5&&
  Number.isSafeInteger(contexto.registradoEn)&&contexto.registradoEn>0,
  'Falta el turno y folio real del motor Uki');
 const fecha=String(draft.fecha||contexto.fechaISO||'');
 check(Number.isFinite(Date.parse(fecha)),'Fecha de pedido inválida');
 const items=Array.isArray(draft.items)?draft.items.filter(x=>txt(x?.nombre,100)):[];
 check(items.length>0&&items.length<=80,'Faltan productos');
 const productos=items.map(x=>{
  check(String(x.det||'').length<=20000,'Armado de producto demasiado largo');
  return {nombre:txt(x.nombre,100),cantidad:entero(x.cant,'cantidad',1),
   precioUnit:entero(x.precio,'precio',1),detalle:String(x.det||'')};
 });
 check(productos.every(p=>p.cantidad<=100),'Cantidad fuera de rango');
 const sub=productos.reduce((sum,p)=>sum+p.cantidad*p.precioUnit,0);
 check(Number.isSafeInteger(sub)&&sub<=100000000,'Subtotal fuera de rango');
 check(['Retiro','Delivery','Consumo en local'].includes(draft.modalidad),'Entrega inválida');
 const envio=draft.modalidad==='Delivery'?entero(draft.envio,'delivery'):0;
 check(!(draft.modalidad==='Delivery'&&draft.romoDeliveryPendienteQA&&envio===0),
  'Confirma el delivery');
 const modo=draft.propinaModo||'ninguna';
 check(['ninguna','diez','otro'].includes(modo),'Propina inválida');
 const propina=modo==='diez'?Math.round(sub*0.1):
  modo==='otro'?entero(draft.propinaPersonalizada,'propina'):0;
 const total=sub+envio+propina;
 check(Number.isSafeInteger(total)&&total<=100000000,'Total fuera de rango');
 if(draft.romoTotalIndicadoQA!==null&&draft.romoTotalIndicadoQA!==undefined&&
    draft.romoTotalIndicadoQA!==''&&
    entero(draft.romoTotalIndicadoQA,'total indicado')!==sub+envio)
  check(contexto.confirmoDiferenciaTotal===true,
   'El importe difiere del indicado por el cliente, confirma la diferencia');
 const pagado=draft.pagado===true;
 check(!pagado||contexto.confirmoPago===true,'Pago no confirmado: no marcar Pagado');
 const pagos=pagosQA(draft,sub,envio);
 const medioPropina=txt(draft.medioPropina||'Efectivo',40);
 check(propina===0||mediosEntrega.includes(medioPropina),'Medio de propina inválido');
 const km=String(draft.kmRecorrido||'').trim();
 check(!km||(Number(km.replace(',','.'))>0&&Number(km.replace(',','.'))<=1000),
  'Kilómetros inválidos');
 const id=estado.nextId,stamp=contexto.registradoEn;
 const p={id,numeroTurno:contexto.numeroTurno,turnoClave:contexto.turnoClave,
  suc:SUC,fechaISO:fecha,registradoEn:stamp,
  cliente:txt(draft.cliente,60),telefono:txt(draft.telefono,30),
  codigoCarta:txt(draft.codigoCarta,60),codigoCliente:txt(draft.codigoCliente,24),
  cartaSolicitudRemotaId:draft.cartaSolicitudRemotaId,
  cartaReservaToken:txt(draft.cartaReservaToken,100),qrSolicitudes:[],
  sucursalCarta:SUC,
  mesaReferencia:draft.modalidad==='Consumo en local'?txt(draft.mesaReferencia,50):'',
  modalidad:draft.modalidad,envio,kmRecorrido:km?Number(km.replace(',','.')):null,
  ...pagos,pagado,estado:'Pendiente',productos,total,subtotal:sub,propina,
  propinaModo:modo,medioPropina,textoOriginal:String(draft.texto||'').slice(0,20000),
  esPremio:false};
 timbreQA(p,draft);
 estado.pedidos.push(p);estado.nextId=id+1;
 efectosEnCopia(estado,p,stamp);
 return {pedidoId:id,total,subtotal:sub};
}
