/**
 * Preparación de acceso multi-dispositivo con las MISMAS claves de Uki.
 * El usuario NO elige contraseña nueva: introduce una clave existente de
 * Uki Regimiento Arica o Uki La Serena, para crear una prueba cifrada Romo.
 *
 * No envía ni almacena la contraseña en claro; sólo devuelve un verificador
 * AES-GCM/PBKDF2 de un texto fijo sin datos de Uki. La prueba es EXCLUSIVAMENTE
 * un segundo requisito de entrada; NO sustituye autenticación Google,
 * autorización de rol ni aislamiento de datos en el backend.
 *
 * QA puro: no escribe Firestore, Neon, localStorage ni solicita permisos.
 */
export const ROMO_PASS_PROOF_FORMAT='romo-uki-shared-pass-proof-v1';
export const ROMO_STORE_ID='romo:serena';
export const ROMO_PASS_PBKDF2_ITER=300000;
export const ROMO_PASS_SLOTS=Object.freeze(['uki:serena','uki:arica']);
const enc=new TextEncoder(),dec=new TextDecoder();
const MAGIC='Romo-Sushi/Balmaceda-1612/clave-Uki/solo-verificacion';

function slotValid(slot){
  if(!ROMO_PASS_SLOTS.includes(slot))throw new Error('Origen de clave Uki no permitido');
  return slot;
}
function cryptoReady(provider){
  if(!provider||typeof provider.getRandomValues!=='function'||
      !provider.subtle||typeof provider.subtle.importKey!=='function'||
      typeof provider.subtle.deriveKey!=='function')
    throw new Error('Cifrado seguro del navegador no disponible');
  return provider;
}
function rawPassword(password){
  if(typeof password!=='string'||password.length<12||password.length>256)
    throw new Error('Introduce tu clave actual de Uki (mínimo 12 caracteres)');
  return password;
}
function encode64(buffer){
  const bytes=new Uint8Array(buffer);let raw='';
  for(let i=0;i<bytes.length;i+=8192)
    raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw);
}
function decode64(value,max){
  if(typeof value!=='string'||value.length<4||value.length>max||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new Error('Prueba cifrada de Romo inválida');
  const str=atob(value);
  return Uint8Array.from(str,x=>x.charCodeAt(0));
}
function aad(slot){
  return enc.encode(JSON.stringify([ROMO_PASS_PROOF_FORMAT,ROMO_STORE_ID,slot]));
}
async function key(password,salt,provider){
  const raw=await provider.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
  return provider.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:ROMO_PASS_PBKDF2_ITER,hash:'SHA-256'},
    raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
  );
}
export function validateRomoPassProof(proof){
  if(!proof||typeof proof!=='object'||Array.isArray(proof)||
     proof.formato!==ROMO_PASS_PROOF_FORMAT||
     proof.storeId!==ROMO_STORE_ID||!ROMO_PASS_SLOTS.includes(proof.ukiSource)||
     proof.iteraciones!==ROMO_PASS_PBKDF2_ITER)
    throw new Error('Prueba de acceso no corresponde a Romo');
  const salt=decode64(proof.salt,32),iv=decode64(proof.iv,24),ciphertext=decode64(proof.cifrado,450);
  if(salt.length!==16||iv.length!==12||ciphertext.length<16||ciphertext.length>250)
    throw new Error('Prueba cifrada de Romo dañada');
  return {salt,iv,ciphertext,slot:proof.ukiSource};
}

/**
 * Solo durante una habilitación inicial aprobada por la dueña.
 * Debe ejecutarse EN EL NAVEGADOR tras identidad Google/roles comprobados
 * por el servidor; el servidor sólo recibe la prueba cifrada.
 */
export async function createRomoPassProof({password,ukiSource,cryptoProvider=globalThis.crypto}){
  const provider=cryptoReady(cryptoProvider),slot=slotValid(ukiSource);
  rawPassword(password);
  const salt=provider.getRandomValues(new Uint8Array(16));
  const iv=provider.getRandomValues(new Uint8Array(12));
  const derived=await key(password,salt,provider);
  const plain=enc.encode(MAGIC+'|'+slot);
  const encrypted=await provider.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:aad(slot)},derived,plain);
  return Object.freeze({formato:ROMO_PASS_PROOF_FORMAT,storeId:ROMO_STORE_ID,
    ukiSource:slot,iteraciones:ROMO_PASS_PBKDF2_ITER,
    salt:encode64(salt),iv:encode64(iv),cifrado:encode64(encrypted)});
}

/**
 * Lectura solamente. Puede ejecutarse en cualquier teléfono compatible.
 * Una clave incorrecta devuelve false. No descifra ni devuelve datos Uki.
 */
export async function verifyRomoPassProof({password,proof,cryptoProvider=globalThis.crypto}){
  const provider=cryptoReady(cryptoProvider);
  rawPassword(password);
  const {salt,iv,ciphertext,slot}=validateRomoPassProof(proof);
  const derived=await key(password,salt,provider);
  try{
    const opened=await provider.subtle.decrypt(
      {name:'AES-GCM',iv,additionalData:aad(slot)},derived,ciphertext);
    return dec.decode(opened)===MAGIC+'|'+slot;
  }catch{return false}
}

/**
 * Verificación por cualquiera de las dos contraseñas de Uki previamente
 * enroladas, sin adivinar cuál usa cada local.
 */
export async function verifyAnyRomoPassProof({password,proofs,cryptoProvider=globalThis.crypto}){
  rawPassword(password);
  if(!Array.isArray(proofs)||proofs.length<1||proofs.length>2)
    throw new Error('Las claves compartidas de Romo no están configuradas');
  const sources=new Set();
  for(const proof of proofs){
    const item=validateRomoPassProof(proof);
    if(sources.has(item.slot))throw new Error('Clave de Uki duplicada');
    sources.add(item.slot);
  }
  for(const proof of proofs){
    if(await verifyRomoPassProof({password,proof,cryptoProvider}))return true;
  }
  return false;
}

/**
 * Preparación del verificador con la MISMA contraseña que ya desbloquea Uki.
 * El panel llamará a su función local existente abrirLocal() mediante
 * unlockExistingUki; no se crea ninguna clave ni se leen datos comerciales.
 * NO registra la prueba en Neon: requiere posterior aprobación de la dueña.
 */
export async function createRomoPassProofAfterUkiUnlockQA({
 password,ukiSource,unlockExistingUki,cryptoProvider=globalThis.crypto
}={}){
 const source=slotValid(ukiSource);
 rawPassword(password);
 if(typeof unlockExistingUki!=='function')
  throw new Error('Primero comprueba la clave con el acceso Uki existente');
 const expectedName=source==='uki:arica'?'Uki Regimiento Arica':'Uki La Serena';
 let opened;
 try{
  opened=await unlockExistingUki({source,expectedName,password});
 }catch{
  throw new Error('La contraseña no desbloquea la sucursal Uki indicada');
 }
 // Un "true" sin demostrar qué sucursal abrió no puede enrolar una clave.
 if(!opened||opened.sucursal!==expectedName||opened.verified!==true)
  throw new Error('La contraseña no corresponde a la sucursal Uki indicada');
 return createRomoPassProof({password,ukiSource:source,cryptoProvider});
}
