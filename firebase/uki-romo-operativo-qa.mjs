/**
 * ROMO · cliente INTERNO del MISMO panel Uki. Sin otro panel.
 *
 * Orquesta carga/guardado de una copia total cifrada de Romo.
 * Los métodos cifrar/descifrar se pasan desde el panel Uki EXISTENTE,
 * para reutilizar exactamente su AES-GCM, PBKDF2 y validación de estado.
 * El servidor SOLO recibe el sobre cifrado y número de revisión.
 *
 * Desactivado en QA hasta publicar una API segura y aprobar la conexión.
 */
export const ROMO_OPERATIVO_SUCURSAL_QA='Romo’s Sushi La Serena';
export const ROMO_OPERATIVO_ID_QA='romo:serena';
const ROMO_OPERATIVO_ENDPOINT_QA='';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Antes del guardado AES-GCM, comprobar en el estado YA ARMADO del mismo
 * motor Uki que el pedido interno corresponde a la solicitud reservada.
 * No enviar cliente, productos ni estado sin cifrar al servidor.
 * La API verifica persistencia de la revisión; no puede leer AES-GCM.
 */
export function validarPedidoGuardadoEnEstadoRomoQA(estado,solicitudCarta){
 const s=solicitudCarta;
 if(!s||typeof s!=='object'||Array.isArray(s)||
    Object.keys(s).sort().join('|')!=='claimToken|pedidoId|requestId'||
    !UUID.test(s.requestId||'')||!UUID.test(s.claimToken||'')||
    !/^[0-9]{1,12}$/.test(String(s.pedidoId||'')))
  throw Error('Vínculo de solicitud Romo no válido');
 if(!estado||estado.suc!==ROMO_OPERATIVO_SUCURSAL_QA||
    !Array.isArray(estado.pedidos))
  throw Error('Estado original de Romo no disponible');
 const found=estado.pedidos.filter(p=>
  p&&p.suc===ROMO_OPERATIVO_SUCURSAL_QA&&
  String(p.id)===String(s.pedidoId)&&
  String(p.cartaSolicitudRemotaId||'')===s.requestId&&
  String(p.cartaReservaToken||'')===s.claimToken);
 if(found.length!==1||!Array.isArray(found[0].productos)||
    found[0].productos.length===0)
  throw Error('Primero debes guardar el pedido de esta solicitud en el panel Romo');
 return Object.freeze({requestId:s.requestId,claimToken:s.claimToken,
  pedidoId:String(s.pedidoId)});
}


export class RomoGuardarConflictoQA extends Error{
 constructor(){super('Romo cambió en otro teléfono. Recarga antes de guardar.');this.code='REVISION_CONFLICTO';}
}
export function crearPuenteRomoOperativoQA({
 endpoint=ROMO_OPERATIVO_ENDPOINT_QA,
 getGoogleToken=()=>window.ukiInventarioToken?.(),
 fetchFn=fetch,
 cifrar,descifrar,validarEstado
}={}){
 if(typeof cifrar!=='function'||typeof descifrar!=='function'||typeof validarEstado!=='function')
  throw new Error('El cifrado y validación deben provenir del panel Uki existente');
 const disponible=()=>Boolean(ROMO_OPERATIVO_ENDPOINT_QA)&&endpoint===ROMO_OPERATIVO_ENDPOINT_QA;
 const request=async(method,body)=>{
  if(!disponible())throw new Error('Operaciones de Romo no habilitadas');
  const token=await getGoogleToken();
  if(typeof token!=='string'||token.length<30)throw new Error('Utiliza el mismo acceso Google de Uki');
  const response=await fetchFn(endpoint,{
   method,headers:{
    Authorization:'Bearer '+token,
    ...(method==='POST'?{'Content-Type':'application/json'}:{})
   },
   ...(method==='POST'?{body:JSON.stringify(body)}:{}),
   cache:'no-store',credentials:'omit'
  });
  if(response.status===409)throw new RomoGuardarConflictoQA();
  if(!response.ok)throw new Error('No se confirmó el acceso o guardado de Romo');
  const value=await response.json();
  if(value?.ok!==true||value.storeId!==ROMO_OPERATIVO_ID_QA||
     !Number.isSafeInteger(value.revision)||value.revision<0)
   throw new Error('Respuesta operativa Romo inválida');
  return value;
 };
 return Object.freeze({
  disponible,
  async cargar({password}={}){
   if(!disponible())throw new Error('Operaciones de Romo no habilitadas');
   const result=await request('GET');
   if(result.revision===0){
    if(result.snapshot!==null)throw new Error('Estado inicial de Romo incorrecto');
    return Object.freeze({revision:0,estado:null});
   }
   if(!result.snapshot||typeof password!=='string'||password.length<12)
    throw new Error('Contraseña habitual de Uki requerida para abrir Romo');
   const estado=await descifrar(result.snapshot,ROMO_OPERATIVO_SUCURSAL_QA,password);
   if(estado?.suc!==ROMO_OPERATIVO_SUCURSAL_QA||!validarEstado(estado,ROMO_OPERATIVO_SUCURSAL_QA))
    throw new Error('El estado recibido no corresponde a Romo');
   return Object.freeze({revision:result.revision,estado});
  },
  async guardar({estado,password,revision,snapshotAnterior=null,solicitudCarta=null}={}){
   if(!disponible())throw new Error('Operaciones de Romo no habilitadas');
   if(!Number.isSafeInteger(revision)||revision<0||
      estado?.suc!==ROMO_OPERATIVO_SUCURSAL_QA||
      !validarEstado(estado,ROMO_OPERATIVO_SUCURSAL_QA)||
      typeof password!=='string'||password.length<12)
    throw new Error('Estado o contraseña de Romo no válido');
   const vinculada=solicitudCarta===null?null:
    validarPedidoGuardadoEnEstadoRomoQA(estado,solicitudCarta);
   const snapshot=await cifrar(estado,ROMO_OPERATIVO_SUCURSAL_QA,password,snapshotAnterior);
   // Nunca enviar texto de contraseñas o pedidos: solo el objeto cifrado.
   if(snapshot?.sucursal!==ROMO_OPERATIVO_SUCURSAL_QA)
    throw new Error('El cifrado recibido no corresponde a Romo');
   const payload={expectedRevision:revision,snapshot};
   if(vinculada)payload.solicitudCarta=vinculada;
   const result=await request('POST',payload);
   if(result.revision!==revision+1)throw new Error('Revisión guardada incorrecta');
   if(vinculada){
    if(typeof result.comprobante!=='string'||result.comprobante.length<70||
       typeof result.expiresAt!=='number'||!Number.isFinite(result.expiresAt))
     throw new Error('El estado se guardó pero faltó confirmar el comprobante; no aceptes la solicitud');
    return Object.freeze({revision:result.revision,snapshot,
     comprobante:result.comprobante,expiresAt:result.expiresAt});
   }
   return Object.freeze({revision:result.revision,snapshot});
  }
 });
}

