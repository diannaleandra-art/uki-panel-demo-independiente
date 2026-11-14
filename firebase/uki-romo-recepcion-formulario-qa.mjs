/**
 * Romo La Serena · usar el MISMO editor de Uki (objeto D), sin crear pantalla.
 * QA apagada: no lee ni escribe ventas ni solicitudes hasta autorización.
 */
const ENDPOINT='https://uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046.vercel.app/api/romo-solicitudes-carta-qa';
const STORE='romo:serena',BRANCH='serena',SUCURSAL='Romo’s Sushi La Serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ROMO_PANEL_RECEPCION_HABILITADA_QA=false;
const requireValid=(test,msg)=>{if(!test)throw Error(msg)};
const clean=(v,n)=>String(v??'').trim().slice(0,n);
export function prepararBorradorRomoDesdeSolicitudQA(row,{
 // Respetar la hora LOCAL del iPhone: el timestamp UTC se veía 3 h adelantado en Chile.
 ahora=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)},
 codigoTelefono=t=>String(t||'').replace(/\D/g,'').slice(-4)
}={}){
 requireValid(row&&typeof row==='object'&&UUID.test(String(row.id||''))&&
  row.estado==='pendiente'&&(!row.branch||row.branch===BRANCH),
  'Solicitud Romo inválida o procesada');
 const t=String(row.mensaje||'').replace(/\r\n?/g,'\n');
 requireValid(/^\*?\s*ROMO[’']S SUSHI\s*\*?$/mi.test(t) &&
  /^\s*Sucursal:\s*Romo[’']s Sushi La Serena\s*$/mi.test(t),
  'Solicitud ajena a la carta Romo La Serena');
 const codigo=clean(row.codigo_pedido,60);
 const numero=clean(t.match(/^\s*N[.º°o\s]*de pedido:\s*(\S+)/mi)?.[1],60);
 requireValid(codigo&&numero===codigo,'Código de carta Romo diferente');
 const cocina=t.match(/\*COCINA\*([\s\S]*?)\*ENTREGA\*/i)?.[1];
 requireValid(cocina,'No hay detalle de cocina Romo');
 const header=/^\s*\*[−-]\s*(\d{1,3})\s*[×x]\s*([^*\n]{1,100})\*\s*$/gm;
 const matches=[...cocina.matchAll(header)];
 requireValid(matches.length>0&&matches.length<=80,'No se encontraron productos válidos');
 const items=matches.map((m,i)=>{
  const fin=i+1<matches.length?matches[i+1].index:cocina.length;
  const nombre=clean(m[2],100),cant=Number(m[1]);
  requireValid(nombre&&Number.isSafeInteger(cant)&&cant>0&&cant<=100,'Producto inválido');
  // Guardar cada línea de armado, salsa, envoltura, extras y nota SIN recortar.
  return {nombre,cant,precio:0,det:cocina.slice(m.index+m[0].length,fin).trim()};
 });
 const modalidad=/^\s*Delivery\s*$/mi.test(t)?'Delivery':
  /CONSUMO\s*[·\-]/mi.test(t)?'Consumo en local':'Retiro';
 const match=t.match(/^\s*Delivery:\s*\$?\s*([\d.,]+)/mi);
 const envio=match?Number(match[1].replace(/\D/g,'')):0;
 const deliveryPendiente=modalidad==='Delivery'&&!match;
 const pago=clean(t.match(/^\s*Pago:\s*([^\n]+)/mi)?.[1],100);
 const medio=['Efectivo','Transferencia','Débito','Edenred','Otros'].find(m=>
  pago.toLowerCase().startsWith(m.toLowerCase()))||'Efectivo';
 const total=Number(row.total_indicado);
 requireValid(Number.isSafeInteger(total)&&total>=0,'Total Romo incorrecto');
 const telefono=clean(row.telefono,30);
 return {texto:t,fecha:ahora(),cliente:clean(row.cliente,60),
  telefono,codigoCarta:codigo,codigoCliente:codigoTelefono(telefono),
  qrSolicitudes:[],sucursalCarta:SUCURSAL,mesaReferencia:'',
  modalidad,envio,kmRecorrido:'',medio,medioEnvio:medio,pagado:false,items,
  mixtoProductos:false,mixtoEnvio:false,pagosProductos:[],pagosEnvio:[],
  productosPagadosOtroLocal:false,montoProductosOtroLocal:'',
  envioPagadoOtroLocal:false,montoEnvioOtroLocal:'',localPagoExterno:'',
  propinaModo:'ninguna',propinaPersonalizada:'',medioPropina:'Efectivo',
  editando:null,cartaSolicitudRemotaId:row.id,
  romoDeliveryPendienteQA:deliveryPendiente,
  romoTotalIndicadoQA:total,romoPagoIndicadoQA:pago};
}
export function verificarBorradorRomoAntesGuardarQA(d,{
 solicitudId,confirmoArmado=false,confirmoImportes=false
}={}){
 requireValid(d&&!d.editando&&UUID.test(String(solicitudId||''))&&
  d.cartaSolicitudRemotaId===solicitudId,'Formulario no vinculado a esta solicitud');
 requireValid(confirmoArmado===true&&confirmoImportes===true,
  'Verifica armado e importes antes de guardar');
 const items=Array.isArray(d.items)?d.items.filter(x=>clean(x?.nombre,100)):[];
 requireValid(items.length>0&&items.length<=80,'Faltan productos');
 for(const p of items)requireValid(Number.isSafeInteger(Number(p.cant))&&Number(p.cant)>0&&
  Number.isSafeInteger(Number(p.precio))&&Number(p.precio)>0,'Falta verificar precio o cantidad');
 requireValid(['Retiro','Delivery','Consumo en local'].includes(d.modalidad),'Entrega inválida');
 requireValid(!d.romoDeliveryPendienteQA||d.modalidad!=='Delivery'||
  (Number.isSafeInteger(Number(d.envio))&&Number(d.envio)>0),'Confirma delivery');
 return {solicitudId,subtotal:items.reduce((n,p)=>n+Number(p.cant)*Number(p.precio),0),
  envio:d.modalidad==='Delivery'?Number(d.envio):0,pagado:!!d.pagado};
}
export function crearBandejaRomoMismoPanelQA({
 endpoint=ENDPOINT,habilitada=ROMO_PANEL_RECEPCION_HABILITADA_QA,
 getGoogleToken=async()=>globalThis.window?.ukiInventarioToken?.(),
 fetchFn=globalThis.fetch
}={}){
 const disponible=()=>habilitada===true&&endpoint===ENDPOINT;
 const request=async(method,body)=>{
  if(!disponible())throw Error('Recepción Romo deshabilitada');
  const token=await getGoogleToken();
  requireValid(typeof token==='string'&&token.length>30,'Sin acceso Google autorizado');
  const response=await fetchFn(endpoint,{
   method,credentials:'omit',cache:'no-store',
   headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({}));
  requireValid(response.ok&&data.ok===true&&data.storeId===STORE,
   clean(data.error||'No se confirmó la solicitud Romo',240));
  return data;
 };
 const act=async(estado,payload)=>{
  requireValid(UUID.test(String(payload?.id||'')),'ID Romo inválido');
  return request('PATCH',{...payload,estado});
 };
 return Object.freeze({
  disponible,
  async listar(){
   const data=await request('GET');
   requireValid(data.branch===BRANCH&&Array.isArray(data.orders),'Bandeja Romo incorrecta');
   return data.orders.map(r=>{
    requireValid(r&&UUID.test(String(r.id||''))&&r.branch===BRANCH&&
      ['pendiente','aceptada','rechazada'].includes(r.estado),'Solicitud de otra sucursal');
    return r;
   });
  },
  async reservar(id,claimToken){
   requireValid(UUID.test(String(claimToken||'')),'Reserva inválida');
   return act('reservar',{id,claimToken});
  },
  async liberar(id,claimToken){
   requireValid(UUID.test(String(claimToken||'')),'Reserva inválida');
   return act('liberar',{id,claimToken});
  },
  async rechazar(id,motivo){
   requireValid(typeof motivo==='string'&&motivo.trim(),'Motivo obligatorio');
   return act('rechazada',{id,motivo:clean(motivo,200)});
  },
  async confirmarGuardado({id,claimToken,pedidoId,expectedRevision,snapshot}={}){
   requireValid(UUID.test(String(claimToken||''))&&
    /^[0-9]{1,12}$/.test(String(pedidoId||''))&&
    Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,
    'Identificadores o revisión inválidos');
   requireValid(snapshot?.sucursal===SUCURSAL&&snapshot.formato==='uki-v813-browser',
    'Cifrado no corresponde a Romo');
   const data=await act('aceptada',{id,claimToken,pedidoId:String(pedidoId),
    expectedRevision,snapshot});
   requireValid(data.estado==='aceptada'&&data.pedido_interno===String(pedidoId)&&
    data.revision===expectedRevision+1,'Aceptación no confirmada');
   return data;
  }
 });
}
if(typeof window!=='undefined')window.ukiRomoRecepcionMismoFormularioQA=Object.freeze({
 disponible:()=>ROMO_PANEL_RECEPCION_HABILITADA_QA,
 prepararBorrador:prepararBorradorRomoDesdeSolicitudQA,
 verificarBorrador:verificarBorradorRomoAntesGuardarQA,
 crearBandeja:crearBandejaRomoMismoPanelQA
});
