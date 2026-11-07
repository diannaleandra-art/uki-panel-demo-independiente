'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const api=require('../api/uki-carta-precios-live.js');
test('solo pizzas en Arica y entradas simples en ambas sucursales',()=>{
 const pizza={kind:'pizza',group:'pizzas',name:'Pizza Cuatro Quesos',description:'Cuatro quesos',price:10900};
 assert.deepEqual(api._testing.validNew(pizza,'arica'),pizza);
 assert.equal(api._testing.validNew(pizza,'serena'),null);
 const dish={kind:'dish',group:'entradas',name:'Nuevo aperitivo',description:'Hecho en local',price:3900};
 assert.deepEqual(api._testing.validNew(dish,'serena'),dish);
 assert.equal(api._testing.validNew({...dish,group:'burger'},'serena'),null);
 assert.equal(api._testing.validNew({...pizza,price:0},'arica'),null);
 assert.equal(api._testing.validNew({...pizza,price:3.5},'arica'),null);
 assert.equal(api._testing.validNew({...pizza,name:' '},'arica'),null);
});
test('precios válidos en pesos y artículos con identificadores únicos',()=>{
 assert.equal(api._testing.goodPrice(10900),true);
 for(const price of [-1,0,1.5,1000001,'10900',NaN])assert.equal(api._testing.goodPrice(price),false);
 const s1=api._testing.getSKU('pizza','Pizza Cuatro Quesos');
 const s2=api._testing.getSKU('pizza','Pizza Cuatro Quesos');
 assert.match(s1,/^pizza:pizza-cuatro-quesos-[0-9a-f]{8}$/);
 assert.notEqual(s1,s2);
});
test('seguridad por dominio: solo panel Google y orígenes de prueba precisos',()=>{
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/uki-disponibilidad-manual-live-2026-11-06',UKI_INVENTARIO_QA_ENABLED:'true'};
 assert.equal(api._testing.originAllowed('https://uki-sushi-pedidos.vercel.app'),true);
 assert.equal(api._testing.originAllowed('https://diannaleandra-art.github.io'),true);
 assert.equal(api._testing.originAllowed('https://sitio-malicioso.example',env),false);
 const qa='https://uki-sushi-pedidos-git-feature-uki-dis-eb0d72-diannaleandra-7046.vercel.app';
 assert.equal(api._testing.originAllowed(qa,env),true);
 assert.equal(api._testing.originAllowed(qa,{...env,VERCEL_ENV:'production'}),false);
});
test('panel tiene cuatro secciones, inventario separado y trabajador registra conteos',()=>{
 const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 const admin=read('firebase/uki-carta-precios-admin.js'),page=read('firebase/uki-sushi-local.html');
 assert.match(admin,/Carta y precios/);assert.match(admin,/Disponible \/ Agotado/);
 assert.match(admin,/Revisiones y compras/);assert.match(admin,/Agregar a la carta/);
 assert.match(admin,/articulos/);assert.match(page,/uki-carta-precios-admin\.js/);
 for(const file of ['public/index.html','firebase/uki-inventario-turno.html']){
  const html=read(file);
  assert.match(html,/turnoProgreso/);assert.match(html,/revisados\.add\(item\.sku\)/);
  assert.match(html,/Guardar conteo/);
 }
});
test('API de precios no altera inventario, caja ni tablas de ventas',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../api/uki-carta-precios-live.js'),'utf8');
 assert.match(s,/uki_carta_items_v1/);assert.match(s,/uki_carta_productos_custom_v1/);
 assert.match(s,/jwtVerify/);
 assert.doesNotMatch(s,/UPDATE\s+public\.uki_inventario|UPDATE\s+public\.uki_pedidos|UPDATE\s+public\.uki_caja/i);
});
