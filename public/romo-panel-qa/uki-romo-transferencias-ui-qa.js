/* Controles de revisión manual. Guardar una revisión no vuelve a cobrar. */
const ukiRomoTransferenciaCamposQA=new Map();
function ukiRomoEscribiendoRevisionTransferenciaQA(){
 const el=document.activeElement;
 return S.suc===ROMO_SUCURSAL_QA&&!ukiRomoOperandoPedidoQA&&!ukiRomoGuardandoManualQA&&
  el?.tagName==='INPUT'&&el.type!=='checkbox'&&/^(romoRevision|romoCobro)/.test(el.id||'');
}
function ukiRomoContextoCamposQA(prefijo){
 const id=Number(String(prefijo).match(/\d+$/)?.[0]);
 const p=(S.pedidos||[]).find(x=>x.suc===ROMO_SUCURSAL_QA&&Number(x.id)===id);
 return {p,sesion:window.ukiRomoSesionRemotaQA,firma:p?JSON.stringify([ukiRomoTransferenciasQA.resumen(p).firmaDistribucion,p.pagado,p.transferenciaVerificacion,p.ajusteCobroPendiente]):''};
}
function ukiRomoCamposRecordadosQA(prefijo){
 const contexto=ukiRomoContextoCamposQA(prefijo),v=ukiRomoTransferenciaCamposQA.get(prefijo);
 if(v&&(v.sesion!==contexto.sesion||v.firma!==contexto.firma)){ukiRomoTransferenciaCamposQA.delete(prefijo);return null;}
 return v||null;
}
function ukiRomoRecordarRevisionQA(prefijo){
 const contexto=ukiRomoContextoCamposQA(prefijo),box=document.getElementById(prefijo+'Campos');
 if(!contexto.p||!box)return;
 const padre=prefijo.startsWith('romoRevisionCobro')?box.closest('details.card'):box;
 const campos={};
 for(const el of padre.querySelectorAll('input[id],select[id],textarea[id]')){
  if((el.id.startsWith(prefijo)||el.id.startsWith('romoCobro'))&&!/timbre/i.test(el.id))campos[el.id]={valor:el.value,marcado:el.checked===true,firma:el.dataset.firma||''};
 }
 ukiRomoTransferenciaCamposQA.set(prefijo,{sesion:contexto.sesion,firma:contexto.firma,campos,
  oculto:box.hidden,resumen:document.getElementById(prefijo+'Resumen')?.textContent||''});
}
function ukiRomoRestaurarRevisionHTMLQA(prefijo,html){
 const v=ukiRomoCamposRecordadosQA(prefijo);if(!v)return html;
 const t=document.createElement('template');t.innerHTML=html;
 for(const el of t.content.querySelectorAll('input[id],select[id],textarea[id]')){
  const x=v.campos[el.id];if(!x)continue;
  if(el.tagName==='SELECT'){for(const opt of el.options)opt.toggleAttribute('selected',opt.value===x.valor);}
  else if(el.tagName==='TEXTAREA')el.textContent=x.valor;
  else{el.setAttribute('value',x.valor);el.toggleAttribute('checked',x.marcado);}
  if(x.firma)el.dataset.firma=x.firma;
 }
 const box=t.content.getElementById(prefijo+'Campos'),res=t.content.getElementById(prefijo+'Resumen');
 if(box)box.hidden=v.oculto;if(res)res.textContent=v.resumen;
 return t.innerHTML;
}
function ukiRomoTransferenciaDraftQA(d){
 const subtotal=(d.items||[]).filter(x=>String(x.nombre||'').trim()).reduce((a,x)=>a+Number(x.cant)*Number(x.precio),0);
 return {...d,subtotal,envio:d.modalidad==='Delivery'?Number(d.envio||0):0,
  propina:ukiMontoPropina(d,subtotal),pagosProductos:d.mixtoProductos?d.pagosProductos||[]:[],
  pagosEnvio:d.mixtoEnvio?d.pagosEnvio||[]:[]};
}
function ukiRomoRevisionDraftHTMLQA(original){
 if(S.suc!==ROMO_SUCURSAL_QA)return '';
 if(original&&!original.pagado)return '<p class="muted">Guarda los cambios de este pedido pendiente. Después confirma el pago y revisa la transferencia desde Pago del pedido, en Pedidos; se conserva el mismo registro.</p>';
 const p=ukiRomoTransferenciaDraftQA(D),r=ukiRomoTransferenciasQA.resumen(p);
 if(original?.pagado){
  if(!r.monto&&!original.transferenciaVerificacion)return '';
  return '<div class="card"><b>Revisión de transferencia</b><p class="muted">Puedes guardar esta corrección conservando el dinero recibido. Si cambias el importe o los medios, vuelve a revisar la transferencia desde el mismo pedido después de regularizar cualquier diferencia.</p></div>';
 }
 if(!r.monto&&!r.error)return '';
 if(r.error)return '<p class="muted">Completa los medios y montos para revisar la parte transferida.</p>';
 const v=D.romoRevisionTransferencia||(D.romoRevisionTransferencia={});
 if(v.confirmoRevision===true&&v.firmaDistribucion!==r.firmaDistribucion)v.confirmoRevision=false;
 const marcada=v.confirmoRevision===true&&v.firmaDistribucion===r.firmaDistribucion;
 return '<div class="card" style="border-color:#b87c23"><h3>Revisar transferencia · '+fmt(r.monto)+'</h3>'+
  '<p class="muted">Comprueba que este importe ingresó a la cuenta bancaria. Un comprobante enviado por WhatsApp no confirma el abono. En pagos mixtos, revisa solo la parte transferida.</p>'+
  '<label>Importe recibido por transferencia ($)</label><input id="romoRevisionDraftMonto" type="number" min="1" step="1" inputmode="numeric" value="'+esc(v.monto??'')+'" oninput="ukiRomoEditarRevisionDraftQA(\'monto\',this.value)">'+
  '<label>Quién revisó la cuenta bancaria</label><input id="romoRevisionDraftResponsable" maxlength="80" autocomplete="off" value="'+esc(v.responsable||'')+'" oninput="ukiRomoEditarRevisionDraftQA(\'responsable\',this.value)">'+
  '<label>Número de operación bancaria (opcional)</label><input id="romoRevisionDraftReferencia" maxlength="160" value="'+esc(v.referencia||'')+'" oninput="ukiRomoEditarRevisionDraftQA(\'referencia\',this.value)">'+
  '<label class="check"><input id="romoRevisionDraftConfirmo" type="checkbox" '+(marcada?'checked':'')+' onchange="ukiRomoMarcarRevisionDraftQA(this.checked)"> Revisé el abono en la cuenta y corresponde a este pedido</label>'+
  '<p class="muted">'+(marcada?'Revisión preparada. Quedará guardada junto con la confirmación del pago.':'Falta la revisión manual para confirmar el pago.')+'</p></div>';
}
function ukiRomoEditarRevisionDraftQA(campo,valor){
 if(!['monto','responsable','referencia'].includes(campo))return;
 const v=D.romoRevisionTransferencia||(D.romoRevisionTransferencia={});
 v[campo]=valor;v.confirmoRevision=false;
 const check=document.getElementById('romoRevisionDraftConfirmo');if(check)check.checked=false;
}
function ukiRomoMarcarRevisionDraftQA(marcado){
 const v=D.romoRevisionTransferencia||(D.romoRevisionTransferencia={});
 v.confirmoRevision=false;
 if(marcado){
  try{
   const p=ukiRomoTransferenciaDraftQA(D);
   v.firmaDistribucion=ukiRomoTransferenciasQA.distribucion(p).firmaDistribucion;
   ukiRomoTransferenciasQA.preparar(p,{...v,confirmoRevision:true},Date.now());
   v.confirmoRevision=true;
  }catch(e){aviso(String(e.message||e));}
 }
 render();
}
function ukiRomoValidarRevisionDraftQA(){
 try{ukiRomoTransferenciasQA.preparar(ukiRomoTransferenciaDraftQA(D),D.romoRevisionTransferencia,Date.now());return true;}
 catch(e){aviso(String(e.message||e));return false;}
}
function ukiRomoCambiarPagoConfirmadoQA(marcado){
 const original=D.editando?(S.pedidos||[]).find(p=>p.suc===S.suc&&Number(p.id)===Number(D.editando)):null;
 if(S.suc===ROMO_SUCURSAL_QA&&marcado&&!original?.pagado&&!ukiRomoValidarRevisionDraftQA()){D.pagado=false;render();return;}
 D.pagado=marcado;render();
}
function ukiRomoRevisionCamposQA(prefijo,monto,accion){
 const html='<div class="card" id="'+prefijo+'Campos"'+(!monto?' hidden':'')+' style="border-color:#b87c23">'+
  '<h3>Revisar transferencia</h3><p id="'+prefijo+'Resumen"><b>Parte transferida: '+fmt(monto)+'</b></p>'+
  '<p class="muted">Revisa el abono en la cuenta bancaria y que corresponde a este pedido. En pagos mixtos solo se confirma la parte transferida.</p>'+
  '<label>Importe recibido por transferencia ($)</label><input id="'+prefijo+'Monto" type="number" min="1" step="1" inputmode="numeric" oninput="ukiRomoDesmarcarRevisionQA(\''+prefijo+'\')">'+
  '<label>Quién revisó la cuenta bancaria</label><input id="'+prefijo+'Responsable" maxlength="80" autocomplete="off" oninput="ukiRomoDesmarcarRevisionQA(\''+prefijo+'\')">'+
  '<label>Número de operación bancaria (opcional)</label><input id="'+prefijo+'Referencia" maxlength="160" oninput="ukiRomoDesmarcarRevisionQA(\''+prefijo+'\')">'+
  '<label class="check"><input id="'+prefijo+'Confirmo" type="checkbox" onchange="event.stopPropagation();'+accion+'"> Revisé el abono en la cuenta y corresponde a este pedido</label>'+
  '<p class="muted">Es una revisión manual. El panel aún no recibe confirmación automática del banco.</p></div>';
 return ukiRomoRestaurarRevisionHTMLQA(prefijo,html);
}
function ukiRomoDesmarcarRevisionQA(prefijo){
 const check=document.getElementById(prefijo+'Confirmo');if(check){check.checked=false;delete check.dataset.firma;}
 ukiRomoRecordarRevisionQA(prefijo);
}
function ukiRomoLeerRevisionTransferenciaQA(prefijo){
 const check=document.getElementById(prefijo+'Confirmo');
 return {confirmoRevision:check?.checked===true,firmaDistribucion:check?.dataset.firma||'',
  monto:document.getElementById(prefijo+'Monto')?.value??'',
  responsable:document.getElementById(prefijo+'Responsable')?.value||'',
  referencia:document.getElementById(prefijo+'Referencia')?.value||''};
}
function ukiRomoCobroPropuestoQA(p){
 const id=Number(p.id),sub=Number(p.subtotal),env=p.modalidad==='Delivery'?Number(p.envio):0;
 const a=Number(document.getElementById('romoCobroExternoProducto'+id)?.value||0);
 const b=Number(document.getElementById('romoCobroExternoEnvio'+id)?.value||0);
 if(!Number.isSafeInteger(a)||a<0||a>sub||!Number.isSafeInteger(b)||b<0||b>env)throw Error('Revisa los importes pagados en otro local.');
 const productos=ukiRomoLeerDistribucionQA(id,'Producto',sub-a),delivery=ukiRomoLeerDistribucionQA(id,'Envio',env-b);
 const modo=document.getElementById('romoCobroPropinaModo'+id)?.value||'ninguna';
 return {...p,medio:productos[0]?.medio||'Efectivo',medioEnvio:delivery[0]?.medio||'Efectivo',
  pagosProductos:productos.length>1?productos:[],pagosEnvio:delivery.length>1?delivery:[],
  productosPagadosOtroLocal:a>0,montoProductosOtroLocal:a,envioPagadoOtroLocal:b>0,montoEnvioOtroLocal:b,
  propina:modo==='ninguna'?0:Number(document.getElementById('romoCobroPropinaMonto'+id)?.value||0),
  medioPropina:document.getElementById('romoCobroPropinaMedio'+id)?.value||'Efectivo'};
}
function ukiRomoActualizarRevisionCobroQA(id){
 const p=(S.pedidos||[]).find(p=>p.suc===ROMO_SUCURSAL_QA&&Number(p.id)===Number(id));
 const prefijo='romoRevisionCobro'+id,box=document.getElementById(prefijo+'Campos'),res=document.getElementById(prefijo+'Resumen'),check=document.getElementById(prefijo+'Confirmo');
 if(!p||!box||!res||!check)return;
 try{
  const r=ukiRomoTransferenciasQA.distribucion(ukiRomoCobroPropuestoQA(p));
  box.hidden=!r.monto;res.textContent='Parte transferida: '+fmt(r.monto);
  if(check.dataset.firma!==r.firmaDistribucion)ukiRomoDesmarcarRevisionQA(prefijo);
 }catch(e){box.hidden=false;res.textContent=String(e.message||e);ukiRomoDesmarcarRevisionQA(prefijo);}
 ukiRomoRecordarRevisionQA(prefijo);
}
function ukiRomoMarcarRevisionCobroQA(id,marcado){
 const prefijo='romoRevisionCobro'+id,check=document.getElementById(prefijo+'Confirmo');
 if(!check)return;
 if(!marcado){ukiRomoDesmarcarRevisionQA(prefijo);return;}
 try{
  const p=(S.pedidos||[]).find(p=>p.suc===ROMO_SUCURSAL_QA&&Number(p.id)===Number(id));
  const propuesto=ukiRomoCobroPropuestoQA(p);
  check.dataset.firma=ukiRomoTransferenciasQA.distribucion(propuesto).firmaDistribucion;
  ukiRomoTransferenciasQA.preparar(propuesto,ukiRomoLeerRevisionTransferenciaQA(prefijo),Date.now());
 }catch(e){ukiRomoDesmarcarRevisionQA(prefijo);const res=document.getElementById(prefijo+'Resumen');if(res)res.textContent=String(e.message||e);}
 ukiRomoRecordarRevisionQA(prefijo);
}
function ukiRomoTransferenciaEstadoHTMLQA(p,cerrado,prueba){
 const r=ukiRomoTransferenciasQA.resumen(p),v=p.transferenciaVerificacion;
 if(!r.monto&&!v)return '';
 const detalle=x=>'<p class="muted">Revisada manualmente por <b>'+esc(x.responsable||'Sin responsable')+'</b> · '+esc(fechaTxt(x.confirmadoEn))+' · '+fmt(x.monto)+(x.referencia?' · '+esc(x.referencia):'')+'</p>';
 let html='<div class="card" style="border-color:'+(r.vigente?'#54835b':'#b87c23')+'"><h3>Transferencia · '+fmt(r.monto)+'</h3>'+
  '<p><b>'+(r.vigente?'Revisión manual vigente':r.monto?'Pendiente de revisión manual':'Distribución actual sin transferencia')+'</b></p>'+
  (v?detalle(v)+(r.vigente?'':'<p class="muted">La revisión anterior se conserva como antecedente; no confirma los importes actuales.</p>'):'')+
  (r.error?'<p class="muted">'+esc(r.error)+'</p>':'');
 if(r.monto&&!r.vigente&&!cerrado&&!prueba&&p.estado!=='Cancelado'){
  if(!p.pagado)html+='<p class="muted">Revisa la transferencia al confirmar el pago en este mismo pedido.</p>';
  else if(p.ajusteCobroPendiente)html+='<p class="muted">Regulariza primero la diferencia de cobro. El dinero ya recibido se conserva.</p>';
  else html+='<details><summary>Revisar transferencia del pago registrado</summary>'+ukiRomoRevisionCamposQA('romoRevisionPedido'+p.id,r.monto,'ukiRomoMarcarRevisionPedidoQA('+Number(p.id)+',this.checked)')+
   '<button type="button" class="sm ok" onclick="ukiRomoRevisarTransferenciaQA('+Number(p.id)+')">Guardar revisión manual · sin nuevo cobro</button></details>';
 }
 const anteriores=Array.isArray(p.historialTransferencias)?p.historialTransferencias:[];
 if(anteriores.length)html+='<details class="inner-details"><summary>Revisiones anteriores ('+anteriores.length+')</summary>'+anteriores.map(detalle).join('')+'</details>';
 return html+'</div>';
}
function ukiRomoMarcarRevisionPedidoQA(id,marcado){
 const prefijo='romoRevisionPedido'+id,check=document.getElementById(prefijo+'Confirmo');
 if(!marcado){ukiRomoDesmarcarRevisionQA(prefijo);return;}
 try{
  const p=(S.pedidos||[]).find(p=>p.suc===ROMO_SUCURSAL_QA&&Number(p.id)===Number(id));
  check.dataset.firma=ukiRomoTransferenciasQA.distribucion(p).firmaDistribucion;
  ukiRomoTransferenciasQA.preparar(p,ukiRomoLeerRevisionTransferenciaQA(prefijo),Date.now());
 }catch(e){ukiRomoDesmarcarRevisionQA(prefijo);const res=document.getElementById(prefijo+'Resumen');if(res)res.textContent=String(e.message||e);}
 ukiRomoRecordarRevisionQA(prefijo);
}
async function ukiRomoRevisarTransferenciaQA(id){
 if(S.suc!==ROMO_SUCURSAL_QA||ukiRomoOperacionesEnCursoQA())return;
 const p=(S.pedidos||[]).find(p=>p.suc===ROMO_SUCURSAL_QA&&Number(p.id)===Number(id));
 if(!p?.pagado||p.estado==='Cancelado'||p.esPremio||p.ajusteCobroPendiente||ukiCierreConfirmadoPedido(p))return aviso('Revisa un pedido pagado de la caja abierta, sin diferencias pendientes.');
 const caja=S.cajasDiarias?.[ROMO_SUCURSAL_QA+'|'+String(p.turnoClave||'').slice(0,10)];
 if(caja?.turnoAbierto!==true||caja.baseConfirmada!==true||caja.turnoId!==p.turnoClave)return aviso('El turno de este pedido debe estar abierto y su base confirmada.');
 ukiRomoOperandoPedidoQA=true;
 try{
  const revision=ukiRomoTransferenciasQA.preparar(p,ukiRomoLeerRevisionTransferenciaQA('romoRevisionPedido'+id),Date.now());
  if(!revision)throw Error('Este pedido no tiene importe transferido por revisar.');
  ukiRomoTransferenciasQA.validarReferencia(S.pedidos,p.id,revision,ROMO_SUCURSAL_QA);
  const copia=datosSoloSucursal(),pedido=copia.pedidos.find(x=>x.suc===ROMO_SUCURSAL_QA&&Number(x.id)===Number(id));
  ukiRomoTransferenciasQA.registrar(pedido,revision);
  await ukiRomoGuardarOperacionQA(copia,'Transferencia revisada manualmente',Number(id));
 }catch(e){aviso('No se confirmó la revisión. Revisa el estado del pedido antes de repetir. '+String(e.message||e));}
 finally{ukiRomoOperandoPedidoQA=false;}
}
