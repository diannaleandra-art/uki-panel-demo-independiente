const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ID=/^[1-9][0-9]{0,11}$/;
const MEDIOS=new Set(['efectivo','transferencia','debito','credito','edenred','junaeb','otro']);
const sucursales={'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena'};
const medium=value=>{
 const s=String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 return s==='otros'?'otro':s;
};
const positive=n=>Number.isSafeInteger(n)&&n>0;
function canon(lines){
 if(!Array.isArray(lines)||lines.length>10)return null;
 const sums=new Map();
 for(const {medio,monto} of lines){
  const m=medium(medio),n=Number(monto);
  if(!MEDIOS.has(m)||!positive(n))return null;
  sums.set(m,(sums.get(m)||0)+n);
 }
 return [...sums].sort(([a],[b])=>a.localeCompare(b)).map(([medio,monto])=>({medio,monto}));
}
const sum=lines=>lines.reduce((n,x)=>n+x.monto,0);
const equal=(a,b)=>{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);
 return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
};

export function datosRectificables(p){
 if(!p||!sucursales[p.suc]||!ID.test(String(p.id??''))||!UUID.test(p.cartaSolicitudRemotaId||'')||
    p.modalidad!=='Delivery'||!['Pendiente','Entregado'].includes(p.estado)||p.esPremio||
    p.productosPagadosOtroLocal||p.envioPagadoOtroLocal||p.mixtoEnvio||p.propina||
    p.ajusteCobroPendiente||p.rectificacionTransferenciaDeliveryV1||
    !positive(p.envio)||!positive(p.subtotal)||p.total!==p.envio+p.subtotal)return null;
 const envio=canon(p.pagosEnvio?.length?p.pagosEnvio:[{medio:p.medioEnvio,monto:p.envio}]);
 const productos=canon(p.pagosProductos?.length?p.pagosProductos:[{medio:p.medio,monto:p.subtotal}]);
 if(!envio||envio.length!==1||envio[0].medio!=='transferencia'||envio[0].monto!==p.envio||
    !productos||sum(productos)!==p.subtotal||productos.some(x=>x.medio==='transferencia'))return null;
 const pagos=canon([...productos,{medio:'efectivo',monto:p.envio}]);
 return {storeId:sucursales[p.suc],id:p.cartaSolicitudRemotaId,pedidoInterno:String(p.id),montoDelivery:p.envio,pagos};
}
export function aplicarRectificacion(p,{constanciaId,motivo,en=new Date().toISOString()}={}){
 const plan=datosRectificables(p);
 if(!plan||!UUID.test(constanciaId||'')||typeof motivo!=='string'||motivo.trim().length<8||
    motivo.trim().length>240||!Number.isFinite(Date.parse(en)))throw Error('Rectificación incompleta');
 return {...p,medioEnvio:'Efectivo',
  ...(p.pagosEnvio?.length?{pagosEnvio:p.pagosEnvio.map(x=>({...x,medio:'Efectivo'}))}:{}),
  rectificacionTransferenciaDeliveryV1:{id:constanciaId,motivo:motivo.trim(),en,monto:p.envio}};
}
export function comprobarRectificacionLocal(prev,next){
 const plan=datosRectificables(prev),proof=next?.rectificacionTransferenciaDeliveryV1;
 if(!plan||!proof||proof.monto!==plan.montoDelivery)return null;
 try{
  const esperado=aplicarRectificacion(prev,{constanciaId:proof.id,motivo:proof.motivo,en:proof.en});
  if(!equal(esperado,next))return null;
 }catch{return null;}
 return {...plan,constanciaId:proof.id,total:prev.total};
}
export function coincideConstancia(plan,result){
 if(!plan||result?.ok!==true||result.permitido!==true||result.sinEnlaceAnterior===true||
    result.storeId!==plan.storeId||result.orderId!==plan.id||result.pedidoInterno!==plan.pedidoInterno||
    result.total!==plan.total||result.montoTransferencia!==0||
    result.rectificacion?.id!==plan.constanciaId||result.rectificacion?.monto!==plan.montoDelivery)
  return false;
 try{return equal(canon(result.rectificacion.pagos),plan.pagos)}catch{return false;}
}
