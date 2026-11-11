import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/romo-claves-lectura-qa.js';

const response=()=>({
 code:0,body:null,headers:{},ended:false,
 setHeader(k,v){this.headers[k]=v;return this;},
 status(code){this.code=code;return this;},
 json(body){this.body=body;return this;},
 end(){this.ended=true;return this;}
});
const request=(method='GET',origin='https://panel.example')=>({
 method,headers:{origin,authorization:'Bearer fake'},query:{}
});
const useEnv=async(next,fn)=>{
 const keys=['VERCEL_ENV','ROMO_ACCESO_CLAVES_LIVE_ENABLED','ROMO_PANEL_ALLOWED_ORIGIN'];
 const original=Object.fromEntries(keys.map(x=>[x,process.env[x]]));
 try{
  for(const k of keys){if(next[k]===undefined)delete process.env[k];else process.env[k]=next[k]}
  await fn();
 }finally{
  for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]}
 }
};

test('endpoint de claves permanece cerrado de forma predeterminada',async()=>{
 await useEnv({},async()=>{
  const res=response();
  await handler(request(),res);
  assert.equal(res.code,503);
  assert.equal(res.body.ok,false);
  assert.match(res.body.error,/todavía no habilitado/);
  assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
  assert.equal(res.headers.Vary,'Origin');
 });
});
test('preview no puede habilitar servicio aunque se active flag',async()=>{
 await useEnv({
  VERCEL_ENV:'preview',ROMO_ACCESO_CLAVES_LIVE_ENABLED:'true',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'
 },async()=>{
  const res=response();
  await handler(request(),res);
  assert.equal(res.code,503);
 });
});
test('bloquea un origen no admitido antes de leer Neon o verificar tokens',async()=>{
 await useEnv({
  VERCEL_ENV:'production',ROMO_ACCESO_CLAVES_LIVE_ENABLED:'true',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'
 },async()=>{
  const res=response();
  await handler(request('GET','https://otro-sitio.example'),res);
  assert.equal(res.code,503);
  assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);
 });
});
test('un preflight permitido responde sin leer la base de datos',async()=>{
 await useEnv({
  VERCEL_ENV:'production',ROMO_ACCESO_CLAVES_LIVE_ENABLED:'true',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'
 },async()=>{
  const res=response();
  await handler(request('OPTIONS'),res);
  assert.equal(res.code,204);
  assert.equal(res.ended,true);
  assert.equal(res.headers['Access-Control-Allow-Origin'],'https://panel.example');
  assert.equal(res.headers['Access-Control-Allow-Methods'],'GET,OPTIONS');
 });
});
test('POST de contraseñas, creación o modificación nunca se admite',async()=>{
 await useEnv({
  VERCEL_ENV:'production',ROMO_ACCESO_CLAVES_LIVE_ENABLED:'true',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'
 },async()=>{
  const res=response();
  await handler(request('POST'),res);
  assert.equal(res.code,405);
  assert.equal(res.body.ok,false);
 });
});
test('GET con bandera pero sin base de Romo configurada sigue cerrado',async()=>{
 await useEnv({
  VERCEL_ENV:'production',ROMO_ACCESO_CLAVES_LIVE_ENABLED:'true',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'
 },async()=>{
  const oldURL=process.env.ROMO_PRIVATE_DATABASE_URL;
  const oldHost=process.env.ROMO_PRIVATE_DATABASE_HOST;
  try{
   delete process.env.ROMO_PRIVATE_DATABASE_URL;
   delete process.env.ROMO_PRIVATE_DATABASE_HOST;
   const res=response();
   await handler(request(),res);
   assert.equal(res.code,503);
   assert.equal(res.body.ok,false);
  }finally{
   if(oldURL===undefined)delete process.env.ROMO_PRIVATE_DATABASE_URL;
   else process.env.ROMO_PRIVATE_DATABASE_URL=oldURL;
   if(oldHost===undefined)delete process.env.ROMO_PRIVATE_DATABASE_HOST;
   else process.env.ROMO_PRIVATE_DATABASE_HOST=oldHost;
  }
 });
});
