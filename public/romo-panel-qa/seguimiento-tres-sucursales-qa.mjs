/*
 * Seguimiento privado de las tres sucursales en panel existente.
 * NO activa cajeros, ventas, pagos ni el backend por sí solo.
 */
const NAMES=Object.freeze({
 'Uki Regimiento Arica':'uki:arica',
 'Uki La Serena':'uki:serena',
 'Romo’s Sushi La Serena':'romo:serena'
});
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
  const link=section('Seguimiento del cliente');
  link.append(text('p','El cliente recibe su enlace al registrar la solicitud cuando el seguimiento está habilitado. Aquí puedes copiar el mismo enlace si necesita recuperarlo.'));
  const linkButton=btn('Copiar enlace del pedido',async()=>{
   linkButton.disabled=true;
   try{
    const address=await doAction('generar_enlace',id);
    try{await navigator.clipboard.writeText(address);tell('Enlace copiado. Se conserva el mismo enlace del cliente.');}
    catch{
     const input=text('textarea',address);input.readOnly=true;input.style.width='100%';
     link.append(field('Copia este enlace privado',input));
     tell('Copia manualmente el enlace para enviarlo al cliente.');
    }
   }catch(e){tell(e.message);}finally{linkButton.disabled=false;}
  });
  link.append(linkButton);detail.append(link);
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
if(root&&dialog&&list&&detail&&notice){
 $('romo-seguimiento-actualizar-qa')?.addEventListener('click',loadList);
 dialog.addEventListener('toggle',()=>{if(dialog.open)loadList();});
 document.addEventListener('click',visibility);
 setInterval(()=>{visibility();if(store()&&dialog.open&&!document.hidden)loadList();},30000);
 visibility();
}
