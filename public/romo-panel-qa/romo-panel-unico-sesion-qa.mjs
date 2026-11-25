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
// Comparación de datos operativos, no de navegación. La UI de Uki cambia
// vista/filtros durante render sin constituir una edición de caja o pedido.
const UI_TRANSIENTES_ROMO=new Set([
 'pinSuc','codigos','vista','busy','msg','confirmCierre',
 'filtro','filtroFecha','filtroCliente','romoSeleccionadoQA','romoIngresadoQA'
]);
const PREDETERMINADOS_ROMO=Object.freeze({
 base:18000,pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],apps:{},
 pagoDelivery:0,pagoDeliveryMedio:'Efectivo',deliveriesManuales:[],
 ajustesHistoricos:[],borradores:[],solicitudesWhatsApp:[],
 cajaChica:{inicial:20000,gastos:[]},clientes:{},cajasDiarias:{},
 incidencias:[],nextIncidenciaId:1,nextId:1
});
const ordenarRecursivo=v=>Array.isArray(v)?v.map(ordenarRecursivo):
 hasOwn(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordenarRecursivo(v[k])])):v;
function cajaDeVistaSinMovimientosRomo(caja){
 if(!hasOwn(caja)||Object.keys(caja).sort().join('|')!==
    'apps|base|baseConfirmada|cajaChica|desdeMs|inicioMs|pagoDelivery|pagoDeliveryMedio')
  return false;
 return hasOwn(caja.apps)&&Object.keys(caja.apps).length===0&&
  caja.base===0&&caja.baseConfirmada===false&&
  hasOwn(caja.cajaChica)&&caja.cajaChica.inicial===0&&
  Array.isArray(caja.cajaChica.gastos)&&caja.cajaChica.gastos.length===0&&
  Object.keys(caja.cajaChica).length===2&&
  caja.pagoDelivery===0&&caja.pagoDeliveryMedio==='Efectivo'&&
  caja.desdeMs===0&&Number.isSafeInteger(caja.inicioMs)&&caja.inicioMs>0;
}
function firmaOperativaRomo(datos,original=null){
 if(!hasOwn(datos)||datos.suc!==ROMO_UI_SUCURSAL_QA)return null;
 const limpio={};
 for(const [k,v] of Object.entries(datos))
  if(!UI_TRANSIENTES_ROMO.has(k))limpio[k]=v;
 for(const [k,v] of Object.entries(PREDETERMINADOS_ROMO))
  if(!Object.prototype.hasOwnProperty.call(limpio,k))limpio[k]=v;
 if(hasOwn(original)&&original.suc===ROMO_UI_SUCURSAL_QA){
  // Solo normalizar campos que el render() existente genera en consulta
  // aunque Neon no los tuviera. No se guardan en la cancelación.
  // La fecha de pantalla cambia automáticamente después de medianoche.
  // Para cancelar se usa estadoOperativoConfirmado(), que preserva
  // la fecha realmente almacenada; no se toma la fecha temporal del render.
  delete limpio.fechaOperativa;
  if(hasOwn(limpio.cajasDiarias)){
   const cajas={...limpio.cajasDiarias};
   const iniciales=hasOwn(original.cajasDiarias)?original.cajasDiarias:{};
   for(const [clave,caja] of Object.entries(cajas))
    if(!Object.prototype.hasOwnProperty.call(iniciales,clave)&&
       cajaDeVistaSinMovimientosRomo(caja))delete cajas[clave];
   limpio.cajasDiarias=cajas;
  }
 }
 return JSON.stringify(ordenarRecursivo(limpio));
}

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
 let sesion=null,guardadoEnCurso=false,operacionAtomicaPendiente=false,refrescoEnCurso=false;
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
   sesion={revision:remote.revision,cifrar:opened.cifrar,abrirSiguiente:opened.abrirSiguiente,ultimoEstado:serialized,conflicto:false};
   return Object.freeze({revision:remote.revision,estado});
  },
  async guardar(estado,{guardarConjunto=null}={}){
   // Un teléfono no puede solapar dos escrituras con la misma revisión CAS.
   if(guardadoEnCurso||operacionAtomicaPendiente)throw Error('Romo tiene una operación pendiente. Consulta Neon antes de intentar otra.');
   guardadoEnCurso=true;
   try{
   const current=requireSession();
   // Evita que render() o navegar por la UI inicialice caja antes de
   // la autorización manual de dueños para el primer sobre cifrado.
   if(current.revision===0)
    throw Error('Primero debes autorizar la inicialización de Romo; no se guardó nada');
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
    // El guardado especial sustituye el POST habitual; jamás ejecuta ambos.
    result=typeof guardarConjunto==='function'?
     await guardarConjunto({expectedRevision:current.revision,snapshot}):
     await vault.guardarSobre({expectedRevision:current.revision,snapshot});
   }catch(error){
    // Un corte de red puede ocultar un guardado que Neon sí aceptó.
    // No repetir operaciones comerciales hasta reabrir y consultar la revisión.
    current.conflicto=true;
    throw Error('Guardado Romo de resultado incierto. Reabre y revisa Neon, pedidos e historial antes de repetir.');
   }
   if(!Number.isSafeInteger(result?.revision)||result.revision!==current.revision+1){
    current.conflicto=true;
    throw Error('Neon no confirmó la revisión esperada. Reabre Romo y concilia antes de repetir.');
   }
   current.revision=result.revision;
   current.ultimoEstado=serialized;
   return Object.freeze({ok:true,changed:true,revision:current.revision});
   }finally{guardadoEnCurso=false;}
  },

  /** Cifra con la MISMA sesión del panel, pero no envía una escritura.
   * Se usa para el SQL atómico que acepta carta+pedido simultáneamente.
   */
  async prepararSobreAceptacion(estado){
   if(guardadoEnCurso||operacionAtomicaPendiente)
    throw Error('Hay una operación pendiente. Revisa Neon antes de repetir.');
   const current=requireSession();
   operacionAtomicaPendiente=true;
   try{
   if(current.revision<1)throw Error('La base Romo aún no tiene estado inicial.');
   const valid=validarDatosRomo(estado,validarEstado);
   const revision=current.revision,firma=current.ultimoEstado;
   const snapshot=await current.cifrar(valid);
   if(current.revision!==revision||current.ultimoEstado!==firma)
    throw Error('Romo cambió durante el cifrado; actualiza antes de continuar');
   if(!hasOwn(snapshot)||snapshot.sucursal!==ROMO_UI_SUCURSAL_QA||
      snapshot.formato!=='uki-v813-browser'||snapshot.version!==1)
    throw Error('Sobre de otra sucursal');
   return Object.freeze({revision,snapshot});
   }catch(error){operacionAtomicaPendiente=false;throw error;}
  },
  /** Solo llamar TRAS respuesta firmada del servidor con revisión +1.
   * Si el servidor respondió pero la pantalla se perdió, NO reintentar:
   * reabrir el estado desde Neon y conciliar.
   */
  confirmarSobreAceptado({estado,revision}={}){
   if(!operacionAtomicaPendiente)
    throw Error('No hay una operación atómica esperando confirmación.');
   const current=requireSession();
   validarDatosRomo(estado,validarEstado);
   if(!Number.isSafeInteger(revision)||revision!==current.revision+1)
    throw Error('Revisión del pedido aceptado no confirmada; recarga Romo.');
   current.revision=revision;
   current.ultimoEstado=JSON.stringify(estado);
   operacionAtomicaPendiente=false;
   return Object.freeze({ok:true,revision});
  },
  /** Copia exacta de la última revisión descifrada y confirmada por Neon.
   * Nunca utiliza caja generada por render() o filtros del teléfono.
   */
  estadoOperativoConfirmado(){
   if(guardadoEnCurso||operacionAtomicaPendiente)
    throw Error('Hay una operación en progreso, reabre Romo');
   const current=requireSession();
   if(!Number.isSafeInteger(current.revision)||current.revision<1)
    throw Error('No existe una revisión confirmada de Romo');
   return JSON.parse(current.ultimoEstado);
  },
  /** Confirma que el estado visible parte de la revisión descifrada
   * y no arrastra ediciones locales de pedidos/caja sin guardar.
   * Ignora solamente los campos de presentación, nunca los monetarios.
   * NO consulta Neon en tiempo real: el CAS valida la revisión al guardar.
   */
  coincideEstadoOperativo(datos){
   if(!sesion||sesion.conflicto||guardadoEnCurso||operacionAtomicaPendiente||
      !Number.isSafeInteger(sesion.revision)||sesion.revision<1)return false;
   try{
    validarDatosRomo(datos,validarEstado);
    const esperado=JSON.parse(sesion.ultimoEstado);
    return firmaOperativaRomo(datos,esperado)!==null&&
     firmaOperativaRomo(datos,esperado)===firmaOperativaRomo(esperado,esperado);
   }catch{return false;}
  },
  // Sólo lectura. No reintenta operaciones de resultado incierto ni mezcla datos.
  async refrescarSiLimpio({getEstado,puedeAplicar,aplicar}={}){
   if(refrescoEnCurso||guardadoEnCurso||operacionAtomicaPendiente||
      !sesion||sesion.conflicto||!disponible()||sesion.revision<1||
      typeof sesion.abrirSiguiente!=='function'||
      typeof getEstado!=='function'||typeof puedeAplicar!=='function'||typeof aplicar!=='function')
    return false;
   const local=sesion,base=local.revision,original=JSON.parse(local.ultimoEstado);
   const firma=firmaOperativaRomo(original,original);
   const vigente=()=>sesion===local&&local.revision===base&&!local.conflicto&&
    !guardadoEnCurso&&!operacionAtomicaPendiente&&disponible()&&
    puedeAplicar()===true&&firmaOperativaRomo(getEstado(),original)===firma;
   if(!vigente())return false;
   refrescoEnCurso=true;
   try{
    const remoto=await vault.cargarSobre();
    if(!vigente()||!Number.isSafeInteger(remoto?.revision)||remoto.revision<=base)return false;
    const datos=validarDatosRomo(await local.abrirSiguiente(remoto.snapshot),validarEstado);
    if(!vigente())return false;
    // Comprobar que la revisión no avanzó durante el descifrado.
    const confirmado=await vault.cargarSobre();
    if(!vigente()||confirmado.revision!==remoto.revision)return false;
    const serial=JSON.stringify(datos);
    // La aplicación de UI es síncrona: no hay espera entre validar y adoptar.
    if(aplicar(datos)!==true)return false;
    local.revision=remoto.revision;local.ultimoEstado=serial;
    return true;
   }finally{refrescoEnCurso=false;}
  },
  // Verificar en Neon la última revisión antes de subir un archivo mensual.
  // Es solo lectura y no cambia pedidos, caja ni estado guardado.
  async comprobarRevisionParaArchivo(){
   if(!sesion||sesion.conflicto||guardadoEnCurso||
      operacionAtomicaPendiente||!disponible())return false;
   const local=sesion,revision=local.revision;
   if(!Number.isSafeInteger(revision)||revision<1)return false;
   const remoto=await vault.cargarSobre();
   if(remoto.revision!==revision){
    local.conflicto=true;
    return false;
   }
   return sesion===local&&!local.conflicto&&!guardadoEnCurso&&
    !operacionAtomicaPendiente&&local.revision===revision;
  },
  estado(){
   const current=requireSession();
   return Object.freeze({storeId:ROMO_UI_STORE_QA,revision:current.revision,conflicto:current.conflicto});
  },
  cerrar(){
   if(guardadoEnCurso)throw Error('El guardado de Romo todavía no terminó. No se cerró la sesión.');
   sesion=null;
   operacionAtomicaPendiente=false;
  }
 });
}
export const ROMO_PANEL_UNICO_SESION_QA_NO_OPERATIVA=true;
