'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const original=fs.readFileSync(path.join(__dirname,'../api/romo-duenos-google-check.js'),'utf8');
const ENV={
 VERCEL_ENV:'production',
 ROMO_DUENOS_VINCULO_ENABLED:'true',
 ROMO_DUENOS_GOOGLE_EMAIL:'owner-test@example.com',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://diannaleandra-art.github.io'
};
const claims={
 sub:'Firebase_UID_OWNER_123',
 iss:'https://securetoken.google.com/uki-panel-f4909',
 aud:'uki-panel-f4909',
 email:'owner-test@example.com',
 email_verified:true,
 firebase:{sign_in_provider:'google.com'}
};
const goodToken='Bearer '+('a'.repeat(120));

function createHandler(customEnv=ENV,payload=claims,jwtThrows=false){
 const calls=[];
 const mockJose={
  createRemoteJWKSet:(url)=>{calls.push('jwks');return url},
  jwtVerify:async(_token,_jwks,options)=>{
   calls.push('verify');
   assert.deepEqual(options,{issuer:claims.iss,audience:claims.aud,algorithms:['RS256']});
   if(jwtThrows)throw Error('Firma inválida');
   return {payload};
  }
 };
 const code=original.replace("await import('jose')","await Promise.resolve(mockJose)");
 const module={exports:{}};
 new Function('module','process','mockJose',code)(module,{env:customEnv},mockJose);
 return {handler:module.exports,calls};
}
const respond=()=>({
 statusCode:null,body:null,headers:{},ended:false,
 setHeader(k,v){this.headers[k]=v;return this},
 status(code){this.statusCode=code;return this},
 json(body){this.body=body;return this},
 end(){this.ended=true;return this}
});
async function invoke(ctx,method='GET',origin=ENV.ROMO_PANEL_ALLOWED_ORIGIN,auth=goodToken){
 const res=respond();
 await ctx.handler({method,headers:{origin,authorization:auth}},res);
 return res;
}
test('verificación de dueños desactivada sin configuración en producción',async()=>{
 const ctx=createHandler({});
 const res=await invoke(ctx);
 assert.equal(res.statusCode,503);
 assert.deepEqual(ctx.calls,[]);
});
test('verificación nunca funciona en preview, aun con flags y correo',async()=>{
 const ctx=createHandler({...ENV,VERCEL_ENV:'preview'});
 const res=await invoke(ctx);
 assert.equal(res.statusCode,503);
});
test('rechaza orígenes diferentes antes de comprobar tokens',async()=>{
 const ctx=createHandler();
 const res=await invoke(ctx,'GET','https://sitio-ajeno.example');
 assert.equal(res.statusCode,503);
 assert.deepEqual(ctx.calls,[]);
 assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);
});
test('POST y otras mutaciones se rechazan sin consultar Google',async()=>{
 const ctx=createHandler();
 const res=await invoke(ctx,'POST');
 assert.equal(res.statusCode,405);
 assert.deepEqual(ctx.calls,[]);
});
test('OPTIONS permite el origen aprobado sin consultar Google',async()=>{
 const ctx=createHandler();
 const res=await invoke(ctx,'OPTIONS');
 assert.equal(res.statusCode,204);
 assert.equal(res.ended,true);
 assert.equal(res.headers['Access-Control-Allow-Origin'],ENV.ROMO_PANEL_ALLOWED_ORIGIN);
 assert.equal(res.headers['Access-Control-Allow-Headers'],'Authorization');
});
test('token ausente o token falso nunca concede acceso',async()=>{
 const ctx=createHandler();
 assert.equal((await invoke(ctx,'GET',ENV.ROMO_PANEL_ALLOWED_ORIGIN,'')).statusCode,403);
 assert.equal((await invoke(ctx,'GET',ENV.ROMO_PANEL_ALLOWED_ORIGIN,'Bearer UKIDEV1.'+'b'.repeat(75))).statusCode,403);
 assert.deepEqual(ctx.calls,[]);
});
test('JWT Google correcto confirma identidad, pero no autoriza Romo',async()=>{
 const ctx=createHandler();
 const res=await invoke(ctx);
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body,{
  ok:true,storeId:'romo:serena',googleVerified:true,
  authorizationGranted:false,requiresRomoRoleEnrollment:true
 });
 assert.deepEqual(ctx.calls,['jwks','verify']);
 assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal(JSON.stringify(res.body).includes('owner-test@example.com'),false);
 assert.equal(JSON.stringify(res.body).includes(claims.sub),false);
});
test('email, proveedor, validación y UID incorrectos se rechazan',async()=>{
 const bad=[
  {...claims,email:'otro@example.com'},
  {...claims,email_verified:false},
  {...claims,firebase:{sign_in_provider:'password'}},
  {...claims,sub:'not a valid UID'}
 ];
 for(const item of bad){
  const ctx=createHandler(ENV,item);
  assert.equal((await invoke(ctx)).statusCode,403);
 }
});
test('firma inválida se rechaza sin errores internos visibles',async()=>{
 const ctx=createHandler(ENV,claims,true);
 const res=await invoke(ctx);
 assert.equal(res.statusCode,403);
 assert.equal(JSON.stringify(res.body).includes('Firma'),false);
});
test('no usa Neon ni autoriza usuarios y no contiene correo real en GitHub',()=>{
 assert.doesNotMatch(original,/neon\(|romos_app_service|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/);
 assert.doesNotMatch(original,/ukiadministracion@gmail\.com/);
 assert.match(original,/authorizationGranted:false/);
 assert.match(original,/ROMO_DUENOS_VINCULO_ENABLED/);
});
