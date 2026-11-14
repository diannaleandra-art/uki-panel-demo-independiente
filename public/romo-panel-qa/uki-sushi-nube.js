/* Uki Sushi — protocolo de foto completa CIFRADA por sucursal, solo habilitar tras autorizar reglas de producción.
 * No conectar con pedidos reales hasta probar reglas y recuperación de datos.
 * 1. Se escriben bloques cifrados e inmutables en una generación nueva.
 * 2. Una transacción mueve el manifiesto SOLO si la revisión esperada coincide.
 * 3. Los clientes leen únicamente la generación confirmada en el manifiesto.
 * Un conflicto nunca sobrescribe silenciosamente los registros ajenos.
 *
 * Requiere:
 *   dividirEstado/reunirEstado de uki-particion-local.js
 *   derivarClave/nuevaSal/nuevaGeneracion/cifrarBloque/descifrarBloque
 *   Firebase SDK: doc/getDocFromServer/writeBatch/runTransaction
 */
export class ErrorSnapshotUki extends Error {
 constructor(codigo,mensaje){super(mensaje);this.name="ErrorSnapshotUki";this.code=codigo;}
}
const RAMAS=Object.freeze({"Uki Regimiento Arica":"regimiento","Uki La Serena":"la-serena"});
const LIMITE_BLOQUES=180;
const TAMANO_BLOQUE_ENCRIPTADO=350000;
const BATCH_SIZE=8; // Asegurar margen para el límite de 20 lecturas de reglas por lote.
const MAX_PARALELO_LECTURA=6;
const fail=(codigo,mensaje)=>{throw new ErrorSnapshotUki(codigo,mensaje)};
const esGeneracion=id=>typeof id==="string"&&/^[a-f0-9]{32}$/.test(id);
const camposManifiesto=data=>data&&
 data.schemaVersion===2&&Number.isSafeInteger(data.rev)&&data.rev>=1&&
 esGeneracion(data.generacion)&&
 typeof data.salt==="string"&&data.salt.length>=20&&data.salt.length<=28&&
 Number.isSafeInteger(data.totalBloques)&&data.totalBloques>=1&&data.totalBloques<=LIMITE_BLOQUES;
