/* Uki Sushi — guardado automatico para operacion interna.
 * No escribe sin activación explícita tras leer la revisión remota.
 * Cambios de vista y filtros no generan sincronizaciones.
 * Conflictos o fallas detienen el autoguardado y conservan la copia local.
 */
const OMITIR=new Set(["vista","pinSuc","codigos","msg","busy","confirmCierre",
 "filtro","filtroFecha","filtroCliente"]);
export function huellaOperativa(estado){
 if(!estado||typeof estado!=="object")throw Error("Estado no disponible");
 const datos={};
 for(const [k,v] of Object.entries(estado))if(!OMITIR.has(k))datos[k]=v;
 return JSON.stringify(datos);
}
export function crearAutoGuardadoOperativo({guardar,getEstado,avisar,delay=1500,
 scheduler=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){
 if(typeof guardar!=="function"||typeof getEstado!=="function"||typeof avisar!=="function")
  throw Error("Faltan funciones de guardado");
 let sucursal=null,revision=null,huellaGuardada=null,timer=null;
 let activo=false,bloqueado=false,ocupado=false,estado="desactivado",token=0,remotoPendiente=null;
 let guardados=0;
 // Sin el limite de 10 de QA. Conserva deduplicacion, debounce y parada por conflicto.
 function informar(nuevo,detalle=""){
  estado=nuevo;avisar({estado,detalle,revision,sucursal,activo,bloqueado});
 }
 function pararTimer(){if(timer!==null){cancel(timer);timer=null;}}
 function desactivar(){
  token++;pararTimer();activo=false;bloqueado=false;
  sucursal=null;revision=null;huellaGuardada=null;remotoPendiente=null;informar("desactivado");
 }
 function activar({suc,rev,estadoBase}){
  if(typeof suc!=="string"||!suc||!Number.isSafeInteger(rev)||rev<0)
   throw Error("Primero cargar una revisión segura");
  if(estadoBase?.suc!==suc)throw Error("Sucursal incorrecta");
  desactivar();sucursal=suc;revision=rev;
  huellaGuardada=huellaOperativa(estadoBase);
  activo=true;informar("sincronizado","Nube verificada");
 }
 function cambioLocal(){
  if(!activo||bloqueado)return;
  const actual=getEstado();
  if(!actual||actual.suc!==sucursal){desactivar();return;}
  if(huellaOperativa(actual)===huellaGuardada){
   if(!ocupado)informar("sincronizado");return;
  }
  pararTimer();informar("pendiente","Cambios guardados solo en este dispositivo");
  timer=scheduler(()=>{timer=null;return enviar()},delay);
 }
 async function enviar(){
  if(!activo||bloqueado||ocupado)return;

  const copia=getEstado();
  if(!copia||copia.suc!==sucursal){desactivar();return;}
  const huella=huellaOperativa(copia);
  if(huella===huellaGuardada){informar("sincronizado");return;}
  const revisionOriginal=revision,id=token;
  ocupado=true;informar("guardando","Guardando copia cifrada");
  try{
   const r=await guardar({sucursal,revisionEsperada:revisionOriginal,estado:copia});
   if(id!==token||!activo||sucursal!==copia.suc)return;
   if(!Number.isSafeInteger(r?.revision)||r.revision!==revisionOriginal+1)
    throw Object.assign(Error("Revisión de guardado inesperada"),{code:"REVISION"});
   revision=r.revision;huellaGuardada=huella;guardados++;
   informar("sincronizado","Guardado confirmado en Firebase");
  }catch(e){
   if(id!==token||!activo)return;
   bloqueado=true;pararTimer();
   const tipo=e?.code==="CONFLICTO"?"conflicto":"error";
   informar(tipo,"Sin sobrescribir la nube. Se conservan los cambios locales: "+String(e?.message||e));
  }finally{
   ocupado=false;
   if(id===token&&activo&&!bloqueado&&remotoPendiente!==null&&remotoPendiente>revision){
     bloqueado=true;pararTimer();
     informar("conflicto","Se detectó una revisión remota más reciente. Mantén esta copia local.");
   }else if(id===token&&activo&&!bloqueado&&huellaOperativa(getEstado())!==huellaGuardada){
     cambioLocal();
   }
   remotoPendiente=null;
  }
 }
 function revisionRemota(rev){
  if(!activo||bloqueado||!Number.isSafeInteger(rev)||rev<=revision)return;
  if(ocupado){remotoPendiente=Math.max(remotoPendiente||0,rev);return;} // Comprobar después del commit propio.
  bloqueado=true;pararTimer();
  informar("conflicto","Otro equipo guardó una revisión más reciente. Recarga la nube antes de seguir.");
 }
 function resumen(){return Object.freeze({estado,revision,sucursal,activo,bloqueado,ocupado,guardados});}
 return Object.freeze({activar,desactivar,cambioLocal,revisionRemota,enviar,resumen});
}
