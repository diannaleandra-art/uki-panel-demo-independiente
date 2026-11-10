/* Uki Sushi, vista de todas las ventas para dueños (QA).
   Sólo transforma una copia DESCIFRADA en el propio iPhone. No usa Firestore,
   no escribe, no envía contraseñas ni expone teléfono/código de cliente.
   La caja cerrada NO se suma a los pedidos: es otra representación de ventas. */
const SUC=Object.freeze({'Uki Regimiento Arica':'Regimiento Arica','Uki La Serena':'La Serena'});
const MAX=1_000_000_000;
const importe=v=>{
 const n=Number(v);
 return Number.isSafeInteger(n)&&n>=0&&n<=MAX?n:0;
};
const fechaValida=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
const estadoPago=p=>p.estado==='Cancelado'?'cancelada':p.esPremio?'premio':p.ajusteCobroPendiente?.estado==='pendiente'?'revisar':p.pagado?'pagada':'pendiente';
function pagoExternoProducto(p,sub){
 if(!p.productosPagadosOtroLocal)return 0;
 if(p.montoProductosOtroLocal===undefined||p.montoProductosOtroLocal===null||p.montoProductosOtroLocal==='')return sub;
 return Math.min(sub,importe(p.montoProductosOtroLocal));
}
function pagoExternoEnvio(p,env,sub){
 if(!env)return 0;
 if(p.envioPagadoOtroLocal===true){
  if(p.montoEnvioOtroLocal===undefined||p.montoEnvioOtroLocal===null||p.montoEnvioOtroLocal==='')return env;
  return Math.min(env,importe(p.montoEnvioOtroLocal));
 }
 const raw=Number(p.montoProductosOtroLocal);
 return p.envioPagadoOtroLocal===undefined&&p.productosPagadosOtroLocal&&
  Number.isFinite(raw)&&raw>sub&&raw<=sub+env?raw-sub:0;
}
function pagosParte(p,nombre,monto,medio){
 if(!monto)return [];
 const list=p[nombre];
 if(Array.isArray(list)&&list.length){
  return list.map(x=>({medio:String(x.medio||'Otros').slice(0,42),monto:importe(x.monto)}))
   .filter(x=>x.monto>0);
 }
 return [{medio:String(p[medio]||'Efectivo').slice(0,42),monto}];
}
function extraerMedios(p){
 if(!p.pagado)return {medios:{},cobradoLocal:0,inconsistente:false};
 const subtotal=importe(p.subtotal);
 const envio=p.modalidad==='Delivery'?importe(p.envio):0;
 const localProductos=subtotal-pagoExternoProducto(p,subtotal);
 const localEnvio=envio-pagoExternoEnvio(p,envio,subtotal);
 const lines=[...pagosParte(p,'pagosProductos',localProductos,'medio'),
  ...pagosParte(p,'pagosEnvio',localEnvio,'medioEnvio')];
 let inconsistente=lines.reduce((sum,x)=>sum+x.monto,0)!==localProductos+localEnvio;
 const source=p.ajusteCobroPendiente?.estado==='pendiente'?
  p.ajusteCobroPendiente.recibido:null;
 const medios={};
 if(source&&typeof source==='object'&&!Array.isArray(source)){
  for(const [nombre,monto] of Object.entries(source)){
   if(nombre.length>42)continue;
   medios[nombre]=importe(monto);
  }
 }else{
  for(const x of lines)medios[x.medio]=(medios[x.medio]||0)+x.monto;
 }
 const cobradoLocal=Object.values(medios).reduce((sum,x)=>sum+x,0);
 if(cobradoLocal>subtotal+envio)inconsistente=true;
 return {medios,cobradoLocal,inconsistente};
}
function fechaDeTurno(p,estado){
 const fechaISO=String(p.fechaISO||'').slice(0,10);
 const fecha=fechaValida(fechaISO)?fechaISO:null;
 const time=Number(p.registradoEn)||Date.parse(String(p.fechaISO||''))||0;
 const cierre=(estado.cierres||[]).filter(c=>c&&c.suc===estado.suc&&
  Number(c.fechaMs)>0&&time>0&&time<=Number(c.fechaMs)&&
  (!Number(c.inicioTurnoMs)||time>=Number(c.inicioTurnoMs))&&
  fechaValida(c.fechaOperativa)).sort((a,b)=>a.fechaMs-b.fechaMs)[0];
 if(cierre)return cierre.fechaOperativa;
 // Si el turno permanece abierto tras medianoche, la caja conserva esta fecha.
 const operativa=String(estado.fechaOperativa||'');
 if(fechaValida(operativa)&&time>0){
  const ultimoCierre=Math.max(0,...(estado.cierres||[]).map(c=>Number(c.fechaMs)||0));
  if(time>ultimoCierre)return operativa;
 }
 return fecha;
}
export function extraerVentasUki(sucursal,estado,{desde='',hasta=''}={}){
 if(!Object.prototype.hasOwnProperty.call(SUC,sucursal)||estado?.suc!==sucursal||
   !Array.isArray(estado.pedidos))throw Error('Respaldo de pedidos no corresponde a esta sucursal');
 if(desde&&!fechaValida(desde)||hasta&&!fechaValida(hasta)||desde&&hasta&&desde>hasta)
  throw Error('Rango de fechas incorrecto');
 const seen=new Set(),rows=[];
 for(const p of estado.pedidos){
  if(!p||p.suc!==sucursal)continue;
  const fecha=fechaDeTurno(p,estado);
  if(!fecha||desde&&fecha<desde||hasta&&fecha>hasta)continue;
  const n=Number(p.id);
  if(!Number.isSafeInteger(n)||n<1)continue;
  const id=sucursal+'|pedido|'+n;
  if(seen.has(id))continue;
  seen.add(id);
  const subtotal=importe(p.subtotal),envio=p.modalidad==='Delivery'?importe(p.envio):0;
  const estado=estadoPago(p);
  const pago=estado==='cancelada'||estado==='premio'?{medios:{},cobradoLocal:0,inconsistente:false}:extraerMedios(p);
  const products=Array.isArray(p.productos)?
   p.productos.slice(0,50).map(x=>Object.freeze({nombre:String(x?.nombre||'Producto').slice(0,100),
    cantidad:importe(x?.cantidad),precio:importe(x?.precioUnit)})):[];
  rows.push(Object.freeze({
   id,sucursal,nombreSucursal:SUC[sucursal],numero:n,
   codigo:String(p.codigoCarta||'').slice(0,70),
   fecha,fechaHora:String(p.fechaISO||'').slice(0,35),
   modalidad:String(p.modalidad||'Sin modalidad').slice(0,50),
   estado:estado==='pagada'&&pago.inconsistente?'revisar':estado,
   total:importe(p.total)||subtotal+envio,subtotal,envio,
   cobradoLocal:pago.cobradoLocal,
   cobradoOtroLocal:estado==='pagada'?pagoExternoProducto(p,subtotal)+pagoExternoEnvio(p,envio,subtotal):0,
   propina:importe(p.propina),
   medios:Object.freeze({...pago.medios}),
   productos:Object.freeze(products)
  }));
 }
 return rows.sort((a,b)=>b.fechaHora.localeCompare(a.fechaHora)||b.numero-a.numero);
}
export function filtrarVentasUki(ventas,{buscar='',estado='',medio='',desde='',hasta='',sucursal=''}={}){
 if(!Array.isArray(ventas))throw Error('Ventas inválidas');
 const q=String(buscar).trim().toLocaleLowerCase('es-CL');
 return ventas.filter(v=>
  (!q||[v.numero,v.codigo,v.modalidad,v.nombreSucursal].some(x=>String(x).toLocaleLowerCase('es-CL').includes(q)))&&
  (!estado||v.estado===estado)&&
  (!medio||Object.hasOwn(v.medios||{},medio))&&
  (!sucursal||v.sucursal===sucursal)&&
  (!desde||v.fecha>=desde)&&(!hasta||v.fecha<=hasta));
}
export function resumenVentasUki(ventas){
 if(!Array.isArray(ventas))throw Error('Lista inválida');
 const seen=new Set(),result={pagadas:0,pendientes:0,canceladas:0,revision:0,cobradoLocal:0,cobradoOtroLocal:0};
 for(const v of ventas){
  if(!v||seen.has(v.id))continue;seen.add(v.id);
  if(v.estado==='pagada'){
   result.pagadas++;result.cobradoLocal+=importe(v.cobradoLocal);
   result.cobradoOtroLocal+=importe(v.cobradoOtroLocal);
  }else if(v.estado==='pendiente')result.pendientes++;
  else if(v.estado==='cancelada')result.canceladas++;
  else if(v.estado==='revisar')result.revision++;
 }
 return result;
}