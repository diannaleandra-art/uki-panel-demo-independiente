/**
 * Mismo Google del panel Uki: preparación de comprobación de dueños Romo.
 * SIN segunda sesión Google, SIN otra clave, SIN permisos nuevos.
 *
 * No se envía el email ni contraseñas desde la interfaz. El servidor obtiene
 * email y UID desde el Firebase ID token firmado y solo confirma identidad.
 * La URL deliberadamente está VACÍA hasta aprobación y pruebas reales.
 */
const ROMO_DUENOS_CHECK_ENDPOINT='';

export async function comprobarGoogleDuenosRomoQA({
  endpoint=ROMO_DUENOS_CHECK_ENDPOINT,
  getToken=()=>window.ukiInventarioToken?.(),
  fetchFn=fetch
}={}){
  if(!ROMO_DUENOS_CHECK_ENDPOINT||endpoint!==ROMO_DUENOS_CHECK_ENDPOINT)
    throw new Error('Comprobación de cuenta Romo aún desactivada');
  if(typeof getToken!=='function'||typeof fetchFn!=='function')
    throw new Error('Inicio de sesión Google no disponible');
  const token=await getToken();
  if(typeof token!=='string'||token.length<30)
    throw new Error('Utiliza la misma sesión Google de Uki');
  const res=await fetchFn(endpoint,{
    method:'GET',headers:{Authorization:'Bearer '+token},
    cache:'no-store',credentials:'omit'
  });
  if(!res.ok)throw new Error('Cuenta Google pendiente de verificación');
  const body=await res.json();
  if(body?.ok!==true||body.storeId!=='romo:serena'||
     body.googleVerified!==true||body.authorizationGranted!==false)
    throw new Error('Resultado de verificación de Romo no válido');
  return Object.freeze({
    googleVerified:true,
    storeId:'romo:serena',
    // La comprobación del Google NO activa la cuenta ni los pedidos.
    needsActivation:true
  });
}

if(typeof window!=='undefined'){
  window.ukiRomoGoogleDuenosVinculoDisponibleQA=()=>Boolean(ROMO_DUENOS_CHECK_ENDPOINT);
  window.ukiRomoComprobarGoogleDuenosQA=()=>comprobarGoogleDuenosRomoQA();
}
