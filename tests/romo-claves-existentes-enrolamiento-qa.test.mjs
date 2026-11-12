import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
 createRomoPassProofAfterUkiUnlockQA,verifyAnyRomoPassProof
} from '../lib/romo-clave-compartida-qa.mjs';
import {validarPruebasCifradasRomoQA}
 from '../firebase/uki-romo-clave-remota-qa.mjs';

const ukis=Object.freeze({
 'uki:serena':Object.freeze({name:'Uki La Serena',password:'ClaveEjemploUkiSerena2026'}),
 'uki:arica':Object.freeze({name:'Uki Regimiento Arica',password:'ClaveEjemploRegimiento2026'})
});
let unlockCount=0;
const unlockExistingUki=async({source,expectedName,password})=>{
 unlockCount++;
 // Simula EXCLUSIVAMENTE abrirLocal() del panel original con su copia cifrada.
 const uki=ukis[source];
 if(!uki||uki.name!==expectedName||uki.password!==password)
  throw Error('GCM authentication failed');
 return {verified:true,sucursal:expectedName};
};
const create=(ukiSource,password,fn=unlockExistingUki)=>
 createRomoPassProofAfterUkiUnlockQA({
  password,ukiSource,unlockExistingUki:fn,cryptoProvider:webcrypto
 });

test('el enrolamiento utiliza la misma clave comprobada por Uki, sin pedir otra',async()=>{
 unlockCount=0;
 const proof=await create('uki:serena',ukis['uki:serena'].password);
 assert.equal(unlockCount,1);
 assert.equal(proof.storeId,'romo:serena');
 assert.equal(proof.ukiSource,'uki:serena');
 assert.equal(await verifyAnyRomoPassProof({
  password:ukis['uki:serena'].password,proofs:[proof],cryptoProvider:webcrypto
 }),true);
 assert.equal(JSON.stringify(proof).includes(ukis['uki:serena'].password),false);
 assert.equal(Object.keys(proof).includes('key'),false);
});

test('simulación de dos teléfonos: cualquier clave existente de los dos Uki, sin datos del otro local',async()=>{
 const proofs=[
  await create('uki:serena',ukis['uki:serena'].password),
  await create('uki:arica',ukis['uki:arica'].password)
 ];
 // Segundo dispositivo no tiene localStorage Uki ni descifra sus ventas.
 for(const password of [ukis['uki:serena'].password,ukis['uki:arica'].password]){
  assert.equal(await validarPruebasCifradasRomoQA({password,proofs,cryptoProvider:webcrypto}),true);
 }
 assert.equal(await validarPruebasCifradasRomoQA({
  password:'CualquierOtraClave999',proofs,cryptoProvider:webcrypto
 }),false);
 assert.equal(JSON.stringify(proofs).includes('cliente'),false);
 assert.equal(JSON.stringify(proofs).includes('pedido'),false);
});

test('rechaza contraseña distinta ANTES de generar una nueva prueba cifrada',async()=>{
 unlockCount=0;
 await assert.rejects(create('uki:serena','ClaveDesconocida12345'),/no desbloquea/);
 assert.equal(unlockCount,1);
});

test('un booleano true no sustituye verificar que se abrió Uki La Serena o Arica',async()=>{
 const accepts=async()=>true;
 await assert.rejects(create('uki:serena','ClaveFicticia123456',accepts),/no corresponde/);
 const swapped=async()=>({verified:true,sucursal:'Uki Regimiento Arica'});
 await assert.rejects(create('uki:serena','ClaveFicticia123456',swapped),/no corresponde/);
 const noUnlock=async()=>({verified:false,sucursal:'Uki La Serena'});
 await assert.rejects(create('uki:serena','ClaveFicticia123456',noUnlock),/no corresponde/);
});

test('no crea una tercera contraseña ni admite Romo Arica ni otra sucursal',async()=>{
 await assert.rejects(create('romo:serena','ClaveFicticia123456'),/Origen de clave Uki/);
 await assert.rejects(create('uki:otra','ClaveFicticia123456'),/Origen de clave Uki/);
 await assert.rejects(create('uki:serena',ukis['uki:serena'].password,null),/Primero comprueba/);
});
