import test from 'node:test';
import assert from 'node:assert/strict';
import {FIREBASE_PROJECT,ownerGoogleEmailMatchesVerifiedToken,resolveRomoIdentity}
 from '../lib/romo-identidad-servidor-qa.mjs';

const TEST_EMAIL='administracion-ejemplo@example.com'; // NUNCA usar cuenta real en código
const env={ROMO_DUENOS_GOOGLE_EMAIL:TEST_EMAIL};
const claims=Object.freeze({
 sub:'firebaseUidValido_123',
 email:TEST_EMAIL,
 email_verified:true,
 iss:'https://securetoken.google.com/'+FIREBASE_PROJECT,
 aud:FIREBASE_PROJECT,
 firebase:{sign_in_provider:'google.com'}
});
const token='Bearer '+('a'.repeat(120));
const makeDB=(rol='duenos',active=true)=>({
 calls:[],
 async query(sql,params){
  this.calls.push({sql,params});
  if(!sql.includes('activo=true'))throw new Error('El servidor no comprueba la autorización');
  return active?[{rol}]:[];
 }
});
const login=(db,verified=claims,options={})=>resolveRomoIdentity({
 authorization:token, db, env, verifyToken:async()=>verified,...options
});

test('correo de dueños se compara solo contra Google firmado y verificado',()=>{
 assert.equal(ownerGoogleEmailMatchesVerifiedToken(claims,env),true);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken({...claims,email:TEST_EMAIL.toUpperCase()},env),true);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken(claims,{}),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken(claims,{ROMO_DUENOS_GOOGLE_EMAIL:''}),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken(claims,{ROMO_DUENOS_GOOGLE_EMAIL:'a@example.com,b@example.com'}),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken({...claims,email:'otro@example.com'},env),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken({...claims,email_verified:false},env),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken({...claims,firebase:{sign_in_provider:'password'}},env),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken({...claims,iss:'https://securetoken.google.com/otro'},env),false);
 assert.equal(ownerGoogleEmailMatchesVerifiedToken({...claims,aud:'otro'},env),false);
});

test('correo correcto por sí solo NO concede acceso si UID no está activo en Neon',async()=>{
 const db=makeDB('duenos',false);
 assert.equal(await login(db),null);
 assert.equal(db.calls.length,1);
 assert.deepEqual(db.calls[0].params,['firebaseUidValido_123','romo:serena']);
});

test('correo Google correcto Y rol dueños activo permiten identificar dueño de Romo',async()=>{
 const db=makeDB('duenos',true);
 const result=await login(db);
 assert.deepEqual({...result,branches:[...result.branches]},{
  userId:'firebaseUidValido_123',brand:'romo',role:'duenos',branches:['serena']
 });
});

test('mismo UID pero otro correo Google NO obtiene permisos de dueños',async()=>{
 for(const bad of [
   {...claims,email:'otra-cuenta@example.com'},
   {...claims,email_verified:false},
   {...claims,firebase:{sign_in_provider:'password'}}
 ]){
  const db=makeDB();
  assert.equal(await login(db,bad),null);
 }
});

test('sin secreto de correo aprobado no habilitar dueños aunque haya fila activa',async()=>{
 const db=makeDB('duenos');
 const result=await login(db,claims,{env:{}});
 assert.equal(result,null);
});

test('agendador e inventario siguen dependiendo de su rol, sin convertirse en dueños',async()=>{
 for(const role of ['agendador','inventario']){
  const db=makeDB(role);
  const result=await login(db);
  assert.equal(result?.role,role);
  assert.notEqual(result.role,'duenos');
 }
});

test('nunca acepta roles o correos directamente desde el navegador',async()=>{
 const db=makeDB('agendador');
 const result=await login(db,{...claims,role:'duenos',metadata:{role:'duenos'}});
 assert.equal(result?.role,'agendador');
 assert.equal(db.calls.length,1);
});
