/* Vista de dueños Uki — solo lectura. Extrae cifras financieras de cierres ya
   confirmados; no modifica cajas, pedidos, clientes ni contabilidad. */
const NOMBRES=Object.freeze({'Uki Regimiento Arica':'Regimiento Arica','Uki La Serena':'La Serena'});
const MONTO_MAXIMO=1_000_000_000_000;
const monto=x=>{
 const n=Number(x);
 return Number.isSafeInteger(n)&&n>=0&&n<=MONTO_MAXIMO?n:0;
};
const valido=fecha=>/^\d{4}-\d{2}-\d{2}$/.test(fecha)&&
 !Number.isNaN(Date.parse(fecha+'T12:00:00Z'));
const fechaCierre=c=>{
 if(valido(c.fechaOperativa))return c.fechaOperativa;
 const iso=String(c.fechaISO||'');
 if(valido(iso.slice(0,10)))return iso.slice(0,10);
 return null; // No se atribuye un cierre antiguo a una fecha inventada.
};
export function extraerCierresUki(sucursal,estado,{desde='',hasta=''}={}){
 if(!Object.prototype.hasOwnProperty.call(NOMBRES,sucursal)||estado?.suc!==sucursal||
    !Array.isArray(estado.cierres))throw Error('Respaldo de sucursal incorrecto');
 if(desde&&!valido(desde)||hasta&&!valido(hasta)||desde&&hasta&&desde>hasta)
  throw Error('Selecciona un rango de fechas válido');
 const ids=new Set(),rows=[];
 for(const c of estado.cierres){
  if(!c||c.suc!==sucursal)continue;
  const fecha=fechaCierre(c);
  if(!fecha||desde&&fecha<desde||hasta&&fecha>hasta)continue;
  const fechaMs=Number(c.fechaMs);
  // La fecha/hora de cierre identifica cada turno, incluso si hubo dos en un día.
  // Los cierres sin fechaMs se muestran con una clave de reserva que no se exporta.
  const id=Number.isSafeInteger(fechaMs)&&fechaMs>0?
   sucursal+'|'+fechaMs:sucursal+'|'+String(c.fechaISO||c.fecha||fecha).slice(0,64);
  if(ids.has(id))continue;
  ids.add(id);
  const medios={};
  for(const [nombre,importe] of Object.entries(c.medios||{})){
   if(!/^[\wÁÉÍÓÚáéíóúüÜñÑ /-]{1,40}$/u.test(nombre))continue;
   medios[nombre]=monto(importe);
  }
  rows.push(Object.freeze({
   id,sucursal,nombreSucursal:NOMBRES[sucursal],fecha,
   venta:monto(c.venta),pedidos:monto(c.pedidos),
   gastosCierre:monto(c.gastos),deliveryPorPagar:monto(c.delivery),
   propinas:monto(c.propinas),retiros:monto(c.retiros),
   efectivoContado:c.efectivoContado==null?null:monto(c.efectivoContado),
   medios:Object.freeze(medios)
  }));
 }
 return rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
}
export function resumirCierresUki(colecciones){
 if(!Array.isArray(colecciones))throw Error('Colecciones inválidas');
 const vistos=new Set(),cierres=[],porSucursal={},medios={};
 const total={venta:0,pedidos:0,gastosCierre:0,deliveryPorPagar:0,propinas:0,retiros:0};
 for(const coleccion of colecciones){
  if(!Array.isArray(coleccion))throw Error('Lista inválida');
  for(const cierre of coleccion){
   if(!cierre||typeof cierre.id!=='string'||vistos.has(cierre.id))continue;
   vistos.add(cierre.id);cierres.push(cierre);
   if(!porSucursal[cierre.sucursal])porSucursal[cierre.sucursal]={venta:0,pedidos:0,gastosCierre:0,deliveryPorPagar:0,propinas:0,retiros:0,cierres:0};
   const destino=porSucursal[cierre.sucursal];destino.cierres++;
   for(const campo of Object.keys(total)){
    const n=monto(cierre[campo]);total[campo]+=n;destino[campo]+=n;
   }
   for(const [medio,value] of Object.entries(cierre.medios||{}))
    medios[medio]=(medios[medio]||0)+monto(value);
  }
 }
 return {cierres:cierres.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id)),
  total,porSucursal,medios,cantidad:cierres.length};
}
