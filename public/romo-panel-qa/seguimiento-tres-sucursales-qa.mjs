/*
 * Seguimiento privado de las tres sucursales en panel existente.
 * NO activa cajeros, ventas, pagos ni el backend por sí solo.
 */
const NAMES=Object.freeze({
 'Uki Regimiento Arica':'uki:arica',
 'Uki La Serena':'uki:serena',
 'Romo’s Sushi La Serena':'romo:serena'
});
// Conectar automáticamente la forma de pago al aceptar el pedido existente,
// SOLO en la copia privada de Preview. No es confirmación de transferencia,
// no marca pagado y no se activa en el panel comercial de producción.
const TRACKING_PAYMENT_PREVIEW_QA=location.protocol==='https:'&&
 /^romos-sushi-panel-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(location.hostname)&&
 location.pathname.startsWith('/romo-panel-qa/');
const TRACKING_PAYMENT_ROMO_LIVE=location.protocol==='https:'&&
 location.hostname==='romos-sushi-panel.vercel.app'&&
 window.ROMO_SEGUIMIENTO_RELEASE_AUTORIZADO===true;
window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED=TRACKING_PAYMENT_PREVIEW_QA||TRACKING_PAYMENT_ROMO_LIVE;
const API='/api/seguimiento-personal-tres-qa';
const $=id=>document.getElementById(id);
const root=$('romo-seguimiento-bandeja-qa'),dialog=$('romo-seguimiento-abrir-qa');
const list=$('romo-seguimiento-lista-qa'),detail=$('romo-seguimiento-detalle-qa');
const notice=$('romo-seguimiento-resumen-qa');
const pesos=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??'');return el};
const section=title=>{const el=text('section','');el.style.cssText='padding:12px 0;border-bottom:1px solid #ddd';el.append(text('h3',title));return el};
const btn=(name,callback)=>{const el=text('button',name);el.type='button';el.className='sm';el.addEventListener('click',callback);return el};
const field=(title,input)=>{const el=text('label',title);el.style.cssText='display:block;margin:9px 0';el.append(input);return el};
const REVISION_HOST='romos-sushi-panel-git-preparacion-enl-341d68-diannaleandra-7046.vercel.app';
let reviewShop=null;
function reviewSelected(){
 return location.protocol==='https:'&&location.hostname===REVISION_HOST&&
  location.pathname.startsWith('/romo-panel-qa/')?
  NAMES[window.ukiSeguimientoContextoRevisionQA?.()]||null:null;
}
const inReview=()=>!!reviewShop&&reviewShop===reviewSelected()&&!window.ukiQAGet?.()?.suc;
const store=()=>NAMES[window.ukiQAGet?.()?.suc]||(inReview()?reviewShop:null);
let busy=false,selectedId=null,activeDetail=null,activeStore=null,loadingDetail=false,actionBusy=false,lastDetailSignature='';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tell=(message,target=detail)=>{
 const node=target&&target!==detail?target.parentElement?.querySelector('[data-seguimiento-status]'):notice;
 if(node)node.textContent=String(message||'');
};
function inlineFor(id){
 return Array.from(document.querySelectorAll('[data-seguimiento-id]')).find(el=>el.dataset.seguimientoId===id)||null;
}
function isActive(target,id,shop){
 return target?.isConnected&&activeDetail===target&&selectedId===id&&activeStore===shop&&store()===shop;
}
function hideActive(){
 if(activeDetail){
  activeDetail.hidden=true;
  if(activeDetail!==detail)activeDetail.parentElement?.querySelector('button')?.setAttribute('aria-expanded','false');
 }
 activeDetail=null;selectedId=null;activeStore=null;lastDetailSignature='';
}
function badgeText(entry){
 if(!entry)return '';
 if(entry.estadoPago==='avisada')return '🔔 Cliente avisó: falta verificar';
 if(entry.estadoPago==='confirmada')return '✓ Transferencia verificada';
 if(entry.ultimaConsulta)return '💬 Mensajes del pedido';
 if(entry.montoTransferencia>0||entry.pagoDeclarado==='transferencia')return 'Transferencia pendiente';
 return '';
}
function paintBadges(orders,shop){
 if(store()!==shop)return;
 const entries=new Map(orders.map(x=>[x.id,x]));
 for(const card of document.querySelectorAll('[data-seguimiento-id]')){
  const label=card.querySelector('[data-seguimiento-aviso]');
  if(label)label.textContent=badgeText(entries.get(card.dataset.seguimientoId));
 }
}
function visibility(){
 if(!root||!dialog)return;
 root.hidden=!store();
 if(root.hidden){dialog.open=false;hideActive();}
 else if(activeStore&&activeStore!==store())hideActive();
}
async function query(method='GET',body={},id='',modo=''){
 const storeId=store();if(!storeId)throw Error('Selecciona el local.');
 const getToken=window.ukiMesasTokenConfirmar;
 const token=typeof getToken==='function'?await getToken():null;
 if(typeof token!=='string'||!token)throw Error('Inicia sesión con Google desde el panel.');
 if(store()!==storeId)throw Error('Cambió la sucursal. Abre el pedido nuevamente.');
 const review=inReview();
 const params=new URLSearchParams({storeId,...(id?{id}:{}),...(review?{revision:'1'}:{}),...(review&&modo==='comprobar_nube'?{modo}:{})});
 const response=await fetch(API+(method==='GET'?'?'+params.toString():review?'?revision=1':''),{
  method,cache:'no-store',credentials:'same-origin',
  headers:{Authorization:'Bearer '+token,'Accept':'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify({...body,storeId})}:{}),
  signal:AbortSignal.timeout(15000)
 });
 const data=await response.json().catch(()=>null);
 if(store()!==storeId||!response.ok||data?.ok!==true||data.storeId!==storeId)
  throw Error(data?.error||'No se pudo consultar el pedido.');
 return data;
}

/*
 * Después de que el panel confirmó el guardado, validar automáticamente
 * EL MEDIO (jamás el abono) con el servidor de QA. No añade otro botón.
 * Solo habilitado en Preview privado; deshabilitado en producción. Sólo pedido de carta
 * pendiente, sin propina ni pagos mixtos cuya distribución no esté validada.
 */
function seguimientoMedioSimpleQA(order){
 if(!order||typeof order!=='object'||order.pagado!==false||
    order.mixtoProductos===true||order.mixtoEnvio===true||
    (Array.isArray(order.pagosProductos)&&order.pagosProductos.length>0)||
    (Array.isArray(order.pagosEnvio)&&order.pagosEnvio.length>0)||
    order.productosPagadosOtroLocal===true||order.envioPagadoOtroLocal===true||
    !Number.isSafeInteger(order.subtotal)||order.subtotal<0||
    !Number.isSafeInteger(Number(order.envio))||Number(order.envio)<0||
    !Number.isSafeInteger(order.total)||Number(order.propina||0)!==0||
    (order.propinaModo||'ninguna')!=='ninguna')return null;
 const expected=order.subtotal+Number(order.envio);
 if(!Number.isSafeInteger(expected)||expected<=0||expected!==order.total)return null;
 const normalize=value=>String(value||'').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
 const methods={'efectivo':'efectivo','transferencia':'transferencia',
  'debito':'debito','tarjeta debito':'debito','tarjeta de debito':'debito',
  'credito':'credito','tarjeta credito':'credito','tarjeta de credito':'credito',
  'edenred':'edenred','junaeb':'junaeb','otros':'otro','otro':'otro'};
 const method=methods[normalize(order.medio)];
 if(!method)return null;
 if(Number(order.envio)>0&&methods[normalize(order.medioEnvio)]!==method)return null;
 return Object.freeze({metodo:method,totalValidado:expected});
}

// Mantener la propina fuera del precio de venta. Si se recibe por
// transferencia, forma parte del abono que se debe comprobar.
function seguimientoPropinaTransferenciaQA(order,subtotal){
 const mode=order?.propinaModo||'ninguna';
 const value=order?.propina!==undefined?Number(order.propina):
  mode==='diez'?Math.round(subtotal*.1):mode==='otro'?Number(order.propinaPersonalizada):0;
 if(!['ninguna','diez','otro'].includes(mode)||!Number.isSafeInteger(value)||value<0||value>1000000)return null;
 return String(order?.medioPropina||'').trim().toLowerCase()==='transferencia'?value:0;
}
function seguimientoDistribucionRealQA(order){
 if(!order)return null;
 const sub=Array.isArray(order.items)?order.items.filter(x=>x.nombre).reduce((n,x)=>n+Number(x.cant)*Number(x.precio),0):Number(order.subtotal);
 const env=order.modalidad==='Delivery'?Number(order.envio):0;
 const total=sub+env;
 if(!Number.isSafeInteger(sub)||sub<1||!Number.isSafeInteger(env)||env<0||
  !Number.isSafeInteger(total)||total>100000000||order.total!==undefined&&Number(order.total)!==total)return null;
 const external=(flag,value,limit)=>{
  if(!flag)return 0;
  if(value===undefined||value===null||value==='')return limit;
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=0&&n<=limit?n:null;
 };
 let a=external(order.productosPagadosOtroLocal,order.montoProductosOtroLocal,sub);
 let b=external(order.envioPagadoOtroLocal,order.montoEnvioOtroLocal,env);
 const legacy=Number(order.montoProductosOtroLocal);
 if(order.envioPagadoOtroLocal===undefined&&order.productosPagadosOtroLocal&&
  Number.isSafeInteger(legacy)&&legacy>sub&&legacy<=total){a=sub;b=legacy-sub;}
 if(a===null||b===null)return null;
 const montoOtroLocal=a+b;
 const propinaTransferencia=seguimientoPropinaTransferenciaQA(order,sub);
 if(propinaTransferencia===null)return null;
 const aliases={'efectivo':'efectivo','transferencia':'transferencia','debito':'debito',
  'tarjeta debito':'debito','tarjeta de debito':'debito','credito':'credito',
  'tarjeta credito':'credito','tarjeta de credito':'credito','edenred':'edenred',
  'junaeb':'junaeb','otro':'otro','otros':'otro'};
 const lines=[];
 for(const [amount,items,medium,mixto] of [[sub-a,order.pagosProductos,order.medio,order.mixtoProductos],
  [env-b,order.pagosEnvio,order.medioEnvio,order.mixtoEnvio]]){
  if(amount===0){if(Array.isArray(items)&&items.length)return null;continue;}
  if(mixto===true&&(!Array.isArray(items)||!items.length))return null;
  const source=Array.isArray(items)&&items.length?items:[{medio:medium,monto:amount}];
  let sum=0;
  for(const x of source){
   const medio=aliases[String(x?.medio||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ')];
   const monto=Number(x?.monto);
   if(!medio||!Number.isSafeInteger(monto)||monto<=0||monto>amount)return null;
   lines.push({medio,monto});sum+=monto;
  }
  if(sum!==amount)return null;
 }
 if(lines.length>8)return null;
 return {pagos:lines,totalValidado:total,...(montoOtroLocal||propinaTransferencia?{montoOtroLocal,propinaTransferencia}:{})};
}
window.ukiQAConfirmPaymentMethodAfterSave=async function({storeId,solicitudId,pedido}={}){
 // El mismo panel sigue guardando normalmente; esta acción sólo existe
 // en el preview exacto y cuando QA la habilite de forma explícita.
 if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||
    location.protocol!=='https:'||
    (!TRACKING_PAYMENT_PREVIEW_QA&&!TRACKING_PAYMENT_ROMO_LIVE))
  return {attempted:false,reason:'qa_disabled'};
 if(!storeId||store()!==storeId||
    typeof solicitudId!=='string'||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i.test(solicitudId)||
    !pedido||String(pedido.cartaSolicitudRemotaId||'')!==solicitudId)
  return {attempted:false,reason:'identity_missing'};
 const payment=seguimientoMedioSimpleQA(pedido);
 const distribution=pedido.pagado===false&&!payment?seguimientoDistribucionRealQA(pedido):null;
 if(!payment&&!distribution)return {attempted:false,reason:'manual_review_required'};
 try{
  const payload=payment?{action:'confirmar_medio_de_pago',id:solicitudId,...payment}:
   {action:'confirmar_distribucion_pago',id:solicitudId,...distribution};
  const data=await query('POST',payload);
  return {attempted:true,ok:true,repeated:data.repeated===true};
 }catch(e){
  // Un fallo de QA no convierte un pedido guardado en un cobro confirmado.
  if(notice)tell('El pedido está guardado; queda por verificar su medio de pago en seguimiento.');
  return {attempted:true,ok:false,error:'payment_method_unverified'};
 }
};

window.ukiQASyncDistributionBeforePayment=async function(pedido){
 if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||inReview()||!store()||
  !Number.isSafeInteger(Number(pedido?.id??pedido?.editando))||Number(pedido.id??pedido.editando)<1)return false;
 const id=String(pedido.cartaSolicitudRemotaId||pedido.seguimientoSolicitudId||'');
 if(!UUID.test(id))return false;
 const distribution=seguimientoDistribucionRealQA(pedido);
 if(!distribution)return false;
 try{
  const result=await query('POST',{action:'confirmar_distribucion_pago',id,...distribution});
  return result?.ok===true;
 }catch{return false;}
};

/* Confirmación bancaria desde el guardado habitual del pedido.
 * Una sola pregunta expresa al trabajador, no confirma por el aviso del cliente.
 * La verificación del servidor NO registra una venta; el guardado habitual sigue.
 */
window.ukiQAConfirmTransferBeforePayment=async function({storeId,id,total,monto}={}){
 if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||inReview()||actionBusy||
    !storeId||store()!==storeId||!UUID.test(String(id||''))||
    !Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(monto)||monto<1)
  return 'no_disponible';
 actionBusy=true;
 try{
  const result=await query('GET',{},id),p=result.pedido;
  if(store()!==storeId||result.orderId!==id||result.totalPedido!==total||
     p?.storeId!==storeId||p.estadoPedido!=='aceptada'||p.montoTransferencia!==monto)
   return 'no_disponible';
  if(p.estadoPago==='confirmada')return 'confirmada';
  if(result.puedeConfirmar!==true||!['pendiente','avisada'].includes(p.estadoPago)||
     p.datosBancariosVerificados!==true||p.datosBancariosSucursal!==storeId)
   return 'no_disponible';
  const nombre=Object.keys(NAMES).find(k=>NAMES[k]===storeId)||storeId;
  if(!window.confirm('TRANSFERENCIA · '+nombre+' · Pedido '+(p.codigoPedido||'')+
   '\n¿Confirmas que viste abonados '+pesos(monto)+' en la cuenta bancaria de este pedido?'+
   '\nSólo acepta si verificaste el dinero en el banco.'))
   return 'cancelada';
  if(store()!==storeId||inReview()||window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true)return 'no_disponible';
  const saved=await doAction('confirmar_transferencia',id,{montoRecibido:monto,verificadoEnBanco:true});
  return saved.estadoPago==='confirmada'&&store()===storeId?'confirmada':'no_disponible';
 }catch{return 'no_disponible';}
 finally{actionBusy=false;}
};


