'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('public/vista-previa-carta-precios.html','utf8');
const panel=fs.readFileSync('public/index.html','utf8');
test('Vista de carta separada del inventario del trabajador',()=>{
 assert.match(html,/Carta y precios/);
 assert.match(html,/no es el panel operativo/i);
 assert.match(html,/No guarda, no publica ni consulta datos reales/i);
 assert.match(panel,/Uki Sushi · Inventario/);
 assert.doesNotMatch(panel,/Carta y precios/);
});
test('Regimiento y La Serena con ejemplos de ingredientes, recargos y promos por separado',()=>{
 for(const term of ['data-branch="arica"','data-branch="serena"','Frutilla','Cebollín','Camarón','Salmón','Promociones del mes','Recargo','piezas por roll','vista visual']) {
  assert.ok(html.toLowerCase().includes(term.toLowerCase()),term);
 }
 assert.match(html,/id="promo-list"/);
 assert.match(html,/id="ingredient-list"/);
 assert.match(html,/id="product-list"/);
});
test('Vista de ensayo no conecta Firebase, inventario, caja ni sistemas externos',()=>{
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|indexedDB|localStorage|sessionStorage|navigator\.serviceWorker/i);
 assert.doesNotMatch(html,/<script\s+[^>]*src|<form\s|\biframe\s|src="https?:/i);
});
test('Las acciones de edición se ven como ejemplo pero desactivadas',()=>{
 assert.match(html,/Guardar ingrediente \(solo en panel real\)<\/button>/);
 assert.match(html,/Guardar borrador \(solo en panel real\)<\/button>/);
 assert.match(html,/Agregar a la carta \(solo en panel real\)<\/button>/);
 assert.equal((html.match(/<button\s+class="demo"[^>]*disabled/g)||[]).length,2);
});
