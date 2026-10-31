/* Uki Sushi — cifrado de bloques para la rama QA.
 * No usar claves privadas ni datos reales en pruebas; nunca se envía contraseña.
 * AES-256-GCM con IV aleatorio por bloque y PBKDF2-SHA256 (300.000).
 * Esta librería NO escribe en Firestore ni altera la carta o panel publicado. */
export const UKI_CLOUD_CRYPTO_FORMAT="uki-cloud-chunk-v1";
export const UKI_CLOUD_PBKDF2_ITER=300000;
const enc=new TextEncoder();
const dec=new TextDecoder();
const encode64=data=>{
 let raw="",a=new Uint8Array(data);
 for(let i=0;i<a.length;i+=8192)raw+=String.fromCharCode(...a.subarray(i,i+8192));
 return btoa(raw);
};
const decode64=str=>{
 if(typeof str!=="string"||str.length>500000||!/^[A-Za-z0-9+/]*={0,2}$/.test(str))
   throw new Error("Contenido cifrado inválido");
 const bytes=atob(str);return Uint8Array.from(bytes,x=>x.charCodeAt(0));
};
const bytesToHex=data=>Array.from(data,x=>x.toString(16).padStart(2,"0")).join("");
export function nuevaSal(){
 const arr=crypto.getRandomValues(new Uint8Array(16));
 return encode64(arr);
}
export function nuevaGeneracion(){
 return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}
export async function derivarClave(password,sal){
 if(typeof password!=="string"||password.length<12)throw new Error("La clave debe tener al menos 12 caracteres");
 const salt=decode64(sal);
 if(salt.length!==16)throw new Error("Sal del cifrado incorrecta");
 const raw=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:UKI_CLOUD_PBKDF2_ITER,hash:"SHA-256"},
    raw,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function identidad(branch,generacion,bloque){
 if(!["regimiento","la-serena"].includes(branch))throw new Error("Sucursal no autorizada");
 if(typeof generacion!=="string"||!/^[a-f0-9]{32}$/.test(generacion))throw new Error("Identificador inválido");
 if(!bloque||typeof bloque.tipo!=="string"||!["pedidos","gastos","retiros","propinas","cierres",
     "deliveriesManuales","incidencias","clientes","cajasDiarias","meta"].includes(bloque.tipo)||
   typeof bloque.grupo!=="string"||bloque.grupo.length>40||
   !Number.isSafeInteger(bloque.numero)||bloque.numero<0)
   throw new Error("Bloque inválido");
 return JSON.stringify([UKI_CLOUD_CRYPTO_FORMAT,branch,generacion,bloque.tipo,bloque.grupo,bloque.numero]);
}
export async function cifrarBloque({clave,branch,generacion,bloque}){
 if(typeof bloque?.contenido!=="string")throw new Error("No hay contenido");
 if(enc.encode(bloque.contenido).length>180000)throw new Error("Bloque demasiado grande");
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const aad=enc.encode(identidad(branch,generacion,bloque));
 const contenido=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad},clave,enc.encode(bloque.contenido));
 return {branch,generacion,tipo:bloque.tipo,grupo:bloque.grupo,numero:bloque.numero,
   formato:UKI_CLOUD_CRYPTO_FORMAT,iv:encode64(iv),cifrado:encode64(contenido)};
}
export async function descifrarBloque({clave,branch,generacion,registro}){
 if(registro?.branch!==branch||registro?.generacion!==generacion||
   registro?.formato!==UKI_CLOUD_CRYPTO_FORMAT)throw new Error("Bloque de otra sucursal o formato");
 const aad=enc.encode(identidad(branch,generacion,registro));
 const iv=decode64(registro.iv),data=decode64(registro.cifrado);
 if(iv.length!==12||data.length<16)throw new Error("Cifrado incompleto");
 const contenido=dec.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:aad},clave,data));
 return {tipo:registro.tipo,grupo:registro.grupo,numero:registro.numero,contenido};
}
