/**
 * Preparación: enlazar en el mismo navegador una clave ya aprobada en Uki.
 * Solo transmite prueba AES-GCM. NO envía contraseñas ni copia datos Uki.
 * Desactivado hasta autorizar endpoint y permisos mínimos.
 */
import {createRomoPassProofAfterUkiUnlockQA} from '../lib/romo-clave-compartida-qa.mjs';
const ENDPOINT=''; // Aprobación y conexión comercial pendientes.
export async function guardarVerificadorUkiEnRomoQA({
 password,ukiSource,unlockExistingUki,
 endpoint=ENDPOINT,
 getToken=()=>window.ukiInventarioToken?.(),
 fetchFn=fetch,cryptoProvider=globalThis.crypto
}={}){
 if(!ENDPOINT||endpoint!==ENDPOINT)
  throw Error('Acceso compartido de Romo todavía no habilitado');
 if(typeof getToken!=='function'||typeof fetchFn!=='function')
  throw Error('No se puede comprobar Google de Uki');
 const token=await getToken();
 if(typeof token!=='string'||token.length<30||token.length>12000)
  throw Error('Entra con el mismo Google de dueña de Uki');
 const proof=await createRomoPassProofAfterUkiUnlockQA({
  password,ukiSource,unlockExistingUki,cryptoProvider
 });
 const res=await fetchFn(endpoint,{
  method:'POST',credentials:'omit',cache:'no-store',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({proof})
 });
 if(!res.ok)throw Error(res.status===409?
  'La clave existente ya está vinculada, sin reemplazarla':
  'No se pudo confirmar la clave compartida de Romo');
 const body=await res.json();
 if(body?.ok!==true||body.storeId!=='romo:serena'||
    body.ukiSource!==ukiSource||body.saved!==true||
    body.ventasHabilitadas!==false)
  throw Error('No se confirmó la vinculación de la clave Uki');
 return Object.freeze({storeId:'romo:serena',ukiSource,saved:true,ventasHabilitadas:false});
}
export const ROMO_ALTA_CLAVE_NO_HABILITADA=true;
