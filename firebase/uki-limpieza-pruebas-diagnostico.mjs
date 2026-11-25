/* Diagnóstico de limpieza de pruebas: solo lectura, sin llamadas de red.
 * No habilita eliminación ni reemplaza la autorización del dueño.
 * Ejecutar sobre una copia descifrada de la revisión vigente, en la sesión autorizada.
 */
export function revisarPedidosPrueba({estado,seleccion,estaCerrado,esDelTurno}){
 if(estado?.suc!=="Uki Regimiento Arica")throw Error("Solo se admite Uki Regimiento");
 if(!Array.isArray(estado.pedidos)||!Array.isArray(seleccion)||!seleccion.length||
    typeof estaCerrado!=="function"||typeof esDelTurno!=="function")throw Error("Falta revisión");
 const ids=new Set();
 const filas=seleccion.map(({id,codigoCarta})=>{
  const n=Number(id);
  if(!Number.isSafeInteger(n)||n<1||ids.has(n)||!String(codigoCarta??"").trim())throw Error("Selección inválida");
  ids.add(n);
  const coincidencias=estado.pedidos.filter(p=>p.suc===estado.suc&&Number(p.id)===n);
  if(coincidencias.length!==1||String(coincidencias[0].codigoCarta??"").trim()!==String(codigoCarta).trim())
   return {id:n,estado:"No identificado",bloqueado:true};
  const p=coincidencias[0];
  const vinculos={};
  for(const clave of ["propinas","incidencias","deliveriesManuales","gastos","retiros","ajustesHistoricos"]){
   if(estado[clave]!==undefined&&!Array.isArray(estado[clave]))throw Error("Formato de estado inesperado");
   vinculos[clave]=(estado[clave]||[]).filter(x=>x.suc===estado.suc&&Number(x.pedidoId)===n).length;
  }
  const bloqueos=[];
  if(estaCerrado(p)||!esDelTurno(p))bloqueos.push("Cierre o turno anterior");
  if(p.pagado||p.ajusteCobroPendiente||p.correccionesTurno?.length)bloqueos.push("Revisar cobro y correcciones");
  if(p.estado!=="Cancelado")bloqueos.push("Todavía no cancelado");
  if(p.esPremio||p.qrSolicitudes?.length||p.cartaSolicitudRemotaId||p.codigoCarta)bloqueos.push("Revisar vínculos externos y timbres");
  if(Object.values(vinculos).some(Boolean))bloqueos.push("Movimientos vinculados");
  return {id:n,codigoCarta:String(p.codigoCarta),estado:p.estado,pagado:!!p.pagado,
   importe:Number(p.total)||0,vinculos,bloqueos,bloqueado:bloqueos.length>0};
 });
 return {sucursal:estado.suc,soloLectura:true,pedidos:filas};
}
