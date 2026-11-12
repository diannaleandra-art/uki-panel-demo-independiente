/**
 * Romo en la MISMA pantalla PEDIDOS del panel Uki. Bandeja de solicitudes
 * iniciadas desde WhatsApp, no venta. Nunca acepta/rechaza o escribe caja.
 * La API exige token Google firmado, rol activo de Romo y base independiente.
 */
const STORE='romo:serena';
const ENDPOINT=''; // Abrir solamente tras aprobación y pruebas de bandeja.
const id='romoSolicitudesEnPanelQA';
function addLine(document,host,text){
 const p=document.createElement('p');p.className='muted';p.textContent=text;host.append(p);
}
export async function consultarSolicitudesPendientesRomoQA({
 endpoint=ENDPOINT,getToken=()=>window.ukiInventarioToken?.(),
 fetchFn=globalThis.fetch
}={}){
 if(!ENDPOINT||endpoint!==ENDPOINT)throw Error('La bandeja de Romo aún no está activada');
 if(typeof getToken!=='function'||typeof fetchFn!=='function')
  throw Error('Google de Uki no disponible');
 const token=await getToken();
 if(typeof token!=='string'||token.length<30||token.length>12000)
  throw Error('Utiliza la cuenta Google autorizada del panel');
 const response=await fetchFn(endpoint,{
  method:'GET',cache:'no-store',mode:'cors',credentials:'omit',
  headers:{Authorization:'Bearer '+token}
 });
 if(!response.ok)throw Error(response.status===403?'Cuenta sin permiso de Romo':'No se pudo consultar la bandeja');
 const body=await response.json();
 if(body?.ok!==true||body.storeId!==STORE||body.soloSolicitudes!==true||
    !Array.isArray(body.orders)||body.orders.length>100||
    body.orders.some(x=>x.store_id!==STORE||!['pendiente','aceptada','rechazada'].includes(x.estado)))
  throw Error('La bandeja recibió pedidos ajenos a Romo');
 return Object.freeze({storeId:STORE,orders:body.orders.map(x=>Object.freeze({...x}))});
}
export function montarSolicitudesRomoEnPedidosQA({
 document,storeId,sessionVerified=false,qaOnly=false
}={}){
 if(storeId!==STORE||!sessionVerified||!qaOnly||
    !document?.body?.classList?.contains('romo-qa'))
  return false;
 const host=document.getElementById('app');
 if(!host||document.getElementById(id))return false;
 const section=document.createElement('section');
 section.className='card';section.id=id;
 const head=document.createElement('h2');head.textContent='Solicitudes de la carta · Romo La Serena';
 section.append(head);
 addLine(document,section,'Las solicitudes todavía no son ventas ni timbres. Se aceptan solo al guardarlas en el panel.');
 const status=document.createElement('p');
 status.setAttribute('role','status');status.className='muted';
 status.textContent='Bandeja de Romo pendiente de activación; no hay pedidos nuevos que consultar aquí.';
 section.append(status);
 const btn=document.createElement('button');btn.type='button';
 btn.className='big romo-bandeja-qa-button';
 btn.textContent='Actualizar solicitudes de Romo';
 btn.disabled=!ENDPOINT;
 section.append(btn);
 const list=document.createElement('div');section.append(list);
 btn.addEventListener('click',async()=>{
  btn.disabled=true;
  status.textContent='Comprobando Google y solicitudes Romo…';
  try{
   const results=await consultarSolicitudesPendientesRomoQA();
   list.replaceChildren();
   if(!results.orders.length)addLine(document,list,'Sin solicitudes de Romo registradas.');
   for(const item of results.orders){
    const card=document.createElement('article');card.className='card';
    const title=document.createElement('strong');
    title.textContent=String(item.codigo_pedido||'Solicitud sin código').slice(0,60);
    card.append(title);
    addLine(document,card,String(item.cliente||'').slice(0,80)+' · '+String(item.estado||''));
    addLine(document,card,String(item.mensaje||'').slice(0,12000));
    addLine(document,card,'Total indicado por cliente: $'+Number(item.total_indicado||0).toLocaleString('es-CL')+
     ' · No contabilizado en caja');
    list.append(card);
   }
   status.textContent=results.orders.length+' solicitudes consultadas. Sin ventas registradas.';
  }catch(e){status.textContent=String(e?.message||'Consulta pendiente')}
  finally{btn.disabled=!ENDPOINT}
 });
 const after=document.getElementById('romoLaSerenaPreparacionQA');
 if(after&&after.parentNode===host)after.after(section);else host.prepend(section);
 return true;
}
if(typeof window!=='undefined'){
 window.ukiRomoSolicitudesMontarQA=()=>{
  const context=window.ukiRomoPedidosQAContexto?.();
  return montarSolicitudesRomoEnPedidosQA({
   document,storeId:context?.storeId,
   sessionVerified:context?.sessionVerified===true,qaOnly:context?.qaOnly===true
  });
 };
}
export const ROMO_PEDIDOS_BANDEJA_SIN_VENTAS=true;
