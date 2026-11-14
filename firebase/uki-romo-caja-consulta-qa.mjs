/**
 * Caja e historial SOLO LECTURA para Romo La Serena.
 * Fuentes: pedidos, propinas y cierres del snapshot CIFRADO ya confirmado
 * por Neon. No calcula ventas desde solicitudes de carta, y nunca escribe.
 */
export const ROMO_CAJA_CONSULTA_QA_SOLO_LECTURA=true;
const SUC='Romo’s Sushi La Serena';
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const APPS=new Set(['Uber Eats','PedidosYa','Rappi']);
const err=message=>{throw Error(message)};
const monto=(v,label)=>{
 if(v===''||v===undefined||v===null||!Number.isSafeInteger(Number(v))||
    Number(v)<0||Number(v)>100000000)err('Importe '+label+' inválido');
 return Number(v);
};
const optional=(v,fallback,label)=>v===''||v===undefined||v===null?
 fallback:monto(v,label);
const assertOwn=(record,label)=>{
 if(!record||typeof record!=='object'||Array.isArray(record)||record.suc!==SUC)
  err(label+' pertenece a otra sucursal');
};
const lineas=(pedido,key,medio,requerido,permitidos)=>{
 if(requerido===0){
  if(Array.isArray(pedido[key])&&pedido[key].length)err('Cobro inexistente con medios asignados');
  return [];
 }
 const saved=pedido[key];
 if(saved!==undefined&&!Array.isArray(saved))err('Detalle de pago inválido');
 if(saved?.length){
  if(saved.length>6)err('Demasiados medios de pago');
  const out=saved.map(x=>{
   if(!x||!permitidos.includes(x.medio))err('Medio de pago no permitido');
   return {medio:x.medio,monto:monto(x.monto,'medio '+x.medio)};
  });
  if(out.some(x=>x.monto===0)||out.reduce((s,x)=>s+x.monto,0)!==requerido)
   err('Los pagos mixtos no cuadran');
  return out;
 }
 if(!permitidos.includes(pedido[medio]))err('Medio de pago no reconocido');
 return [{medio:pedido[medio],monto:requerido}];
};
function etiquetaDia(p){
 const dia=String(p?.fechaOperativa||p?.fechaISO||'').slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(dia)?dia:'';
}
/**
 * No intenta calcular cierre final, efectivo restante ni saldo de repartidor,
 * porque estos requieren gastos, devoluciones y conciliación del turno.
 */
export function consultarCajaRomoQA(estado,{fechaOperativa}={}){
 if(!estado||estado.suc!==SUC)err('La caja no es de Romo La Serena');
 for(const field of ['pedidos','propinas','cierres','gastos','retiros','deliveriesManuales']){
  if(!Array.isArray(estado[field]))err('No se verificó '+field+' del estado Romo');
  estado[field].forEach(row=>assertOwn(row,field));
 }
 const fecha=String(fechaOperativa||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))err('Día operativo inválido');
 const medios=Object.fromEntries(MEDIOS.map(m=>[m,0]));
 const result={fecha,soloLectura:true,pedidosRegistrados:0,pagados:0,
  pendientes:0,pedidosCancelados:0,productosCobradosRomo:0,
  deliveryCobradoRomo:0,deliveryCobradoOtroLocal:0,
  productosCobradosOtroLocal:0,deliveryParaRepartidor:0,
  cobrosEnRomo:0,pedidosPagadosTotal:0,propinasRegistradas:0,
  entregasManualesAConciliar:0,medios};
 for(const p of estado.pedidos){
  if(etiquetaDia(p)!==fecha)continue;
  result.pedidosRegistrados++;
  if(p.estado==='Cancelado'||p.esPremio===true){
   result.pedidosCancelados++;continue;
  }
  const subtotal=monto(p.subtotal,'subtotal');
  const envio=p.modalidad==='Delivery'?monto(p.envio,'delivery'):0;
  result.deliveryParaRepartidor+=envio;
  if(p.pagado!==true){result.pendientes++;continue}
  result.pagados++;result.pedidosPagadosTotal+=subtotal+envio;
  const productoFuera=p.productosPagadosOtroLocal===true?
   optional(p.montoProductosOtroLocal,subtotal,'productos externos'):0;
  const envioFuera=p.envioPagadoOtroLocal===true?
   optional(p.montoEnvioOtroLocal,envio,'delivery externo'):0;
  if(productoFuera>subtotal||envioFuera>envio||
     (p.productosPagadosOtroLocal===true&&!productoFuera)||
     (p.envioPagadoOtroLocal===true&&!envioFuera))
   err('Cobro externo incompatible con el pedido');
  if((productoFuera||envioFuera)&&!String(p.localPagoExterno||'').trim())
   err('Falta identificar el local que recibió el cobro');
  const productosLocal=subtotal-productoFuera,deliveryLocal=envio-envioFuera;
  const productos=lineas(p,'pagosProductos','medio',productosLocal,MEDIOS);
  const delivery=lineas(p,'pagosEnvio','medioEnvio',deliveryLocal,
   MEDIOS.filter(m=>!APPS.has(m)));
  for(const l of [...productos,...delivery])medios[l.medio]+=l.monto;
  result.productosCobradosRomo+=productosLocal;
  result.deliveryCobradoRomo+=deliveryLocal;
  result.productosCobradosOtroLocal+=productoFuera;
  result.deliveryCobradoOtroLocal+=envioFuera;
 }
 result.cobrosEnRomo=Object.values(medios).reduce((a,b)=>a+b,0);
 if(result.cobrosEnRomo!==
    result.productosCobradosRomo+result.deliveryCobradoRomo)
  err('La suma de medios no corresponde al dinero recibido en Romo');
 for(const p of estado.propinas){
  if(etiquetaDia(p)===fecha)result.propinasRegistradas+=monto(p.monto,'propina');
 }
 for(const d of estado.deliveriesManuales){
  if(etiquetaDia(d)===fecha){
   const v=monto(d.monto,'delivery manual');
   result.entregasManualesAConciliar+=v;
  }
 }
 // Los cierres son snapshots ya confirmados; no modifica ni reconstruye nada.
 const historial=estado.cierres.slice().sort((a,b)=>
  (Number(b.fechaMs)||Date.parse(b.fechaISO||'')||0)-
  (Number(a.fechaMs)||Date.parse(a.fechaISO||'')||0))
  .slice(0,25).map(c=>({
   fecha:String(c.fechaOperativa||c.fechaISO||c.fecha||'').slice(0,40),
   venta:c.venta===undefined?null:monto(c.venta,'venta de cierre'),
   efectivo:c.efectivo===undefined?null:monto(c.efectivo,'efectivo de cierre')
  }));
 return Object.freeze({...result,medios:Object.freeze({...medios}),
  historial:Object.freeze(historial)});
}


