/**
 * Romo La Serena: edición de pedido pendiente SIN cobro, con auditoría.
 * Conservar identificadores, solicitud, folio, timbre y caja. No permite
 * editar ventas pagadas ni turnos cerrados sin conciliación financiera.
 */
export const ROMO_EDICION_PENDIENTE_HABILITADA_QA=false;
const SUC='Romo’s Sushi La Serena';
const check=(b,m)=>{if(!b)throw Error(m)};
const text=(x,n,m)=>{
 const v=String(x??'').trim();check(v.length>=1&&v.length<=n,m);return v;
};
const integer=(x,min,max,label)=>{
 check(x!==''&&x!==null&&x!==undefined&&
  Number.isSafeInteger(Number(x))&&Number(x)>=min&&Number(x)<=max,
  label+' inválido');
 return Number(x);
};
export class RomoEdicionInciertaQA extends Error{
 constructor(){super('No se confirmó la edición. Revisa Neon y el historial antes de repetir.');
  this.code='ROMO_EDICION_REVISAR_NEON';}
}
export class RomoEdicionConfirmadaReleerQA extends Error{
 constructor(){super('Neon guardó la edición pero la pantalla cambió; recarga sin repetir.');
  this.code='ROMO_EDICION_CONFIRMADA_RECARGAR';}
}
export function prepararEdicionPendienteRomoQA(estado,{
 pedidoId,responsable,motivo,registradoEn,productos,envio
}={}){
 check(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
  Array.isArray(estado.cierres)&&Array.isArray(estado.propinas)&&
  estado.cajasDiarias&&typeof estado.cajasDiarias==='object',
  'Estado ajeno a Romo La Serena');
 const id=integer(pedidoId,1,100000000,'Pedido'),actor=text(responsable,80,'Responsable obligatorio'),
  razon=text(motivo,300,'Motivo obligatorio');
 check(razon.length>=4,'Escribe el motivo de la modificación');
 check(Number.isSafeInteger(registradoEn)&&registradoEn>0,'Fecha de edición inválida');
 const p=estado.pedidos.find(x=>x?.id===id&&x.suc===SUC);
 check(p&&p.estado==='Pendiente'&&!p.esPremio,'Solo editar pedido Romo pendiente');
 check(p.pagado!==true&&!p.productosPagadosOtroLocal&&!p.envioPagadoOtroLocal&&
  !p.timbreEnviadoEn&&!p.timbreEnviadoPor&&
  !(p.timbreEventos||[]).some(x=>x.tipo==='declarado_enviado')&&
  !((p.pagosProductos||[]).length||(p.pagosEnvio||[]).length) &&
  !estado.propinas.some(x=>x?.pedidoId===id),
  'Pedido con pago, propina o timbre: requiere conciliación');
 check(Number(p.propina||0)===0,'La propina requiere conciliación');
 check(typeof p.turnoClave==='string'&&p.turnoClave.length>=6,
  'Falta identificar el turno original');
 check(!estado.cierres.some(x=>x?.suc===SUC&&x.turnoClave===p.turnoClave),
  'Turno ya cerrado: no se puede alterar el pedido');
 const fecha=p.turnoClave.slice(0,10);
 const caja=estado.cajasDiarias[SUC+'|'+fecha];
 check(caja?.turnoAbierto===true&&caja.turnoId===p.turnoClave,
  'Solo editar dentro del turno Romo abierto y confirmado');
 const antiguos=p.productos;
 check(Array.isArray(antiguos)&&antiguos.length>0&&antiguos.length<=80&&
  Array.isArray(productos)&&productos.length===antiguos.length,
  'Revisa todos los productos; no se permite omitir ninguno');
 const nuevos=productos.map((x,i)=>({
  ...antiguos[i],
  nombre:text(x?.nombre,100,'Nombre del producto obligatorio'),
  cantidad:integer(x?.cantidad,1,100,'Cantidad del producto'),
  precioUnit:integer(x?.precioUnit,1,1000000,'Precio unitario'),
  detalle:String(x?.detalle??'').trim().slice(0,12000)
 }));
 check(productos.every(x=>String(x?.detalle??'').length<=12000),
  'Detalle de armado demasiado largo');
 const subtotal=nuevos.reduce((s,x)=>s+x.cantidad*x.precioUnit,0);
 check(Number.isSafeInteger(subtotal)&&subtotal>0&&subtotal<=100000000,
  'El subtotal no es válido');
 const envioNuevo=p.modalidad==='Delivery'?
  integer(envio,0,100000,'Delivery'):
  integer(envio,0,0,'Sin delivery');
 const total=subtotal+envioNuevo;
 check(Number.isSafeInteger(total)&&total<=100000000,'Total fuera de rango');
 const previo={productos:structuredClone(antiguos),subtotal:p.subtotal,envio:p.envio,total:p.total};
 const proximo={productos:structuredClone(nuevos),subtotal,envio:envioNuevo,total};
 check(JSON.stringify(previo)!==JSON.stringify(proximo),
  'No hay cambios para guardar');
 check(p.historialCambios===undefined||Array.isArray(p.historialCambios),
  'Historial de cambios inválido');
 p.productos=nuevos;p.subtotal=subtotal;p.envio=envioNuevo;p.total=total;
 const fechaISO=new Date(registradoEn).toISOString();
 const evento={tipo:'edicion_pedido_sin_pago',fecha:fechaISO,responsable:actor,
  motivo:razon,anterior:previo,nuevo:proximo};
 p.historialCambios=[...(p.historialCambios||[]),evento].slice(-100);
 return Object.freeze({pedidoId:id,responsable:actor,motivo:razon,
  totalAnterior:previo.total,totalNuevo:total});
}
export function crearGuardadoEdicionRomoQA({
 habilitado=ROMO_EDICION_PENDIENTE_HABILITADA_QA,
 servidor,estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado
}={}){
 let busy=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor.guardarSobreCifrado==='function';
 return Object.freeze({
  disponible,
  async editar(datos){
   check(disponible(),'Edición Romo no habilitada');
   check(!busy,'Ya hay una edición en curso');
   check([estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado].every(
    fn=>typeof fn==='function'),'Falta conexión del panel');
   const visible=estadoVisible(),revision=visible?.revision;
   check(Number.isSafeInteger(revision)&&revision>=0&&
    validarEstado(visible?.estado,SUC),'Primero carga el estado Romo');
   busy=true;
   try{
    const original=JSON.stringify(visible.estado),copia=JSON.parse(original);
    const cambio=prepararEdicionPendienteRomoQA(copia,datos);
    check(validarEstado(copia,SUC),'Edición de otra sucursal');
    const intacto=()=>{
     const now=estadoVisible();
     return now?.revision===revision&&JSON.stringify(now.estado)===original;
    };
    check(intacto(),'El pedido cambió antes del guardado');
    const snapshot=await cifrarEstado(copia);
    check(snapshot?.sucursal===SUC&&snapshot?.formato==='uki-v813-browser',
     'Falta cifrado seguro de Romo');
    check(intacto(),'El pedido cambió durante el cifrado');
    let confirmed;
    try{confirmed=await servidor.guardarSobreCifrado({snapshot,revision})}
    catch{throw new RomoEdicionInciertaQA()}
    if(confirmed?.revision!==revision+1)throw new RomoEdicionInciertaQA();
    if(!intacto())throw new RomoEdicionConfirmadaReleerQA();
    try{await aplicarConfirmado({estado:copia,revision:confirmed.revision,cambio})}
    catch{throw new RomoEdicionConfirmadaReleerQA()}
    return Object.freeze({ok:true,revision:confirmed.revision,cambio});
   }finally{busy=false}
  }
 });
}
