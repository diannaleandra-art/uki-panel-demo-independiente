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
window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED=TRACKING_PAYMENT_PREVIEW_QA;
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
const store=()=>NAMES[window.ukiQAGet?.()?.suc]||null;
const tell=message=>{notice.textContent=String(message||'')};
let busy=false,selectedId=null;
function visibility(){
 if(!root||!dialog)return;
 root.hidden=!store();
 if(root.hidden){dialog.open=false;selectedId=null;}
}
async function query(method='GET',body={},id=''){
 const storeId=store();if(!storeId)throw Error('Selecciona el local.');
 const getToken=window.ukiMesasTokenConfirmar;
 const token=typeof getToken==='function'?await getToken():null;
 if(typeof token!=='string'||!token)throw Error('Inicia sesión con Google desde el panel.');
 const params=new URLSearchParams({storeId,...(id?{id}:{})});
 const response=await fetch(API+(method==='GET'?'?'+params.toString():''),{
  method,cache:'no-store',credentials:'same-origin',
  headers:{Authorization:'Bearer '+token,'Accept':'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify({...body,storeId})}:{}),
  signal:AbortSignal.timeout(15000)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true||data.storeId!==storeId)
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
    !Number.isSafeInteger(order.total)||Number(order.propina||0)!==0)return null;
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
window.ukiQAConfirmPaymentMethodAfterSave=async function({storeId,solicitudId,pedido}={}){
 // El mismo panel sigue guardando normalmente; esta acción sólo existe
 // en el preview exacto y cuando QA la habilite de forma explícita.
 if(window.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true||
    location.protocol!=='https:'||
    !/^romos-sushi-panel-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(location.hostname))
  return {attempted:false,reason:'qa_disabled'};
 if(!storeId||store()!==storeId||
    typeof solicitudId!=='string'||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i.test(solicitudId)||
    !pedido||String(pedido.cartaSolicitudRemotaId||'')!==solicitudId)
  return {attempted:false,reason:'identity_missing'};
 const payment=seguimientoMedioSimpleQA(pedido);
 if(!payment)return {attempted:false,reason:'manual_review_required'};
 try{
  const data=await query('POST',{action:'confirmar_medio_de_pago',id:solicitudId,...payment});
  return {attempted:true,ok:true,repeated:data.repeated===true};
 }catch(e){
  // Un fallo de QA no convierte un pedido guardado en un cobro confirmado.
  if(notice)tell('El pedido está guardado; queda por verificar su medio de pago en seguimiento.');
  return {attempted:true,ok:false,error:'payment_method_unverified'};
 }
};

function line(title,body){
 const div=section(title);div.append(text('p',body));return div;
}
async function loadList(){
 if(!store()||!dialog.open||busy)return;busy=true;tell('Consultando avisos…');
 try{
  const data=await query();
  list.replaceChildren();
  const sorted=[...(data.orders||[])].sort((a,b)=>
   Number(Boolean(b.clienteAvisoEn||b.ultimaConsulta))-Number(Boolean(a.clienteAvisoEn||a.ultimaConsulta)));
  tell(sorted.length?'Solicitudes aceptadas: '+sorted.length:'No hay mensajes recientes.');
  for(const entry of sorted){
   const item=line((entry.codigoPedido||'Pedido')+' · '+(entry.cliente||'Cliente'),
    entry.montoTransferencia>0?'Transferencia '+pesos(entry.montoTransferencia)+' · '+
     (entry.estadoPago==='confirmada'?'Verificada':entry.estadoPago==='avisada'?
      'El cliente avisó; falta verificar':entry.estadoPago==='requiere_revision'?'Requiere revisión':'Pendiente'):
     entry.pagoDeclarado==='transferencia'?'Cliente seleccionó transferencia · monto por verificar':
     'Sin transferencia pendiente registrada');
   item.append(btn('Ver seguimiento y mensajes',()=>loadDetail(entry.id)));
   list.append(item);
  }
 }catch(e){tell(e.message);}finally{busy=false;}
}
async function doAction(action,id,extra={}){
 const result=await query('POST',{action,id,...extra});
 if(action==='generar_enlace'){
  if(typeof result.enlace!=='string'||!result.enlace.startsWith('https://'))throw Error('Enlace inválido.');
  return result.enlace;
 }
 return result;
}
async function loadDetail(id){
 if(!/^[a-f0-9-]{36}$/i.test(String(id||'')))return;
 selectedId=id;detail.hidden=false;detail.replaceChildren(text('p','Consultando pedido…'));
 try{
  const data=await query('GET',{},id);if(selectedId!==id)return;
  const p=data.pedido;
  detail.replaceChildren(text('h3','Pedido '+(p.codigoPedido||'')),text('p',p.descripcionPedido||p.estadoPedido));
  // No crear pantallas ni enlaces nuevos para el personal. El cliente
  // mantiene su acceso privado dentro de la carta que ya utilizó.
  const seguimiento=section('Seguimiento del cliente');
  seguimiento.append(text('p',p.estadoPedido==='pendiente'?
   'Solicitud pendiente de aceptación. El cliente puede conservar esta carta para seguir el pedido.':
   'El cliente sigue este pedido directamente en la carta. Puede dejarla abierta o guardar el acceso en su celular.'));
  detail.append(seguimiento);
  const payment=section('Transferencia');
  if(Number.isSafeInteger(p.montoTransferencia)&&p.montoTransferencia>0){
   payment.append(text('p','Monto de transferencia: '+pesos(p.montoTransferencia)));
   payment.append(text('p',p.descripcionPago||'Transferencia por revisar'));
   if(data.puedeConfirmar&&p.estadoPago!=='confirmada'&&p.estadoPago!=='requiere_revision'){
    // Un solo toque DESPUÉS de mirar el abono real en el banco.
    // El importe proviene del servidor, nunca se permite escribir otro valor.
    const button=btn('Confirmar: vi '+pesos(p.montoTransferencia)+' abonados',async()=>{
     if(!Number.isSafeInteger(p.montoTransferencia)||p.montoTransferencia<=0){
      tell('El importe del pedido debe revisarse antes de confirmar.');return;
     }
     button.disabled=true;
     try{
      await doAction('confirmar_transferencia',id,{
       montoRecibido:p.montoTransferencia,verificadoEnBanco:true
      });
      tell('Transferencia verificada. No se sumó un cobro nuevo a caja.');
      await loadDetail(id);
     }catch(e){tell(e.message);}finally{button.disabled=false;}
    });
    payment.append(text('p','Primero comprueba en el banco que llegó exactamente '+pesos(p.montoTransferencia)+'.'),button);
   }
  }else payment.append(text('p','Transferencia no registrada o aún por revisar.'));
  detail.append(payment);
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
    const value=reply.value.trim();if(!value)return;
    send.disabled=true;
    try{await doAction('responder_mensaje',id,{texto:value});
     tell('Respuesta enviada.');await loadDetail(id);}
    catch(e){tell(e.message);}finally{send.disabled=false;}
   });
   chat.append(field('Respuesta para el cliente',reply),send);
  }else chat.append(text('p','El chat todavía no está habilitado en este entorno.'));
  detail.append(chat);
 }catch(e){tell(e.message);detail.replaceChildren();}
}
// Acceso rápido desde el pedido existente: no pide buscar otra sección.
window.ukiQAOpenOrderTracking=async function(orderId){
 if(!root||!dialog||!detail||!store())return false;
 const id=String(orderId||'');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i.test(id)){
  tell('Este pedido aún no tiene seguimiento vinculado.');return false;
 }
 visibility();
 if(root.hidden)return false;
 dialog.open=true;
 await loadDetail(id);
 root.scrollIntoView({block:'start',behavior:'smooth'});
 return true;
};
if(root&&dialog&&list&&detail&&notice){
 $('romo-seguimiento-actualizar-qa')?.addEventListener('click',loadList);
 dialog.addEventListener('toggle',()=>{if(dialog.open)loadList();});
 document.addEventListener('click',visibility);
 setInterval(()=>{visibility();if(store()&&dialog.open&&!document.hidden)loadList();},30000);
 visibility();
}