/**
 * Conexión real al MISMO estado de Uki, con almacenamiento Romo separado.
 * No implementa otro cifrado: INYECTA abrirLocal/cifrarLocal/ukiClaveBackup
 * del panel actual. No se publica ni habilita la ruta de Neon en esta QA.
 */
export function crearCodecRomoDesdeUkiQA({
 abrirLocal,cifrarLocal,derivarClave,validarEstado,cryptoProvider=globalThis.crypto
}={}){
 for(const fn of [abrirLocal,cifrarLocal,derivarClave,validarEstado]){
  if(typeof fn!=='function')throw Error('Falta una función original del panel Uki');
 }
 if(!cryptoProvider?.getRandomValues)throw Error('Cifrado de navegador no disponible');
 const suc=ROMO_OPERATIVO_SUCURSAL_QA;
 return Object.freeze({
  validarEstado:(estado,sucursal)=>sucursal===suc&&estado?.suc===suc&&validarEstado(estado,suc),
  async descifrar(snapshot,sucursal,password){
   if(sucursal!==suc||snapshot?.sucursal!==suc)
    throw Error('No se pueden descifrar datos de Uki como Romo');
   const result=await abrirLocal(JSON.stringify(snapshot),suc,password);
   if(!result?.estado||!validarEstado(result.estado,suc))
    throw Error('El respaldo Romo no pertenece a esta sucursal');
   return result.estado;
  },
  async cifrar(estado,sucursal,password){
   if(sucursal!==suc||estado?.suc!==suc||!validarEstado(estado,suc)||
      typeof password!=='string'||password.length<12)
    throw Error('Estado o clave Romo no válidos');
   const salt=cryptoProvider.getRandomValues(new Uint8Array(16));
   const key=await derivarClave(password,salt);
   const snapshot=await cifrarLocal(estado,suc,key,salt);
   if(snapshot?.sucursal!==suc)throw Error('El sobre cifrado no corresponde a Romo');
   return snapshot;
  }
 });
}
export async function cargarRomoEnMotorUkiQA({password,getGoogleToken,...codecFns}={}){
 const codec=crearCodecRomoDesdeUkiQA(codecFns);
 const puente=crearPuenteRomoOperativoQA({
  ...codec,...(getGoogleToken?{getGoogleToken}:{})
 });
 if(!puente.disponible())throw Error('Romo aún no tiene almacenamiento remoto habilitado');
 const {revision,estado}=await puente.cargar({password});
 if(!Number.isSafeInteger(revision)||revision<0||
   (estado!==null&&!codec.validarEstado(estado,ROMO_OPERATIVO_SUCURSAL_QA)))
  throw Error('La carga del estado de Romo fue rechazada');
 return Object.freeze({storeId:ROMO_OPERATIVO_ID_QA,revision,estado});
}
if(typeof window!=='undefined'){
 window.ukiRomoOperativoDisponibleQA=()=>Boolean(ROMO_OPERATIVO_ENDPOINT_QA);
 window.ukiRomoOperativoCargarQA=cargarRomoEnMotorUkiQA;
}
