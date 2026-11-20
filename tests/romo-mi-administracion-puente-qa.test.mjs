import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const endpoint=require('../api/mi-administracion-lectura-qa.js');
const {config,valid,READ,SESSION}=endpoint._internalQA;
const origin='https://uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app';
const env={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'preparacion/uki-romo-sobre-main-20261114',
 ROMO_PANEL_ALLOWED_ORIGIN:origin,ROMO_CIERRES_DUENOS_LECTURA_QA_ENABLED:'true'
};
const headers={
 host:new URL(origin).host,origin,'content-type':'application/json',
 authorization:'Bearer '+('A'.repeat(120)),'x-fin-session':'a'.repeat(64)
};
const req=(body,changes={})=>({
 method:'POST',headers:{...headers,...changes},body
});
function fakeRes(){
 let statusCode=200;
 const r={headers:{},code:0,body:null,setHeader(k,v){this.headers[k]=v;},
  status(n){statusCode=n;return this;},
  json(o){this.code=statusCode;this.body=o;return this;}};
 return r;
}
async function run(q,values=env,fn){
 const old={};
 for(const key of Object.keys(values)){old[key]=process.env[key];process.env[key]=values[key];}
 try{return await fn();}finally{
  for(const key of Object.keys(values)){
   if(old[key]===undefined)delete process.env[key];
   else process.env[key]=old[key];
  }
 }
}
test('Puente solo se habilita en preview financiero exacto con origen privado',()=>{
 assert.deepEqual(config(env),{origin,host:new URL(origin).host});
 assert.equal(config({...env,VERCEL_ENV:'production'}),null);
 assert.equal(config({...env,VERCEL_GIT_COMMIT_REF:'main'}),null);
 assert.equal(config({...env,ROMO_CIERRES_DUENOS_LECTURA_QA_ENABLED:'false'}),null);
 assert.equal(config({...env,ROMO_PANEL_ALLOWED_ORIGIN:'https://otra-carta.vercel.app'}),null);
 assert.equal(valid(req({action:'estado'}),config(env)),true);
 assert.equal(valid(req({action:'estado'},{host:'otro-proyecto.vercel.app'}),config(env)),false);
 assert.equal(valid(req({action:'estado'},{origin:'https://evil.test'}),config(env)),false);
});
test('Permite solo consultas y manejo de sesión PIN, nunca escribir ventas/cierres',()=>{
 for(const action of ['estado','negocios','resumen','listar_movimientos','listar_cierres'])
  assert.equal(READ.has(action),true);
 assert.equal(SESSION.has('ingresar_pin'),true);
 for(const action of ['guardar_movimiento','configurar_pin','anular_movimiento','guardar_documento','editar_movimiento','guardar_compra_factura','marcar_pagado','guardar_cierre'])
  assert.equal(READ.has(action)||SESSION.has(action),false);
});
test('Un intento de registrar dinero en Preview se detiene ANTES de llamar al servidor oficial',async()=>{
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No debe llamarse');};
 try{
  await run(null,env,async()=>{
   const response=fakeRes();
   await endpoint(req({action:'guardar_movimiento',monto:2500}),response);
   assert.equal(response.code,403);
   assert.match(response.body.error,/solo de consulta/);
   assert.equal(calls,0);
  });
 }finally{globalThis.fetch=original;}
});
test('La sesión Google y PIN se verifican exclusivamente en servicio financiero oficial',async()=>{
 const original=globalThis.fetch;
 const seen=[];
 globalThis.fetch=async(url,options)=>{
  seen.push({url,options});
  return {status:200,json:async()=>({ok:true,autorizado:true})};
 };
 try{
  await run(null,env,async()=>{
   const response=fakeRes();
   await endpoint(req({action:'estado'}),response);
   assert.equal(response.code,200);
   assert.equal(response.body.autorizado,true);
   assert.equal(seen.length,1);
   assert.equal(seen[0].url,'https://uki-sushi-inventario.vercel.app/api/mi-administracion-live');
   assert.equal(seen[0].options.headers.Origin,'https://uki-sushi-inventario.vercel.app');
   assert.equal(seen[0].options.headers.Authorization,headers.authorization);
   assert.equal(seen[0].options.headers['X-Fin-Session'],headers['x-fin-session']);
   assert.equal(JSON.parse(seen[0].options.body).action,'estado');
  });
 }finally{globalThis.fetch=original;}
});
test('Sin origen exacto o sin Google jamás se hace consulta privada',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('NO');};
 try{
  await run(null,env,async()=>{
   const a=fakeRes();await endpoint(req({action:'estado'},{origin:'https://otro.vercel.app'}),a);
   assert.equal(a.code,403);
   const b=fakeRes();await endpoint(req({action:'estado'},{authorization:''}),b);
   assert.equal(b.code,401);
   assert.equal(calls,0);
  });
 }finally{globalThis.fetch=original;}
});
test('El panel de prueba conecta consultas por ruta propia y conserva la ruta oficial para administrar',()=>{
 const html=readFileSync(new URL('../public/mi-administracion-duenos.html',import.meta.url),'utf8');
 assert.match(html,/fetch\('\/api\/mi-administracion-lectura-qa'/);
 assert.match(html,/const UKI_DUENOS_CIERRES_URL='\/api\/mi-administracion-lectura-qa'/);
 assert.match(html,/FINANZAS_CONSULTA_QA\.has\(action\)/);
 assert.match(html,/https:\/\/uki-sushi-inventario\.vercel\.app\/mi-administracion-duenos\.html/);
 assert.doesNotMatch(html,/fetch\('https:\/\/uki-sushi-inventario\.vercel\.app\/api\/mi-administracion-live'/);
});
