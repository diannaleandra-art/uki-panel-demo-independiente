/* Uki Sushi · Carta normal → panel. SOLO solicitudes pendientes, nunca caja.
 * WhatsApp externo NO comunica si el cliente finalmente pulsó "Enviar".
 * No modificar ventas/cierres hasta "Guardar pedido" y nube sincronizada.
 */
const UKI_CARTA_REMOTAS_API='https://uki-sushi-pedidos.vercel.app/api/carta-solicitudes-live';
let ukiCartaRemotaActiva=null;
let ukiCartaRemotas={rows:[],branch:'',busy:false,used:false,status:'Pulsa Actualizar para consultar pedidos de carta normal.'};
let ukiCartaRecuperacionPuedeQA=false;
function ukiCartaReservaVencidaQA(r){
 const hasta=Date.parse(r?.reserva_hasta||'');
 return r?.estado==='pendiente'&&r?.en_reserva===true&&Number.isFinite(hasta)&&hasta<Date.now();
}
// Consulta de permiso SOLO para el Google dueña. Un equipo QR nunca autoriza
// esta operación. No altera la bandeja ni la sesión habitual del trabajador.
async function ukiCartaRecuperacionPermisoQA(branch){
 ukiCartaRecuperacionPuedeQA=false;
 let token=null;
 try{token=await window.ukiInventarioToken?.()}catch{return false}
 if(!token)return false;
 try{
  const response=await fetch(UKI_CARTA_REMOTAS_API+'?branch='+encodeURIComponent(branch)+'&modo=recuperacion',{
   method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store',
   signal:AbortSignal.timeout(15000)
  });
  const data=await response.json().catch(()=>({}));
  if(branch!==ukiMesaBranch())return false;
  ukiCartaRecuperacionPuedeQA=Boolean(response.ok&&data.ok===true&&
   data.branch===branch&&data.puedeRecuperar===true);
  if(S.vista==='pedidos')render();
  return ukiCartaRecuperacionPuedeQA;
 }catch{return false}
}

