/**
 * Romo QA · confirma una cuenta por cobrar SOLO después de que se reciba el
 * pago real. Copia del estado, registro auditable y CAS cifrado en Neon.
 * No se conecta a cajas Uki, no registra pagos de prueba, ni cobra por sí solo.
 */
import {efectosEnCopia} from './uki-romo-pedido-formato-qa.mjs';
export const ROMO_COBRO_PENDIENTE_HABILITADO_QA=false;
const SUC='Romo’s Sushi La Serena';
const METODOS=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const METODOS_ENVIO=METODOS.filter(x=>!['Uber Eats','PedidosYa','Rappi'].includes(x));
const need=(v,msg)=>{if(!v)throw Error(msg)};
const num=(x,min,max,msg)=>{
 const n=Number(x);
 need(x!==''&&x!==null&&x!==undefined&&Number.isSafeInteger(n)&&n>=min&&n<=max,msg);
 return n;
};
function mediosConfirmados({lineas,medio,total,permitidos,nombre}){
 if(total===0){
  need(!lineas?.length,'No se debe cobrar '+nombre+' inexistente');
  return {medio:'Efectivo',lineas:[]};
 }
 if(Array.isArray(lineas)&&lineas.length){
  need(lineas.length>=2&&lineas.length<=6,'Pago mixto '+nombre+' inválido');
  const pasos=lineas.map(x=>({
   medio:String(x?.medio||''),
   monto:num(x?.monto,1,100000000,'Importe mixto '+nombre+' inválido')
  }));
  need(pasos.every(x=>permitidos.includes(x.medio)),'Medio mixto '+nombre+' no permitido');
  need(pasos.reduce((s,x)=>s+x.monto,0)===total,
   'Los pagos mixtos de '+nombre+' no cuadran con la cuenta');
  return {medio:pasos[0].medio,lineas:pasos};
 }
 need(permitidos.includes(medio),'Medio de '+nombre+' no permitido');
 return {medio,lineas:[]};
}
export class RomoCobroInciertoQA extends Error{
 constructor(){super('No se confirmó el cobro. Consulta Neon y Caja antes de repetir.');
  this.code='ROMO_COBRO_REVISAR_NEON';}
}
export class RomoCobroConfirmadoReleerQA extends Error{
 constructor(){super('Neon confirmó el cobro pero cambió la pantalla: recarga sin repetir.');
  this.code='ROMO_COBRO_CONFIRMADO_RELEER';}
}
export function prepararCobroPendienteRomoQA(estado,{
 pedidoId,responsable,registradoEn,confirmoRecepcion=false,
 medioProductos='Efectivo',medioEnvio='Efectivo',
 pagosProductos=[],pagosEnvio=[]
}={}){
 need(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
  Array.isArray(estado.propinas)&&Array.isArray(estado.cierres)&&
  estado.cajasDiarias&&typeof estado.cajasDiarias==='object'&&
  estado.clientes&&typeof estado.clientes==='object',
  'Falta el estado aislado de Romo');
 need(estado.pedidos.every(p=>p?.suc===SUC),'El estado contiene pedidos de otra sucursal');
 need(confirmoRecepcion===true,'El pago no está confirmado como recibido realmente');
 const id=num(pedidoId,1,100000000,'Número de pedido inválido');
 const actor=String(responsable??'').trim();
 need(actor.length>=2&&actor.length<=80,'Indica el responsable del cobro');
 const stamp=num(registradoEn,1,8640000000000000,'Fecha de cobro inválida');
 const p=estado.pedidos.find(x=>x.id===id&&x.suc===SUC);
 need(p&&['Pendiente','Entregado'].includes(p.estado)&&!p.esPremio,
  'El pedido no admite cobro');
 need(!/^QA-ROMO-/i.test(String(p.codigoCarta||''))&&
  String(p.cliente||'').trim().toUpperCase()!=='PRUEBA INTERNA NO CLIENTE',
  'Prohibido registrar cobros de pedidos ficticios');
 need(p.pagado===false&&!p.productosPagadosOtroLocal&&!p.envioPagadoOtroLocal&&
  !(p.pagosProductos||[]).length&&!(p.pagosEnvio||[]).length,
  'Pedido ya pagado, parcial o con cobro externo: requiere conciliación');
 need(typeof p.turnoClave==='string'&&/^\d{4}-\d{2}-\d{2}@\d+$/.test(p.turnoClave),
  'Turno de pedido inválido');
 const dia=p.turnoClave.slice(0,10),caja=estado.cajasDiarias[SUC+'|'+dia];
 need(caja?.turnoAbierto===true&&caja.turnoId===p.turnoClave,
  'La caja de este turno no está abierta');
 need(!estado.cierres.some(c=>c.suc===SUC&&c.turnoClave===p.turnoClave),
  'El turno ya tiene cierre');
 const productos=Array.isArray(p.productos)?p.productos:[];
 need(productos.length>0&&productos.every(x=>Number.isSafeInteger(Number(x.cantidad))&&
   Number(x.cantidad)>0&&Number.isSafeInteger(Number(x.precioUnit))&&Number(x.precioUnit)>0),
  'Productos originales inválidos');
 const subtotal=num(p.subtotal,1,100000000,'Subtotal inválido');
 need(productos.reduce((a,x)=>a+Number(x.cantidad)*Number(x.precioUnit),0)===subtotal,
  'El subtotal no coincide con los productos');
 const envio=p.modalidad==='Delivery'?num(p.envio,0,100000000,'Delivery inválido'):0;
 need(p.modalidad==='Delivery'||Number(p.envio||0)===0,'Entrega sin delivery cobrado');
 const propina=num(p.propina??0,0,100000000,'Propina inválida');
 need(num(p.total,1,100000000,'Total inválido')===subtotal+envio+propina,
  'El pedido no cuadra; revisar antes de cobrar');
 need(p.historialCambios===undefined||Array.isArray(p.historialCambios),
  'Historial del pedido inválido');
 const prod=mediosConfirmados({lineas:pagosProductos,medio:medioProductos,
  total:subtotal,permitidos:METODOS,nombre:'productos'});
 const del=mediosConfirmados({lineas:pagosEnvio,medio:medioEnvio,
  total:envio,permitidos:METODOS_ENVIO,nombre:'delivery'});
 p.pagado=true;p.medio=prod.medio;p.medioEnvio=del.medio;
 p.pagosProductos=prod.lineas;p.pagosEnvio=del.lineas;
 p.cobroConfirmadoEn=new Date(stamp).toISOString();
 p.cobroConfirmadoPor=actor;
 const evento={tipo:'cobro_pendiente',fecha:p.cobroConfirmadoEn,
  responsable:actor,anterior:{pagado:false},nuevo:{pagado:true,
   total:p.total,medioProductos:prod.medio,medioEnvio:del.medio,
   pagosProductos:prod.lineas,pagosEnvio:del.lineas}};
 p.historialCambios=[...(p.historialCambios||[]),evento].slice(-100);
 // Misma contabilidad auxiliar de cliente/propina que el pedido pagado de Romo.
 efectosEnCopia(estado,p,stamp);
 return Object.freeze({pedidoId:id,total:p.total,revisionNecesaria:true,
  responsable:actor,medioProductos:prod.medio,medioEnvio:del.medio});
}
export function crearGuardadoCobroRomoQA({
 habilitado=ROMO_COBRO_PENDIENTE_HABILITADO_QA,
 servidor,estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado
}={}){
 let busy=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor.guardarSobreCifrado==='function';
 return Object.freeze({
  disponible,
  async confirmar(datos){
   need(disponible(),'Cobro de Romo deshabilitado');
   need(!busy,'Ya se está confirmando un cobro Romo');
   need([estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado].every(
    fn=>typeof fn==='function'),'Faltan conexiones cifradas');
   const visible=estadoVisible(),rev=visible?.revision;
   need(Number.isSafeInteger(rev)&&rev>=0&&validarEstado(visible?.estado,SUC),
    'Primero abre el estado de Romo');
   busy=true;
   try{
    const original=JSON.stringify(visible.estado),copia=JSON.parse(original);
    const cobro=prepararCobroPendienteRomoQA(copia,datos);
    need(validarEstado(copia,SUC),'Cobro incompatible con el estado Romo');
    const intacto=()=>{
     const v=estadoVisible();
     return v?.revision===rev&&JSON.stringify(v?.estado)===original;
    };
    need(intacto(),'El estado de Romo cambió antes del guardado');
    const snapshot=await cifrarEstado(copia);
    need(snapshot?.sucursal===SUC&&snapshot?.formato==='uki-v813-browser',
     'El respaldo no corresponde a Romo');
    need(intacto(),'El estado de Romo cambió durante el cifrado');
    let resultado;
    try{resultado=await servidor.guardarSobreCifrado({snapshot,revision:rev})}
    catch{throw new RomoCobroInciertoQA()}
    if(resultado?.revision!==rev+1)throw new RomoCobroInciertoQA();
    if(!intacto())throw new RomoCobroConfirmadoReleerQA();
    try{await aplicarConfirmado({estado:copia,revision:resultado.revision,cobro})}
    catch{throw new RomoCobroConfirmadoReleerQA()}
    return Object.freeze({ok:true,revision:resultado.revision,cobro});
   }finally{busy=false;}
  }
 });
}