export function crearSnapshotsUki({db,auth,api,blocks,codec}){
 if(!db||!auth||!api||!blocks||!codec)fail("CONFIG","Falta configuración");
 for(const p of ["doc","getDocFromServer","writeBatch","runTransaction"])
   if(typeof api[p]!=="function")fail("SDK","Falta API "+p);
 for(const p of ["dividirEstado","reunirEstado"])
   if(typeof blocks[p]!=="function")fail("BLOQUES","Falta "+p);
 for(const p of ["derivarClave","nuevaSal","nuevaGeneracion","cifrarBloque","descifrarBloque"])
   if(typeof codec[p]!=="function")fail("CIFRADO","Falta "+p);
 const nombreRama=s=>{
   if(!Object.prototype.hasOwnProperty.call(RAMAS,s))fail("SUCURSAL","Sucursal no reconocida");
   return RAMAS[s];
 };
 const verificarSesion=()=>{
   if(!auth.currentUser||!auth.currentUser.uid)fail("LOGIN","Primero ingresa con Google");
   return auth.currentUser.uid;
 };
 const refManifiesto=branch=>api.doc(db,"uki_operacion_v1",branch);
 const refBloque=(branch,generation,index)=>api.doc(db,"uki_operacion_v1",branch,"bloques",generation+"_"+String(index).padStart(4,"0"));
 const validarManifest=(data,branch)=>{
   if(data==null)return {revision:0,manifest:null};
   if(!camposManifiesto(data)||data.branch!==branch)fail("FORMATO","Manifiesto remoto incorrecto");
   return {revision:data.rev,manifest:data};
 };
 async function cargar(sucursal,password){
   verificarSesion();const branch=nombreRama(sucursal);
   const manifestSnap=await api.getDocFromServer(refManifiesto(branch));
   const {revision,manifest}=validarManifest(manifestSnap.exists()?manifestSnap.data():null,branch);
   if(!manifest)return {revision:0,estado:null};
   const clave=await codec.derivarClave(password,manifest.salt);
   const resultados=new Array(manifest.totalBloques);
   let siguiente=0;
   async function trabajador(){
     while(siguiente<manifest.totalBloques){
       const i=siguiente++;
       const snap=await api.getDocFromServer(refBloque(branch,manifest.generacion,i));
       if(!snap.exists())fail("INCOMPLETO","Falta parte "+i+" del respaldo remoto");
       const doc=snap.data();
       if(doc.branch!==branch||doc.generacion!==manifest.generacion||
          doc.indice!==i||doc.formato!=="uki-cloud-chunk-v1"||
          typeof doc.paquete!=="string"||doc.paquete.length>TAMANO_BLOQUE_ENCRIPTADO)
         fail("FORMATO","Bloque remoto no coincide");
       const decrypted=await codec.descifrarBloque({
         clave,branch,generacion:manifest.generacion,registro:JSON.parse(doc.paquete)
       });
       resultados[i]=decrypted;
     }
   }
   await Promise.all(Array.from({length:Math.min(manifest.totalBloques,MAX_PARALELO_LECTURA)},()=>trabajador()));
   const estado=blocks.reunirEstado(resultados,sucursal);
   if(!estado||estado.suc!==sucursal)fail("SUCURSAL","Los datos corresponden a otra sucursal");
   return {revision,estado};
 }
 async function guardar({sucursal,password,revisionEsperada,estado}){
   const uid=verificarSesion(),branch=nombreRama(sucursal);
   if(!Number.isSafeInteger(revisionEsperada)||revisionEsperada<0)
     fail("REVISION","Revisión local incorrecta");
   if(!estado||estado.suc!==sucursal)fail("SUCURSAL","Los datos mezclan locales");
   const piezas=blocks.dividirEstado(estado,sucursal);
   if(!piezas.length||piezas.length>LIMITE_BLOQUES)
     fail("CUOTA","Demasiados bloques. Descarga un respaldo y consulta antes de continuar.");
   // Si ya hay una generación, conservar su SAL. Así otra persona con la misma
   // contraseña puede descifrarla. No se publica la contraseña ni la clave.
   const manifestSnap=await api.getDocFromServer(refManifiesto(branch));
   const origen=validarManifest(manifestSnap.exists()?manifestSnap.data():null,branch);
   if(origen.revision!==revisionEsperada)
     fail("CONFLICTO","Otro equipo guardó cambios. Recarga antes de intentar guardar.");
   const salt=origen.manifest?origen.manifest.salt:codec.nuevaSal();
   const clave=await codec.derivarClave(password,salt);
   // Comprobar que la clave sea correcta si ya existe un manifiesto. No basta
   // con derivar una clave cualquiera que cifraría información ilegible.
   if(origen.manifest && origen.manifest.totalBloques>0){
     const oldSnap=await api.getDocFromServer(refBloque(branch,origen.manifest.generacion,0));
     if(!oldSnap.exists())fail("INCOMPLETO","Falta el registro remoto inicial");
     const old=oldSnap.data();
     try{
       await codec.descifrarBloque({clave,branch,generacion:origen.manifest.generacion,
         registro:JSON.parse(old.paquete)});
     }catch(e){fail("CLAVE","La contraseña no permite abrir los registros existentes")}
   }
   const generacion=codec.nuevaGeneracion();
   if(!esGeneracion(generacion)||origen.manifest?.generacion===generacion)
      fail("GENERACION","Generación no válida");
   const encrypted=await Promise.all(piezas.map(async (p,i)=>{
     const r=await codec.cifrarBloque({clave,branch,generacion,bloque:p});
     const paquete=JSON.stringify(r);
     if(paquete.length>TAMANO_BLOQUE_ENCRIPTADO)
       fail("CUOTA","Un bloque cifrado supera el tamaño permitido");
     return {branch,generacion,indice:i,formato:"uki-cloud-chunk-v1",paquete};
   }));
   // Subir bloques inmutables. Los fallos dejan una generación huérfana,
   // NUNCA publican un manifiesto parcial.
   for(let start=0;start<encrypted.length;start+=BATCH_SIZE){
     verificarSesion();
     const batch=api.writeBatch(db);
     for(let j=start;j<Math.min(start+BATCH_SIZE,encrypted.length);j++)
       batch.set(refBloque(branch,generacion,j),encrypted[j]);
     await batch.commit();
   }
   // Commit final de solo un documento. Firestore reintenta la transacción
   // y vuelve a leer la revisión, impidiendo perder modificaciones concurrentes.
   try{
     const committed=await api.runTransaction(db,async t=>{
       const live=await t.get(refManifiesto(branch));
       const now=validarManifest(live.exists()?live.data():null,branch);
       if(now.revision!==revisionEsperada)
         fail("CONFLICTO","Otro equipo guardó primero. Tus datos no han sobrescrito los suyos.");
       const rev=revisionEsperada+1;
       t.set(refManifiesto(branch),{branch,schemaVersion:2,rev,generacion,
         salt,totalBloques:encrypted.length,actualizadoPor:uid});
       return rev;
     });
     return {revision:committed,generacion,bloques:encrypted.length};
   }catch(e){
     if(e?.code==="CONFLICTO")throw e;
     fail("PENDIENTE","No se pudo confirmar el guardado. Comprueba el estado remoto antes de reintentar.");
   }
 }
 return Object.freeze({cargar,guardar});
}
