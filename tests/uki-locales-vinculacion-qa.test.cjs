'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {identificarLocalOperativoQA}=require('../lib/uki-locales-vinculacion-qa.cjs');
const r={negocio:"Romo's Sushi",sucursal:'La Serena',direccion:'Balmaceda 1612, La Serena',
 nuevoId:'123e4567-e89b-42d3-a456-426614174001'};
test('Romo existente se vincula una sola vez al storeId real',()=>{
 assert.equal(identificarLocalOperativoQA({...r,solicitud:'romo:serena'}),'romo:serena');
 assert.throws(()=>identificarLocalOperativoQA(r),/ya existe/);
});
test('no vincula Uki ni sucursal ajena o una ubicación nueva',()=>{
 for(const bad of [
  {...r,negocio:'Uki Sushi'},
  {...r,sucursal:'Regimiento Arica'},
  {...r,direccion:'Calle distinta 123'},
  {...r,solicitud:'uki:serena'}]){
  assert.throws(()=>identificarLocalOperativoQA(bad));
 }
});
test('nuevo local recibe ID propio sin heredar Romo',()=>{
 const x=identificarLocalOperativoQA({...r,negocio:'Crepe Pop',solicitud:''});
 assert.equal(x,'local:'+r.nuevoId);
});
test('servidor y formulario ofrecen vinculación explícita sin publicar',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/mi-administracion-duenos.html'),'utf8');
 assert.match(api,/identificarLocalOperativoQA/);
 assert.match(api,/vincularLocalExistente/);
 assert.match(html,/id="ownerLocExisting"/);
 assert.match(html,/vincular Romo/i);
 assert.match(api,/UKI_LOCALES_OPERATIVOS_QA_ENABLED/);
});
