/* Archivo mensual privado: mismo panel, sin modificar pedidos, cierres ni timbres. */
(function(){
 'use strict';
 const HOST='https://uki-sushi-inventario.vercel.app';
 const core=()=>window.UkiArchivoMensual;
 const loginURL=HOST+'/api/mi-administracion-live',archiveURL=HOST+'/api/mi-archivo-mensual-live';
 let finSession='',ultimo=null,loading=false;
 const $=(id,el=document)=>el.querySelector('#'+id);
 function hoyChile(){
  const o=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return o.year+'-'+o.month+'-'+o.day;
 }
 function mesInicial(){
  const hoy=hoyChile(),d=new Date(Date.UTC(Number(hoy.slice(0,4)),Number(hoy.slice(5,7))-2,1));
  return d.toISOString().slice(0,7)<'2026-11'?'2026-11':d.toISOString().slice(0,7);
 }
 async function llamar(url,token,session,body){
  const response=await fetch(url,{method:'POST',cache:'no-store',credentials:'omit',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'X-Fin-Session':session||''},
   body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true)throw Error(data?.error||'No se pudo confirmar el archivo en Mi Administración.');
  return data;
 }
 function verificarNube(suc){
  if(suc==='Romo’s Sushi La Serena'){
   if(window.ukiRomoGuardadoHabilitadoQA?.()!==true||!window.ukiRomoSesionRemotaQA?.disponible?.()||window.ukiRomoSesionRemotaQA?.estado?.()?.conflicto)
    throw Error('Primero confirma que Romo esté conectado y sincronizado con Neon.');
  }else if(window.ukiCancelacionNubeLista?.()!==true)
   throw Error('Primero espera a que Uki indique Nube: sincronizado.');
 }
 function descargar(blob,nombre){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=nombre;document.body.append(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},3000);
 }
 function instalar(raiz){
  if(raiz.dataset.archivoInstalado)return;
  raiz.dataset.archivoInstalado='1';
  const d=document.createElement('details');d.className='card';d.innerHTML=
   '<summary style="cursor:pointer"><b>🗄️ Archivo mensual · Excel y PDF</b></summary>'+
   '<p class="muted">Guarda todos los pedidos, cierres, ventas, WhatsApp, clientes y timbres de un mes en Mi Administración.</p>'+
   '<p class="muted">El primer mes será noviembre de 2026, disponible desde el 5 de diciembre. Ningún dato se elimina antes de verificar el respaldo.</p>'+
   '<label for="ukiArchivoMes">Mes completo</label><input id="ukiArchivoMes" type="month" min="2026-11">'+
   '<label for="ukiArchivoPin">PIN privado de Mi Administración (dueños)</label><input id="ukiArchivoPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off">'+
   '<button id="ukiArchivoGuardar" type="button" class="big">Guardar mes en Mi Administración</button>'+
   '<p id="ukiArchivoEstado" role="status" class="muted">Confirma que la sucursal esté sincronizada antes de guardar.</p>'+
   '<div class="quick-grid"><button type="button" id="ukiArchivoExcel" disabled>Descargar Excel</button>'+
   '<button type="button" id="ukiArchivoPDF" disabled>Descargar PDF</button></div>'+
   '<p class="muted">Los timbres vigentes y los cierres originales permanecen intactos. La limpieza automática seguirá bloqueada hasta comprobar los archivos.</p>';
  raiz.append(d);
  const mes=$('ukiArchivoMes',raiz),pin=$('ukiArchivoPin',raiz),b=$('ukiArchivoGuardar',raiz),ex=$('ukiArchivoExcel',raiz),pd=$('ukiArchivoPDF',raiz),msg=$('ukiArchivoEstado',raiz);
  mes.value=mesInicial();
  const estado=(t,error=false)=>{msg.textContent=t;msg.style.color=error?'#af1231':'';};
  mes.addEventListener('change',()=>{ultimo=null;ex.disabled=true;pd.disabled=true;});
  b.addEventListener('click',async()=>{
   if(loading)return;loading=true;b.disabled=true;
   try{
    const contexto=window.ukiQAGet?.();
    if(!contexto?.suc||!contexto?.estado)throw Error('Abre primero una sucursal.');
    verificarNube(contexto.suc);
    const archivo=core()?.generar(contexto.estado,mes.value);
    if(!archivo)throw Error('No se cargó el generador mensual.');
    const token=await window.ukiInventarioToken?.();
    if(!token)throw Error('Inicia sesión con tu Google autorizado de dueños.');
    if(!finSession){
     if(!/^\d{6}$/.test(pin.value))throw Error('Escribe el PIN privado de seis dígitos.');
     const response=await llamar(loginURL,token,'',{action:'ingresar_pin',pin:pin.value});
     if(!/^[a-f0-9]{64}$/.test(String(response.sesion||'')))throw Error('No se recibió una sesión privada válida.');
     finSession=response.sesion;pin.value='';
    }
    estado('Comprimiendo y verificando el archivo completo…');
    const packed=await core().empaquetar(archivo);
    const response=await llamar(archiveURL,token,finSession,{action:'guardar',sucursal:archivo.sucursal,mes:archivo.mes,
     sha256:packed.sha256,encoding:packed.encoding,base64:packed.base64});
    if(response.confirmado!==true||response.sha256!==packed.sha256||response.mes!==archivo.mes)
     throw Error('El archivo no fue confirmado con la misma huella digital.');
    ultimo=archivo;ex.disabled=pd.disabled=false;
    estado('✓ Mes archivado en Mi Administración. Descarga el Excel y PDF.');
   }catch(e){
    if(/PIN|sesión|código privado/.test(String(e.message||'')))finSession='';
    estado(String(e.message||e)+'. No se eliminó ningún registro.',true);
   }finally{loading=false;b.disabled=false;}
  });
  ex.onclick=()=>{
   if(!ultimo||ultimo.mes!==mes.value)return estado('Primero guarda este mes.',true);
   descargar(new Blob([core().excel(ultimo)],{type:'text/csv;charset=utf-8'}),
    'archivo-'+ultimo.sucursal.replace(':','-')+'-'+ultimo.mes+'.csv');
   estado('Excel preparado para descargar.');
  };
  pd.onclick=()=>{
   if(!ultimo||ultimo.mes!==mes.value)return estado('Primero guarda este mes.',true);
   try{
    descargar(core().pdf(ultimo),'archivo-'+ultimo.sucursal.replace(':','-')+'-'+ultimo.mes+'.pdf');
    estado('PDF preparado para descargar.');
   }catch(e){estado(String(e.message||e),true);}
  };
 }
 function iniciar(){
  const app=document.getElementById('app');if(!app)return;
  const activar=()=>{const h=document.getElementById('ukiArchivoMensualRoot');if(h&&!h.dataset.archivoInstalado)instalar(h);};
  new MutationObserver(activar).observe(app,{childList:true,subtree:true});
  activar();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
})();