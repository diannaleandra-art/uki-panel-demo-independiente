/*
 * QA · Bandeja discreta para Romo. El acceso real sigue siendo Google.
 * Sin abrir automáticamente ventanas ni alterar caja/pedidos.
 */
const STORE='Romo’s Sushi La Serena';
const API='/api/romo-seguimiento-personal-qa';
const $=id=>document.getElementById(id);
const root=$('romo-seguimiento-bandeja-qa');
const details=$('romo-seguimiento-abrir-qa');
const list=$('romo-seguimiento-lista-qa');
const detail=$('romo-seguimiento-detalle-qa');
const status=$('romo-seguimiento-resumen-qa');
const money=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
let requestBusy=false,activeId=null,opened=false;
const element=(tag,text)=>{
 const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;
};
function warn(message){status.textContent=String(message||'');}
function selected(){return window.ukiQAGet?.()?.suc===STORE;}
function visibility(){
 root.hidden=!selected();
 if(root.hidden&&details.open)details.open=false;
}
async function request(method='GET',query='',payload){
 const getToken=window.ukiMesasTokenConfirmar;
 const token=typeof getToken==='function'?await getToken():null;
 if(!token)throw Error('Abre el panel e inicia sesión con Google.');
 const res=await fetch(API+query,{method,cache:'no-store',credentials:'same-origin',
  headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(payload)}:{}),
  signal:AbortSignal.timeout(15000)});
 const data=await res.json().catch(()=>null);
 if(!res.ok||data?.ok!==true||data.storeId!=='romo:serena')
  throw Error(data?.error||'No se pudo consultar la bandeja.');
 return data;
}
function section(title){
 const s=element('section');s.style.cssText='padding:14px 0;border-top:1px solid #eee';
 s.append(element('h3',title));return s;
}
function action(label,callback){
 const b=element('button',label);b.type='button';b.className='sm';b.addEventListener('click',callback);return b;
}
function label(text,input){
 const line=element('label');line.textContent=text;
 line.style.cssText='display:block;margin:10px 0;font-size:14px';
 line.append(input);return line;
}
async function loadList(){
 if(requestBusy||!selected()||!details.open)return;
 requestBusy=true;warn('Consultando avisos…');
 try{
  const data=await request();
  list.replaceChildren();
  const items=data.orders||[];
  const priority=[...items].sort((a,b)=>
    Number(Boolean(b.clienteAvisoEn||b.ultimaConsulta))-Number(Boolean(a.clienteAvisoEn||a.ultimaConsulta)));
  warn(items.length?'Pedidos registrados: '+items.length:'No hay avisos recientes.');
  for(const o of priority){
   if(!o||!o.id)continue;
   const line=section((o.codigoPedido||'Solicitud')+' · '+(o.cliente||'Cliente'));
   const payment=element('p',
    o.metodoPago==='transferencia'?
     'Transferencia '+(o.estadoPago==='confirmada'?'verificada manualmente':o.estadoPago==='avisada'?'avisada · pendiente de revisión':'pendiente')+
      (o.montoTransferencia>0?' · '+money.format(o.montoTransferencia):''):
     'Pago a coordinar en el pedido');
   payment.style.cssText='font-size:14px;line-height:1.5;margin:6px 0';
   line.append(payment,action('Ver pedido y mensajes',()=>loadOrder(o.id)));
   list.append(line);
  }
 }catch(e){warn(e.message);}
 finally{requestBusy=false;}
}
async function loadOrder(id){
 activeId=id;detail.hidden=false;detail.replaceChildren(element('p','Cargando pedido…'));
 try{
  const result=await request('GET','?id='+encodeURIComponent(id));
  if(activeId!==id)return;
  const p=result.pedido;
  detail.replaceChildren();
  detail.append(element('h3','Pedido '+p.codigoPedido));
  detail.append(element('p',p.cliente+' · '+p.estadoPedido));
  const payment=section('Transferencia');
  if(p.metodoPago==='transferencia'&&Number.isSafeInteger(p.montoTransferencia)&&p.montoTransferencia>0){
   payment.append(element('p','Monto declarado: '+money.format(p.montoTransferencia)));
   payment.append(element('p','Estado: '+(p.estadoPago==='confirmada'?'Verificada manualmente':p.estadoPago==='avisada'?'Cliente avisó, falta verificar':'Aún sin aviso')));
   if(result.puedeConfirmar&&p.estadoPago!=='confirmada'){
    const amount=element('input');amount.type='number';amount.min='1';amount.step='1';
    amount.placeholder='Monto realmente recibido en el banco';
    const check=element('input');check.type='checkbox';check.style.width='auto';
    const mark=label(' Comprobé directamente en el banco que el abono fue recibido',check);
    const btn=action('Confirmar transferencia revisada',async()=>{
     const n=Number(amount.value);
     if(!check.checked||!Number.isSafeInteger(n)||n!==p.montoTransferencia){
      warn('Revisa el abono real, escribe el importe recibido y marca la confirmación.');return;
     }
     btn.disabled=true;
     try{await request('POST','',{action:'confirmar_transferencia',id,montoRecibido:n,verificadoEnBanco:true});
      warn('Verificación manual registrada. No se sumó un cobro a caja.');await loadOrder(id);
     }catch(e){warn(e.message);}finally{btn.disabled=false;}
    });
    payment.append(label('Monto que aparece abonado en tu banco',amount),mark,btn);
   }
  }else payment.append(element('p','Este pedido no tiene una transferencia verificable desde el seguimiento.'));
  detail.append(payment);
  const chat=section('Mensajes del pedido');
  if(result.chatHabilitado){
   const ul=element('ul');ul.style.cssText='padding-left:18px;max-height:240px;overflow:auto';
   for(const m of result.mensajes||[]){
    const li=element('li',(m.remitente==='cliente'?'Cliente: ':'Local: ')+m.texto);
    li.style.cssText='padding:7px 0;white-space:pre-wrap;overflow-wrap:anywhere';ul.append(li);
   }
   chat.append(ul);
   const input=element('textarea');input.rows=2;input.maxLength=800;input.placeholder='Respuesta breve sobre este pedido';
   const btn=action('Enviar respuesta',async()=>{
    const txt=input.value.trim();if(!txt)return;
    btn.disabled=true;
    try{await request('POST','',{action:'responder_mensaje',id,texto:txt});
     warn('Respuesta enviada.');await loadOrder(id);
    }catch(e){warn(e.message);}finally{btn.disabled=false;}
   });
   chat.append(label('Escribe al cliente',input),btn);
  }else chat.append(element('p','Chat pendiente de activación en QA.'));
  detail.append(chat);
 }catch(e){warn(e.message);detail.replaceChildren();}
}
details.addEventListener('toggle',()=>{
 if(details.open){opened=true;loadList();}
});
$('romo-seguimiento-actualizar-qa').addEventListener('click',()=>loadList());
document.addEventListener('click',visibility);
setInterval(()=>{visibility();if(opened&&selected()&&details.open&&!document.hidden)loadList();},30000);
visibility();
