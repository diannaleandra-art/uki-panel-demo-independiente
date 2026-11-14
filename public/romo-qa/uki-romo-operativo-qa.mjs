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
const ROMO_OPERATIVO_ENDPOINT_QA='https://uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046.vercel.app/api/romo-estado-operativo-qa';
export const ROMO_OPERATIVO_CLIENTE_HABILITADO_QA=false;

export class RomoGuardarConflictoQA extends Error{
 constructor(){super('Romo cambió en otro teléfono. Recarga antes de guardar.');this.code='REVISION_CONFLICTO';}
}
export function crearPuenteRomoOperativoQA({
 endpoint=ROMO_OPERATIVO_ENDPOINT_QA,habilitado=ROMO_OPERATIVO_CLIENTE_HABILITADO_QA,
 getGoogleToken=()=>window.ukiInventarioToken?.(),
 fetchFn=fetch,
 cifrar,descifrar,validarEstado
}={}){
 if(typeof cifrar!=='function'||typeof descifrar!=='function'||typeof validarEstado!=='function')
  throw new Error('El cifrado y validación deben provenir del panel Uki existente');
 const disponible=()=>habilitado===true&&endpoint===ROMO_OPERATIVO_ENDPOINT_QA;
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
  async guardarCierreSobreCifrado({snapshot,revision,turnoId,resumen}={}){
   if(!disponible())throw new Error('Romo no está autorizado para cerrar caja');
   if(!Number.isSafeInteger(revision)||revision<1||
      typeof turnoId!=='string'||!/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(turnoId)||
      snapshot?.formato!=='uki-v813-browser'||snapshot?.version!==1||
      snapshot?.sucursal!==ROMO_OPERATIVO_SUCURSAL_QA||
      typeof snapshot?.salt!=='string'||typeof snapshot?.iv!=='string'||
      typeof snapshot?.cifrado!=='string')
    throw new Error('Se requiere el estado cifrado del turno Romo');
   if(resumen?.store_id!=='romo:serena'||resumen?.turno_ref!==turnoId||
     resumen?.estado!=='pendiente_confirmacion_neon')
    throw new Error('No se preparó el resumen de cierre Romo');
   const result=await request('POST',{
    operation:'cierre_definitivo',expectedRevision:revision,turnoId,snapshot,resumen
   });
   if(result.revision!==revision+1||result.estado!=='cierre_confirmado'||
      result.turnoId!==turnoId)
    throw new Error('No se confirmó el cierre de Romo');
   return Object.freeze({revision:result.revision,turnoId});
  },
  async guardarSobreCifrado({snapshot,revision}={}){
   if(!disponible())throw new Error('Operaciones de Romo no habilitadas');
   if(!Number.isSafeInteger(revision)||revision<0||
      snapshot?.formato!=='uki-v813-browser'||snapshot?.version!==1||
      snapshot?.sucursal!==ROMO_OPERATIVO_SUCURSAL_QA||
      typeof snapshot?.salt!=='string'||typeof snapshot?.iv!=='string'||
      typeof snapshot?.cifrado!=='string')
    throw new Error('Se necesita el respaldo cifrado propio de Romo');
   const result=await request('POST',{expectedRevision:revision,snapshot});
   if(result.revision!==revision+1)throw new Error('Neon confirmó otra revisión');
   return Object.freeze({revision:result.revision});
  },
  async guardar({estado,password,revision,snapshotAnterior=null}={}){
   if(!disponible())throw new Error('Operaciones de Romo no habilitadas');
   if(!Number.isSafeInteger(revision)||revision<0||
      estado?.suc!==ROMO_OPERATIVO_SUCURSAL_QA||
      !validarEstado(estado,ROMO_OPERATIVO_SUCURSAL_QA)||
      typeof password!=='string'||password.length<12)
    throw new Error('Estado o contraseña de Romo no válido');
   const snapshot=await cifrar(estado,ROMO_OPERATIVO_SUCURSAL_QA,password,snapshotAnterior);
   // Nunca enviar texto de contraseñas o pedidos: solo el objeto cifrado.
   if(snapshot?.sucursal!==ROMO_OPERATIVO_SUCURSAL_QA)
    throw new Error('El cifrado recibido no corresponde a Romo');
   const result=await request('POST',{expectedRevision:revision,snapshot});
   if(result.revision!==revision+1)throw new Error('Revisión guardada incorrecta');
   return Object.freeze({revision:result.revision,snapshot});
  }
 });
}
if(typeof window!=='undefined'){
 window.ukiRomoOperativoDisponibleQA=()=>ROMO_OPERATIVO_CLIENTE_HABILITADO_QA;
}
