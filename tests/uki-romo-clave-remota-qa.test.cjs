'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');

const file=path.resolve(__dirname,'../firebase/uki-romo-clave-remota-qa.mjs');
const source=fs.readFileSync(file,'utf8');
const FORMAT='romo-uki-shared-pass-proof-v1',STORE='romo:serena';
const MAGIC='Romo-Sushi/Balmaceda-1612/clave-Uki/solo-verificacion';
const ITER=300000;
const b64=v=>Buffer.from(v).toString('base64');

const proof=async(password,ukiSource='uki:serena')=>{
 const salt=webcrypto.getRandomValues(new Uint8Array(16));
 const iv=webcrypto.getRandomValues(new Uint8Array(12));
 const raw=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const k=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},
  raw,{name:'AES-GCM',length:256},false,['encrypt']);
 const additionalData=new TextEncoder().encode(JSON.stringify([FORMAT,STORE,ukiSource]));
 const encrypted=await webcrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},k,
  new TextEncoder().encode(MAGIC+'|'+ukiSource));
 return {formato:FORMAT,storeId:STORE,ukiSource,iteraciones:ITER,
  salt:b64(salt),iv:b64(iv),cifrado:b64(encrypted)};
};

test('módulo de acceso remoto permanece desactivado y no contiene URL de servidor',()=>{
 assert.match(source,/const ROMO_PROOFS_ENDPOINT='';/);
 assert.match(source,/if\(!ROMO_PROOFS_ENDPOINT\|\|endpoint!==ROMO_PROOFS_ENDPOINT\)/);
 assert.match(source,/window\.ukiRomoClaveRemotaDisponibleQA=\(\)=>!!ROMO_PROOFS_ENDPOINT/);
 assert.doesNotMatch(source,/setItem\(|localStorage\.|sessionStorage\.|fetch\(.*password/);
});
test('mismas claves de Uki Serena o Arica funcionan desde el navegador, sin datos de Uki',async()=>{
 const mod=await import('../firebase/uki-romo-clave-remota-qa.mjs');
 const passSerena='LaMismaClaveDeUkiSerena2026';
 const passArica='LaMismaClaveDeUkiArica2026';
 const proofs=await Promise.all([
  proof(passSerena,'uki:serena'),proof(passArica,'uki:arica')
 ]);
 for(const password of [passSerena,passArica])
  assert.equal(await mod.validarPruebasCifradasRomoQA({password,proofs,cryptoProvider:webcrypto}),true);
 assert.equal(await mod.validarPruebasCifradasRomoQA({
  password:'UnaClaveDistinta2026',proofs,cryptoProvider:webcrypto}),false);
 assert.equal(JSON.stringify(proofs).includes(passSerena),false);
 assert.equal(JSON.stringify(proofs).includes(passArica),false);
});
test('la prueba de otro local o una clave duplicada se bloquea',async()=>{
 const mod=await import('../firebase/uki-romo-clave-remota-qa.mjs');
 const p=await proof('LaMismaClaveDeUkiSerena2026');
 await assert.rejects(()=>mod.validarPruebasCifradasRomoQA({
  password:'LaMismaClaveDeUkiSerena2026',proofs:[{...p,storeId:'uki:serena'}],cryptoProvider:webcrypto
 }),/no corresponde a Romo/);
 await assert.rejects(()=>mod.validarPruebasCifradasRomoQA({
  password:'LaMismaClaveDeUkiSerena2026',proofs:[p,p],cryptoProvider:webcrypto
 }),/duplicadas/);
});
test('no se envía token ni contraseña cuando la conexión sigue apagada',async()=>{
 const mod=await import('../firebase/uki-romo-clave-remota-qa.mjs');
 let tokenUsed=false,fetchUsed=false;
 await assert.rejects(()=>mod.leerYVerificarClaveRomoQA({
  password:'LaMismaClaveDeUkiSerena2026',
  getGoogleToken:async()=>{tokenUsed=true;return 'token'},
  fetchFn:async()=>{fetchUsed=true;throw Error('No debe conectarse')}
 }),/todavía no habilitado/);
 assert.equal(tokenUsed,false);
 assert.equal(fetchUsed,false);
});
test('la QA conserva el ingreso local de Uki y nunca habilita operaciones de Romo',()=>{
 const panel=fs.readFileSync(path.resolve(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
 assert.match(panel,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(panel,/uki-romo-clave-remota-qa.mjs/);
 assert.match(panel,/if\(typeof window!=="undefined"&&window\.ukiRomoClaveRemotaDisponibleQA\?\.\(\)\)/);
 assert.match(panel,/Vista informativa de Romo · sin sesión ni acceso a pedidos reales/);
 assert.match(panel,/La contraseña de Uki NO puede comprobarse desde este dominio de pruebas/);
});
