import test from 'node:test';
import assert from 'node:assert/strict';
import {FIREBASE_PROJECT} from '../lib/romo-identidad-servidor-qa.mjs';
import {ownerLinkInspectionEnabled,inspectRomoOwnerGoogle,inspectRomoOwnerRoleQA}
 from '../lib/romo-duenos-vinculo-qa.mjs';
import handler from '../api/romo-duenos-vinculo-qa.js';

const fakeEmail='owner-qa@example.com'; // jamás poner correo real en test
const base={
 VERCEL_ENV:'production',
 ROMO_DUENOS_VINCULO_ENABLED:'true',
 ROMO_DUENOS_GOOGLE_EMAIL:fakeEmail,
 ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'
};
const signedClaims={
 sub:'UID_AutenticadoDeGoogle_123',
 iss:'https://securetoken.google.com/'+FIREBASE_PROJECT,
 aud:FIREBASE_PROJECT,
 email:fakeEmail,email_verified:true,
 firebase:{sign_in_provider:'google.com'}
};
const authorization='Bearer '+('a'.repeat(64));
const result=(opts={})=>inspectRomoOwnerGoogle({
 authorization,env:base,verifyToken:async()=>signedClaims,...opts
});
function fakeResponse(){
 return{
  statusCode:0,body:null,headers:{},ended:false,
  setHeader(k,v){this.headers[k]=v;return this},
  status(v){this.statusCode=v;return this},
  json(body){this.body=body;return this},
  end(){this.ended=true;return this}
 };
}
async function withEnvironment(next,run){
 const keys=['VERCEL_ENV','ROMO_DUENOS_VINCULO_ENABLED','ROMO_PANEL_ALLOWED_ORIGIN',
   'ROMO_DUENOS_GOOGLE_EMAIL'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const k of keys){
   if(Object.hasOwn(next,k))process.env[k]=next[k];
   else delete process.env[k];
  }
  await run();
 }finally{
  for(const k of keys){
   if(saved[k]===undefined)delete process.env[k];
   else process.env[k]=saved[k];
  }
 }
}
test('por defecto la inspección de identidad está completamente apagada',async()=>{
 assert.equal(ownerLinkInspectionEnabled({}),false);
 assert.equal((await inspectRomoOwnerGoogle({authorization,env:{}})).ok,false);
 assert.equal(ownerLinkInspectionEnabled({...base,VERCEL_ENV:'preview'}),false);
 assert.equal(ownerLinkInspectionEnabled({...base,ROMO_DUENOS_VINCULO_ENABLED:'false'}),false);
});
test('Google correcto identifica UID sin otorgar permisos ni escribir Neon',async()=>{
 const r=await result();
 assert.equal(r.ok,true);
 assert.equal(r.verifiedUid,signedClaims.sub);
 assert.equal(r.storeId,'romo:serena');
 assert.equal(r.authorizationGranted,false);
 assert.equal(r.requiresRomoRoleEnrollment,true);
});
test('un correo no verificado o diferente no recibe vinculación',async()=>{
 for(const claims of [
  {...signedClaims,email:'different@example.com'},
  {...signedClaims,email_verified:false},
  {...signedClaims,firebase:{sign_in_provider:'password'}},
  {...signedClaims,iss:'https://securetoken.google.com/otro'},
  {...signedClaims,aud:'otro'},
  {...signedClaims,sub:'uid no valido'},
  {...signedClaims,sub:''}
 ]){
  const x=await result({verifyToken:async()=>claims});
  assert.equal(x.ok,false);
 }
});
test('tokens inválidos y firma fallida no autorizan vinculación',async()=>{
 const failed=await result({verifyToken:async()=>{throw Error('firma inválida')}});
 assert.equal(failed.ok,false);
 for(const bad of ['Basic '+('a'.repeat(40)),'Bearer UKIDEV1.'+('a'.repeat(70)),null]){
  assert.equal((await result({authorization:bad})).ok,false);
 }
});
test('sin habilitación de servidor API deniega cualquier acceso',async()=>{
 await withEnvironment({},async()=>{
  const res=fakeResponse();
  await handler({method:'GET',headers:{origin:'https://panel.example'}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.ok,false);
  assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 });
});
test('en preview siempre está apagada aunque un flag indique true',async()=>{
 await withEnvironment({...base,VERCEL_ENV:'preview'},async()=>{
  const res=fakeResponse();
  await handler({method:'GET',headers:{origin:'https://panel.example'}},res);
  assert.equal(res.statusCode,503);
 });
});
test('origen ajeno queda bloqueado incluso si el flag estuviera habilitado',async()=>{
 await withEnvironment(base,async()=>{
  const res=fakeResponse();
  await handler({method:'GET',headers:{origin:'https://attacker.example'}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);
 });
});
test('no se aceptan escrituras de identidades ni contraseñas',async()=>{
 await withEnvironment(base,async()=>{
  const res=fakeResponse();
  await handler({method:'POST',headers:{origin:'https://panel.example'}},res);
  assert.equal(res.statusCode,405);
 });
});
test('preflight de navegador permite Authorization sin consultar la base de datos',async()=>{
 await withEnvironment(base,async()=>{
  const res=fakeResponse();
  await handler({method:'OPTIONS',headers:{origin:'https://panel.example'}},res);
  assert.equal(res.statusCode,204);
  assert.equal(res.ended,true);
  assert.equal(res.headers['Access-Control-Allow-Origin'],'https://panel.example');
 });
});


test('reconoce si la MISMA cuenta Google ya tiene rol de dueños Romo sin inscribir otra cuenta',async()=>{
 const calls=[];
 const db={async query(sql,params){
  calls.push({sql,params});return [{rol:'duenos'}];
 }};
 const status=await inspectRomoOwnerRoleQA({verifiedUid:signedClaims.sub,db});
 assert.equal(status.storeId,'romo:serena');
 assert.equal(status.ownerRoleActive,true);
 assert.equal(status.requiresRomoRoleEnrollment,false);
 assert.equal(status.authorizationGranted,false);
 assert.equal(calls.length,1);
 assert.match(calls[0].sql,/^SELECT rol FROM public\.romo_personal_acceso_v1/);
 assert.match(calls[0].sql,/activo=true/);
 assert.deepEqual(calls[0].params,[signedClaims.sub,'romo:serena']);
 assert.doesNotMatch(JSON.stringify(status),/UID_|@|password|secret/);
});
test('si dueña no está inscrita, identifica exactamente el permiso pendiente y NO lo crea',async()=>{
 for(const rows of [[],[{rol:'inventario'}],[{rol:'agendador'}]]){
  const calls=[];
  const db={async query(sql,params){calls.push({sql,params});return rows}};
  const status=await inspectRomoOwnerRoleQA({verifiedUid:signedClaims.sub,db});
  assert.equal(status.ownerRoleActive,false);
  assert.equal(status.requiresRomoRoleEnrollment,true);
  assert.equal(status.authorizationGranted,false);
  assert.equal(calls.length,1);
  assert.ok(calls[0].sql.startsWith('SELECT '));
 }
});
test('no consulta Neon con UID vacío ni devuelve respuesta ante roles corruptos',async()=>{
 let calls=0;
 const db={async query(){calls++;return [{rol:'superadmin'}]}};
 for(const value of [null,'','otro uid!','x'.repeat(130)]){
  await assert.rejects(inspectRomoOwnerRoleQA({verifiedUid:value,db}),/obligatorias/);
 }
 assert.equal(calls,0);
 await assert.rejects(inspectRomoOwnerRoleQA({
  verifiedUid:signedClaims.sub,db
 }),/no es válida/);
 assert.equal(calls,1);
});
test('la ruta existente sigue siendo solo GET para el dueño y jamás inscribe permisos',async()=>{
 const src=await import('node:fs');
 const content=src.readFileSync(new URL('../api/romo-duenos-vinculo-qa.js',import.meta.url),'utf8');
 assert.match(content,/adaptarNeonParaClavesRomoQA/);
 assert.match(content,/verifiedUid:result\.verifiedUid/);
 assert.match(content,/ownerRoleActive:role\.ownerRoleActive/);
 assert.doesNotMatch(content,/INSERT INTO|UPDATE public\.romo_personal|GRANT|CREATE USER/);
});
