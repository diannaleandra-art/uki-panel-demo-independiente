'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const panel=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=[...panel.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(m=>m[1]).find(x=>x.includes('const SUCURSALES='));
const inventory=panel.slice(panel.indexOf('/* Uki Inventario y Carta'),panel.indexOf('const VISTAS=',panel.indexOf('/* Uki Inventario y Carta')));
test('la pantalla principal y el inventario compilan sin errores JS',()=>{
 assert.ok(main?.length);
 assert.doesNotThrow(()=>new vm.Script(main,{filename:'uki-sushi-local.js'}));
 assert.doesNotThrow(()=>new vm.Script(inventory));
});
test('la carta tiene una entrada desde Inicio y no reemplaza las pestañas existentes',()=>{
 assert.match(panel,/onclick="ir\('inventario'\)"/);
 assert.match(panel,/function vInventario\(\)/);
 assert.match(panel,/inventario:vInventario/);
 assert.match(panel,/const VISTAS=\[\["inicio","Inicio"/);
});
test('la disponibilidad solo se modifica con confirmación manual',()=>{
 const f=inventory.slice(inventory.indexOf('function ukiInvEstado('),inventory.indexOf('function ukiInvFormGuardar('));
 assert.match(f,/confirm\(texto\)/);
 assert.match(f,/ukiInvGuardar\(sku,\{available\}/);
 assert.doesNotMatch(f,/stock_qty|stock_qty===0|stock_qty<=0/);
});
test('editar inventario no escribe disponibilidad ni modifica la caja',()=>{
 const f=inventory.slice(inventory.indexOf('function ukiInvFormGuardar('),inventory.indexOf('async function ukiInvCrear('));
 assert.match(f,/stock_qty:Number\(stock\)/);
 assert.doesNotMatch(f,/available:/);
 assert.doesNotMatch(inventory,/S\.pedidos\s*=|S\.cierres\s*=|S\.gastos\s*=|S\.propinas\s*=/);
});
test('las ediciones requieren token Google y control de versión',()=>{
 assert.match(inventory,/window\.ukiMesasTokenConfirmar\?\.\(\)/);
 assert.match(inventory,/expected_version:version/);
 assert.match(inventory,/Authorization:'Bearer '\+token/);
 assert.match(inventory,/response\.ok/);
});
test('cada sucursal conserva el inventario separado',()=>{
 assert.match(inventory,/S\.suc===SUCURSALES\[0\]\?'arica'/);
 assert.match(inventory,/S\.suc===SUCURSALES\[1\]\?'serena'/);
 assert.match(inventory,/branch!==ukiInvBranch\(\)/);
});
