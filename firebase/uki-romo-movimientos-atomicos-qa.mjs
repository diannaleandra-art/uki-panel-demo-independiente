/**
 * Movimientos Romo con el formato Uki: modificar copia, cifrar, escribir CAS,
 * mostrar solo después del resultado Neon. Sin cambio del estado Uki.
 */
export const ROMO_MOVIMIENTOS_CAJA_QA_HABILITADOS=false;
const SUC='Romo’s Sushi La Serena';
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const check=(x,msg)=>{if(!x)throw Error(msg)};
const monto=(x,nombre)=>{
 const v=Number(x);
 check(x!==null&&x!==undefined&&x!==''&&Number.isSafeInteger(v)&&
  v>0&&v<=100000000,'Monto inválido de '+nombre);
 return v;
};
const txt=(s,n,msg)=>{
 const v=String(s??'').trim();
 check(v.length>0&&v.length<=n,msg+' obligatorio');
 return v;
};
const base=(estado,datos,grupo)=>{
 check(estado?.suc===SUC&&Array.isArray(estado[grupo]),'Estado ajeno a Romo');
 const registradoEn=datos.registradoEn,fechaISO=datos.fechaISO;
 check(Number.isSafeInteger(registradoEn)&&registradoEn>0&&
  typeof fechaISO==='string'&&fechaISO.length>=16&&fechaISO.length<=32&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(fechaISO)&&
  Number.isFinite(Date.parse(fechaISO)),'Fecha inválida');
 check(!estado[grupo].some(x=>Number(x.id)===registradoEn),'Movimiento repetido');
 return {suc:SUC,id:registradoEn,registradoEn,fechaISO};
};
export function moverCajaRomoCandidatoQA(estado,{tipo,datos}={}){
 check(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&Array.isArray(estado.cierres),
  'Estado de otra sucursal');
 check(datos&&typeof datos==='object'&&!Array.isArray(datos),'Falta movimiento');
 if(tipo==='gasto'){
  const b=base(estado,datos,'gastos'),medio=txt(datos.medio,45,'Medio');
  check(MEDIOS.includes(medio),'Medio inválido');
  estado.gastos.push({...b,concepto:txt(datos.concepto,180,'Concepto'),
   monto:monto(datos.monto,'gasto'),medio});
  return {tipo,id:b.id};
 }
 if(tipo==='retiro'){
  const b=base(estado,datos,'retiros');
  estado.retiros.push({...b,monto:monto(datos.monto,'retiro'),
   motivo:txt(datos.motivo,180,'Motivo')});
  return {tipo,id:b.id};
 }
 if(tipo==='delivery_manual'){
  const b=base(estado,datos,'deliveriesManuales'),medio=txt(datos.medio,45,'Medio');
  check(MEDIOS.includes(medio),'Medio inválido');
  estado.deliveriesManuales.push({...b,monto:monto(datos.monto,'delivery'),
   cliente:String(datos.cliente||'').trim().slice(0,90),
   nota:String(datos.nota||'').trim().slice(0,240),medio});
  return {tipo,id:b.id};
 }
 if(tipo==='pago_repartidor'){
  const fechaOperativa=String(datos.fechaOperativa||'');
  check(/^\d{4}-\d{2}-\d{2}$/.test(fechaOperativa),'Día operativo inválido');
  const caja=estado.cajasDiarias?.[SUC+'|'+fechaOperativa];
  check(caja?.turnoAbierto===true,'Abre primero turno de repartos Romo');
  const registro=base(estado,datos,'deliveriesManuales');
  // No es un delivery MANUAL, ni se agrega al arreglo de ventas.
  const medio=txt(datos.medio,45,'Medio');
  check(MEDIOS.includes(medio),'Medio de pago a repartidor inválido');
  const tipoSaldo=String(datos.tipoSaldo||'');
  check(['dia','anterior'].includes(tipoSaldo),'Indica si es reparto del día o saldo anterior');
  const cantidad=monto(datos.monto,'pago repartidor');
  const key=tipoSaldo==='dia'?'pagoDeliveryDia':'pagoDeliveryAnterior';
  const medKey=tipoSaldo==='dia'?'pagoDeliveryMedioDia':'pagoDeliveryMedioAnterior';
  const anterior=Number(caja[key])||0;
  check(Number.isSafeInteger(anterior)&&anterior>=0,'Abono anterior inválido');
  check(anterior===0||caja[medKey]===medio,
   'Si cambia el medio, primero concilia el pago anterior');
  if(tipoSaldo==='dia'){
   const desde=Number(caja.inicioMs)||0;
   const porPedido=estado.pedidos.filter(p=>p?.suc===SUC&&
    p.modalidad==='Delivery'&&p.estado!=='Cancelado'&&!p.esPremio&&
    (Number(p.registradoEn)||Date.parse(p.fechaISO||''))>=desde)
    .reduce((sum,p)=>sum+(Number(p.envio)||0),0);
   const manual=estado.deliveriesManuales.filter(d=>d.suc===SUC&&
    (Number(d.registradoEn)||Date.parse(d.fechaISO||''))>=desde)
    .reduce((sum,d)=>sum+(Number(d.monto)||0),0);
   check(anterior+cantidad<=porPedido+manual,
    'El pago del día supera los deliverys registrados');
  }
  caja[key]=anterior+cantidad;caja[medKey]=medio;
  const movimiento={...registro,medio,monto:cantidad,tipoSaldo,
   concepto:String(datos.concepto||'').trim().slice(0,180)};
  if(!Array.isArray(caja.pagosRepartidor))caja.pagosRepartidor=[];
  check(!caja.pagosRepartidor.some(x=>x.id===movimiento.id),
   'Ese abono al repartidor ya existe');
  caja.pagosRepartidor.push(movimiento);
  if(tipoSaldo==='anterior')
   caja.pagoDeliveryConceptoAnterior=txt(datos.concepto,180,'Concepto saldo anterior');
  return {tipo,id:registro.id,tipoSaldo};
 }
 if(tipo==='propina_manual'){
  const b=base(estado,datos,'propinas');
  const pedidoId=Number(datos.pedidoId);
  check(Number.isSafeInteger(pedidoId)&&pedidoId>0,'Pedido de propina inválido');
  const p=estado.pedidos.find(x=>x?.suc===SUC&&x.id===pedidoId);
  check(p&&p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio,
   'Propina solo para pedido de Romo pagado y vigente');
  check(!estado.propinas.some(x=>x.pedidoId===pedidoId),
   'Ese pedido ya tiene propina registrada');
  const fecha=Number(p.registradoEn)||Date.parse(p.fechaISO||'');
  check(Number.isFinite(fecha)&&fecha>0,'No se pudo determinar la fecha del pedido');
  check(!estado.cierres.some(c=>
   (Number(c.fechaMs)||Date.parse(c.fechaISO||'')||0)>=fecha),
   'El pedido ya pertenece a un cierre definitivo');
  const medio=txt(datos.medio,45,'Medio');
  check(MEDIOS.includes(medio),'Medio inválido');
  estado.propinas.push({...b,monto:monto(datos.monto,'propina'),medio,
   concepto:txt(datos.concepto,180,'Concepto'),
   responsable:txt(datos.responsable,80,'Responsable'),
   pedidoId,codigoCarta:String(p.codigoCarta||'').slice(0,60),origen:'manual'});
  return {tipo,id:b.id,pedidoId};
 }
 throw Error('Acción de caja todavía no autorizada');
}
export class RomoMovimientoInciertoQA extends Error{
 constructor(message){super(message);this.code='ROMO_MOVIMIENTO_REVISAR_NEON'}
}
export class RomoMovimientoConfirmadoQA extends Error{
 constructor(){super('El movimiento fue confirmado pero cambió la pantalla. Recarga sin duplicarlo.');
  this.code='ROMO_MOVIMIENTO_CONFIRMADO_RECARGAR';}
}
export function crearGuardadoCajaRomoQA({
 habilitado=ROMO_MOVIMIENTOS_CAJA_QA_HABILITADOS,
 servidor,estadoVisible,cifrarEstado,validarEstado,aplicarConfirmado
}={}){
 let enCurso=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor.guardarSobreCifrado==='function';
 return Object.freeze({
  disponible,
  async guardar({tipo,datos}={}){
   check(disponible(),'Movimientos de caja Romo todavía no habilitados');
   check(!enCurso,'Ya hay un movimiento de caja en curso');
   check([estadoVisible,cifrarEstado,validarEstado,aplicarConfirmado].every(x=>
    typeof x==='function'),'Falta conexión del panel');
   const actual=estadoVisible(),revision=actual?.revision;
   check(Number.isSafeInteger(revision)&&revision>=0&&
    validarEstado(actual?.estado,SUC),'Primero abre la caja Romo en Neon');
   enCurso=true;
   try{
    const original=JSON.stringify(actual.estado);
    const copia=JSON.parse(original);
    const cambio=moverCajaRomoCandidatoQA(copia,{tipo,datos});
    check(validarEstado(copia,SUC),'Candidato de otra sucursal');
    const igual=()=>{
     const v=estadoVisible();
     return v?.revision===revision&&JSON.stringify(v.estado)===original;
    };
    check(igual(),'La caja cambió antes del cifrado');
    const sobre=await cifrarEstado(copia);
    check(sobre?.formato==='uki-v813-browser'&&sobre?.sucursal===SUC,
     'No se cifró el estado Romo');
    check(igual(),'La caja cambió antes del envío');
    let r;
    try{r=await servidor.guardarSobreCifrado({snapshot:sobre,revision})}
    catch(error){throw new RomoMovimientoInciertoQA(
     'Revisa la caja y el historial en Neon antes de intentar otra vez: '+String(error.message||error)
    )}
    check(r?.revision===revision+1,'Neon no confirmó la revisión solicitada');
    if(!igual())throw new RomoMovimientoConfirmadoQA();
    try{await aplicarConfirmado({estado:copia,revision:r.revision,cambio})}
    catch{throw new RomoMovimientoConfirmadoQA()}
    return Object.freeze({ok:true,revision:r.revision,cambio});
   }finally{enCurso=false}
  }
 });
}