/* Conector del MISMO botón de cobro/entrega, exclusivamente en Preview QA.
 * No hay fallback al guardado antiguo después de iniciar esta operación.
 */
window.ukiQAGuardarRomoConjunto=async function({pedido,accion,expectedRevision,snapshot}={}){
 if(window.UKI_SEGUIMIENTO_ROMO_GUARDADO_CONJUNTO_AUTORIZADO!==true||!TRACKING_PAYMENT_PREVIEW_QA||inReview()||store()!=='romo:serena'||
    !['confirmar_cobro','entregar'].includes(accion)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1||
    pedido?.suc!=='Romo’s Sushi La Serena'||pedido.pagado!==true||
    pedido.estado!==(accion==='entregar'?'Entregado':'Pendiente'))throw Error('Guardado protegido Romo no disponible');
 const id=String(pedido.cartaSolicitudRemotaId||'');
 const pedidoInterno=String(pedido.id||'');
 if(!UUID.test(id)||! /^[1-9][0-9]{0,11}$/.test(pedidoInterno))throw Error('Pedido original no identificado');
 const d=seguimientoDistribucionRealQA(pedido);
 if(!d)throw Error('Revisa la distribución del pago');
 const monto=d.pagos.filter(x=>x.medio==='transferencia').reduce((sum,x)=>sum+x.monto,0)+Number(d.propinaTransferencia||0);
 const token=await window.ukiMesasTokenConfirmar?.();
 if(typeof token!=='string'||!token||store()!=='romo:serena')throw Error('Sesión de Romo no disponible');
 const result=await fetch('/api/seguimiento-finalizar-en-servidor-qa',{
  method:'POST',cache:'no-store',credentials:'same-origin',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({storeId:'romo:serena',id,action:accion,expectedRevision,snapshot,pedidoInterno,total:d.totalValidado,montoTransferencia:monto,restoPagoVerificado:true}),
  signal:AbortSignal.timeout(20000)
 });
 const saved=await result.json().catch(()=>null);
 if(!result.ok||saved?.ok!==true||saved.soloQA!==true||saved.storeId!=='romo:serena'||saved.orderId!==id||
    saved.revision!==expectedRevision+1||saved.estado!==(accion==='entregar'?'entregado':'pagado'))
  throw Error(saved?.error||'No se confirmó el guardado protegido');
 return {revision:saved.revision};
};

