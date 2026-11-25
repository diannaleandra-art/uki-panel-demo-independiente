/* Planificador de archivo de pruebas; no tiene red, permisos ni escritura.
 * Mantiene el pedido original en el snapshot cifrado para conservar auditoría,
 * caja y conciliación de carta. Sólo añade marcas de visibilidad.
 * Integración obligatoria: sesión privada de dueños validada en servidor,
 * revisión vigente, respaldo y confirmación explícita antes de guardar.
 */
const copy=x=>JSON.parse(JSON.stringify(x));
const folio=x=>String(x??'').trim();
const sucursales=new Set(['Uki Regimiento Arica','Uki La Serena','Romo’s Sushi La Serena']);
export function planificarArchivoPruebas({estado,seleccion,solicitudes,revision}={}){
 if(!sucursales.has(estado?.suc)||!Number.isSafeInteger(revision)||revision<1||
    !Array.isArray(estado.pedidos)||!Array.isArray(seleccion)||seleccion.length<1||
    seleccion.length>50||!Array.isArray(solicitudes))throw Error('Falta verificación de sucursal y revisión');
 const ids=new Set(),marcas=estado.pedidosPruebaArchivados??[];
 if(!Array.isArray(marcas))throw Error('Archivo anterior inválido');
 const branch={'Uki Regimiento Arica':'arica','Uki La Serena':'serena','Romo’s Sushi La Serena':'serena'}[estado.suc];
 const filas=seleccion.map(s=>{
  const id=Number(s.id),codigo=folio(s.codigoCarta);
  if(!Number.isSafeInteger(id)||id<1||!codigo||ids.has(id))throw Error('Selección inválida');
  ids.add(id);
  const hits=estado.pedidos.filter(p=>p.suc===estado.suc&&Number(p.id)===id&&folio(p.codigoCarta)===codigo);
  if(hits.length!==1)return {id,codigoCarta:codigo,bloqueos:['Pedido no identificado de forma única']};
  const p=hits[0],bloqueos=[];
  if(p.estado!=='Cancelado'||p.pagado!==false)bloqueos.push('Cancelación sin pago no confirmada en panel');
  if(p.esPremio||p.qrSolicitudes?.length||p.ajusteCobroPendiente||p.correccionesTurno?.length||
     p.timbreEnviadoEn||Number(p.propina||0)!==0||
     p.pagosProductos?.length||p.pagosEnvio?.length||p.productosPagadosOtroLocal||p.envioPagadoOtroLocal)
   bloqueos.push('Vínculo de pago, corrección, propina, QR o timbre que requiere revisión');
  for(const k of ['propinas','incidencias','deliveriesManuales','gastos','retiros','ajustesHistoricos']){
   if(estado[k]!==undefined&&!Array.isArray(estado[k]))throw Error('Colección inválida: '+k);
   if((estado[k]||[]).some(v=>v.suc===estado.suc&&Number(v.pedidoId)===id))bloqueos.push('Movimiento vinculado: '+k);
  }
  const vinculos=solicitudes.filter(r=>r.branch===branch&&folio(r.pedido_interno)===String(id)&&folio(r.codigo_pedido)===codigo);
  if(vinculos.length!==1||vinculos[0].estado!=='aceptada'||
     vinculos[0].estado_guardado!=='Cancelado'||String(vinculos[0].pagado)!=='false')
   bloqueos.push('Seguimiento de carta no confirmado como cancelado sin pago');
  if(p.cartaSolicitudRemotaId&&vinculos[0]?.id!==p.cartaSolicitudRemotaId)
   bloqueos.push('Identificador de carta no coincide');
  const archivado=marcas.some(m=>m.suc===estado.suc&&m.id===id&&m.codigoCarta===codigo);
  return {id,codigoCarta:codigo,importe:Number(p.total)||0,archivado,bloqueos};
 });
 return {sucursal:estado.suc,revision,filas,puedeArchivar:filas.every(f=>!f.bloqueos.length)};
}
export function construirCopiaArchivadaPruebas({estado,seleccion,solicitudes,revision,responsable,motivo,fecha}={}){
 const plan=planificarArchivoPruebas({estado,seleccion,solicitudes,revision});
 if(!plan.puedeArchivar)throw Error('Hay pedidos sin verificar: no se cambia ninguno');
 if(typeof responsable!=='string'||responsable.trim().length<2||responsable.length>100||
    typeof motivo!=='string'||motivo.trim().length<3||motivo.length>300||
    typeof fecha!=='string'||!Number.isFinite(Date.parse(fecha)))throw Error('Falta responsable, motivo o fecha');
 const candidato=copy(estado);candidato.pedidosPruebaArchivados??=[];
 for(const f of plan.filas.filter(x=>!x.archivado))
  candidato.pedidosPruebaArchivados.push({suc:plan.sucursal,id:f.id,codigoCarta:f.codigoCarta,revisionOrigen:revision,responsable:responsable.trim(),motivo:motivo.trim(),fecha});
 return {candidato,plan};
}
export function pruebaArchivada(estado,pedido){
 return pedido?.estado==='Cancelado'&&pedido?.pagado===false&&
  Array.isArray(estado?.pedidosPruebaArchivados)&&estado.pedidosPruebaArchivados.some(m=>
   m.suc===estado.suc&&pedido.suc===m.suc&&m.id===Number(pedido.id)&&m.codigoCarta===folio(pedido.codigoCarta));
}
