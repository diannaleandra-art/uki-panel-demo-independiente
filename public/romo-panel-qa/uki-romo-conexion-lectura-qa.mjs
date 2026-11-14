/**
 * Comprobación manual desde el mismo panel de Romo.
 * Solo GET, sin contraseñas enviadas y sin habilitar sesiones operativas.
 */
const STORE='romo:serena';
const PATH='/api/romo-conexion-lectura-qa';
export async function comprobarConexionRomoSoloLecturaQA(password){
 if(typeof password!=='string'||password.length<12||password.length>256)
  throw Error('Escribe la misma contraseña habitual de Uki');
 const getToken=window.ukiInventarioToken;
 if(typeof getToken!=='function'||!await getToken())
  throw Error('Primero entra con tu cuenta Google de dueños');
 const verificar=window.ukiRomoVerificarClaveRemotaQA;
 if(typeof verificar!=='function'||await verificar(password)!==true)
  throw Error('No se pudo verificar la clave vinculada de Romo');
 const token=await getToken();
 if(typeof token!=='string'||token.length<30)
  throw Error('La sesión Google no está disponible');
 const response=await fetch(PATH,{
  method:'GET',headers:{Authorization:'Bearer '+token},
  credentials:'omit',cache:'no-store'
 });
 if(!response.ok){
  if(response.status===403)throw Error('Tu cuenta Google no tiene acceso de dueños a Romo');
  if(response.status===503)throw Error('Conexión de solo lectura todavía no disponible en Romo');
  throw Error('Romo no pudo confirmar su conexión segura');
 }
 const value=await response.json();
 if(value?.ok!==true||value.storeId!==STORE||
    value.soloLectura!==true||value.operacionesHabilitadas!==false||
    typeof value.inicializado!=='boolean')
  throw Error('La respuesta de Romo no corresponde a la sucursal autorizada');
 return Object.freeze({inicializado:value.inicializado});
}
if(typeof window!=='undefined')
 window.ukiRomoEstadoConexionLecturaQA=comprobarConexionRomoSoloLecturaQA;