/* Proyección informativa: sólo DESPUÉS de confirmación de la caja/nube habitual.
 * No vuelve a cobrar ni hace que una operación ya guardada se repita.
 * Deshabilitado hasta aprobar el guardado y la publicación comercial.
 */
const estadosPublicados=new Map();
let publicandoEstado=false;
window.ukiQAPublishSavedState=async function({pedidos,revision}={}){
 const shop=store();
 if(window.UKI_SEGUIMIENTO_ESTADO_GUARDADO_AUTORIZADO!==true||
    window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||inReview()||publicandoEstado||!shop||
    !Number.isSafeInteger(revision)||revision<1||!Array.isArray(pedidos))return false;
 publicandoEstado=true;let ok=true;
 try{
  for(const p of pedidos){
   if(store()!==shop)return false;
   if(NAMES[p?.suc]!==shop||p.esPremio||typeof p.pagado!=='boolean'||
      !['Pendiente','Entregado','Cancelado'].includes(p.estado))continue;
   const id=String(p.cartaSolicitudRemotaId||'');
   if(!UUID.test(id)||(!p.pagado&&p.estado==='Pendiente'&&!estadosPublicados.has(shop+'|'+id)))continue;
   const d=seguimientoDistribucionRealQA(p);
   if(!d){ok=false;continue;}
   const monto=d.pagos.filter(x=>x.medio==='transferencia').reduce((sum,x)=>sum+x.monto,0)+Number(d.propinaTransferencia||0);
   const payload={id,revision,total:d.totalValidado,montoTransferencia:monto,estado:p.estado,pagado:p.pagado};
   const key=shop+'|'+id;
   const firma=JSON.stringify([payload.total,monto,p.estado,p.pagado]);
   if(estadosPublicados.get(key)===firma)continue;
   try{
    const result=await doAction('publicar_estado_guardado',id,{
     revision:payload.revision,total:payload.total,montoTransferencia:monto,estado:p.estado,pagado:p.pagado
    });
    if(result?.ok===true)estadosPublicados.set(key,firma);else ok=false;
   }catch{ok=false;}
  }
  if(!ok&&store()===shop&&notice)tell('El pedido ya se guardó en caja. El seguimiento aún necesita sincronizarse; no vuelvas a cobrar.');
  return ok;
 }finally{publicandoEstado=false;}
};

