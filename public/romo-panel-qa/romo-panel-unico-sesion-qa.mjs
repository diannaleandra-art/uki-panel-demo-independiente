/**
 * Adaptador de selección y sesión para instalar en el panel ÚNICO existente.
 * PREPARACIÓN, sin URL de red activa, importaciones Firebase ni escritura.
 *
 * El cliente de uki-romo-operativo-qa.mjs llama una API que exige sesión
 * Google firmada + permiso Neon del local. Nunca se acepta "rol" de la UI.
 *
 * La clave Uki no se guarda aquí: desbloquearSobre/prepararEstadoInicial
 * deben devolver el estado y una función cifrar() que ya usa AES-GCM de Uki.
 */
export const ROMO_UI_SUCURSAL_QA='Romo’s Sushi La Serena';
export const ROMO_UI_STORE_QA='romo:serena';
export const ROMO_UI_KEY_QA='romo_operativo_v1_cifrado_la-serena';

const UKI_EXACT=new Map([
 ['Uki Regimiento Arica','uki:arica'],
 ['Uki La Serena','uki:serena']
]);
const hasOwn=x=>!!x&&typeof x==='object'&&!Array.isArray(x);

export function seleccionarAlmacenamientoPanelQA(sucursal){
 if(UKI_EXACT.has(sucursal))
  return Object.freeze({storeId:UKI_EXACT.get(sucursal),sistema:'uki-existente',operativo:'sin cambios'});
 if(sucursal===ROMO_UI_SUCURSAL_QA)
  return Object.freeze({storeId:ROMO_UI_STORE_QA,sistema:'romo-neon-cifrado',operativo:'desactivado'});
 throw Error('Sucursal desconocida: no se permite utilizar el almacenamiento de Uki');
}
export function bloquearRespaldoUkiEnRomoQA(sucursal,destino){
 const route=seleccionarAlmacenamientoPanelQA(sucursal);
 if(route.storeId===ROMO_UI_STORE_QA&&destino!=='romo-neon-cifrado')
  throw Error('Romo nunca puede guardar datos en Firestore ni localStorage de Uki');
 return route.storeId;
}

function validarDatosRomo(datos,validarEstado){
 if(!hasOwn(datos)||datos.suc!==ROMO_UI_SUCURSAL_QA||!validarEstado(datos,ROMO_UI_SUCURSAL_QA))
  throw Error('Los registros no corresponden a Romo Balmaceda');
 for(const campo of ['pedidos','gastos','retiros','propinas','cierres','deliveriesManuales','incidencias']){
  if(!Array.isArray(datos[campo])||datos[campo].some(x=>!hasOwn(x)||x.suc!==ROMO_UI_SUCURSAL_QA))
   throw Error('Registro de otra sucursal detectado; no guardar');
 }
 return datos;
}

/** 
 * Encaja en la pantalla actual de Uki mediante entrarSuc/guardarEnLocalStorage.
 * No reemplaza el panel ni la sesión Firebase actual.
 * vault: puente al servidor Romo — apagado por defecto hasta autorización.
 * desbloquearSobre: usa abrirLocal del panel + contraseña de esa entrada;
 * prepararEstadoInicial: crea estado vacío sólo en memoria para Romo.
 */
export function crearSesionPanelUnicoRomoQA({
 vault,
 validarEstado,
 desbloquearSobre,
 prepararEstadoInicial
}={}){
 if(typeof validarEstado!=='function'||typeof desbloquearSobre!=='function'||
    typeof prepararEstadoInicial!=='function'||
    !vault||typeof vault.cargarSobre!=='function'||typeof vault.guardarSobre!=='function'||
    typeof vault.disponible!=='function')
  throw Error('Faltan los conectores del panel existente');
 let sesion=null;
 const disponible=()=>vault.disponible()===true;
 function requireSession(){
  if(!sesion)throw Error('Abre Romo con Google y su clave habitual antes de operar');
  if(sesion.conflicto)throw Error('Romo cambió en otro teléfono: recarga antes de guardar');
  return sesion;
 }
 return Object.freeze({
  disponible,
  async abrir({googleVerificado=false,claveUkiVerificada=false,
    abrirCifrado=null,prepararNuevo=null}={}){
   if(sesion)throw Error('Cierra la sucursal anterior antes de abrir Romo');
   if(!disponible()||!googleVerificado||claveUkiVerificada!==true)
    throw Error('La conexión protegida de Romo todavía no está autorizada');
   const remote=await vault.cargarSobre(); // El backend verifica Google y permisos ACTIVO.
   if(!Number.isSafeInteger(remote?.revision)||remote.revision<0)
    throw Error('La revisión cifrada de Romo es inválida');
   const opened=remote.revision===0?
     await (typeof prepararNuevo==='function'?prepararNuevo:prepararEstadoInicial)():
     await (typeof abrirCifrado==='function'?abrirCifrado:desbloquearSobre)(remote.snapshot);
   if(!opened||typeof opened.cifrar!=='function')
    throw Error('No se puede reutilizar el cifrado existente del panel');
   const estado=validarDatosRomo(opened.estado,validarEstado);
   const serialized=JSON.stringify(estado);
   sesion={revision:remote.revision,cifrar:opened.cifrar,ultimoEstado:serialized,conflicto:false};
   return Object.freeze({revision:remote.revision,estado});
  },
  async guardar(estado){
   const current=requireSession();
   validarDatosRomo(estado,validarEstado);
   const serialized=JSON.stringify(estado);
   if(serialized===current.ultimoEstado)
    return Object.freeze({ok:true,changed:false,revision:current.revision});
   const snapshot=await current.cifrar(estado);
   if(!hasOwn(snapshot)||snapshot.sucursal!==ROMO_UI_SUCURSAL_QA||
      snapshot.formato!=='uki-v813-browser'||snapshot.version!==1)
    throw Error('La preparación cifrada es de otra sucursal');
   let result;
   try{
    result=await vault.guardarSobre({expectedRevision:current.revision,snapshot});
   }catch(error){
    // Un conflicto no se puede resolver sobrescribiendo la revisión.
    if(error?.code==='REVISION_CONFLICTO'||/conflicto|cambió|recarga/i.test(String(error?.message||'')))
      current.conflicto=true;
    throw error;
   }
   if(!Number.isSafeInteger(result?.revision)||result.revision!==current.revision+1)
    throw Error('Romo no confirmó el guardado; conserva la sesión abierta');
   current.revision=result.revision;
   current.ultimoEstado=serialized;
   return Object.freeze({ok:true,changed:true,revision:current.revision});
  },
  estado(){
   const current=requireSession();
   return Object.freeze({storeId:ROMO_UI_STORE_QA,revision:current.revision,conflicto:current.conflicto});
  },
  cerrar(){sesion=null;}
 });
}
export const ROMO_PANEL_UNICO_SESION_QA_NO_OPERATIVA=true;
