'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=require('../api/uki-carta-precios-live.js');
const panel=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const admin=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
const sql=fs.readFileSync('sql/uki-carta-promos-visibilidad-v1.sql','utf8');
const valid=api._testing.validPromo;
test('Promociones: precio, fotos y composición de piezas verificadas (200 = 20x10)',()=>{
 const base={name:'Promo 200 piezas',description:'Con foto real',price:55000,rollCount:20,
  piecesPerRoll:10,sauceCount:12,korokes:4,payments:['efectivo','transferencia']};
 assert.deepEqual(valid(base),base);
 assert.equal(valid({...base,rollCount:21}),null);
 assert.equal(valid({...base,piecesPerRoll:11}),null);
 assert.equal(valid({...base,payments:['efectivo','gratis']}),null);
 assert.equal(valid({...base,price:1.25}),null);
 assert.equal(valid({...base,name:'x'}),null);
 assert.equal(valid({...base,korokes:-1}),null);
});
test('Promociones nacen como borrador hasta subir la foto y publicar',()=>{
 const code=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.match(code,/if\(action==='crear-promocion'\)/);
 assert.match(code,/false,\$11/);
 assert.match(code,/SELECT 1 FROM public\.uki_carta_fotos_v1 WHERE branch=\$1 AND sku=\$2 LIMIT 1/);
 assert.match(code,/if\(action==='editar-promocion'\)/);
 assert.match(admin,/await reduceImage\(file\)/);
 assert.match(admin,/await request\(API,'crear-promocion'/);
 assert.match(admin,/await request\(PHOTO_API,'subir'/);
 assert.match(admin,/await request\(API,'publicar-promocion'/);
});
test('Panel aplica automáticamente sucursal ingresada y separa retirar de agotado',()=>{
 assert.match(admin,/const chosen=branch\(\),file=\$\('ukiPromoPhoto'\)/);
 assert.match(admin,/expected_visibility_version:price\.visibilityVersion/);
 assert.match(admin,/price\.visible===false\?'↩ Restaurar en carta':'🗑 Retirar de carta'/);
 assert.match(admin,/photoControls\(price\)/);
 assert.match(admin,/promoEditor\(price\)/);
});
test('Retirar cualquier producto no borra las ventas; mantiene precio y disponibilidad separados',()=>{
 const src=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.match(src,/uki_carta_visibilidad_v1/);
 assert.match(src,/WHERE public\.uki_carta_visibilidad_v1\.version=\$4/);
 assert.match(src,/entry\.visible===visible/);
 assert.doesNotMatch(src,/DELETE FROM\s+public\.uki_(carta|pedidos)/i);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.uki_carta_promos_custom_v1/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.uki_carta_visibilidad_v1/);
 assert.doesNotMatch(sql,/\bDROP TABLE\b|\bDELETE FROM\b/i);
});
test('Pedidos divide filtros y rechazos antiguos se consultan solamente en Historial',()=>{
 const js=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);assert.doesNotThrow(()=>new vm.Script(js));
 const main=panel.slice(panel.indexOf('function vPedidos(){'),panel.indexOf('function guardarPedido('));
 assert.doesNotMatch(main,/Archivo de rechazados de días anteriores/);
 assert.match(main,/Más estados y filtros/);
 assert.match(main,/Filtros principales de pedidos/);
 assert.match(panel,/function ukiHistorialSolicitudesRechazadas\(\)/);
 assert.match(panel,/const antecedentes=ukiHistorialSolicitudesRechazadas\(\)/);
 assert.match(panel,/S\.filtroFecha/);
});
