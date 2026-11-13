/**
 * Adaptador para el MISMO panel y botón Guardar de Uki.
 * El estado Romo solo se instala tras autenticación Google, verificación de
 * clave y lectura de la base independiente. El pedido sólo se muestra cuando
 * Neon ha confirmado solicitud + estado cifrado mediante una sola operación.
 *
 * No habilita por sí mismo ventas, caja, cierres ni inventario.
 */
import {crearGuardadoRomoDesdeFormularioQA} from './uki-romo-guardado-atomico-qa.mjs';
import {prepararBorradorRomoDesdeSolicitudQA} from './uki-romo-recepcion-formulario-qa.mjs';
import {crearGuardadoCajaRomoQA} from './uki-romo-movimientos-atomicos-qa.mjs';
export const ROMO_PANTALLA_OPERATIVA_HABILITADA_QA=false;
const SUC='Romo’s Sushi La Serena';
const requireOk=(condition,message)=>{if(!condition)throw Error(message)};
export function crearControlRomoMismoPanelQA({
 habilitado=ROMO_PANTALLA_OPERATIVA_HABILITADA_QA,
 estadoRemoto,bandeja,obtenerToken,validarClave,crearInicial,
 cifrarEstado,validarEstado,estadoVisible,aplicarEstado
}={}){
 let revision=null,solicitud=null,guardando=false;
 const disponible=()=>habilitado===true&&estadoRemoto?.disponible?.()===true&&
  bandeja?.disponible?.()===true;
 const verificarSesion=()=>{
  requireOk(disponible(),'Romo permanece en preparación');
  requireOk(Number.isSafeInteger(revision)&&revision>=0,
   'Primero abre el estado separado de Romo');
  const visible=estadoVisible?.();
  requireOk(visible?.revision===revision&&validarEstado?.(visible.estado,SUC),
   'La versión local de Romo está desactualizada');
  return visible;
 };
 return Object.freeze({
  disponible,
  resumen:()=>Object.freeze({sucursal:SUC,abierto:Number.isSafeInteger(revision),
   revision,solicitudId:solicitud?.id||null,guardando}),
  async abrir({password}={}){
   requireOk(disponible(),'Romo permanece en preparación');
   requireOk(typeof password==='string'&&password.length>=12,'Contraseña habitual requerida');
   requireOk(typeof obtenerToken==='function'&&typeof validarClave==='function'&&
    typeof crearInicial==='function'&&typeof aplicarEstado==='function',
    'Faltan conexiones del panel Uki');
   const token=await obtenerToken();
   requireOk(typeof token==='string'&&token.length>30,
    'Inicia sesión Google en el mismo panel antes de abrir Romo');
   await validarClave(password);
   const data=await estadoRemoto.cargar({password});
   requireOk(Number.isSafeInteger(data?.revision)&&data.revision>=0,
    'La revisión remota Romo no es válida');
   const estado=data.estado??crearInicial();
   requireOk(validarEstado?.(estado,SUC),'Estado no pertenece a Romo La Serena');
   await aplicarEstado({estado,revision:data.revision,soloLectura:false});
   revision=data.revision;solicitud=null;
   return Object.freeze({revision,storeId:'romo:serena',estado:'abierto'});
  },
  cerrar(){
   revision=null;solicitud=null;guardando=false;
  },
  async listar(){
   verificarSesion();
   return bandeja.listar();
  },
  async seleccionar(id){
   verificarSesion();
   requireOk(typeof id==='string','Solicitud inválida');
   const rows=await bandeja.listar();
   const row=rows.find(x=>x.id===id&&x.branch==='serena'&&x.estado==='pendiente');
   requireOk(row,'Solicitud no disponible. Actualiza la bandeja');
   // No hay efecto de caja, historial ni timbre al seleccionar.
   solicitud=row;
   return prepararBorradorRomoDesdeSolicitudQA(row);
  },
  async guardarMovimiento({tipo,datos}={}){
   verificarSesion();
   requireOk(!guardando,'Ya se está guardando en Romo');
   requireOk(typeof cifrarEstado==='function'&&typeof aplicarEstado==='function',
    'La caja independiente todavía no está conectada');
   guardando=true;
   try{
    const worker=crearGuardadoCajaRomoQA({
     habilitado:true,servidor:estadoRemoto,cifrarEstado,validarEstado,
     estadoVisible:()=>estadoVisible(),
     aplicarConfirmado:async({estado,revision:next,cambio})=>{
      await aplicarEstado({estado,revision:next,cambio,soloLectura:false});
      revision=next;
     }
    });
    return await worker.guardar({tipo,datos});
   }finally{guardando=false}
  },
  async guardar({draft,contexto,confirmoArmado=false,confirmoImportes=false}={}){
   const visible=verificarSesion();
   requireOk(!guardando,'Ya hay un guardado de Romo en curso');
   requireOk(solicitud&&draft?.cartaSolicitudRemotaId===solicitud.id,
    'Primero selecciona la solicitud pendiente en la bandeja Romo');
   requireOk(contexto&&typeof contexto==='object'&&!Array.isArray(contexto),
    'Falta turno real del panel Uki');
   requireOk(typeof cifrarEstado==='function'&&typeof aplicarEstado==='function',
    'El cifrado del panel habitual no está conectado');
   guardando=true;
   try{
    const driver=crearGuardadoRomoDesdeFormularioQA({
     habilitado:true,bandeja,validarEstado,cifrarEstado,
     contextoPedido:async()=>contexto,
     estadoVisible:()=>estadoVisible(),
     aplicarConfirmado:async ({estado,revision:next,pedidoId})=>{
      await aplicarEstado({estado,revision:next,pedidoId,soloLectura:false});
      revision=next;
     }
    });
    const resultado=await driver.guardarSolicitud({
     solicitud,draft,estado:visible.estado,revision,
     confirmoArmado,confirmoImportes
    });
    solicitud=null;
    return resultado;
   }finally{guardando=false;}
  }
 });
}
