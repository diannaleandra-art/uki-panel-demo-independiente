/**
 * Romo en la MISMA pantalla PEDIDOS del panel Uki. Bandeja de solicitudes
 * iniciadas desde WhatsApp, no venta. Nunca acepta/rechaza o escribe caja.
 * La API exige token Google firmado, rol activo de Romo y base independiente.
 */
import {prepararBorradorSolicitudRomoQA} from './uki-romo-formulario-solicitud-qa.mjs';
const STORE='romo:serena';
const ENDPOINT='https://uki-sushi-inventario.vercel.app/api/romo-solicitudes-carta-qa';
export const ROMO_PANEL_BANDEJA_HABILITADA_QA=false; // Activa solo con aprobación.
const id='romoSolicitudesEnPanelQA';
function addLine(document,host,text){
 const p=document.createElement('p');p.className='muted';p.textContent=text;host.append(p);
}
export async function consultarSolicitudesPendientesRomoQA({
 endpoint=ENDPOINT,getToken=()=>window.ukiInventarioToken?.(),
 fetchFn=globalThis.fetch,enabled=ROMO_PANEL_BANDEJA_HABILITADA_QA
}={}){
 if(enabled!==true||endpoint!==ENDPOINT)throw Error('La bandeja de Romo aún no está activada');
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
 document,storeId,sessionVerified=false,qaOnly=false,
 enabled=ROMO_PANEL_BANDEJA_HABILITADA_QA,
 consultar=options=>consultarSolicitudesPendientesRomoQA(options),
 abrirEnFormulario=item=>globalThis.window?.ukiRomoAbrirSolicitudEnFormularioQA?.(item)
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
 btn.disabled=!enabled;
 section.append(btn);
 const list=document.createElement('div');section.append(list);
 btn.addEventListener('click',async()=>{
  btn.disabled=true;
  status.textContent='Comprobando Google y solicitudes Romo…';
  try{
   const results=await consultar({enabled});
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
    if(enabled===true&&item.estado==='pendiente'){
     if(item.en_reserva===true){
      addLine(document,card,'En revisión en otro equipo. No ingresar el pedido de nuevo.');
     }else{
      const action=document.createElement('button');
      action.type='button';action.className='sm ok romo-aceptar-revisar-qa';
      action.textContent='✅ Aceptar y revisar';
      action.addEventListener('click',()=>{
       try{
        // La solicitud NO se acepta en el servidor por abrir este formulario.
        // Solo se prepara el borrador; reserva, guardado y cobro se validan aparte.
        const borrador=prepararBorradorSolicitudRomoQA(item);
        const ok=abrirEnFormulario({solicitud:item,borrador});
        if(ok!==true)status.textContent='No se abrió: comprueba el acceso a Romo y revisa si ya está registrado.';
       }catch(error){status.textContent=String(error?.message||'No se pudo abrir el pedido de Romo');}
      });
      card.append(action);
     }
    }
    list.append(card);
   }
   status.textContent=results.orders.length+' solicitudes consultadas. Sin ventas registradas.';
  }catch(e){status.textContent=String(e?.message||'Consulta pendiente')}
  finally{btn.disabled=!enabled}
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
