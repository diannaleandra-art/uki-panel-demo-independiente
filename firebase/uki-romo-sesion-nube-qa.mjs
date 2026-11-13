/**
 * Sesión del MISMO panel Uki para Romo La Serena, con repositorio Neon privado.
 * Usa las funciones AES-GCM/PBKDF2 YA EXISTENTES de Uki y el token Google
 * YA VERIFICADO por backend. No almacena contraseña ni envía estado en claro.
 *
 * QA fail-closed. La bandera de runtime está apagada hasta que la propietaria
 * autorice activar caja/recepción tras una prueba real entre dispositivos.
 */
import {validarPedidoGuardadoEnEstadoRomoQA} from './uki-romo-operativo-qa.mjs';
import {coordinarGuardadoYAceptacionRomoQA} from './uki-romo-guardar-confirmar-qa.mjs';

export const ROMO_RUNTIME_HABILITADO_QA=false;
const STORE='romo:serena';
const BRANCH='Romo’s Sushi La Serena';
const ROOT='https://uki-sushi-inventario.vercel.app';
const OPERATIVE=ROOT+'/api/romo-estado-operativo-qa';
const INBOX=ROOT+'/api/romo-solicitudes-carta-qa';
const MAX_TOKEN=12000;
function revisionValid(rev){return Number.isSafeInteger(rev)&&rev>=0&&rev<Number.MAX_SAFE_INTEGER;}
function cloudError(response){
 const error=new Error(response?.status===409?'Otra persona modificó Romo. Recarga antes de guardar.':
  'No se confirmó el guardado remoto de Romo');
 error.code=response?.status===409?'ROMO_CONFLICTO':'ROMO_GUARDADO_INCIERTO';
 return error;
}
export function crearSesionNubeRomoEnPanelQA({
 enabled=false,fetchFn=globalThis.fetch,getToken=async()=>globalThis.window?.ukiInventarioToken?.(),
 now=()=>Date.now()
}={}){
 let revision=null,key=null,salt=null,blocked=false,inFlight=false;
 const available=()=>enabled===true;
 const guard=()=>{
  if(!available())throw Error('Operación Romo cerrada hasta aprobación comercial');
  if(typeof fetchFn!=='function'||typeof getToken!=='function')
   throw Error('No está disponible el acceso privado de Romo');
  if(blocked)throw Error('Romo requiere conciliar la revisión de otro teléfono');
 };
 const request=async(uri,method,body=null)=>{
  guard();
  if(![OPERATIVE,INBOX].includes(uri))throw Error('Ruta ajena a Romo bloqueada');
  if((uri===INBOX&&method!=='PATCH')||(uri===OPERATIVE&&!['GET','POST'].includes(method)))
   throw Error('Método no admitido para Romo');
  const jwt=await getToken();
  if(typeof jwt!=='string'||jwt.length<30||jwt.length>MAX_TOKEN)
   throw Error('Accede con el Google habitual de Uki');
  let response;
  try{
   response=await fetchFn(uri,{method,mode:'cors',cache:'no-store',credentials:'omit',
    headers:{Authorization:'Bearer '+jwt,...(body===null?{}:{'Content-Type':'application/json'})},
    ...(body===null?{}:{body:JSON.stringify(body)})});
  }catch(error){
   blocked=true;throw cloudError(null);
  }
  if(!response?.ok){
   if(response?.status===409)blocked=true;
   throw cloudError(response);
  }
  let json;
  try{json=await response.json()}catch{blocked=true;throw cloudError(null)}
  if(json?.ok!==true||json.storeId!==STORE){blocked=true;throw Error('La nube devolvió datos que no pertenecen a Romo')}
  return json;
 };
 const open=async({password,abrirLocal,derivarClave,validarEstado,cryptoProvider=globalThis.crypto}={})=>{
  // Una recarga autenticada puede recuperar la sesión tras un conflicto.
  // No permitirlo mientras sigue un envío en curso.
  if(inFlight)throw Error('Todavía se está guardando Romo');
  blocked=false;key=null;salt=null;revision=null;
  guard();
  if(typeof password!=='string'||password.length<12||typeof abrirLocal!=='function'||
     typeof derivarClave!=='function'||typeof validarEstado!=='function'||
     !cryptoProvider?.getRandomValues)
   throw Error('No se pudo abrir Romo con el cifrado original de Uki');
  // Cargar directamente desde Neon evita usar una copia del otro teléfono.
  const data=await request(OPERATIVE,'GET');
  if(!revisionValid(data.revision))throw Error('Revisión Romo inválida');
  let state=null,derived,randomSalt;
  if(data.revision===0){
   if(data.snapshot!==null)throw Error('No existe un estado Romo inicial válido');
   randomSalt=cryptoProvider.getRandomValues(new Uint8Array(16));
   derived=await derivarClave(password,randomSalt);
  }else{
   if(!data.snapshot||data.snapshot.sucursal!==BRANCH)
    throw Error('Romo no puede abrir un respaldo de Uki');
   const result=await abrirLocal(JSON.stringify(data.snapshot),BRANCH,password);
   if(!result?.estado||!validarEstado(result.estado,BRANCH)||
      !result?.key||!(result.salt instanceof Uint8Array)||result.salt.length!==16)
    throw Error('Estado cifrado de Romo incompatible');
   state=result.estado;derived=result.key;randomSalt=result.salt;
  }
  key=derived;salt=randomSalt;revision=data.revision;blocked=false;
  return Object.freeze({storeId:STORE,revision,estado:state,key,salt});
 };
 const save=async({estado,cifrarLocal,validarEstado,solicitudCarta=null}={})=>{
  guard();
  if(inFlight||key===null||salt===null||!revisionValid(revision))
   throw Error('Debes cargar Romo y terminar cualquier guardado previo');
  if(typeof cifrarLocal!=='function'||typeof validarEstado!=='function'||
     estado?.suc!==BRANCH||!validarEstado(estado,BRANCH))
   throw Error('Estado operativo inválido para Romo');
  const link=solicitudCarta===null?null:
   validarPedidoGuardadoEnEstadoRomoQA(estado,solicitudCarta);
  inFlight=true;
  try{
   const snapshot=await cifrarLocal(estado,BRANCH,key,salt);
   if(snapshot?.sucursal!==BRANCH||snapshot?.formato!=='uki-v813-browser')
    throw Error('Solo se guarda el sobre AES-GCM propio de Romo');
   const next=await request(OPERATIVE,'POST',{
    expectedRevision:revision,snapshot,...(link?{solicitudCarta:link}:{})
   });
   if(next.revision!==revision+1){blocked=true;throw Error('Revisión de Romo no confirmada')}
   revision=next.revision;
   if(link){
    if(typeof next.comprobante!=='string'||next.comprobante.length<70||
       !Number.isFinite(next.expiresAt)||next.expiresAt<=now()){
     blocked=true;throw Error('Romo quedó guardado, pero falta conciliar el comprobante');
    }
    return Object.freeze({storeId:STORE,revision,snapshot,
     comprobante:next.comprobante,expiresAt:next.expiresAt});
   }
   return Object.freeze({storeId:STORE,revision,snapshot});
  }finally{inFlight=false}
 };
 // Reserva central, EXACTAMENTE un teléfono puede continuar la solicitud.
 // El permiso real y la sucursal se validan otra vez en backend Romo.
 const reserve=async({id,claimToken}={})=>{
  guard();
  // Patrón estándar exacto: versión UUID y variante, sin aceptar claves locales.
  const standard=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!standard.test(id||'')||!standard.test(claimToken||'')||
     inFlight||key===null||!revisionValid(revision))
   throw Error('La solicitud o sesión Romo no está preparada');
  const response=await request(INBOX,'PATCH',{
   storeId:STORE,estado:'reservar',id,claimToken
  });
  if(response.estado!=='reservada'||response.id!==id||response.countsAsSale!==false){
   blocked=true;throw Error('No se confirmó la reserva exclusiva de Romo');
  }
  return Object.freeze({storeId:STORE,id,reservada:true});
 };
 const confirm=async({storeId,estado,id,claimToken,pedidoId,comprobante}={})=>{
  if(storeId!==STORE||estado!=='aceptada')
   throw Error('Confirmación de otra sucursal no permitida');
  const response=await request(INBOX,'PATCH',{storeId,estado,id,claimToken,pedidoId,comprobante});
  if(response.estado!=='aceptada'||String(response.pedidoInterno)!==pedidoId||
     response.countsAsSale!==false||response.whatsappConfirmado!==false){
   blocked=true;throw Error('La aceptación Romo no fue confirmada');
  }
  return response;
 };
 const saveAndAccept=async({estado,solicitudCarta,cifrarLocal,validarEstado}={})=>{
  guard();
  if(!revisionValid(revision))throw Error('No se ha abierto el estado Romo');
  return coordinarGuardadoYAceptacionRomoQA({
   estado,solicitudCarta,revision,
   guardarEstadoCifrado:({estado,solicitudCarta})=>save({
    estado,solicitudCarta,cifrarLocal,validarEstado}),
   confirmarEnBandeja:confirm
  });
 };
 const close=()=>{key=null;salt=null;revision=null;blocked=true;};
 return Object.freeze({disponible:available,abrir:open,guardar:save,
  guardarYAceptar:saveAndAccept,reservar:reserve,confirmar:confirm,cerrar:close,
  resumen:()=>Object.freeze({storeId:STORE,revision,abierta:key!==null,
   bloqueada:blocked,guardando:inFlight})});
}
if(typeof window!=='undefined'){
 window.ukiRomoSesionNubeQA=crearSesionNubeRomoEnPanelQA({
  enabled:ROMO_RUNTIME_HABILITADO_QA
 });
 // La misma acción Guardar de Uki solo se abre cuando esta sesión remota
 // está cargada, no bloqueada y el backend comercial fue autorizado.
 window.ukiRomoConfirmacionDisponibleQA=()=>{
  const session=window.ukiRomoSesionNubeQA;
  return session.disponible()&&session.resumen().abierta&&
   !session.resumen().bloqueada&&!session.resumen().guardando;
 };
}
