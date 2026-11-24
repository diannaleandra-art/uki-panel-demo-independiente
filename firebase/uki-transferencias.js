/* Revisión manual de transferencias. No consulta bancos ni ejecuta cobros. */
function ukiTransferenciaContexto(p,borrador=false){
 const sub=borrador?(p.items||[]).filter(x=>x.nombre).reduce((n,x)=>n+Number(x.cant||0)*Number(x.precio||0),0):Number(p.subtotal)||0;
 const envio=p.modalidad==='Delivery'?Number(p.envio)||0:0;
 const propina=borrador?ukiMontoPropina(p,sub):Number(p.propina)||0;
 const pago=borrador?{...p,...ukiDatosPago(p,sub),subtotal:sub}:p;
 const productos=ukiLineasPago(pago,'productos',sub);
 const reparto=ukiLineasPago(pago,'envio',envio);
 const lineas=[...productos,...reparto,...(propina>0?[{medio:p.medioPropina||'Efectivo',monto:propina}]:[])];
 const monto=lineas.filter(x=>x.medio==='Transferencia').reduce((n,x)=>n+Number(x.monto||0),0);
 const firmaDistribucion=JSON.stringify({suc:p.suc||S.suc,productos,reparto,propina,medioPropina:propina>0?p.medioPropina||'Efectivo':'',
  externo:ukiMontoProductosOtroLocal(pago,sub),envioExterno:ukiMontoEnvioOtroLocal(pago,envio,sub)});
 return {monto,firmaDistribucion,sub,envio,propina,pago};
}
function ukiTransferenciaVigente(p,borrador=false){
 const c=ukiTransferenciaContexto(p,borrador),v=p.transferenciaVerificacion;
 if(c.monto<=0)return true;
 return !!(Number.isSafeInteger(c.monto)&&v?.version===1&&v.tipo==='manual'&&v.monto===c.monto&&
  v.firmaDistribucion===c.firmaDistribucion&&String(v.responsable||'').trim().length>=2&&
  Number.isFinite(Date.parse(v.confirmadoEn))&&!ukiTransferenciaReferenciaUsada(v.referencia,borrador?p.editando:p.id));
}
function ukiTransferenciaErrorFinalizar(p){
 const c=ukiTransferenciaContexto(p);
 const pendiente=ukiCobroPendiente(p);
 if(pendiente&&(c.monto>0||Number(pendiente.recibido?.Transferencia)>0))return 'Hay una diferencia de cobro o medios por conciliar. Regularízala antes de finalizar el pedido.';
 if(c.monto<=0)return '';
 if(!ukiTransferenciaVigente(p))return 'Falta revisar en Santander la transferencia de '+fmt(c.monto)+'. Abre el detalle del pedido y registra quién comprobó el abono.';
 if(!p.pagado)return 'La transferencia está revisada. Confirma el pago completo del pedido antes de finalizarlo.';
 if(ukiCobroPendiente(p))return 'Hay una diferencia de cobro pendiente. Regularízala antes de finalizar el pedido.';
 return '';
}
function ukiTransferenciaErrorNuevoPago(d,original){
 if(d.transferenciaVerificacion&&ukiTransferenciaReferenciaUsada(d.transferenciaVerificacion.referencia,d.editando))
  return 'La referencia de esta revisión ya figura en otro pedido. Comprueba el abono y registra una nueva revisión con la operación correcta.';
 if(!d.pagado||ukiTransferenciaVigente(d,true))return '';
 // Una edición conserva el cobro previo y el mecanismo existente de diferencias.
 // La revisión anterior nunca autoriza finalizar el importe modificado.
 if(original?.pagado){
  const propina=ukiTransferenciaContexto(d,true).propina;
  if((Number(original.propina||0)!==propina||original.medioPropina!==d.medioPropina)&&
    propina>0&&d.medioPropina==='Transferencia')
   return 'Antes de guardar la nueva propina por transferencia, revisa el abono del importe actual. El pago anterior se conserva.';
  return '';
 }
 return 'Antes de confirmar el pago, registra la revisión de '+fmt(ukiTransferenciaContexto(d,true).monto)+' en Santander. También puedes guardar el pedido pendiente, sin marcar «Pago completo confirmado».';
}
function ukiTransferenciaCampos(p){
 return {transferenciaVerificacion:p.transferenciaVerificacion?ukiCopia(p.transferenciaVerificacion):null,
  historialTransferencias:Array.isArray(p.historialTransferencias)?ukiCopia(p.historialTransferencias):[]};
}
function ukiTransferenciaFecha(v){
 return new Date(v.confirmadoEn).toLocaleString('es-CL',{timeZone:'America/Santiago'});
}
function ukiTransferenciaReferenciaUsada(referencia,pedidoId){
 const ref=String(referencia||'').trim().toLowerCase();
 if(!ref)return false;
 return (S.pedidos||[]).some(x=>x.suc===S.suc&&Number(x.id)!==Number(pedidoId)&&
  [x.transferenciaVerificacion,...(x.historialTransferencias||[])].some(v=>!v?.referenciaDescartadaPorDuplicado&&String(v?.referencia||'').trim().toLowerCase()===ref))||
  (S.ajustesHistoricos||[]).some(x=>x.suc===S.suc&&String(x.transferenciaVerificacion?.referencia||'').trim().toLowerCase()===ref);
}
const ukiTransferenciaEdiciones=new Map();
function ukiTransferenciaEditarCampo(id,campo,valor){
 const key=String(S.suc||'')+':'+Number(id),datos=ukiTransferenciaEdiciones.get(key)||{};
 datos[campo]=valor;ukiTransferenciaEdiciones.set(key,datos);
}
function ukiTransferenciaUI(p,borrador=false){
 const c=ukiTransferenciaContexto(p,borrador),v=p.transferenciaVerificacion;
 if(c.monto<=0&&!v)return '';
 const vigente=ukiTransferenciaVigente(p,borrador)&&c.monto>0;
 const id=borrador?'Borrador':String(Number(p.id));
 const edicion=borrador?p:ukiTransferenciaEdiciones.get(String(S.suc||'')+':'+Number(p.id))||{};
 const editable=c.monto>0&&(borrador||p.estado!=='Cancelado'&&esDelPeriodo(p)&&!ukiCierreConfirmadoPedido(p));
 let html='<section class="uki-transferencia-revision" style="padding:13px;margin:12px 0;border:2px solid '+(vigente?'#80b89b':'#d6aa69')+';border-radius:12px;background:'+(vigente?'#f0f9f3':'#fff8ed')+'">'+
  '<h3 style="margin:0 0 8px">'+(vigente?'✓ Transferencia revisada':'Transferencia por revisar')+' · '+fmt(c.monto)+'</h3>';
 if(v){
  html+='<p class="muted" style="margin:6px 0"><b>Revisión manual declarada por '+esc(v.responsable||'Sin nombre')+'</b><br>'+esc(ukiTransferenciaFecha(v))+' · Importe revisado: '+fmt(v.monto)+(v.referencia?'<br>Referencia: '+esc(v.referencia):'')+'</p>';
  if(!vigente)html+='<p class="muted"><b>'+ (ukiTransferenciaReferenciaUsada(v.referencia,borrador?p.editando:p.id)?'La referencia también figura en otro pedido.':'El pago cambió.')+'</b> La revisión anterior se conserva como antecedente. Revisa el importe y la operación del pedido actual.</p>';
 }
 if(editable&&!vigente){
  html+='<p class="muted">Comprueba el abono en Santander. La foto del comprobante no confirma por sí sola que el dinero llegó.</p>'+
   '<label for="ukiTransferenciaResponsable'+id+'">¿Quién revisó el banco?</label><input id="ukiTransferenciaResponsable'+id+'" maxlength="80" autocomplete="name" placeholder="Nombre de quien revisó" value="'+esc(edicion.transferenciaResponsable||(borrador?p.responsableEdicion:'')||'')+'" oninput="'+(borrador?'D.transferenciaResponsable=this.value':'ukiTransferenciaEditarCampo('+Number(p.id)+',\'transferenciaResponsable\',this.value)')+'">'+
   '<label for="ukiTransferenciaReferencia'+id+'">Número de operación (opcional)</label><input id="ukiTransferenciaReferencia'+id+'" maxlength="120" placeholder="Referencia que aparece en el banco" value="'+esc(edicion.transferenciaReferencia||'')+'" oninput="'+(borrador?'D.transferenciaReferencia=this.value':'ukiTransferenciaEditarCampo('+Number(p.id)+',\'transferenciaReferencia\',this.value)')+'">'+
   '<button type="button" class="sm ok" onclick="'+(borrador?'ukiTransferenciaRevisarBorrador()':'ukiTransferenciaRevisarPedido('+Number(p.id)+')')+'">Confirmar revisión de '+fmt(c.monto)+'</button>';
 }
 if(vigente&&!p.pagado)html+='<p class="muted">La revisión está lista. Marca «Pago completo confirmado» cuando también estén recibidas las otras partes del pago.</p>';
 if(borrador&&v&&!vigente)html+='<button type="button" class="sm" onclick="ukiTransferenciaRetirarRevision(D,\'Revisión descartada antes de guardar.\');render()">Descartar revisión anterior</button>';
 const historial=p.historialTransferencias||[];
 if(historial.length)html+='<details class="inner-details"><summary>Revisiones anteriores · '+historial.length+'</summary>'+historial.map(x=>'<p class="muted">'+esc(x.responsable||'')+' · '+esc(ukiTransferenciaFecha(x))+' · '+fmt(x.monto)+(x.referencia?' · '+esc(x.referencia):'')+(x.motivo?'<br>'+esc(x.motivo):'')+'</p>').join('')+'</details>';
 return html+'</section>';
}
function ukiTransferenciaCrearRevision(p,borrador){
 const c=ukiTransferenciaContexto(p,borrador),id=borrador?'Borrador':String(Number(p.id));
 const responsable=String($('ukiTransferenciaResponsable'+id)?.value||'').trim().slice(0,80);
 const referencia=String($('ukiTransferenciaReferencia'+id)?.value||'').trim().slice(0,120);
 if(responsable.length<2){aviso('Escribe el nombre de quien revisó la transferencia en Santander.');$('ukiTransferenciaResponsable'+id)?.focus();return null;}
 if(!Number.isSafeInteger(c.monto)||c.monto<=0){aviso('Revisa primero los montos y medios de pago.');return null;}
 const error=ukiErrorDistribucionPago(c.pago,c.sub,c.envio);
 if(error){aviso(error);return null;}
 if(ukiTransferenciaReferenciaUsada(referencia,borrador?p.editando:p.id)){
  aviso('Esa referencia ya está registrada en otro pedido de esta sucursal. Revisa el abono antes de usarlo nuevamente.');return null;
 }
 if(!window.confirm('¿Confirmas que revisaste en Santander el dinero correspondiente a '+fmt(c.monto)+' de este pedido? La revisión quedará registrada a nombre de '+responsable+'.'))return null;
 return {version:1,tipo:'manual',monto:c.monto,responsable,confirmadoEn:new Date().toISOString(),referencia,firmaDistribucion:c.firmaDistribucion};
}
function ukiTransferenciaAnotar(p,revision){
 if(!Array.isArray(p.historialTransferencias))p.historialTransferencias=[];
 if(p.transferenciaVerificacion){
  const anterior=ukiCopia(p.transferenciaVerificacion);
  if(ukiTransferenciaReferenciaUsada(anterior.referencia,p.editando||p.id))
   Object.assign(anterior,{referenciaDescartadaPorDuplicado:true,motivo:'Referencia en otro pedido; revisión reemplazada sin registrar otro cobro.'});
  p.historialTransferencias.push(anterior);
 }
 p.transferenciaVerificacion=revision;
}
function ukiTransferenciaRetirarRevision(p,motivo){
 if(!p.transferenciaVerificacion)return;
 if(!Array.isArray(p.historialTransferencias))p.historialTransferencias=[];
 const descartada=ukiTransferenciaReferenciaUsada(p.transferenciaVerificacion.referencia,p.editando||p.id);
 p.historialTransferencias.push({...ukiCopia(p.transferenciaVerificacion),invalidadaEn:new Date().toISOString(),motivo,
  ...(descartada?{referenciaDescartadaPorDuplicado:true}:{})});
 p.transferenciaVerificacion=null;
}
function ukiTransferenciaRevisarBorrador(){
 if(!S.suc||S.busy||window.ukiCancelacionNubeLista?.()!==true)return aviso('Espera a que la sucursal esté sincronizada antes de registrar la revisión.');
 const revision=ukiTransferenciaCrearRevision(D,true);if(!revision)return;
 ukiTransferenciaAnotar(D,revision);render();
 aviso('Revisión manual preparada. Guarda el pedido para conservarla.');
}
let ukiTransferenciaGuardando=false;
function ukiOlvidoActualizarTransferencia(){
 const bloque=$('ukiOlvidoTransferenciaBloque'),casilla=$('ukiOlvidoTransferenciaRevisada');
 const monto=Number($('ukiOlvidoUki')?.value)||0;
 const requiere=$('ukiOlvidoMedio')?.value==='Transferencia'&&monto>0;
 if(bloque)bloque.style.display=requiere?'block':'none';
 if(casilla){casilla.checked=false;casilla.dataset.monto=String(monto);}
 const texto=$('ukiOlvidoTransferenciaMonto');if(texto)texto.textContent=fmt(monto);
}
async function ukiTransferenciaRevisarPedido(id){
 const p=(S.pedidos||[]).find(x=>x.suc===S.suc&&x.id===Number(id));
 if(!p||p.estado==='Cancelado'||!esDelPeriodo(p)||ukiCierreConfirmadoPedido(p))return aviso('La revisión corresponde a pedidos de la caja abierta.');
 if(ukiTransferenciaGuardando||S.busy||window.ukiCancelacionNubeLista?.()!==true)return aviso('Espera a que la sucursal esté sincronizada antes de registrar la revisión.');
 const revision=ukiTransferenciaCrearRevision(p,false);if(!revision)return;
 const anterior=ukiTransferenciaCampos(p);ukiTransferenciaGuardando=true;
 try{
  ukiTransferenciaAnotar(p,revision);
  if(await guardarEnLocalStorage()===false){Object.assign(p,anterior);render();return aviso('No se guardó la revisión. Conserva esta sesión y revisa la sincronización.');}
  ukiTransferenciaEdiciones.delete(String(S.suc||'')+':'+Number(p.id));
  render();aviso('Revisión manual registrada por '+revision.responsable+'. Comprueba que la nube termine de sincronizar.');
 }finally{ukiTransferenciaGuardando=false;}
}
