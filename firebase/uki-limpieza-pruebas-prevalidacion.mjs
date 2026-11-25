/* Prevalidación de retiro de pruebas. Sin red, sin escrituras, sin acceso de dueño implícito.
 * El servidor y la sesión del dueño deberán autorizar por separado cualquier operación.
 * No se publican ni se incluyen identificadores de pedidos reales en este módulo.
 */
const SUC='Uki Regimiento Arica', UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function diagnosticarRetiroPruebas({estado,seleccion,solicitudes,revision,estaCerrado}={}){
 if(estado?.suc!==SUC||!Number.isSafeInteger(revision)||revision<1||
  !Array.isArray(estado.pedidos)||!Array.isArray(seleccion)||!seleccion.length||
  !Array.isArray(solicitudes)||typeof estaCerrado!=='function')throw Error('Falta copia autorizada de Regimiento');
 const ids=new Set(),remotos=new Set();
 const filas=seleccion.map(({id,codigoCarta,solicitudId})=>{
  if(!Number.isSafeInteger(id)||id<1||ids.has(id)||!UUID.test(String(solicitudId))||remotos.has(solicitudId)||
   typeof codigoCarta!=='string'||!codigoCarta.trim())throw Error('Identidad inválida o duplicada');
  ids.add(id);remotos.add(solicitudId);
  const pp=estado.pedidos.filter(p=>p.suc===SUC&&Number(p.id)===id);
  const rr=solicitudes.filter(r=>r.branch==='arica'&&String(r.id)===solicitudId);
  const p=pp[0],r=rr[0],bloqueos=[];
  if(pp.length!==1||String(p?.codigoCarta)!==codigoCarta||String(p?.cartaSolicitudRemotaId)!==solicitudId)
   bloqueos.push('Pedido local no identificado de forma inequívoca');
  if(rr.length!==1||String(r?.pedidoInterno)!==String(id)||String(r?.codigoCarta)!==codigoCarta||r?.estadoSolicitud!=='aceptada')
   bloqueos.push('Solicitud de carta no identificada de forma inequívoca');
  if(p){
   if(p.estado!=='Cancelado'||p.pagado!==false||!p.canceladoEn)bloqueos.push('Cancelación local no confirmada');
   if(estaCerrado(p)!==false)bloqueos.push('Cierre histórico o desconocido');
   if(p.esPremio||p.qrSolicitudes?.length||p.ajusteCobroPendiente||p.correccionesTurno?.length||
    p.timbreEnviadoEn||p.productosPagadosOtroLocal||p.envioPagadoOtroLocal||
    Number(p.propina||0)!==0||p.pagosProductos?.length||p.pagosEnvio?.length)
    bloqueos.push('Vínculo financiero, QR o timbre pendiente de revisión');
   for(const k of ['propinas','incidencias','deliveriesManuales','gastos','retiros','ajustesHistoricos']){
    if(!Array.isArray(estado[k]))bloqueos.push('No se pudo revisar '+k);
    else if(estado[k].some(x=>Number(x.pedidoId)===id))bloqueos.push('Vínculo en '+k);
   }
  }
  if(r?.estadoGuardado!=='Cancelado'||r?.pagado!==false)bloqueos.push('Carta sin cancelación respaldada');
  if(r?.abonoVerificado!==false||r?.transferenciaConfirmada!==false||r?.estadoPago==='confirmada')
   bloqueos.push('Verificación bancaria previa o desconocida: conciliar antes de retirar');
  return Object.freeze({id,codigoCarta,bloqueos:Object.freeze(bloqueos),apto:bloqueos.length===0});
 });
 return Object.freeze({sucursal:SUC,revision,soloLectura:true,apto:filas.every(x=>x.apto),filas:Object.freeze(filas)});
}
