// Delta de reclasificación. No registra un nuevo cobro, reembolso ni pedido.
export const SUCURSALES={
 'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena','Romo’s Sushi La Serena':'romo:serena'
};
const MEDIOS=new Set(['transferencia','efectivo','debito','credito','edenred','junaeb','otro']);
const CAMPOS=['medio','medioEnvio','pagosProductos','pagosEnvio','mixtoProductos','mixtoEnvio'];
const medium=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^otros$/,'otro');
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const sum=lines=>lines.reduce((n,x)=>n+x.monto,0);
const transfer=lines=>lines.find(x=>x.medio==='transferencia')?.monto||0;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const ref=p=>String(p?.cartaSolicitudRemotaId||p?.seguimientoSolicitudId||'');
export function canon(lines) {
 if(!Array.isArray(lines)||lines.length>20)return null;
 const map=new Map();
 for(const x of lines){
  const medio=medium(x?.medio),monto=Number(x?.monto);
  if(!MEDIOS.has(medio)||!money(monto)||monto===0)return null;
  map.set(medio,(map.get(medio)||0)+monto);
 }
 return [...map].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([medio,monto])=>({medio,monto}));
}
export function fotoPago(p,leer){
 if(!p||typeof leer!=='function')return null;
 const subtotal=Number(p.subtotal),envio=p.modalidad==='Delivery'?Number(p.envio):0,propina=Number(p.propina||0);
 if(![subtotal,envio,propina].every(money)||subtotal<1||Number(p.total)!==subtotal+envio+propina)return null;
 const productos=canon(leer(p,'productos',subtotal)),delivery=canon(leer(p,'envio',envio));
 if(!productos||!delivery||sum(productos)>subtotal||sum(delivery)>envio)return null;
 return {total:subtotal+envio,productos,delivery,propinaTransferencia:medium(p.medioPropina)==='transferencia'?propina:0,
  montoOtroLocal:subtotal+envio-sum(productos)-sum(delivery)};
}
export function exigirPlan(prev,nuevo,leer,leerAnterior=leer){
 const storeId=SUCURSALES[prev?.suc],pedidoInterno=String(prev?.id??'');
 if(!storeId||!/^[1-9][0-9]{0,11}$/.test(pedidoInterno)||prev.suc!==nuevo.suc||
    prev.id!==nuevo.id||ref(prev)!==ref(nuevo)||!['Pendiente','Entregado'].includes(prev.estado)||
    prev.esPremio||prev.ajusteCobroPendiente?.estado==='pendiente'||prev.pagado!==nuevo.pagado)
  throw Error('El pedido no tiene un cobro que se pueda corregir desde esta edición.');
 const a=fotoPago(prev,leerAnterior),b=fotoPago(nuevo,leer);
 // Una reparación no cambia si el pedido estaba o no pagado. Para una venta
 // manual pendiente solo admite el caso cuyo reparto anterior estaba incompleto.
 if(!prev.pagado&&!ref(prev)&&(leerAnterior===leer||fotoPago(prev,leer)||!a))
  throw Error('El pedido aún no tiene un cobro que rectificar.');
 if(!a||!b||a.total!==b.total||a.montoOtroLocal!==b.montoOtroLocal||a.propinaTransferencia!==b.propinaTransferencia)
  throw Error('Revisa el reparto de los pagos. Esta corrección conserva los importes del pedido.');
 for(const tipo of ['productos','delivery']){
  if(sum(a[tipo])!==sum(b[tipo])||transfer(b[tipo])>transfer(a[tipo])||
     a[tipo].filter(x=>x.medio!=='transferencia').some(x=>(b[tipo].find(y=>y.medio===x.medio)?.monto||0)<x.monto))
   throw Error('Solo cambia la parte registrada como transferencia. Conserva los otros pagos y sus montos.');
  if(transfer(b[tipo])===transfer(a[tipo])&&!eq(a[tipo],b[tipo]))
   throw Error('La corrección no puede modificar otras formas de pago.');
 }
 const montoAnterior=transfer(a.productos)+transfer(a.delivery)+a.propinaTransferencia;
 const montoRestante=transfer(b.productos)+transfer(b.delivery)+b.propinaTransferencia;
 if(montoAnterior<=montoRestante)throw Error('No se encontró una transferencia que retirar o reducir.');
 const pagos=canon([...b.productos,...b.delivery]),pagosAntes=canon([...a.productos,...a.delivery]);
 // Distinguir un importe reconstruido para la autorización de una transferencia
 // que realmente quedó registrada. La marca viaja firmada con los importes.
 const sinDetalleAnterior=[];
 for(const [i,tipo,monto] of [[0,'productos',Number(prev.subtotal)],[1,'envio',prev.modalidad==='Delivery'?Number(prev.envio):0]]){
  const filas=leer(prev,tipo,monto);
  const bloque=i===0?a.productos:a.delivery, propuesta=i===0?b.productos:b.delivery;
  if(filas.length>0&&filas.every(x=>Number(x.monto)===0)&&bloque.length===1&&
    bloque[0].medio==='transferencia'&&transfer(propuesta)<bloque[0].monto)sinDetalleAnterior.push(i);
 }
 return {storeId,id:ref(prev),pedidoInterno,total:a.total,montoOtroLocal:a.montoOtroLocal,
  propinaTransferencia:a.propinaTransferencia,montoAnterior,montoRestante,pagosAntes,pagos,
  repartoAntes:[a.productos,a.delivery],repartoDespues:[b.productos,b.delivery],
  ...(sinDetalleAnterior.length?{sinDetalleAnterior}:{})};
}
export function pagoCorregido(prev,d) {
 const p={...prev};
 for(const k of CAMPOS)if(d[k]!==undefined)p[k]=d[k];
 return p;
}
const igual=(a,b)=>{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&igual(a[k],b[k]));
};
export function comprobarCambio(prev,next,leer,leerAnterior=leer){
 if(!prev||!next)return null;
 try{
  const recibos=next.rectificacionesTransferenciaV2,anteriores=prev.rectificacionesTransferenciaV2||[];
  if(!Array.isArray(anteriores)||!Array.isArray(recibos)||recibos.length!==anteriores.length+1||
     !igual(anteriores,recibos.slice(0,-1)))return null;
  const r=recibos.at(-1);
  const limpio=pagoCorregido(prev,next);limpio.rectificacionesTransferenciaV2=recibos;
  if(!igual(limpio,next)||typeof r?.id!=='string'||typeof r.firma!=='string'||
     typeof r.motivo!=='string'||!Number.isFinite(Date.parse(r.en)))return null;
  return {plan:exigirPlan(prev,next,leer,leerAnterior),recibo:r};
 }catch{return null;}
}
