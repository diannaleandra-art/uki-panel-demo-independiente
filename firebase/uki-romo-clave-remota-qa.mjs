/**
 * Comprueba EN EL NAVEGADOR la misma clave existente de Uki para entrar a Romo.
 *
 * La API Romo (cuando sea autorizada) requiere sesión Google válida y permiso
 * activo en la base separada de Romo. Solo devuelve verificadores cifrados.
 * La contraseña nunca se envía en HTTP, nunca se guarda ni se registra.
 *
 * Por seguridad, la URL sigue VACÍA: no habilitar ni usar clave real en QA.
 * Este módulo no lee datos ni modifica almacenamiento de Uki.
 */
const STORE='romo:serena';
const FORMAT='romo-uki-shared-pass-proof-v1';
const ITER=300000;
const MAGIC='Romo-Sushi/Balmaceda-1612/clave-Uki/solo-verificacion';
const SOURCES=new Set(['uki:arica','uki:serena']);
const enc=new TextEncoder(),dec=new TextDecoder();

// Configuración pendiente de revisión de la dueña, despliegue, permisos y
// aprobación. No se acepta URL dinámica del usuario ni del querystring.
const ROMO_PROOFS_ENDPOINT='';

function decoded(value,max){
 if(typeof value!=='string'||value.length<4||value.length>max||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
   throw new Error('Verificador Romo incorrecto');
 const raw=atob(value);return Uint8Array.from(raw,x=>x.charCodeAt(0));
}
function decodeProof(proof){
 if(!proof||typeof proof!=='object'||Array.isArray(proof)||
    proof.formato!==FORMAT||proof.storeId!==STORE||
    !SOURCES.has(proof.ukiSource)||proof.iteraciones!==ITER)
   throw new Error('El verificador no corresponde a Romo La Serena');
 const salt=decoded(proof.salt,32),iv=decoded(proof.iv,24),bytes=decoded(proof.cifrado,450);
 if(salt.length!==16||iv.length!==12||bytes.length<16||bytes.length>250)
   throw new Error('Verificador cifrado Romo dañado');
 return {salt,iv,bytes,slot:proof.ukiSource};
}
export async function validarPruebasCifradasRomoQA({password,proofs,cryptoProvider=globalThis.crypto}){
 if(typeof password!=='string'||password.length<12||password.length>256)
   throw new Error('Utiliza tu contraseña habitual de Uki');
 if(!cryptoProvider?.subtle||!Array.isArray(proofs)||proofs.length<1||proofs.length>2)
   throw new Error('La comprobación remota de Romo no está configurada');
 const seen=new Set(),rows=proofs.map(decodeProof);
 for(const row of rows){
   if(seen.has(row.slot))throw new Error('Fuentes de clave duplicadas');
   seen.add(row.slot);
 }
 const raw=await cryptoProvider.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 for(const row of rows){
  const key=await cryptoProvider.subtle.deriveKey(
    {name:'PBKDF2',salt:row.salt,iterations:ITER,hash:'SHA-256'},
    raw,{name:'AES-GCM',length:256},false,['decrypt']
  );
  const aad=enc.encode(JSON.stringify([FORMAT,STORE,row.slot]));
  try{
    const opened=await cryptoProvider.subtle.decrypt(
      {name:'AES-GCM',iv:row.iv,additionalData:aad},key,row.bytes);
    if(dec.decode(opened)===MAGIC+'|'+row.slot)return true;
  }catch{/* la clave no corresponde a esta sucursal */}
 }
 return false;
}

/**
 * Nunca se instala en producción ni toca los pedidos Uki.
 * El token se obtiene de la misma instancia Firebase Google del panel,
 * no de un formulario alternativo. La API valida el token otra vez.
 */
export async function leerYVerificarClaveRomoQA({
 password,
 endpoint=ROMO_PROOFS_ENDPOINT,
 getGoogleToken=()=>window.ukiInventarioToken?.(),
 fetchFn=fetch,
 cryptoProvider=globalThis.crypto
}={}){
 if(!ROMO_PROOFS_ENDPOINT||endpoint!==ROMO_PROOFS_ENDPOINT)
   throw new Error('Acceso remoto de Romo todavía no habilitado');
 const token=await getGoogleToken();
 if(typeof token!=='string'||token.length<30)
   throw new Error('Inicia sesión con la misma cuenta Google del panel');
 const reply=await fetchFn(endpoint,{
  method:'GET',headers:{Authorization:'Bearer '+token},
  cache:'no-store',credentials:'omit'
 });
 if(!reply.ok)throw new Error('Tu cuenta todavía no tiene acceso a Romo');
 const data=await reply.json();
 if(!data?.ok||data.storeId!==STORE||data.configured!==true)
   throw new Error('La comprobación de Romo aún no está lista');
 const matches=await validarPruebasCifradasRomoQA({password,proofs:data.proofs,cryptoProvider});
 if(!matches)throw new Error('La contraseña de Uki no coincide');
 return true;
}

// El formulario QA del panel puede comprobar si existe una conexión aprobada.
if(typeof window!=='undefined'){
 window.ukiRomoClaveRemotaDisponibleQA=()=>!!ROMO_PROOFS_ENDPOINT;
 window.ukiRomoVerificarClaveRemotaQA=pass=>leerYVerificarClaveRomoQA({password:pass});
}


/*
 * Habilitación inicial EN EL MISMO PANEL (en iPhone).
 * El backend de alta se habilitaría por la dueña en una fase separada.
 * La clave habitual se comprueba primero localmente contra la sucursal
 * Uki exacta. Sólo se envía el VERIFICADOR CIFRADO, nunca la contraseña.
 */
const ROMO_CLAVE_ALTA_ENDPOINT_QA='';
export async function crearPruebaClaveHabitualRomoQA({
 password,ukiSource,verificarClaveLocal,cryptoProvider=globalThis.crypto
}={}){
 if(!SOURCES.has(ukiSource)||typeof verificarClaveLocal!=='function'||
    typeof password!=='string'||password.length<12||password.length>256)
  throw Error('Indica una sucursal y su clave actual de Uki');
 if(await verificarClaveLocal(password,ukiSource)!==true)
  throw Error('La clave no coincide con la sucursal Uki elegida en este dispositivo');
 if(!cryptoProvider?.subtle||!cryptoProvider?.getRandomValues)
  throw Error('Este navegador no dispone de cifrado seguro');
 const salt=cryptoProvider.getRandomValues(new Uint8Array(16));
 const iv=cryptoProvider.getRandomValues(new Uint8Array(12));
 const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
 const raw=await cryptoProvider.subtle.importKey(
  'raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await cryptoProvider.subtle.deriveKey(
  {name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},
  raw,{name:'AES-GCM',length:256},false,['encrypt']);
 const ciphertext=await cryptoProvider.subtle.encrypt(
  {name:'AES-GCM',iv,additionalData:enc.encode(JSON.stringify([FORMAT,STORE,ukiSource]))},
  key,enc.encode(MAGIC+'|'+ukiSource));
 const proof=Object.freeze({formato:FORMAT,storeId:STORE,ukiSource,
  iteraciones:ITER,salt:b64(salt),iv:b64(iv),cifrado:b64(ciphertext)});
 decodeProof(proof);
 return proof;
}
export async function registrarClaveHabitualRomoQA({
 password,ukiSource,verificarClaveLocal,
 endpoint=ROMO_CLAVE_ALTA_ENDPOINT_QA,
 getGoogleToken=()=>window.ukiInventarioToken?.(),
 fetchFn=fetch
}={}){
 if(!ROMO_CLAVE_ALTA_ENDPOINT_QA||endpoint!==ROMO_CLAVE_ALTA_ENDPOINT_QA)
  throw Error('El alta de Romo aún no está autorizada');
 const token=await getGoogleToken();
 if(typeof token!=='string'||token.length<30)
  throw Error('Inicia sesión con la cuenta Google de dueños');
 const proof=await crearPruebaClaveHabitualRomoQA({
  password,ukiSource,verificarClaveLocal});
 const response=await fetchFn(endpoint,{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({ukiSource,proof}),
  cache:'no-store',credentials:'omit'
 });
 if(response.status===409)throw Error('Esta sucursal ya tiene una clave registrada');
 if(!response.ok)throw Error('No se pudo confirmar el alta de Romo');
 const result=await response.json();
 if(result?.ok!==true||result.storeId!==STORE||
    result.ukiSource!==ukiSource||result.created!==true)
  throw Error('El registro de Romo no fue confirmado');
 return Object.freeze({ok:true,storeId:STORE,ukiSource});
}
if(typeof window!=='undefined'){
 window.ukiRomoClaveAltaDisponibleQA=()=>!!ROMO_CLAVE_ALTA_ENDPOINT_QA;
 window.ukiRomoRegistrarClaveQA=args=>registrarClaveHabitualRomoQA(args);
}
