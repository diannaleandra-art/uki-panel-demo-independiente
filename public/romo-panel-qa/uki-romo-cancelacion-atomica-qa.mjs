/**
 * Romo La Serena: cancelar SOLO pedidos sin pago ni cierre, con motivo obligatorio.
 * Prohibido inferir devoluciones de dinero cuando no existió cobro.
 * Usa copia, AES-GCM y CAS en Neon, sin tocar Uki ni balances.
 */
export const ROMO_CANCELACION_HABILITADA_QA=false;
const SUC='Romo’s Sushi La Serena';
const fail=m=>{throw Error(m)};
export class RomoCancelacionInciertaQA extends Error{
 constructor(){super('Cancelación no confirmada: revisa Neon e Historial antes de repetir.');
  this.code='ROMO_CANCELACION_REVISAR_NEON';}
}
export class RomoCancelacionConfirmadaReleerQA extends Error{
 constructor(){super('La cancelación se guardó, pero cambió la pantalla; recarga sin repetir.');
  this.code='ROMO_CANCELACION_CONFIRMADA_RECARGAR';}
}
export function prepararCancelacionRomoQA(estado,{
 pedidoId,responsable,motivo,registradoEn
}={}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos)||
    !Array.isArray(estado.cierres)||!Array.isArray(estado.propinas))
  fail('El estado no pertenece a Romo La Serena');
 const id=Number(pedidoId),actor=String(responsable||'').trim(),razon=String(motivo||'').trim();
 if(!Number.isSafeInteger(id)||id<1)fail('Número de pedido inválido');
 if(actor.length<2||actor.length>80)fail('Indica quién cancela el pedido');
 if(razon.length<4||razon.length>300)fail('Motivo de cancelación obligatorio');
 if(!Number.isSafeInteger(registradoEn)||registradoEn<1||
    !Number.isFinite(new Date(registradoEn).getTime()))fail('Fecha de cancelación inválida');
 const pedido=estado.pedidos.find(p=>p?.id===id&&p.suc===SUC);
 if(!pedido||pedido.estado!=='Pendiente'||pedido.esPremio)
  fail('Solo se puede cancelar un pedido pendiente de Romo');
 // Si hubo cualquier cobro, necesita el flujo de reembolso y conciliación.
 if(pedido.pagado===true||pedido.productosPagadosOtroLocal||
    pedido.envioPagadoOtroLocal||
    (Array.isArray(pedido.pagosProductos)&&pedido.pagosProductos.length>0)||
    (Array.isArray(pedido.pagosEnvio)&&pedido.pagosEnvio.length>0)||
    estado.propinas.some(p=>p?.pedidoId===id))
  fail('Pedido con pagos: requiere conciliación antes de cancelar');
 if(estado.cierres.some(c=>c?.suc===SUC&&c.turnoClave===pedido.turnoClave))
  fail('El pedido pertenece a un turno ya cerrado');
 if(pedido.historialCambios!==undefined&&!Array.isArray(pedido.historialCambios))
  fail('Historial del pedido inválido');
 const momento=new Date(registradoEn).toISOString();
 pedido.estado='Cancelado';
 pedido.canceladoEn=momento;pedido.canceladoPor=actor;pedido.motivoCancelacion=razon;
 // En un pedido sin pago no inventamos una devolución pendiente ni movemos dinero.
 pedido.historialCambios=[...(pedido.historialCambios||[]),{
  tipo:'cancelacion',fecha:momento,responsable:actor,motivo:razon,
  anterior:'Pendiente',nuevo:'Cancelado'
 }].slice(-100);
 return Object.freeze({pedidoId:id,estado:'Cancelado',responsable:actor,motivo:razon});
}
export function crearGuardadoCancelacionRomoQA({
 habilitado=ROMO_CANCELACION_HABILITADA_QA,
 servidor,estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado
}={}){
 let ocupado=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor.guardarSobreCifrado==='function';
 return Object.freeze({
  disponible,
  async cancelar(datos){
   if(!disponible())fail('Cancelación Romo no habilitada');
   if(ocupado)fail('Ya existe una cancelación Romo en proceso');
   if([estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado]
     .some(f=>typeof f!=='function'))fail('Falta conectar el panel de Romo');
   const previo=estadoVisible(),revision=previo?.revision;
   if(!Number.isSafeInteger(revision)||revision<0||
      !validarEstado(previo?.estado,SUC))fail('Primero carga el estado Romo');
   ocupado=true;
   try{
    const original=JSON.stringify(previo.estado),copia=JSON.parse(original);
    const cambio=prepararCancelacionRomoQA(copia,datos);
    if(!validarEstado(copia,SUC))fail('Estado candidato Romo inválido');
    const intacto=()=>{
     const current=estadoVisible();
     return current?.revision===revision&&JSON.stringify(current.estado)===original;
    };
    if(!intacto())fail('Romo cambió antes de cancelar');
    const snapshot=await cifrarEstado(copia);
    if(snapshot?.sucursal!==SUC||snapshot?.formato!=='uki-v813-browser')
     fail('Cifrado Romo inválido');
    if(!intacto())fail('Romo cambió durante el cifrado');
    let confirmado;
    try{confirmado=await servidor.guardarSobreCifrado({snapshot,revision})}
    catch{throw new RomoCancelacionInciertaQA()}
    if(confirmado?.revision!==revision+1)throw new RomoCancelacionInciertaQA();
    if(!intacto())throw new RomoCancelacionConfirmadaReleerQA();
    try{await aplicarConfirmado({estado:copia,revision:confirmado.revision,cambio})}
    catch{throw new RomoCancelacionConfirmadaReleerQA()}
    return Object.freeze({ok:true,revision:confirmado.revision,cambio});
   }finally{ocupado=false}
  }
 });
}