function line(title,body){
 const div=section(title);div.append(text('p',body));return div;
}
async function loadList(){
 const shop=store();
 if(!shop||busy||(!dialog.open&&!document.querySelector('[data-seguimiento-id]')))return;
 busy=true;if(dialog.open)tell('Consultando avisos…');
 try{
  const data=await query();
  if(store()!==shop)return;
  paintBadges(data.orders||[],shop);
  if(!dialog.open)return;
  list.replaceChildren();
  const sorted=[...(data.orders||[])].sort((a,b)=>
   Number(Boolean(b.clienteAvisoEn||b.ultimaConsulta))-Number(Boolean(a.clienteAvisoEn||a.ultimaConsulta)));
  tell(sorted.length?'Solicitudes aceptadas: '+sorted.length:'No hay mensajes recientes.');
  for(const entry of sorted){
   const item=line((entry.codigoPedido||'Pedido')+' · '+(entry.cliente||'Cliente'),
    entry.montoTransferencia>0?'Transferencia '+pesos(entry.montoTransferencia)+' · '+
     (entry.estadoPago==='confirmada'?(inReview()?'Simulación registrada':'Verificada'):entry.estadoPago==='avisada'?
      'El cliente avisó; falta verificar':entry.estadoPago==='requiere_revision'?'Requiere revisión':'Pendiente'):
     entry.pagoDeclarado==='transferencia'?'Cliente seleccionó transferencia · monto por verificar':
     'Sin transferencia pendiente registrada');
   item.append(btn('Ver seguimiento y mensajes',()=>window.ukiQAOpenOrderTracking(entry.id)));
   list.append(item);
  }
 }catch(e){if(dialog.open&&store()===shop)tell(e.message);}finally{busy=false;}
}
async function doAction(action,id,extra={}){
 const result=await query('POST',{action,id,...extra});
 if(action==='generar_enlace'){
  if(typeof result.enlace!=='string'||!result.enlace.startsWith('https://'))throw Error('Enlace inválido.');
  return result.enlace;
 }
 return result;
}
async function loadDetail(id,target=activeDetail,refresh=false){
 const shop=store();
 if(!UUID.test(String(id||''))||!target||!shop||loadingDetail||actionBusy||!isActive(target,id,shop))return;
 // No borrar la respuesta que el trabajador está escribiendo.
 if(refresh&&(target.querySelector('textarea')?.value||target.contains(document.activeElement)))return;
 loadingDetail=true;target.hidden=false;
 if(!refresh)target.replaceChildren(text('p','Consultando pedido…'));
 try{
  const data=await query('GET',{},id);if(!isActive(target,id,shop))return;
  if(refresh&&(target.querySelector('textarea')?.value||target.contains(document.activeElement)))return;
  const p=data.pedido,revisionAislada=inReview()&&data.revisionAislada===true;
  const signature=JSON.stringify([p,data.puedeConfirmar,data.puedeSimular,revisionAislada]);
  if(refresh&&signature===lastDetailSignature)return;
  lastDetailSignature=signature;
  target.replaceChildren(text('h3','Pedido '+(p.codigoPedido||'')),text('p',p.descripcionPedido||p.estadoPedido));
  // No crear pantallas ni enlaces nuevos para el personal. El cliente
  // mantiene su acceso privado dentro de la carta que ya utilizó.
  const seguimiento=section('Seguimiento del cliente');
  seguimiento.append(text('p',p.estadoPedido==='pendiente'?
   'Solicitud pendiente de aceptación. El cliente puede conservar esta carta para seguir el pedido.':
   'El cliente sigue este pedido directamente en la carta. Puede dejarla abierta o guardar el acceso en su celular.'));
  target.append(seguimiento);
  const payment=section('Transferencia');
  if(Number.isSafeInteger(p.montoTransferencia)&&p.montoTransferencia>0){
   payment.append(text('p','Monto de transferencia: '+pesos(p.montoTransferencia)));
   payment.append(text('p',revisionAislada&&p.estadoPago==='confirmada'?
    'Simulación registrada · sin abono ni cobro real':p.descripcionPago||'Transferencia por revisar'));
   if(revisionAislada&&data.puedeSimular===true){
    const simular=btn('Simular confirmación · '+pesos(p.montoTransferencia),async()=>{
     if(!inReview()||!isActive(target,id,shop)||actionBusy||loadingDetail)return;
     if(!window.confirm('PRUEBA FICTICIA. ¿Simular la confirmación de '+pesos(p.montoTransferencia)+'? No es un abono bancario real.'))return;
     simular.disabled=true;actionBusy=true;
     try{
      const saved=await doAction('simular_transferencia',id,{montoRecibido:p.montoTransferencia,confirmoSimulacion:true});
      if(saved.simulado!==true||saved.estadoPago!=='confirmada')throw Error('No se confirmó la simulación.');
      if(isActive(target,id,shop))tell('Simulación registrada. No se modificaron ventas ni caja.',target);
     }catch(e){if(isActive(target,id,shop))tell(e.message,target);}
     finally{simular.disabled=false;actionBusy=false;
      if(isActive(target,id,shop)){await loadDetail(id,target);void loadList();}}
    });
    payment.append(text('p','Sólo prueba del pedido ficticio; no necesitas hacer ni verificar una transferencia real.'),simular);
   }else if(data.puedeConfirmar&&p.estadoPago!=='confirmada'&&p.estadoPago!=='requiere_revision'){
    // Un solo toque DESPUÉS de mirar el abono real en el banco.
    // El importe proviene del servidor, nunca se permite escribir otro valor.
    const button=btn('Confirmar: vi '+pesos(p.montoTransferencia)+' abonados',async()=>{
     if(!Number.isSafeInteger(p.montoTransferencia)||p.montoTransferencia<=0){
      tell('El importe del pedido debe revisarse antes de confirmar.',target);return;
     }
     if(!isActive(target,id,shop)||actionBusy||loadingDetail)return;
     button.disabled=true;actionBusy=true;
     try{
      await doAction('confirmar_transferencia',id,{
       montoRecibido:p.montoTransferencia,verificadoEnBanco:true
      });
      if(isActive(target,id,shop))tell('Transferencia verificada. Continúa con el cierre habitual.',target);
     }catch(e){if(isActive(target,id,shop))tell(e.message,target);}
     finally{
      button.disabled=false;actionBusy=false;
      if(isActive(target,id,shop)){await loadDetail(id,target);void loadList();}
     }
    });
    payment.append(text('p','Primero comprueba en el banco que llegó exactamente '+pesos(p.montoTransferencia)+'.'),button);
   }
  }else payment.append(text('p','Transferencia no registrada o aún por revisar.'));
  target.append(payment);
  const chat=section('Mensajes del pedido');
  if(p.chatHabilitado===true){
   const ul=document.createElement('ul');ul.style.cssText='padding-left:18px;max-height:260px;overflow:auto';
   for(const message of p.mensajes||[]){
    if(!message||typeof message.texto!=='string')continue;
    const li=text('li',(message.remitente==='cliente'?'Cliente: ':'Local: ')+message.texto);
    li.style.cssText='margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere';ul.append(li);
   }
   chat.append(ul);
   const reply=document.createElement('textarea');reply.rows=2;reply.maxLength=800;
   reply.placeholder='Respuesta breve para este pedido';
   const send=btn('Responder',async()=>{
    const value=reply.value.trim();if(!value||!isActive(target,id,shop)||actionBusy||loadingDetail)return;
    send.disabled=true;actionBusy=true;let sent=false;
    try{await doAction('responder_mensaje',id,{texto:value});sent=true;
     if(isActive(target,id,shop)){reply.value='';tell('Respuesta enviada.',target);}}
    catch(e){if(isActive(target,id,shop))tell(e.message,target);}
    finally{
     send.disabled=false;actionBusy=false;
     if(sent&&isActive(target,id,shop))await loadDetail(id,target);
    }
   });
   chat.append(field('Respuesta para el cliente',reply),send);
  }else chat.append(text('p','El chat todavía no está habilitado en este entorno.'));
  target.append(chat);
 }catch(e){if(isActive(target,id,shop)){tell(e.message,target);if(!refresh)target.replaceChildren();}}
 finally{loadingDetail=false;
  if(activeDetail&&(activeDetail!==target||selectedId!==id)&&selectedId&&store()===activeStore)
   void loadDetail(selectedId,activeDetail);
 }
}
// Acceso autorizado sólo al seguimiento en la base aislada: sin abrir el
// estado operativo ni cargar/cifrar/guardar cajas o pedidos comerciales.
window.ukiQAEntrarSeguimientoRevision=async function(){
 const selected=reviewSelected(),status=$('ukiRevisionSeguimientoEstadoQA');
 if(!selected||window.ukiQAGet?.()?.suc)return false;
 if(!status)return false;
 status.textContent='Comprobando tu permiso de seguimiento…';
 try{
  reviewShop=selected;
  const result=await query();
  if(!inReview()||result.storeId!==selected||result.revisionAislada!==true)
   throw Error('No se confirmó la revisión aislada de esta sucursal.');
  status.textContent='Acceso autorizado. Sólo seguimiento de prueba; caja sin abrir.';
  visibility();dialog.open=true;
  await loadList();
  const nube=$('ukiRevisionDiagnosticoNubeQA');
  if(nube){
   nube.hidden=!selected.startsWith('uki:');nube.textContent='';
   if(!nube.hidden){
    nube.textContent='Comprobando la conexión Firebase de ambos locales (solo lectura)…';
    try{
     const diagnostic=await query('GET',{},'','comprobar_nube');
     if(inReview()&&store()===selected){
      const results=diagnostic.resultadoNube;
      if(diagnostic.soloLectura!==true||!Array.isArray(results)||results.length!==2)throw Error('No se confirmó la lectura');
      const labels={'uki:arica':'Uki Regimiento Arica','uki:serena':'Uki La Serena'};
      const estados={lectura_correcta:'Conexión de lectura correcta',sin_permiso:'Sin permiso de lectura',sin_manifiesto:'Revisión remota no encontrada',sesion_no_valida:'Sesión no válida',formato_no_valido:'Revisión no válida',no_disponible:'No se pudo consultar'};
      nube.replaceChildren(text('strong','Comprobación Firebase · solo lectura'));
      for(const s of ['uki:arica','uki:serena']){
       const result=results.find(x=>x.storeId===s);
       nube.append(text('p',labels[s]+': '+(estados[result?.estado]||'No comprobado')));
      }
      nube.append(text('small','No se abrió ni modificó ninguna caja. Esto comprueba conexión, no el cobro comercial.'));
     }
    }catch(e){if(inReview()&&store()===selected)nube.textContent='No se confirmó la lectura de Firebase: '+String(e?.message||'Sesión no disponible');}
   }
  }
  root.scrollIntoView({block:'start',behavior:'smooth'});
  return true;
 }catch(err){
  reviewShop=null;visibility();
  status.textContent=String(err?.message||'No se confirmó tu acceso Google.');
  return false;
 }
};
// Acceso rápido desde el pedido existente: no pide buscar otra sección.
window.ukiQAOpenOrderTracking=async function(orderId){
 if(!root||!dialog||!detail||!store())return false;
 const id=String(orderId||'');
 if(!UUID.test(id)){tell('Este pedido aún no tiene seguimiento vinculado.');return false;}
 visibility();if(root.hidden||actionBusy)return false;
 const card=inlineFor(id),target=card?.querySelector('[data-seguimiento-detalle]')||detail;
 if(activeDetail!==target||selectedId!==id)hideActive();
 activeDetail=target;selectedId=id;activeStore=store();lastDetailSignature='';
 if(card&&target!==detail){
  // La ficha ya contiene chat y confirmación. No abrir otra bandeja.
  let parent=card.parentElement;
  while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
  card.querySelector('button')?.setAttribute('aria-expanded','true');
  target.hidden=false;
  await loadDetail(id,target);
  card.scrollIntoView({block:'nearest',behavior:'smooth'});
 }else{
  // Sólo solicitudes sin ficha existente conservan su bandeja habitual.
  dialog.open=true;
  await loadDetail(id,target);
  root.scrollIntoView({block:'start',behavior:'smooth'});
 }
 return true;
};
if(root&&dialog&&list&&detail&&notice){
 $('romo-seguimiento-actualizar-qa')?.addEventListener('click',loadList);
 dialog.addEventListener('toggle',()=>{if(dialog.open)loadList();});
 document.addEventListener('click',visibility);
 setInterval(()=>{
  visibility();if(!store()||document.hidden)return;
  if(dialog.open||document.querySelector('[data-seguimiento-id]'))void loadList();
  if(activeDetail&&selectedId&&isActive(activeDetail,selectedId,activeStore)&&!activeDetail.hidden)
   void loadDetail(selectedId,activeDetail,true);
 },15000);
 visibility();
}
