/* Uki Sushi · Carta normal → panel. SOLO solicitudes pendientes, nunca caja.
 * WhatsApp externo NO comunica si el cliente finalmente pulsó "Enviar".
 * No modificar ventas/cierres hasta "Guardar pedido" y nube sincronizada.
 */
const UKI_CARTA_REMOTAS_API='https://uki-sushi-pedidos.vercel.app/api/carta-solicitudes-live';
let ukiCartaRemotaActiva=null;
let ukiCartaRemotas={rows:[],branch:'',busy:false,used:false,status:'Pulsa Actualizar para consultar pedidos de carta normal.'};
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
// Auditoría de solo lectura: una solicitud aceptada por el servidor que todavía
// no tiene vínculo visible con un pedido de esta copia. Nunca crea otra venta.
function ukiCartaAceptadasSinVinculo(){
 return ukiCartaRemotasSucursal().filter(r=>r.estado==='aceptada'&&!ukiCartaPedidoAceptadoEnCaja(r));
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
   const sinVinculo=ukiCartaAceptadasSinVinculo().length;
   if(sinVinculo)ukiCartaRemotas.status+=' · '+sinVinculo+' aceptada(s) por revisar tras sincronizar la caja.';
  }
 }catch(e){ukiCartaRemotas.status='Recepción de carta no disponible: '+String(e?.message||e)}
 finally{ukiCartaRemotas.busy=false;if(S.vista==='pedidos')render()}
 void ukiCartaConfirmarRespaldados();
}
function ukiCartaRemotaFicha(r){
 const d=ukiWhatsAppDatosDesdeTexto(r.mensaje||'');
 d.codigoCarta=String(r.codigo_pedido||d.codigoCarta||'');
 d.cliente=String(r.cliente||d.cliente||'');
 d.telefono=String(r.telefono||d.telefono||'');
 const pendiente=r.estado==='pendiente';
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
   detalle+(pendiente?'<div class="uki-solicitud-acciones">'+
   '<label class="uki-motivo-rechazo">Motivo del rechazo<select id="ukiCartaMotivo'+esc(r.id)+'" onchange="ukiMotivoRechazoCambio(this)"><option value="">Selecciona un motivo</option>'+
   ['Cliente canceló','Cliente no respondió','Producto no disponible','Otro motivo'].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
   '<button class="sm uki-accion-rechazar" type="button" disabled onclick="ukiCartaRemotaRechazar('+esc(JSON.stringify(r.id))+')">✕ Rechazar solicitud</button>'+
   '<div class="uki-separador-acciones" aria-hidden="true">o, si vas a preparar el pedido</div>'+
   '<button class="sm ok uki-accion-aceptar" type="button" onclick="ukiCartaRemotaAbrir('+esc(JSON.stringify(r.id))+')">✅ Aceptar y revisar</button></div>':'')+'</div>';
}
function ukiCartaRemotaAbrir(id){
 const r=ukiCartaRemotasSucursal().find(x=>x.id===id&&x.estado==='pendiente');
 if(!r)return aviso('La solicitud ya no está pendiente. Actualiza la bandeja.');
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
  const pegada=ukiSolicitudPegadaYaRecibida({codigoCarta:folio});
  if(pegada){aviso(pegada);return;}
 }
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
async function ukiCartaRemotaRechazar(id){
 const r=ukiCartaRemotasSucursal().find(x=>x.id===id&&x.estado==='pendiente');
 if(!r)return aviso('La solicitud ya fue procesada.');
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
