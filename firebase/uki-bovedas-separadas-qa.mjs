/*
 * Uki Sushi — prototipo QA de cifrado SEPARADO por rol y sucursal.
 * NO conecta a Firebase/Neon ni migra snapshots actuales.
 * En operación real TAMBIÉN se necesitan reglas del servidor:
 * ningún trabajador podrá descargar el paquete administrativo.
 */
import {separarEstadoPorAcceso,revisarPaqueteOperativo,
 recomponerEstadoAdministracion} from './uki-separacion-cierres-v1.mjs';
const FORMATO='uki-vaults-qa-v1';
const ITERACIONES=260000;
const SUCURSALES=new Set(['Uki Regimiento Arica','Uki La Serena']);
const ROLES=new Set(['operacion','administracion']);
const LIMITE_B64=20_000_000;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const fail=()=>{throw Error('No se pudo abrir el paquete autorizado.');};
const cryptoAPI=api=>{
 const c=api||globalThis.crypto;
 if(!c?.subtle||typeof c.getRandomValues!=='function')throw Error('Cifrado no disponible.');
 return c;
};
const b64=bytes=>{
 let value='';
 for(let i=0;i<bytes.length;i+=8192)
  value+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
};
const bytes=value=>{
 if(typeof value!=='string'||value.length>LIMITE_B64||!/^[-_A-Za-z0-9]+$/.test(value))fail();
 const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/') );
 return Uint8Array.from(raw,character=>character.charCodeAt(0));
};
const validarDominio=(branch,role)=>{
 if(!SUCURSALES.has(branch)||!ROLES.has(role))fail();
};
const validarClave=password=>{
 if(typeof password!=='string'||password.length<14||password.length>512)throw Error('Se necesita una clave de al menos 14 caracteres.');
};
const aad=(branch,role)=>enc.encode(FORMATO+'|'+branch+'|'+role);
async function derivar(password,salt,crypto){
 const raw=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERACIONES,hash:'SHA-256'},
  raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function cifrarBovedaQA({branch,role,datos,clave,cryptoImpl}){
 validarDominio(branch,role);validarClave(clave);
 if(!datos||Array.isArray(datos)||typeof datos!=='object'||datos.suc!==branch)fail();
 if(role==='operacion')revisarPaqueteOperativo(datos);
 const crypto=cryptoAPI(cryptoImpl),salt=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derivar(clave,salt,crypto);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(branch,role)},
  key,enc.encode(JSON.stringify(datos)));
 return {formato:FORMATO,branch,role,iteraciones:ITERACIONES,salt:b64(salt),
  iv:b64(iv),cifrado:b64(new Uint8Array(ciphertext))};
}
export async function descifrarBovedaQA({paquete,branch,role,clave,cryptoImpl}){
 validarDominio(branch,role);validarClave(clave);
 if(!paquete||paquete.formato!==FORMATO||paquete.role!==role||
    paquete.branch!==branch||paquete.iteraciones!==ITERACIONES)fail();
 const crypto=cryptoAPI(cryptoImpl);
 try{
  const salt=bytes(paquete.salt),iv=bytes(paquete.iv),ciphertext=bytes(paquete.cifrado);
  if(salt.length!==16||iv.length!==12||ciphertext.length<17)fail();
  const key=await derivar(clave,salt,crypto);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(branch,role)},key,ciphertext);
  const data=JSON.parse(dec.decode(plain));
  if(!data||Array.isArray(data)||data.suc!==branch)fail();
  if(role==='operacion')revisarPaqueteOperativo(data);
  return data;
 }catch{fail();}
}
export async function prepararBovedasQA(estado,{claveOperativa,claveAdministracion,cryptoImpl}){
 validarClave(claveOperativa);validarClave(claveAdministracion);
 if(claveOperativa===claveAdministracion)throw Error('Las claves de operación y administración deben ser distintas.');
 const {operacion,administracion}=separarEstadoPorAcceso(estado);
 const crypto=cryptoAPI(cryptoImpl);
 const operativa=await cifrarBovedaQA({branch:estado.suc,role:'operacion',datos:operacion,
  clave:claveOperativa,cryptoImpl:crypto});
 const financiera=await cifrarBovedaQA({branch:estado.suc,role:'administracion',datos:administracion,
  clave:claveAdministracion,cryptoImpl:crypto});
 return {operativa,financiera};
}
export async function recuperarEstadoParaAdministracionQA({operativa,financiera,branch,
 claveOperativa,claveAdministracion,cryptoImpl}){
 // El acceso administrativo debe superar AMBAS autorizaciones cifradas.
 const operacion=await descifrarBovedaQA({paquete:operativa,branch,role:'operacion',
  clave:claveOperativa,cryptoImpl});
 const administracion=await descifrarBovedaQA({paquete:financiera,branch,role:'administracion',
  clave:claveAdministracion,cryptoImpl});
 return recomponerEstadoAdministracion({operacion,administracion});
}
