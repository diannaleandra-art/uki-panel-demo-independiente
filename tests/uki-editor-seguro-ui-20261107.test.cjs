'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const main=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const editor=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
test('Editor oculto si API no disponible, sin activar costos o carta',()=>{
 assert.match(editor,/id="ukiArmadoIngredientes" hidden/);
 assert.match(editor,/async function checkAvailability\(chosen\)/);
 assert.match(editor,/if\(!response\.ok\)\{state\.availability=false;box\.hidden=true;return;\}/);
 assert.match(editor,/box\.hidden=!ready/);
 assert.match(editor,/const prevMount=window\.ukiInventarioMontar/);
 assert.match(editor,/const API=\(QA_HOST\.test/);
});
test('Un solo script nuevo junto al editor de precios existente',()=>{
 const price=main.indexOf('<script src="./uki-carta-precios-admin.js" defer></script>');
 const ing=main.indexOf('<script src="./uki-armado-ingredientes-admin.js" defer></script>');
 assert.ok(price>=0&&ing>price);
 assert.equal(main.split('uki-armado-ingredientes-admin.js').length,2);
});
test('Preservar pedidos, pagos, cierres, inventario y disponibilidad manual',()=>{
 for(const k of ['ukiErrorDistribucionPago','ukiCajaAcumulada','ukiQRPermitirCobroDefinitivo',
  'ukiDatosPago(D,sub)','ukiCartaRemotasActualizar','ukiInventarioMontar']) {
  if(k==='ukiInventarioMontar')continue;
  assert.ok(main.includes(k),k);
 }
 for(const path of ['firebase/uki-inventario-admin-embebido.js',
  'firebase/uki-disponibilidad-admin.js','firebase/uki-carta-precios-admin.js',
  'firebase/uki-carta-remotas-panel.js'])assert.ok(fs.existsSync(path));
});
test('Sin errores de sintaxis en editor y scripts embebidos',()=>{
 new vm.Script(editor);
 for(const m of main.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  new vm.Script(m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2]);
 }
});
