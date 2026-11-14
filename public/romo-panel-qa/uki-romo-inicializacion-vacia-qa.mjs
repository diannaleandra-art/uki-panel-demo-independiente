/**
 * Primera preparación explícita de Romo La Serena desde el mismo panel Uki.
 * Solo transmite ciphertext AES-GCM y una revisión 0; no recibe contraseñas.
 * No abre la sesión operativa ni invoca guardados automáticos.
 */
const ROUTE='/api/romo-inicializar-vacio-qa';
export async function inicializarEstadoVacioRomoQA({snapshot}={}){
 const token=await window.ukiInventarioToken?.();
 if(typeof token!=='string'||token.length<30)
  throw Error('Inicia sesión con la cuenta Google de dueños.');
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    snapshot.formato!=='uki-v813-browser'||snapshot.version!==1||
    snapshot.sucursal!=='Romo’s Sushi La Serena'||typeof snapshot.cifrado!=='string')
  throw Error('El paquete cifrado no corresponde a Romo La Serena.');
 const response=await fetch(ROUTE,{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({
   expectedRevision:0,
   confirmacion:'ROMO_VACIO_QA_UNA_VEZ',
   snapshot
  }),
  cache:'no-store',credentials:'omit'
 });
 const body=await response.json().catch(()=>null);
 if(response.status===409)
  throw Error('Romo ya fue inicializado en otro dispositivo. No se reemplazó.');
 if(response.status===403)
  throw Error('Solo una cuenta de dueños autorizada puede preparar Romo.');
 if(response.status===503)
  throw Error('La preparación de Romo todavía no está habilitada o no está disponible.');
 if(!response.ok)
  throw Error('Romo rechazó la preparación inicial; no vuelvas a intentarlo sin revisar.');
 if(body?.ok!==true||body?.storeId!=='romo:serena'||body?.created!==true||
    body?.revision!==1||body?.operacionesHabilitadas!==false)
  throw Error('No se confirmó correctamente el estado inicial de Romo.');
 return Object.freeze({revision:body.revision});
}
if(typeof window!=='undefined')
 window.ukiRomoInicializarEstadoVacioQA=inicializarEstadoVacioRomoQA;
