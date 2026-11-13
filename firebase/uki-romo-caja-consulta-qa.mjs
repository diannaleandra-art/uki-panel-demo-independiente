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

// La vista clasica reutiliza este módulo puro sin darle permisos de escritura.
if(typeof window!=='undefined')window.ukiRomoCajaConsultaQA=Object.freeze({consultarCajaRomoQA});
