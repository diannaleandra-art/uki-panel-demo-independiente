'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path='public/panel-locales-vista-previa.html';
const html=fs.readFileSync(path,'utf8');
test('La vista tiene sintaxis JS válida y solo usa datos ficticios',()=>{
 const js=html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'uki-panel-locales-vista.js'}));
 assert.match(html,/Vista visual de mejoras del panel/);
 assert.match(html,/Datos ficticios/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB/i);
 assert.doesNotMatch(html,/<form\b|<script[^>]+\bsrc=/i);
});
test('Se muestran los cinco accesos y las mejoras del paquete sin caja real',()=>{
 for(const label of ['Panel v8.16 · LOCALES','Rechazados (historial)','PRECIERRE DEL TRABAJADOR',
  'CIERRE DEFINITIVO DEL DÍA','Completar o editar datos del cliente','WhatsApp (opcional)','Código cliente · 4 dígitos',
  'Regimiento Arica','La Serena','Guardar pedido (desactivado)'])
  assert.ok(html.includes(label),label);
 assert.match(html,/Confirmar cierre definitivo \(desactivado\)/);
 assert.match(html,/Datos ficticios/);
 assert.match(html,/Solo para revisar el diseño/);
});
test('Se añade a public sin reemplazar el acceso del trabajador a Inventario',()=>{
 const publicIndex=fs.readFileSync('public/index.html','utf8');
 assert.match(publicIndex,/Uki Sushi · Inventario/);
 assert.doesNotMatch(publicIndex,/Panel v8.16 · LOCALES/);
});
