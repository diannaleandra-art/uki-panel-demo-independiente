export const SUCURSAL='Uki Regimiento Arica';
export const PEDIDOS=Object.freeze([655,656,657,658,659,660,661,662,663]);
const FOLIOS_CAPTURA=Object.freeze(['413','977','980','156']);
// Estos son los únicos seis envíos de prueba señalados en el diagnóstico de Regimiento.
const TIMBRES_PRUEBA=new Set([655,656,659,660,662,663]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const estr=x=>String(x??'').trim();
const exigir=(ok,msg)=>{if(!ok)throw Error(msg);};
// La partición cifrada reagrupa las claves de los objetos, no las filas de los pedidos.
// Normalizar su orden permite comparar el contenido sin ignorar valores ni listas.
export function mismaHuellaRegimiento(local,nube){
 if(typeof local!=='string'||typeof nube!=='string')return false;
 const ordenar=x=>JSON.stringify(JSON.parse(x),(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
  Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 return local===nube||ordenar(local)===ordenar(nube);
}
function bloqueosRetiro(p,aclaracion=aclaracionPruebaSinCobro(p)){
 return [
  [p.esPremio,'pedido marcado como premio'],[p.qrSolicitudes?.length,'vínculo con mesa QR'],
  [p.timbreEnviadoEn&&!aclaracion,'timbre marcado como enviado'],[p.ajusteCobroPendiente,'registro de ajuste de cobro'],
  [p.correccionesTurno?.length&&!aclaracion,'corrección de turno sin una aclaración verificable de que no se recibió dinero'],[p.correccionesHistoricas?.length,'corrección histórica'],
  [Number(p.propina||0),'propina registrada'],[p.pagosProductos?.length,'desglose de medios para productos'],
  [p.pagosEnvio?.length,'desglose de medios para delivery'],[p.productosPagadosOtroLocal,'productos marcados como pagados en otro local'],
  [p.envioPagadoOtroLocal,'delivery marcado como pagado en otro local'],[p.transferenciaManualQA,'registro de revisión de transferencia'],
  [p.cobroConfirmadoEn,'marca de cobro confirmado'],[p.pagoConfirmadoEn,'marca de pago confirmado']
 ].filter(([activo])=>activo).map(([,texto])=>texto);
}
function aclaracionPruebaSinCobro(p){
 const cambios=p.correccionesTurno;
 if(!TIMBRES_PRUEBA.has(Number(p.id))||p.suc!==SUCURSAL||p.pagado!==false||p.estado!=='Cancelado'||
    !Number.isFinite(Date.parse(p.timbreEnviadoEn))||!Array.isArray(cambios)||!cambios.length)return null;
 // Una devolución, cobro adicional o conciliación QR no es equivalente a «nunca se recibió».
 const ultimo=cambios.at(-1);
 if(ultimo?.accion!=='pago_erroneo_no_cobrado'||ultimo.saldoPendiente!==0||
    ultimo.antes?.pagado!==false||ultimo.despues?.pagado!==false||ultimo.despues?.estado!=='Cancelado'||
    !Number.isSafeInteger(ultimo.importe)||ultimo.importe<=0||!estr(ultimo.responsable)||
    !Number.isFinite(Date.parse(ultimo.fechaISO))||ultimo.conciliacionQRManual||ultimo.cobroRecibidoQR)return null;
 const recibido=ultimo.recibidoRegistrado;
 if(!recibido||typeof recibido!=='object'||Array.isArray(recibido)||
    Object.values(recibido).some(n=>!Number.isSafeInteger(n)||n<0)||
    Object.values(recibido).reduce((a,b)=>a+b,0)!==ultimo.importe)return null;
 if(!cambios.slice(0,-1).every(c=>c?.antes&&c?.despues&&!c.accion&&!c.conciliacionQRManual&&!c.cobroRecibidoQR&&
    !c.recibidoRegistrado&&(c.saldoPendiente===0||
     (c.antes.pagado===true&&c.despues.pagado===false&&c.saldoPendiente===ultimo.importe))))return null;
 return {timbrePruebaMarcadoEn:p.timbreEnviadoEn,aclaradoEn:ultimo.fechaISO,aclaradoPor:estr(ultimo.responsable),
  importeMarcadoPorError:ultimo.importe,accion:ultimo.accion};
}
export function diagnosticarRetiroRegimiento(estado,revisarCierre=()=>false){
 exigir(estado?.suc===SUCURSAL&&Array.isArray(estado.pedidos),'Primero carga la nube de Regimiento.');
 return PEDIDOS.flatMap(id=>{
  const filas=estado.pedidos.filter(p=>p?.suc===SUCURSAL&&Number(p.id)===id);
  if(filas.length!==1)return [`Pedido ${id}: ${filas.length?'duplicado':'no está en esta copia'}`];
  const p=filas[0],motivos=bloqueosRetiro(p);
  if(p.estado!=='Cancelado')motivos.unshift('no figura como cancelado');
  if(p.pagado!==false)motivos.unshift('no figura como impago');
  if(revisarCierre(p)!==false)motivos.push('asociado a un cierre');
  return motivos.length?[`Pedido ${id}: ${motivos.join(', ')}`]:[];
 });
}
export function planRegimiento(estado,revisarCierre=()=>false){
 exigir(estado?.suc===SUCURSAL&&Array.isArray(estado.pedidos)&&Number.isSafeInteger(estado.nextId)&&estado.nextId>663,'No es el respaldo sincronizado de Regimiento.');
 const marcas=estado.pedidosPruebaRetirados||[];
 exigir(Array.isArray(marcas),'Las marcas anteriores requieren revisión.');
 const lista=estado.pedidos.filter(p=>p.suc===SUCURSAL&&PEDIDOS.includes(Number(p.id)));
 if(!lista.length&&PEDIDOS.every(id=>marcas.some(m=>m.suc===SUCURSAL&&m.id===id)))return {hecho:true,filas:[]};
 exigir(lista.length===9&&PEDIDOS.every(id=>lista.filter(p=>Number(p.id)===id).length===1),'No se identificaron los nueve pedidos juntos. No se modificó nada.');
 exigir(FOLIOS_CAPTURA.every(code=>lista.some(p=>estr(p.codigoCarta)===code)),'Los folios no coinciden con la captura de Regimiento.');
 exigir(new Set(lista.map(p=>p.cartaSolicitudRemotaId)).size===9,'Hay solicitudes duplicadas.');
 const refs=new Set(lista.map(p=>p.cartaSolicitudRemotaId));
 const relacionados=x=>{
  if(!x||typeof x!=='object')return false;
  if(Array.isArray(x))return x.some(relacionados);
  return Object.entries(x).some(([k,v])=>
   (/^(pedidoId|idPedido|pedido_interno|pedidoInterno)$/i.test(k)&&PEDIDOS.includes(Number(v)))||
   (/^(solicitudId|cartaSolicitudRemotaId|seguimientoSolicitudId)$/i.test(k)&&refs.has(v))||
   (v&&typeof v==='object'&&relacionados(v)));
 };
 for(const k of ['gastos','retiros','propinas','incidencias','deliveriesManuales','ajustesHistoricos','cierres','clientes','cajasDiarias','solicitudesWhatsApp','borradores']){
  exigir((estado[k]===undefined||estado[k]&&typeof estado[k]==='object')&&!relacionados(estado[k]),'Hay un registro vinculado en '+k+'. No se modificó nada.');
 }
 exigir(!estado.pedidos.some(p=>!lista.includes(p)&&refs.has(p.cartaSolicitudRemotaId)),'Una solicitud también está vinculada a otro pedido.');
 const filas=lista.map(p=>{
  const n=Number(p.id),codigo=estr(p.codigoCarta),total=Number(p.total);
  exigir(/^\d{3}$/.test(codigo)&&UUID.test(p.cartaSolicitudRemotaId)&&Number.isSafeInteger(total)&&total>0,
   'No se pudo comprobar la identidad del pedido '+n+'.');
  exigir(p.pagado===false&&p.estado==='Cancelado'&&Number.isFinite(Date.parse(p.canceladoEn)),
   'El pedido '+n+' no figura como cancelado sin pago.');
  const aclaracion=aclaracionPruebaSinCobro(p),bloqueos=bloqueosRetiro(p,aclaracion);
  exigir(!bloqueos.length,'No se retiró ningún pedido. Pedido '+n+': '+bloqueos.join(', ')+'.');
  exigir(revisarCierre(p)===false,'El pedido '+n+' está asociado a un cierre.');
  return {id:n,suc:SUCURSAL,codigoCarta:codigo,cartaSolicitudRemotaId:p.cartaSolicitudRemotaId,
   numeroTurno:p.numeroTurno,turnoClave:p.turnoClave,registradoEn:p.registradoEn,fechaISO:p.fechaISO,total,
   ...(aclaracion?{aclaracionSinCobro:aclaracion}:{})};
 }).sort((a,b)=>a.id-b.id);
 return {filas,hecho:false};
}
export function prepararRetiroRegimiento({estado,consultas,revision,identidad,fecha,revisarCierre}={}){
 const plan=planRegimiento(estado,revisarCierre);
 if(plan.hecho)return {hecho:true,estado};
 exigir(Number.isSafeInteger(revision)&&revision>0&&estr(identidad)&&Number.isFinite(Date.parse(fecha)),'Falta sesión de dueños, revisión o fecha.');
 exigir(Array.isArray(consultas)&&consultas.length===9,'No se verificaron los nueve pedidos de la carta.');
 for(const f of plan.filas){
  const filas=consultas.filter(x=>x.orderId===f.cartaSolicitudRemotaId);
  const x=filas[0];
  exigir(filas.length===1&&x.storeId==='uki:arica'&&String(x.pedidoInterno)===String(f.id)&&
   x.codigoCarta===f.codigoCarta&&x.total===f.total&&x.estadoPedido==='cancelada'&&
   x.estadoPago==='sin_transferencia'&&x.pagoRegistrado===false&&x.montoTransferencia===0,
   'La carta no confirma un pedido cancelado sin pago para Carta #'+f.codigoCarta+'.');
 }
 const candidato=JSON.parse(JSON.stringify(estado));
 candidato.pedidos=candidato.pedidos.filter(p=>!PEDIDOS.includes(Number(p.id))||p.suc!==SUCURSAL);
 candidato.pedidosPruebaRetirados=[...(candidato.pedidosPruebaRetirados||[]),...plan.filas.map(f=>{
  const {total,...identificadores}=f;
  return {...identificadores,revision,retiradoEn:fecha,retiradoPor:estr(identidad)};
 })];
 return {hecho:false,estado:candidato,filas:plan.filas};
}

