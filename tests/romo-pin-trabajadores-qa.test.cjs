'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pin=require('../lib/romo-pin-inventario-qa.cjs');
const uki=require('../lib/uki-inventario-pin-live.cjs');
const api=fs.readFileSync(path.join(__dirname,'../api/romo-catalogo-qa.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../firebase/uki-romo-carta-panel-qa.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'../sql/20261112_romo_pin_trabajadores_QA_NO_EJECUTAR.sql'),'utf8');
test('inventario Romo pide seis números igual que Uki, sin duplicar PIN real',()=>{
 for(const value of ['123456','000000','914702']){
  assert.equal(pin.valido(value),true);
  assert.equal(pin.valido(value),uki.valido(value));
 }
 for(const value of ['1234','12345','abc123','1234567',123456,'12-456']){
  assert.equal(pin.valido(value),false);
  assert.equal(pin.valido(value),uki.valido(value));
 }
 assert.equal(pin.nombreValido('María'),true);
 assert.equal(pin.nombreValido('A'),false);
});
test('hash Romo propio usa sal aleatoria, no guarda código claro ni reutiliza Uki',()=>{
 const a=pin.crearRegistro('914702'),b=pin.crearRegistro('914702');
 assert.equal(a.store_id,'romo:serena');
 assert.match(a.salt,/^[a-f0-9]{32}$/);assert.match(a.hash,/^[a-f0-9]{64}$/);
 assert.notEqual(a.hash,b.hash);assert.notEqual(a.salt,b.salt);
 assert.equal(Object.values(a).includes('914702'),false);
 assert.equal(pin.comprobarCodigo('914702',a),true);
 assert.equal(pin.comprobarCodigo('000000',a),false);
 assert.equal(pin.comprobarCodigo('914702',{...a,store_id:'uki:serena'}),false);
 assert.equal(pin.comprobarCodigo('914702',{...a,hash:'!' }),false);
});
test('mismo PIN de inventario nunca habilita caja, pedidos ni cierres',()=>{
 for(const action of ['cash.read','cash.write','cash.close','orders.read','orders.accept','orders.edit','owners.write']){
  assert.equal(pin.permiteTrabajadorOperacion(action),false);
 }
 for(const action of ['inventory.read','inventory.write'])
  assert.equal(pin.permiteTrabajadorOperacion(action),true);
});
test('tablas de PIN quedan sólo como SQL propuesto y endpoint sin login del trabajador',()=>{
 assert.match(sql,/NO EJECUTAR SIN APROBACIÓN/);
 assert.match(sql,/romo_pin_inventario_v1/);
 assert.match(sql,/romo_pin_intentos_v1/);
 assert.match(sql,/store_id='romo:serena'/);
 assert.match(sql,/REVOKE ALL ON public\.romo_pin_inventario_v1 FROM PUBLIC/);
 assert.doesNotMatch(api,/romo-pin-inventario-qa|romo_pin_inventario_v1|origen=inventario-trabajador/);
 assert.match(ui,/no introduzcas códigos de trabajadores en esta pantalla de prueba/);
});
test('mantiene última carta Uki y tercera entrada Romo sólo en QA',()=>{
 assert.match(html,/uki-carta-precios-admin\.js\?v=uki-categorias-lista-clara-20261112/);
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/SUCURSALES_PANEL_QA\.map\(s=>/);
 assert.match(html,/No registres operaciones aquí/);
 assert.doesNotMatch(html,/S\.suc=ROMO_SUCURSAL_QA/);
});