function ukiCartaRemotasSucursal(){
 const branch=ukiMesaBranch();
 return ukiCartaRemotas.branch===branch?ukiCartaRemotas.rows.filter(x=>x.branch===branch):[];
}
async function ukiCartaApiSesion(){
 const token=await window.ukiMesasQAToken?.();
 if(!token)throw Error('Este equipo necesita autorización para recibir pedidos. Utiliza la autorización QR existente.');
 return token;
}
async function ukiCartaApiCambio(id,estado,motivo='',extra={}){
 const branch=ukiMesaBranch(),token=await ukiCartaApiSesion();
 const r=await fetch(UKI_CARTA_REMOTAS_API,{
  method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({branch,id,estado,motivo,...extra}),signal:AbortSignal.timeout(15000)
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok)throw Error(String(data.error||'El servidor no confirmó la operación'));
 return data;
}
async function ukiCartaReservarRegistro(id,claimToken){
 if(!claimToken||!id)throw Error('Falta identificación de la solicitud original.');
 return ukiCartaApiCambio(id,'reservar','',{claimToken});
}
function ukiCartaPedidoAceptadoEnCaja(r){
 if(!r?.id)return false;
 return S.pedidos.some(p=>p.suc===S.suc&&p.estado!=='Cancelado'&&String(p.cartaSolicitudRemotaId||'')===String(r.id));
}
// Distinto de "pedido activo": una solicitud sigue vinculada a su pedido
// original aunque este se haya CANCELADO después de aceptarse. La aceptación
// remota es un hecho histórico; NO debe generar una alerta ni otra venta.
function ukiCartaSolicitudYaRegistrada(r){
 if(!r?.id)return false;
 const pedidos=(S.pedidos||[]).filter(p=>p.suc===S.suc);
 const remoto=String(r.id);
 if(pedidos.some(p=>String(p.cartaSolicitudRemotaId||'')===remoto))return true;
 // Compatibilidad MUY conservadora con cancelaciones antiguas sin ID remoto:
 // exigir folio, WhatsApp completo, mensaje original idéntico y un único candidato.
 // Nunca relacionar por los últimos cuatro dígitos ni solo por el nombre.
 const folio=String(r.codigo_pedido||'').trim().toLowerCase();
 const tel=ukiTelefonoNormalizado(r.telefono);
 const texto=String(r.mensaje||'').replace(/\s+/g,' ').trim();
 if(!folio||tel.length<8||texto.length<25)return false;
 const candidatos=pedidos.filter(p=>
  p.estado==='Cancelado'&&!String(p.cartaSolicitudRemotaId||'').trim()&&
  String(p.codigoCarta||'').trim().toLowerCase()===folio&&
  ukiTelefonoNormalizado(p.telefono)===tel&&
  String(p.textoOriginal||'').replace(/\s+/g,' ').trim()===texto
 );
 return candidatos.length===1;
}
// Auditoría SOLO de las aceptadas que siguen realmente sin registro visible.
// Un pedido cancelado se conserva en historial y NO cuenta en ventas/timbres.
function ukiCartaAceptadasSinVinculo(){
 return ukiCartaRemotasSucursal().filter(r=>r.estado==='aceptada'&&!ukiCartaSolicitudYaRegistrada(r));
}
let ukiCartaConfirmando=false;
async function ukiCartaConfirmarRespaldados(){
 if(ukiCartaConfirmando||ukiCartaRemotas.busy||!S.suc||!window.ukiCancelacionNubeLista?.())return;
 const rows=ukiCartaRemotasSucursal().filter(r=>r.estado==='pendiente'&&ukiCartaPedidoAceptadoEnCaja(r));
 if(!rows.length)return;
 ukiCartaConfirmando=true;
 try{
  for(const r of rows){
   if(!window.ukiCancelacionNubeLista?.()||r.branch!==ukiMesaBranch())break;
   try{
    const p=S.pedidos.find(p=>p.suc===S.suc&&p.estado!=='Cancelado'&&String(p.cartaSolicitudRemotaId||'')===String(r.id));
    const extra=p?.cartaReservaToken?{claimToken:p.cartaReservaToken,pedidoId:String(p.id)}:{};
    await ukiCartaApiCambio(r.id,'aceptada','',extra);r.estado='aceptada';
   }
   catch(e){ukiCartaRemotas.status='Pedido registrado en Uki; el estado de la bandeja sigue pendiente: '+String(e?.message||e);break}
  }
 }finally{ukiCartaConfirmando=false;if(S.vista==='pedidos')render()}
}
async function ukiCartaRemotasActualizar(){
 if(!S.suc||ukiCartaRemotas.busy||document.body.classList.contains('uki-operativo-bloqueado'))return;
 const branch=ukiMesaBranch();if(!branch)return;
 ukiCartaRemotas.busy=true;ukiCartaRemotas.used=true;ukiCartaRemotas.status='Consultando solicitudes…';
 try{
  const token=await ukiCartaApiSesion();
  const r=await fetch(UKI_CARTA_REMOTAS_API+'?branch='+encodeURIComponent(branch),{
   headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok)throw Error(String(data.error||'No se pudo consultar'));
  if(branch===ukiMesaBranch()){
   ukiCartaRemotas.rows=Array.isArray(data.orders)?data.orders.filter(x=>x.branch===branch):[];
   ukiCartaRemotas.branch=branch;
   ukiCartaRemotas.status=ukiCartaRemotas.rows.filter(x=>x.estado==='pendiente').length+
    ' solicitud(es) pendientes. Comprueba que el WhatsApp del cliente también haya llegado.';
   // El permiso se consulta únicamente si hay reservas vencidas; nunca se
   // abre un botón a un trabajador que entra por el QR de su dispositivo.
   ukiCartaRecuperacionPuedeQA=false;
   if(ukiCartaRemotas.rows.some(ukiCartaReservaVencidaQA))
    void ukiCartaRecuperacionPermisoQA(branch);
   const sinVinculo=ukiCartaAceptadasSinVinculo().length;
   if(sinVinculo)ukiCartaRemotas.status+=' · '+sinVinculo+' aceptada(s) por revisar tras sincronizar la caja.';
  }
 }catch(e){ukiCartaRemotas.status='Recepción de carta no disponible: '+String(e?.message||e)}
 finally{ukiCartaRemotas.busy=false;if(S.vista==='pedidos')render()}
 void ukiCartaConfirmarRespaldados();
}
// Comprobación estricta del cierre: no usar una copia antigua de la bandeja.
// Si no hay red o autorización, NO declarar que faltan cero solicitudes.
async function ukiCartaRemotasVerificarCierre(){
 const branch=ukiMesaBranch();
 if(!S.suc||!branch)throw Error('Selecciona la sucursal antes de revisar el cierre.');
 const token=await ukiCartaApiSesion();
 const r=await fetch(UKI_CARTA_REMOTAS_API+'?branch='+encodeURIComponent(branch),{
  headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok||!Array.isArray(data.orders))
  throw Error(String(data.error||'No se pudo verificar la bandeja de solicitudes de la carta.'));
 if(branch!==ukiMesaBranch())throw Error('La sucursal cambió durante la comprobación.');
 const items=data.orders.filter(x=>x.branch===branch);
 ukiCartaRemotas.rows=items;ukiCartaRemotas.branch=branch;ukiCartaRemotas.used=true;
 const pendientes=items.filter(x=>x.estado==='pendiente');
 ukiCartaRemotas.status=pendientes.length+' solicitud(es) pendientes, verificado antes del cierre.';
 return pendientes.map(x=>({
  id:String(x.id||''),codigo:String(x.codigo_pedido||''),
  cliente:String(x.cliente||'')
 }));
}
function ukiCartaRemotaFicha(r){
 const d=ukiWhatsAppDatosDesdeTexto(r.mensaje||'');
 d.codigoCarta=String(r.codigo_pedido||d.codigoCarta||'');
 d.cliente=String(r.cliente||d.cliente||'');
 d.telefono=String(r.telefono||d.telefono||'');
 const pendiente=r.estado==='pendiente';
 const reservado=pendiente&&r.en_reserva===true;
 const recibido=Date.parse(r.creado_en||'');
 const detalle=ukiWhatsAppFicha({id:r.id,suc:S.suc,estado:pendiente?'pendiente':'rechazada',
  codigoCarta:d.codigoCarta,cliente:d.cliente,telefono:d.telefono,
  codigoCliente:ukiCodigoWhatsApp(d.telefono),datos:d,
  creadoEn:Number.isFinite(recibido)?recibido:Date.now(),
  fechaISO:Number.isFinite(recibido)?new Date(recibido).toLocaleString('es-CL'):'Fecha por confirmar',
  motivo:r.motivo_rechazo||''},false);
 return '<div class="card order-card uki-carta-compacta"><p class="muted"><b>📲 Carta normal · '+
   (pendiente?'Por confirmar':'Rechazado')+'</b></p>'+
   '<p class="muted uki-whatsapp-check">Verifica el mensaje en WhatsApp antes de aceptarlo.</p>'+
   detalle+(reservado?'<p class="muted"><b>'+(
    ukiCartaReservaVencidaQA(r)?'Reserva vencida.':'En revisión en otro equipo.'
   )+'</b> '+(
    ukiCartaReservaVencidaQA(r)?'No se libera sola: comprueba que nadie haya registrado el pedido.':
    'Actualiza la bandeja antes de continuar. No ingreses este pedido de nuevo.'
   )+'</p>'+(
    ukiCartaReservaVencidaQA(r)&&ukiCartaRecuperacionPuedeQA?
    '<button class="sm uki-accion-recuperar" type="button" onclick="ukiCartaRecuperarReservaQA('+esc(JSON.stringify(r.id))+')">🔓 Recuperar solicitud · solo dueños</button>':''
   ):pendiente?'<div class="uki-solicitud-acciones">'+
   '<label class="uki-motivo-rechazo">Motivo del rechazo<select id="ukiCartaMotivo'+esc(r.id)+'" onchange="ukiMotivoRechazoCambio(this)"><option value="">Selecciona un motivo</option>'+
   ['Cliente canceló','Cliente no respondió','Producto no disponible','Otro motivo'].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
   '<button class="sm uki-accion-rechazar" type="button" disabled onclick="ukiCartaRemotaRechazar('+esc(JSON.stringify(r.id))+')">✕ Rechazar solicitud</button>'+
   '<div class="uki-separador-acciones" aria-hidden="true">o, si vas a preparar el pedido</div>'+
   '<button class="sm ok uki-accion-aceptar" type="button" onclick="ukiCartaRemotaAbrir('+esc(JSON.stringify(r.id))+')">✅ Aceptar y revisar</button></div>':'')+'</div>';
}
function ukiCartaRemotaAbrir(id){
 const r=ukiCartaRemotasSucursal().find(x=>x.id===id&&x.estado==='pendiente');
 if(!r)return aviso('La solicitud ya no está pendiente. Actualiza la bandeja.');
 if(r.en_reserva===true)return aviso('Esta solicitud se está revisando en otro equipo. Actualiza y verifica antes de continuar.');
 if(ukiCartaPedidoAceptadoEnCaja(r)){aviso('Este pedido ya figura en caja. Se confirmará tras sincronizar Firebase.');void ukiCartaConfirmarRespaldados();return}
 const folio=String(r.codigo_pedido||'').trim().toLowerCase();
 if(folio){
  const yaGuardado=(S.pedidos||[]).find(p=>ukiRegistroMismoOrigen(p,{
   cartaSolicitudRemotaId:id,codigoCarta:folio,telefono:r.telefono,texto:r.mensaje
  }));
  if(yaGuardado){
   aviso('Carta #'+folio+' ya fue registrada como pedido interno #'+yaGuardado.id+'. No aceptes ni cobres otra vez. Revisa el pedido existente.');
   return;
  }
 }
 const pegada=ukiSolicitudPegadaYaRecibida({
  codigoCarta:folio,telefono:r.telefono,texto:r.mensaje
 });
 if(pegada){aviso(pegada);return;}
 if(S.busy||document.body.classList.contains('uki-operativo-bloqueado')||!window.ukiCancelacionNubeLista?.()){
  aviso('Sincroniza la nube antes de aceptar. La solicitud continúa pendiente.');return;
 }
 if(ukiBorradorTieneContenido()&&!D.editando&&!ukiGuardarBorradorSinVista())return;
 D=ukiWhatsAppDatosDesdeTexto(String(r.mensaje||''));
 D.codigoCarta=String(r.codigo_pedido||D.codigoCarta||'');
 D.cliente=String(r.cliente||D.cliente||'');D.telefono=String(r.telefono||D.telefono||'');
 D.codigoCliente=ukiCodigoWhatsApp(D.telefono)||D.codigoCliente||'';
 D.cartaSolicitudRemotaId=id; // vínculo exacto, evita confundir pedidos con el mismo código de 3 dígitos
 D.pagado=false;D.editando=null;
 ukiCartaRemotaActiva=id;ukiSolicitudWhatsAppActiva=null;ukiBorradorActivo=null;modoNuevo='whatsapp';
 S.vista='nuevo';S.msg='Verifica el WhatsApp, ajusta pedido y pagos en el formulario habitual; se aceptará al guardar.';
 render();window.scrollTo({top:0,behavior:'instant'});
}
/**
 * Recuperación manual del dueño ante una reserva vencida y sin venta.
 * Un POST perdido pudo haber guardado un pedido cifrado en otro equipo.
 * Por ello NO se hace liberación automática y se exige doble comprobación.
 */
async function ukiCartaRecuperarReservaQA(id){
 const branch=ukiMesaBranch();
 if(!ukiCartaRecuperacionPuedeQA||!['arica','serena'].includes(branch))
  return aviso('Solo la cuenta Google dueña puede recuperar reservas vencidas.');
 if(!window.ukiCancelacionNubeLista?.()||S.busy)
  return aviso('Sincroniza la caja y el historial antes de recuperar.');
 await ukiCartaRemotasActualizar();
 const r=ukiCartaRemotasSucursal().find(x=>x.id===id&&x.branch===branch);
 if(!r||!ukiCartaReservaVencidaQA(r))
  return aviso('Esta reserva ya cambió o no está vencida. Actualiza Pedidos.');
 if(ukiCartaSolicitudYaRegistrada(r)||ukiCartaPedidoAceptadoEnCaja(r))
  return aviso('Este pedido ya aparece registrado o en historial. No se liberó la reserva.');
 const motivo=String(window.prompt('¿Por qué necesitas recuperar Carta #'+r.codigo_pedido+
  '?\nEs obligatorio dejar el motivo (mínimo 5 caracteres).','Reserva vencida sin pedido registrado')||'').trim();
 if(motivo.length<5||motivo.length>200)
  return aviso('La reserva no se modificó: escribe un motivo de 5 a 200 caracteres.');
 if(!window.confirm('RECUPERAR SOLICITUD #'+r.codigo_pedido+
   '\n\nConfirma que revisaste pedidos registrados, historial y caja de ESTA sucursal, y que otro trabajador NO está terminando el pedido.'+
   '\n\nEsto solo libera la reserva. No registra venta, pago ni timbre.'))return;
 try{
  const token=await window.ukiInventarioToken?.();
  if(!token)throw Error('Inicia sesión con el Google de dueños.');
  const response=await fetch(UKI_CARTA_REMOTAS_API,{
   method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({branch,id,estado:'recuperar',motivo,confirmoSinPedido:true}),
   signal:AbortSignal.timeout(15000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true||data.id!==id||data.branch!==branch||
     data.estado!=='pendiente'||data.reservaLiberada!==true)
   throw Error(data.error||'La reserva cambió o no fue liberada');
  aviso('Reserva de Carta #'+r.codigo_pedido+' liberada, con motivo y responsable registrados.');
  await ukiCartaRemotasActualizar();
 }catch(error){aviso('No se pudo recuperar la solicitud: '+String(error.message||error))}
}

async function ukiCartaRemotaRechazar(id){
 const r=ukiCartaRemotasSucursal().find(x=>x.id===id&&x.estado==='pendiente');
 if(!r)return aviso('La solicitud ya fue procesada.');
 if(r.en_reserva===true)return aviso('Esta solicitud está reservada. No se puede rechazar desde este equipo.');
 const motivo=String($('ukiCartaMotivo'+id)?.value||'').trim();
 if(!['Cliente canceló','Cliente no respondió','Producto no disponible','Otro motivo'].includes(motivo))
  return aviso('Selecciona el motivo de rechazo.');
 if(!window.confirm('¿Rechazar la solicitud de '+r.cliente+'? No sumará venta, caja ni timbres.'))return;
 try{
  await ukiCartaApiCambio(id,'rechazada',motivo);
  r.estado='rechazada';r.motivo_rechazo=motivo;
  if(ukiCartaRemotaActiva===id)ukiCartaRemotaActiva=null;
  aviso('Solicitud rechazada y archivada, sin registrar venta.');
 }catch(e){aviso('No se pudo rechazar: '+String(e?.message||e))}
}
setInterval(()=>{if(ukiCartaRemotas.used&&!ukiCartaRemotas.busy&&S.suc&&S.vista==='pedidos')
  void ukiCartaRemotasActualizar();},45000);