/** Historial Romo desde el mismo estado cifrado confirmado por Neon.
 * Solo lectura. NO suma solicitudes en ventas y no lee ni modifica Uki.
 */
const histDia=v=>{
 const t=String(v||'').slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(t)&&
  !Number.isNaN(Date.parse(t+'T12:00:00Z'))?t:'';
};
const buscaNormal=s=>String(s??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function consultarHistorialRomoQA(estado,{
 desde='',hasta='',busqueda='',maxResultados=100
}={}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos)||!Array.isArray(estado.cierres))
  err('Historial no corresponde a Romo La Serena');
 if(!estado.pedidos.every(p=>p?.suc===SUC)||!estado.cierres.every(c=>c?.suc===SUC))
  err('El historial contiene otra sucursal');
 if((desde&&!histDia(desde))||(hasta&&!histDia(hasta))||
    (desde&&hasta&&desde>hasta))err('Revisa el rango de fechas');
 if(!Number.isSafeInteger(maxResultados)||maxResultados<1||maxResultados>200)
  err('Límite de resultados inválido');
 const filtro=buscaNormal(busqueda);
 if(filtro.length>120)err('Búsqueda demasiado larga');
 const encontrados=estado.pedidos.filter(p=>{
  const fecha=histDia(p.fechaOperativa)||histDia(p.fechaISO);
  if(!fecha||(desde&&fecha<desde)||(hasta&&fecha>hasta))return false;
  const campos=[p.id,p.numeroTurno,p.codigoCarta,p.codigoCliente,p.cliente,p.telefono];
  return !filtro||campos.some(v=>buscaNormal(v).includes(filtro));
 }).slice().sort((a,b)=>(Number(b.registradoEn)||0)-(Number(a.registradoEn)||0)||
  (Number(b.id)||0)-(Number(a.id)||0));
 const filas=encontrados.slice(0,maxResultados).map(p=>{
  const monto=montoHistorial(p.total,'total de pedido');
  const eventos=Array.isArray(p.historialCambios)?p.historialCambios.slice(-30).map(x=>({
   tipo:String(x?.tipo||'Modificación').slice(0,80),
   fecha:String(x?.fecha||'').slice(0,40),
   responsable:String(x?.responsable||'').slice(0,80),
   motivo:String(x?.motivo||'').slice(0,300),
   totalAnterior:Number.isSafeInteger(x?.anterior?.total)?x.anterior.total:null,
   totalNuevo:Number.isSafeInteger(x?.nuevo?.total)?x.nuevo.total:null
  })):[];
  return Object.freeze({
   id:Number(p.id),turno:Number(p.numeroTurno||p.id),
   codigo:String(p.codigoCarta||''),cliente:String(p.cliente||''),
   whatsappUltimos4:String(p.telefono||'').replace(/\D/g,'').slice(-4),
   fecha:histDia(p.fechaOperativa)||histDia(p.fechaISO),
   estado:String(p.estado||'Pendiente'),pagado:p.pagado===true,
   total:monto,productos:Array.isArray(p.productos)?p.productos.map(x=>({
    nombre:String(x.nombre||''),cantidad:Number(x.cantidad)||0,
    precioUnit:Number(x.precioUnit)||0,detalle:String(x.detalle||'').slice(0,12000)
   })):[],
   eventos:Object.freeze(eventos)
  });
 });
 return Object.freeze({
  soloLectura:true,encontrados:encontrados.length,
  mostrados:filas.length,hayMas:encontrados.length>maxResultados,
  pagados:encontrados.filter(p=>p.pagado===true&&p.estado!=='Cancelado').length,
  pendientes:encontrados.filter(p=>p.pagado!==true&&p.estado!=='Cancelado').length,
  cancelados:encontrados.filter(p=>p.estado==='Cancelado').length,
  filas:Object.freeze(filas)
 });
}
function montoHistorial(value,label){
 if(!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>100000000)
  err('Importe de '+label+' inválido');
 return Number(value);
}

// La vista clasica reutiliza este módulo puro sin darle permisos de escritura.
if(typeof window!=='undefined')window.ukiRomoCajaConsultaQA=Object.freeze({consultarCajaRomoQA,consultarHistorialRomoQA});
