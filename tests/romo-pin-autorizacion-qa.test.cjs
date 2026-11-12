'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=require('../lib/romo-pin-autorizacion-qa.cjs');
const pin=require('../lib/romo-pin-inventario-qa.cjs');
const base=()=>({
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'qa/romo-catalogo-inventario-sin-publicar-20261111',
 ROMO_CATALOGO_QA_ENABLED:'true',
 ROMO_PIN_TRABAJADOR_QA_ENABLED:'true',
 ROMO_PIN_CONTROL_HMAC_KEY:'solo-para-pruebas-no-usar-en-vivo'.repeat(2)
});
const privateRow=pin.crearRegistro('614925');
function fakeDatabase(){
 let count=0,blocked=false,cleared=0;
 const calls=[];
 return {calls,
  get count(){return count},get cleared(){return cleared},
  query:async(sql,args)=>{
   assert.equal(args[0],'romo:serena');
   assert.doesNotMatch(sql,/uki_inventario|uki:serena|uki:arica/);
   calls.push({sql,args});
   if(sql.startsWith('INSERT INTO public.romo_pin_intentos_v1')){
    assert.match(args[1],/^[a-f0-9]{64}$/);
    if(blocked)return [];
    count+=1;
    if(count>=5)blocked=true;
    return [{fallos:count,bloqueado_hasta:blocked?'bloqueado':null}];
   }
   if(sql.startsWith('SELECT store_id,salt,hash FROM public.romo_pin_inventario_v1')){
    return [privateRow];
   }
   if(sql.startsWith('DELETE FROM public.romo_pin_intentos_v1')){
    cleared+=1;count=0;return [{store_id:'romo:serena'}];
   }
   throw Error('SQL ajeno a Romo no permitido');
  }
 };
}
test('desactivado por defecto, sin acceso a base ni a tienda Uki',async()=>{
 assert.equal(service.habilitado({}),false);
 assert.equal(service.habilitado({...base(),VERCEL_ENV:'production'}),false);
 assert.equal(service.habilitado({...base(),VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(service.habilitado({...base(),ROMO_PIN_TRABAJADOR_QA_ENABLED:'false'}),false);
 const db=fakeDatabase();
 await assert.rejects(service.verificarCodigoInventarioRomoQA({db,code:'614925',workerName:'Ana',env:{}}),/desactivado/);
 assert.equal(db.calls.length,0);
});
test('mismo ingreso inventario: nombre, seis dígitos y permiso solo inventario',async()=>{
 const db=fakeDatabase();
 const result=await service.verificarCodigoInventarioRomoQA({
  db,code:'614925',workerName:'  Ana  Pérez  ',env:base()
 });
 assert.equal(result.storeId,'romo:serena');
 assert.equal(result.workerName,'Ana Pérez');
 assert.equal(result.role,'inventario');
 assert.equal(result.canReadInventory,true);
 assert.equal(result.canWriteInventory,true);
 assert.equal(Object.hasOwn(result,'canReadCash'),false);
 assert.equal(Object.hasOwn(result,'authToken'),false);
 assert.equal(db.cleared,1);
 assert.equal(db.count,0);
 assert.equal(db.calls.length,3);
});
test('contraseña equivocada no concede acceso ni revela clave',async()=>{
 const db=fakeDatabase();
 const result=await service.verificarCodigoInventarioRomoQA({
  db,code:'123456',workerName:'Ana',env:base()
 });
 assert.equal(result,null);
 assert.equal(db.calls.length,2);
 assert.equal(db.cleared,0);
 for(const entry of db.calls)assert.equal(entry.args.includes('123456'),false);
});
test('cinco intentos causan bloqueo y el intento seis no consulta PIN real',async()=>{
 const db=fakeDatabase();
 for(let i=0;i<6;i++){
  const out=await service.verificarCodigoInventarioRomoQA({
   db,code:i===5?'614925':'123456',workerName:'Ana',env:base()
  });
  assert.equal(out,null);
 }
 assert.equal(db.calls.filter(x=>x.sql.startsWith('SELECT')).length,4);
 assert.equal(db.cleared,0);
 assert.equal(db.calls.filter(x=>x.sql.startsWith('INSERT')).length,6);
});
test('no se puede cambiar identificador de equipo para eludir el límite',async()=>{
 const db=fakeDatabase(),env=base();
 await service.verificarCodigoInventarioRomoQA({db,code:'111111',workerName:'Trabajador 1',env});
 await service.verificarCodigoInventarioRomoQA({db,code:'222222',workerName:'Trabajador 2',env});
 const params=db.calls.filter(x=>x.sql.startsWith('INSERT'));
 assert.equal(params.length,2);
 assert.equal(params[0].args[1],params[1].args[1]);
});
test('sin secreto privado no se registra intento ni se autentica trabajador',async()=>{
 const db=fakeDatabase();
 await assert.rejects(
  service.verificarCodigoInventarioRomoQA({db,code:'614925',workerName:'Ana',env:{...base(),ROMO_PIN_CONTROL_HMAC_KEY:''}}),
  /Secreto privado/
 );
 assert.equal(db.calls.length,0);
});
test('código no está conectado a API y no hay formulario de credenciales falsas',()=>{
 const endpoint=fs.readFileSync(path.join(__dirname,'../api/romo-catalogo-qa.js'),'utf8');
 const carta=fs.readFileSync(path.join(__dirname,'../firebase/uki-romo-carta-panel-qa.js'),'utf8');
 assert.doesNotMatch(endpoint,/romo-pin-autorizacion-qa|ROMO_PIN_TRABAJADOR_QA_ENABLED/);
 assert.match(carta,/no introduzcas códigos de trabajadores en esta pantalla de prueba/);
});
