/*
 * Seguimiento privado de las tres sucursales en panel existente.
 * NO activa cajeros, ventas, pagos ni el backend por sí solo.
 */
const NAMES=Object.freeze({
 'Uki Regimiento Arica':'uki:arica',
 'Uki La Serena':'uki:serena'
});
// Conectar automáticamente la forma de pago al aceptar el pedido existente,
// SOLO en la copia privada de Preview. No es confirmación de transferencia,
// no marca pagado y no se activa en el panel comercial de producción.
// Autorización de la versión candidata: sólo el dominio del panel Uki vigente.
// La rama de preparación no se publica hasta coordinar el servicio de pedidos.
if(location.protocol==='https:'&&location.hostname==='diannaleandra-art.github.io'){
 window.UKI_SEGUIMIENTO_RELEASE_AUTORIZADO=true;
}
const TRACKING_PAYMENT_PREVIEW_QA=location.protocol==='https:'&&
 location.hostname==='diannaleandra-art.github.io'&&
 window.UKI_SEGUIMIENTO_RELEASE_AUTORIZADO===true;
window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED=TRACKING_PAYMENT_PREVIEW_QA;
// Sólo la revisión de caja ya confirmada puede proyectarse al seguimiento.
if(TRACKING_PAYMENT_PREVIEW_QA)window.UKI_SEGUIMIENTO_ESTADO_GUARDADO_AUTORIZADO=true;
const API='https://uki-sushi-pedidos.vercel.app/api/seguimiento-personal-live';
const $=id=>document.getElementById(id);
const root=$('romo-seguimiento-bandeja-qa'),dialog=$('romo-seguimiento-abrir-qa');
const list=$('romo-seguimiento-lista-qa'),detail=$('romo-seguimiento-detalle-qa');
const notice=$('romo-seguimiento-resumen-qa');
const pesos=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??'');return el};
const section=title=>{const el=text('section','');el.style.cssText='padding:12px 0;border-bottom:1px solid #ddd';el.append(text('h3',title));return el};
const btn=(name,callback)=>{const el=text('button',name);el.type='button';el.className='sm';el.addEventListener('click',callback);return el};
const field=(title,input)=>{const el=text('label',title);el.style.cssText='display:block;margin:9px 0';el.append(input);return el};
const store=()=>NAMES[window.ukiQAGet?.()?.suc]||null;
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
function badgeText(entry,localState){
 if(!entry)return localState==='Entregado'?'✓ Entregado · Seguimiento por sincronizar':'Seguimiento no disponible';
 const labels=[localState==='Entregado'||entry.estadoPedido==='entregada'?'✓ Entregado':entry.estadoPedido==='cancelada'?'Pedido cancelado':entry.enCamino?'🛵 Pedido en camino':entry.estadoPedido==='aceptada'?'✓ Pedido aceptado':'Pendiente de aceptación'];
 if(entry.estadoPago==='confirmada')labels.push('✓ Transferencia verificada');
 else if(entry.estadoPago==='avisada')labels.push('Transferencia avisada · por revisar');
 else if(entry.montoTransferencia>0||entry.pagoDeclarado==='transferencia')labels.push('Transferencia pendiente');
 return labels.join(' · ');
}
function paintBadges(orders,shop){
 if(store()!==shop)return;
 const entries=new Map(orders.map(x=>[x.id,x]));
 for(const summary of document.querySelectorAll('[data-seguimiento-resumen-id]')){
  const label=summary.querySelector('[data-seguimiento-resumen-aviso]');
  const entry=entries.get(summary.dataset.seguimientoResumenId);
  if(label)label.textContent=badgeText(entry,summary.dataset.seguimientoEstado);
  const route=summary.querySelector('[data-seguimiento-ruta]');if(route){route.disabled=summary.dataset.seguimientoEstado==='Entregado'||!entry||entry.estadoPedido!=='aceptada'||entry.enCamino===true;route.textContent=entry?.enCamino?'✓ En camino':'🛵 Pedido en camino';}
 }
 for(const card of document.querySelectorAll('[data-seguimiento-id]')){
  const label=card.querySelector('[data-seguimiento-aviso]');
  if(label)label.textContent=badgeText(entries.get(card.dataset.seguimientoId));
 }
}
function visibility(){
 if(!root||!dialog)return;
 const enabled=!!store()&&window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED===true;
 root.hidden=true;
 root.style.display=root.hidden?'none':'';
 if(root.hidden)dialog.open=false;
 if(!enabled||(activeStore&&activeStore!==store()))hideActive();
}
async function query(method='GET',body={},id=''){
 const storeId=store();if(!storeId)throw Error('Selecciona el local.');
 // Usa exactamente la sesión de recepción existente; no obliga a abrir Google.
 // Sólo la proyección de un guardado Firebase usa su propia sesión Google.
 // Recepción, mensajes y transferencia conservan su autorización de equipo.
 const getToken=method==='POST'&&body.action==='publicar_estado_guardado'?window.ukiInventarioToken:window.ukiMesasQAToken;
 const token=typeof getToken==='function'?await getToken():null;
 if(typeof token!=='string'||!token)throw Error('El equipo debe estar autorizado en el panel habitual.');
 if(store()!==storeId)throw Error('Cambió la sucursal. Abre el pedido nuevamente.');
 const params=new URLSearchParams({storeId,...(id?{id}:{})});
 const response=await fetch(API+(method==='GET'?'?'+params.toString():''),{
  method,cache:'no-store',credentials:'omit',
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
    location.hostname!=='diannaleandra-art.github.io')
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
 if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||!store()||
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
window.ukiQAConfirmTransferBeforePayment=async function({storeId,id,total,monto,revisionBancoMarcada=false}={}){
 if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||actionBusy||
    !storeId||store()!==storeId||!UUID.test(String(id||''))||
    !Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(monto)||monto<1)
  return 'no_disponible';
 actionBusy=true;
 try{
  const result=await query('GET',{},id),p=result.pedido;
  if(store()!==storeId||result.orderId!==id||result.totalPedido!==total||
     p?.storeId!==storeId||!['aceptada','en_camino'].includes(p.estadoPedido)||p.montoTransferencia!==monto)
   return 'no_disponible';
  if(p.estadoPago==='confirmada')return 'confirmada';
  if(result.puedeConfirmar!==true||!['pendiente','avisada'].includes(p.estadoPago)||
     p.datosBancariosVerificados!==true||p.datosBancariosSucursal!==storeId)
   return 'no_disponible';
  const nombre=Object.keys(NAMES).find(k=>NAMES[k]===storeId)||storeId;
  if(!revisionBancoMarcada&&!window.confirm('TRANSFERENCIA · '+nombre+' · Pedido '+(p.codigoPedido||'')+
   '\n¿Confirmas que viste abonados '+pesos(monto)+' en la cuenta bancaria de este pedido?'+
   '\nSólo acepta si verificaste el dinero en el banco.'))
   return 'cancelada';
  if(store()!==storeId||window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true)return 'no_disponible';
  const saved=await doAction('confirmar_transferencia',id,{montoRecibido:monto,verificadoEnBanco:true});
  return saved.estadoPago==='confirmada'&&store()===storeId?'confirmada':'no_disponible';
 }catch{return 'no_disponible';}
 finally{actionBusy=false;}
};


/* Proyección informativa: sólo DESPUÉS de confirmación de la caja/nube habitual.
 * No vuelve a cobrar ni hace que una operación ya guardada se repita.
 * Deshabilitado hasta aprobar el guardado y la publicación comercial.
 */
const estadosPublicados=new Map();
let publicandoEstado=false;
window.ukiQAPublishSavedState=async function({pedidos,revision,generacion}={}){
 const shop=store();
 if(window.UKI_SEGUIMIENTO_ESTADO_GUARDADO_AUTORIZADO!==true||
    window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||publicandoEstado||!shop||
    !Number.isSafeInteger(revision)||revision<1||! /^[a-f0-9]{32}$/.test(generacion||'')||!Array.isArray(pedidos))return false;
 publicandoEstado=true;let ok=true;
 try{
  for(const p of pedidos){
   if(store()!==shop)return false;
   if(NAMES[p?.suc]!==shop||p.esPremio||typeof p.pagado!=='boolean'||
      !['Pendiente','Entregado','Cancelado'].includes(p.estado))continue;
   const id=String(p.cartaSolicitudRemotaId||''),pedidoInterno=String(p.id||'');
   if(!UUID.test(id)||! /^[1-9][0-9]{0,11}$/.test(pedidoInterno))continue;
   // Tras recargar el panel, comprobar si un pedido vuelto a pendiente
   // tenía un pago/entrega publicado. No mantener un estado pagado obsoleto.
   if(!p.pagado&&p.estado==='Pendiente'&&!estadosPublicados.has(shop+'|'+id)){
    try{const prior=await query('GET',{},id);if(prior?.pedido?.pagoRegistrado!==true&&
     !['entregada','cancelada'].includes(prior?.pedido?.estadoPedido))continue;}catch{ok=false;continue;}
   }
   const d=seguimientoDistribucionRealQA(p);
   if(!d){ok=false;continue;}
   const monto=d.pagos.filter(x=>x.medio==='transferencia').reduce((sum,x)=>sum+x.monto,0)+Number(d.propinaTransferencia||0);
   const payload={id,revision,total:d.totalValidado,montoTransferencia:monto,estado:p.estado,pagado:p.pagado};
   const key=shop+'|'+id;
   const firma=JSON.stringify([payload.total,monto,p.estado,p.pagado]);
   if(estadosPublicados.get(key)===firma)continue;
   try{
    const result=await doAction('publicar_estado_guardado',id,{
     revision:payload.revision,generacion,pedidoInterno,total:payload.total,montoTransferencia:monto,estado:p.estado,pagado:p.pagado
    });
    if(result?.ok===true&&result.obsolete!==true)estadosPublicados.set(key,firma);else ok=false;
   }catch{ok=false;}
  }
  if(!ok&&store()===shop&&notice)tell('El pedido ya se guardó en caja. El seguimiento aún necesita sincronizarse; no vuelvas a cobrar.');
  return ok;
 }finally{publicandoEstado=false;}
};

function line(title,body){
 const div=section(title);div.append(text('p',body));return div;
}
// Alarma de pedidos de carta. Se repite hasta la aceptación o rechazo confirmado.
let audioPedido=null,pendientesSonido=new Set(),tiendaSonido=null,ultimoTono=0;
const resueltasSonido=new Set(),vocesPedido=new Set();
function detenerTonoPedido(){
 for(const o of vocesPedido){try{o.stop();}catch{}}
 vocesPedido.clear();ultimoTono=0;
}
function cambiarTiendaSonido(shop){
 if(tiendaSonido===shop)return;
 detenerTonoPedido();pendientesSonido.clear();resueltasSonido.clear();tiendaSonido=shop;
}
function tonoPedido(){
 if(!audioPedido||audioPedido.state!=='running'||!pendientesSonido.size||tiendaSonido!==store()||document.hidden||Date.now()-ultimoTono<2700)return;
 ultimoTono=Date.now();
 try{
  for(const [i,f] of [740,1040,880,1170].entries()){
   const o=audioPedido.createOscillator(),g=audioPedido.createGain(),t=audioPedido.currentTime+i*.24;
   o.type='triangle';o.frequency.value=f;
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.28,t+.035);
   g.gain.exponentialRampToValueAtTime(.0001,t+.21);
   o.connect(g);g.connect(audioPedido.destination);vocesPedido.add(o);
   o.onended=()=>{vocesPedido.delete(o);o.disconnect();g.disconnect();};
   o.start(t);o.stop(t+.22);
  }
 }catch{}
}
function actualizarAvisoSonoro(rows,shop){
 if(store()!==shop)return;
 cambiarTiendaSonido(shop);
 pendientesSonido=new Set(rows.filter(x=>x.estadoPedido==='pendiente'&&!resueltasSonido.has(x.id)).map(x=>x.id));
 if(pendientesSonido.size)tonoPedido();else detenerTonoPedido();
}
window.ukiSeguimientoSolicitudResuelta=function(id,shop){
 if(shop!==store()||!UUID.test(String(id||'')))return;
 cambiarTiendaSonido(shop);
 resueltasSonido.add(id);pendientesSonido.delete(id);
 if(!pendientesSonido.size)detenerTonoPedido();
 void loadList();
};
document.addEventListener('pointerdown',()=>{
 if(!store()||window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true)return;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  if(!audioPedido)audioPedido=new Audio();
  if(audioPedido.state!=='running')void audioPedido.resume().then(tonoPedido).catch(()=>{});
 }catch{}
},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){void loadList();tonoPedido();}});
setInterval(()=>{cambiarTiendaSonido(store());tonoPedido();},1000);
window.ukiSeguimientoMarcarRuta=async function(button,id){
 if(!button||button.disabled||!UUID.test(String(id||''))||!store()||actionBusy)return;
 const shop=store(),label=button.closest('[data-seguimiento-resumen-id]')?.querySelector('[data-seguimiento-resumen-aviso]');
 button.disabled=true;
 try{const data=await doAction('marcar_en_camino',id);if(store()!==shop||data.enCamino!==true)throw Error('No se confirmó el estado');button.textContent='✓ En camino';if(label)label.textContent='🛵 Pedido en camino';void loadList();}
 catch(e){button.disabled=false;if(label)label.textContent=String(e?.message||'No se pudo actualizar');}
};
async function loadList(){
 const shop=store();
 if(!shop||window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||busy)return;
 busy=true;if(dialog.open)tell('Consultando avisos…');
 try{
  const data=await query();
  if(store()!==shop)return;
  paintBadges(data.orders||[],shop);
  actualizarAvisoSonoro(data.orders||[],shop);
  if(!dialog.open)return;
  list.replaceChildren();
  const sorted=[...(data.orders||[])].sort((a,b)=>
   Number(Boolean(b.clienteAvisoEn))-Number(Boolean(a.clienteAvisoEn)));
  tell(sorted.length?'Solicitudes aceptadas: '+sorted.length:'No hay pedidos con seguimiento.');
  for(const entry of sorted){
   const item=line((entry.codigoPedido||'Pedido')+' · '+(entry.cliente||'Cliente'),
    entry.montoTransferencia>0?'Transferencia '+pesos(entry.montoTransferencia)+' · '+
     (entry.estadoPago==='confirmada'?'Verificada':entry.estadoPago==='avisada'?
      'El cliente avisó; falta verificar':entry.estadoPago==='requiere_revision'?'Requiere revisión':'Pendiente'):
     entry.pagoDeclarado==='transferencia'?'Cliente seleccionó transferencia · monto por verificar':
     'Sin transferencia pendiente registrada');
   item.append(btn('Ver seguimiento',()=>window.ukiQAOpenOrderTracking(entry.id)));
   list.append(item);
  }
 }catch(e){/* Un error de red no confirma aceptación; conservar alarma pendiente. */if(dialog.open&&store()===shop)tell(e.message);}finally{busy=false;}
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
  const p=data.pedido,signature=JSON.stringify([p,data.puedeConfirmar]);
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
   payment.append(text('p',p.descripcionPago||'Transferencia por revisar'));
   if(data.puedeConfirmar&&p.estadoPago!=='confirmada'&&p.estadoPago!=='requiere_revision'){
    // Un solo toque DESPUÉS de mirar el abono real en el banco.
    // El importe proviene del servidor, nunca se permite escribir otro valor.
    const button=document.createElement('input');button.type='checkbox';button.style.cssText='width:20px;height:20px;flex:none;margin:0';
    const checkLabel=document.createElement('label');checkLabel.style.cssText='display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #d3b99d;border-radius:8px;font-weight:600';
    checkLabel.append(button,document.createTextNode('Transferencia revisada en el banco · '+pesos(p.montoTransferencia)));
    button.addEventListener('change',async()=>{
     if(!button.checked)return;
     if(!Number.isSafeInteger(p.montoTransferencia)||p.montoTransferencia<=0){
      tell('El importe del pedido debe revisarse antes de confirmar.',target);return;
     }
     if(!isActive(target,id,shop)||actionBusy||loadingDetail){button.checked=false;return;}
     button.disabled=true;actionBusy=true;
     try{
      const saved=await doAction('confirmar_transferencia',id,{
       montoRecibido:p.montoTransferencia,verificadoEnBanco:true
      });
      if(saved.estadoPago!=='confirmada')throw Error('No se confirmó la revisión bancaria.');
      if(isActive(target,id,shop))tell('Transferencia verificada. Continúa con el cierre habitual.',target);
     }catch(e){button.checked=false;if(isActive(target,id,shop))tell(e.message,target);}
     finally{
      button.disabled=false;actionBusy=false;
      if(isActive(target,id,shop)){await loadDetail(id,target);void loadList();}
     }
    });
    payment.append(checkLabel);
   }
  }else payment.append(text('p','Transferencia no registrada o aún por revisar.'));
  target.append(payment);
  // Historial de mensajes anteriores: sólo lectura, sin nuevo canal de atención.
  if(Array.isArray(p.mensajes)&&p.mensajes.length){
   const history=document.createElement('details');
   history.append(text('summary','Mensajes anteriores (sólo lectura)'));
   const ul=document.createElement('ul');
   for(const message of p.mensajes){
    if(message&&typeof message.texto==='string')ul.append(text('li',(message.remitente==='cliente'?'Cliente: ':'Local: ')+message.texto));
   }
   history.append(ul);target.append(history);
  }
  
 }catch(e){if(isActive(target,id,shop)){tell(e.message,target);if(!refresh)target.replaceChildren();}}
 finally{loadingDetail=false;
  if(activeDetail&&(activeDetail!==target||selectedId!==id)&&selectedId&&store()===activeStore)
   void loadDetail(selectedId,activeDetail);
 }
}
// Acceso rápido desde el pedido existente: no pide buscar otra sección.
window.ukiQAOpenOrderTracking=async function(orderId){
 if(!root||!dialog||!detail||!store())return false;
 const id=String(orderId||'');
 if(!UUID.test(id)){tell('Este pedido aún no tiene seguimiento vinculado.');return false;}
 visibility();if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||actionBusy)return false;
 const card=inlineFor(id),target=card?.querySelector('[data-seguimiento-detalle]')||detail;
 if(target===detail&&root.hidden)return false;
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
  void loadList();
  if(activeDetail&&selectedId&&isActive(activeDetail,selectedId,activeStore)&&!activeDetail.hidden)
   void loadDetail(selectedId,activeDetail,true);
 },5000);
 visibility();
}
