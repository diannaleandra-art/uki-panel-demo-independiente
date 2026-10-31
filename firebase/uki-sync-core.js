/* Uki Sushi: núcleo de sincronización en preparación. No se usa en la v8.15.
   Solo transmite paquetes cifrados, nunca el estado en texto claro. */
export const SUCURSALES_CLOUD=Object.freeze({"Uki Regimiento Arica":"regimiento","Uki La Serena":"la-serena"});
export class ErrorUkiCloud extends Error {
  constructor(code,message){super(message);this.name="ErrorUkiCloud";this.code=code;}
}
export function crearAlmacenCloud({db,firestore,auth}){
  if(!db||!firestore||!auth)throw new ErrorUkiCloud("CONFIG","Firebase no configurado");
  const {doc,getDocFromServer,runTransaction,onSnapshot}=firestore;
  for(const [name,fn] of Object.entries({doc,getDocFromServer,runTransaction,onSnapshot}))
    if(typeof fn!=="function")throw new ErrorUkiCloud("SDK","Falta "+name);
  const ruta=s=>{
    if(!Object.prototype.hasOwnProperty.call(SUCURSALES_CLOUD,s))
      throw new ErrorUkiCloud("SUCURSAL","Sucursal no autorizada");
    return doc(db,"uki_sucursales",SUCURSALES_CLOUD[s]);
  };
  const autenticar=()=>{if(!auth.currentUser)throw new ErrorUkiCloud("LOGIN","Inicia sesión con Google");};
  const validar=(data,s)=>{
    if(data==null)return {revision:0,paquete:null};
    if(data.branch!==SUCURSALES_CLOUD[s]||data.schemaVersion!==1||
       !Number.isSafeInteger(data.rev)||data.rev<1||
       typeof data.paquete!=="string"||data.paquete.length>750000)
      throw new ErrorUkiCloud("FORMATO","La información pertenece a otra sucursal o tiene formato incorrecto");
    return {revision:data.rev,paquete:data.paquete};
  };
  async function cargar(s){
    autenticar();
    const ref=ruta(s),snap=await getDocFromServer(ref);
    return validar(snap.exists()?snap.data():null,s);
  }
  async function guardar({sucursal,revisionEsperada,paquete}){
    autenticar();
    const ref=ruta(sucursal);
    if(!Number.isSafeInteger(revisionEsperada)||revisionEsperada<0)
      throw new ErrorUkiCloud("REVISION","Revisión inválida");
    if(typeof paquete!=="string"||!paquete.length||paquete.length>750000)
      throw new ErrorUkiCloud("TAMANO","Registro demasiado grande");
    let p;
    try{p=JSON.parse(paquete)}catch(e){throw new ErrorUkiCloud("CIFRADO","Paquete no válido")}
    if(p.formato!=="uki-v813-browser"||p.version!==1||p.sucursal!==sucursal||
      typeof p.cifrado!=="string"||typeof p.iv!=="string"||typeof p.salt!=="string")
      throw new ErrorUkiCloud("CIFRADO","Falta el cifrado de Uki");
    // La transacción se reintenta ante conflictos. No modificar la pantalla aquí.
    return runTransaction(db,async t=>{
      const snap=await t.get(ref);
      const actual=validar(snap.exists()?snap.data():null,sucursal);
      if(actual.revision!==revisionEsperada)
        throw new ErrorUkiCloud("CONFLICTO","Otro equipo guardó cambios. No se sobrescribió nada.");
      const rev=actual.revision+1;
      t.set(ref,{branch:SUCURSALES_CLOUD[sucursal],schemaVersion:1,rev,paquete});
      return {revision:rev};
    });
  }
  function observar(s,recibir,error){
    autenticar();const ref=ruta(s);
    if(typeof recibir!=="function")throw new ErrorUkiCloud("CALLBACK","Falta receptor");
    return onSnapshot(ref,{includeMetadataChanges:true},snap=>{
      if(snap.metadata?.fromCache)return; // No aceptar caché como revisión actual.
      try{recibir(validar(snap.exists()?snap.data():null,s))}
      catch(e){if(typeof error==="function")error(e)}
    },e=>{if(typeof error==="function")error(e)});
  }
  return Object.freeze({cargar,guardar,observar});
}
