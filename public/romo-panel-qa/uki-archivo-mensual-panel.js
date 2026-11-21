/* Archivo mensual privado: mismo panel, sin modificar pedidos, cierres ni timbres. */
(function(){
 'use strict';
 const HOST='https://uki-sushi-inventario.vercel.app';
 const core=()=>window.UkiArchivoMensual;
 const loginURL=HOST+'/api/mi-administracion-live',archiveURL=HOST+'/api/mi-archivo-mensual-live';
 let finSession='',finSessionHasta=0,ultimo=null,loading=false;
 const $=(id,el=document)=>el.querySelector('#'+id);
 function hoyChile(){
  const o=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return o.year+'-'+o.month+'-'+o.day;
 }
 function mesInicial(){
  // Solo proponer el mes cerrado cuyo día 5 ya llegó en Chile.
  const [ano,mes,dia]=hoyChile().split('-').map(Number);
  const d=new Date(Date.UTC(ano,mes-1-(dia>=5?1:2),1));
  const elegido=d.toISOString().slice(0,7);
  return elegido<'2026-11'?'2026-11':elegido;
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
   if(window.ukiRomoGuardadoHabilitadoQA?.()!==true||
      !window.ukiRomoSesionRemotaQA?.disponible?.()||
      window.ukiRomoSesionRemotaQA?.estado?.()?.conflicto)
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
   '<summary style="cursor:pointer"><b>🗄️ Respaldo mensual</b></summary>'+
   '<p class="muted">Guarda la información de esta sucursal en Mi Administración, con Excel y PDF. No borra ningún registro.</p>'+
   '<div id="ukiArchivoPinArea"><label for="ukiArchivoPin">PIN de dueños</label>'+
   '<input id="ukiArchivoPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="Tu PIN habitual de 6 números">'+
   '<p class="muted">Usa el PIN que ya tienes. Solo se solicita al iniciar una sesión privada.</p></div>'+
   '<button id="ukiArchivoGuardar" type="button" class="big">Guardar respaldo</button>'+
   '<p id="ukiArchivoEstado" role="status" class="muted">Disponible desde el 5 de diciembre de 2026.</p>'+
   '<details><summary style="cursor:pointer">Otros meses y descargas</summary>'+
   '<label for="ukiArchivoMes">Mes completo</label><input id="ukiArchivoMes" type="month" min="2026-11">'+
   '<div class="quick-grid"><button type="button" id="ukiArchivoExcel" disabled>Descargar Excel</button>'+
   '<button type="button" id="ukiArchivoPDF" disabled>Descargar PDF</button></div></details>'+
   '<p class="muted">Solo los dueños pueden respaldar. La limpieza seguirá desactivada.</p>';
  raiz.append(d);
  const mes=$('ukiArchivoMes',raiz),pin=$('ukiArchivoPin',raiz),pinArea=$('ukiArchivoPinArea',raiz),
   b=$('ukiArchivoGuardar',raiz),ex=$('ukiArchivoExcel',raiz),pd=$('ukiArchivoPDF',raiz),msg=$('ukiArchivoEstado',raiz);
  mes.value=mesInicial();
  const estado=(t,error=false)=>{msg.textContent=t;msg.style.color=error?'#af1231':'';};
  function actualizarMes(){
   ultimo=null;ex.disabled=true;pd.disabled=true;
   let permitido=false,desde='';
   try{
    const p=core()?.periodo(mes.value);
    permitido=!!p&&hoyChile()>=p.desdeDia5;desde=p?.desdeDia5||'';
   }catch{}
   b.disabled=!permitido;
   b.textContent='Guardar respaldo de '+mes.value;
   estado(permitido?'Listo para guardar en Mi Administración.':
    'Disponible desde el '+(desde||'2026-12-05')+'. No se elimina información.');
  }
  mes.addEventListener('change',actualizarMes);
  actualizarMes();
  b.addEventListener('click',async()=>{
   if(loading)return;loading=true;b.disabled=true;
   try{
    const contexto=window.ukiQAGet?.();
    if(!contexto?.suc||!contexto?.estado)throw Error('Abre primero una sucursal.');
    verificarNube(contexto.suc);
    // Tomar una foto verificada antes de comprimir, nunca el estado en movimiento.
    // Romo conserva una copia confirmada por Neon, distinta de los campos del render.
    const romo=contexto.suc==='Romo’s Sushi La Serena';
    const sesionRomo=romo?window.ukiRomoSesionRemotaQA:null;
    if(romo&&sesionRomo?.coincideEstadoOperativo?.(contexto.estado)!==true)
     throw Error('Romo tiene información local aún no confirmada en Neon. Primero sincroniza.');
    const origen=romo?sesionRomo.estadoOperativoConfirmado():contexto.estado;
    const huellaPantalla=JSON.stringify(contexto.estado),huellaOrigen=JSON.stringify(origen);
    const revisarRevisionRemota=async()=>{
     const confirmado=romo?await sesionRomo?.comprobarRevisionParaArchivo?.():
      await window.ukiArchivoComprobarNube?.(contexto.suc);
     if(confirmado!==true)
      throw Error('La revisión más reciente de la nube no está confirmada. Recarga la sucursal antes de archivar.');
    };
    await revisarRevisionRemota();
    const archivo=core()?.generar(origen,mes.value);
    if(!archivo)throw Error('No se cargó el generador mensual.');
    const sinFecha=Object.entries(archivo.sinFecha||{}).filter(([,cantidad])=>cantidad>0);
    if(sinFecha.length)throw Error('Hay registros sin fecha verificable ('+
     sinFecha.map(([nombre,cantidad])=>nombre+': '+cantidad).join(', ')+
     '). Se conserva todo y no se permite cerrar un respaldo incompleto.');
    const token=await window.ukiInventarioToken?.();
    if(!token)throw Error('Inicia sesión con tu Google autorizado de dueños.');
    if(finSession&&Date.now()>finSessionHasta){finSession='';pinArea.hidden=false;}
    if(!finSession){
     if(!/^\d{6}$/.test(pin.value))throw Error('Escribe el PIN privado de seis dígitos.');
     const response=await llamar(loginURL,token,'',{action:'ingresar_pin',pin:pin.value});
     if(!/^[a-f0-9]{64}$/.test(String(response.sesion||'')))throw Error('No se recibió una sesión privada válida.');
     finSession=response.sesion;finSessionHasta=Date.now()+29*60*1000;pin.value='';pinArea.hidden=true;
    }
    estado('Comprimiendo y verificando el archivo completo…');
    const packed=await core().empaquetar(archivo);
    // Si durante el proceso cambió el pedido, el cierre, la sucursal o la nube,
    // NO subir el archivo antiguo ni sustituir el mes confirmado.
    const actual=window.ukiQAGet?.();
    if(!actual||actual.suc!==contexto.suc||
       JSON.stringify(actual.estado)!==huellaPantalla)
     throw Error('La sucursal cambió mientras se preparaba el respaldo. Revisa y reintenta.');
    verificarNube(contexto.suc);
    if(romo&&(sesionRomo.coincideEstadoOperativo(actual.estado)!==true||
       JSON.stringify(sesionRomo.estadoOperativoConfirmado())!==huellaOrigen))
     throw Error('La revisión confirmada de Romo cambió. Vuelve a consultar Neon.');
    await revisarRevisionRemota();
    // Guardar es idempotente: si ya se archivó este mes, reutilizar el mismo archivo.
    const previo=await llamar(archiveURL,token,finSession,
     {action:'verificar',sucursal:archivo.sucursal,mes:archivo.mes});
    let consulta;
    if(previo.confirmado===true){
     consulta=await llamar(archiveURL,token,finSession,
      {action:'consultar',sucursal:archivo.sucursal,mes:archivo.mes});
     if(!consulta.archivo||consulta.archivo.sha256!==previo.sha256)
      throw Error('No coincide la referencia del respaldo anterior.');
     // La hora de generación cambia en cada intento. Los datos del mes NO.
     const anterior=await core().desempaquetar(
      consulta.archivo.base64,consulta.archivo.encoding,consulta.archivo.sha256);
     const sinHora=(dato)=>{const {generadoEn,...contenido}=dato;return JSON.stringify(contenido);};
     if(sinHora(anterior)!==sinHora(archivo))
      throw Error('Este mes ya tiene un respaldo diferente. No se reemplazó; revisa los cambios posteriores en Mi Administración.');
    }else{
     const response=await llamar(archiveURL,token,finSession,{action:'guardar',sucursal:archivo.sucursal,mes:archivo.mes,
      sha256:packed.sha256,encoding:packed.encoding,base64:packed.base64});
     if(response.confirmado!==true||response.sha256!==packed.sha256||response.mes!==archivo.mes)
      throw Error('El archivo no fue confirmado con la misma huella digital.');
    }
    // Releer del servidor y descomprimir: un simple 'guardado' no basta.
    estado('Comprobando que el archivo se puede recuperar completo…');
    if(!consulta)consulta=await llamar(archiveURL,token,finSession,
     {action:'consultar',sucursal:archivo.sucursal,mes:archivo.mes});
    if(!consulta.archivo||consulta.archivo.sha256!==(previo.confirmado?previo.sha256:packed.sha256))
     throw Error('La copia remota no coincide con la guardada.');
    const recuperado=await core().desempaquetar(
     consulta.archivo.base64,consulta.archivo.encoding,consulta.archivo.sha256);
    if(previo.confirmado!==true&&JSON.stringify(recuperado)!==JSON.stringify(archivo))
     throw Error('La recuperación no reprodujo el archivo completo.');
    ultimo=recuperado;ex.disabled=pd.disabled=false;
    let aviso='✓ Respaldo guardado y comprobado en Mi Administración. Excel y PDF en «Otros meses y descargas».';
    try{
     await revisarRevisionRemota();
     const vig=window.ukiQAGet?.();
     if(!vig||vig.suc!==contexto.suc||JSON.stringify(vig.estado)!==huellaPantalla)throw Error('Cambió el estado activo');
     const sim=core().simularRetencion(origen,recuperado);
     const operativos=Object.values(sim.secciones).reduce((a,v)=>a+v.porAntiguedadYCoincidencia,0);
     const discrepancias=Object.values(sim.secciones).reduce((a,v)=>a+v.noCoinciden,0)+sim.timbres.noCoinciden;
     aviso+=' Simulación: '+operativos+' registros de 35 días o más y '+sim.timbres.porAntiguedadYCoincidencia+' movimientos de timbres de 95 días o más coinciden con el archivo. '+discrepancias+' diferencias. No se elimina nada.';
    }catch(e){aviso+=' La simulación de limpieza no quedó confirmada; no se elimina nada.';}
    estado(aviso);
   }catch(e){
    if(/PIN|sesión|código privado/.test(String(e.message||''))){finSession='';finSessionHasta=0;pinArea.hidden=false;}
    estado(String(e.message||e)+'. No se eliminó ningún registro.',true);
   }finally{loading=false;b.disabled=false;}
  });
  ex.onclick=async()=>{
   if(!ultimo||ultimo.mes!==mes.value)return estado('Primero guarda este mes.',true);
   try{
    const {generarXLSX}=await import('/mi-administracion-informes.js');
    const hojas=core().hojasExcel(ultimo);
    descargar(generarXLSX({hojas}),
     'archivo-'+ultimo.sucursal.replace(':','-')+'-'+ultimo.mes+'.xlsx');
    estado('Excel XLSX preparado para descargar.');
   }catch(e){estado('No se pudo generar el Excel: '+String(e.message||e),true);}
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