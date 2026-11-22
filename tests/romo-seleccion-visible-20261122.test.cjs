'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('public/romo-panel-qa/index.html','utf8');
const cut=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Falta bloque '+start);
 return html.slice(a,b);
};
test('Al tocar una tarjeta se muestra inmediatamente el producto seleccionado encima de la lista',()=>{
 const block=cut('function ukiDibujarCatalogoManual(){','function vNuevo(){');
 assert.match(block,/Producto seleccionado · aún no agregado al pedido/);
 assert.match(block,/chosen\.scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/);
 assert.match(block,/root\.append\(search,chosen,grid,refresh\)/);
 assert.match(block,/b\.setAttribute\('aria-pressed'/);
 assert.match(block,/tile\.style\.border=selected\?/);
 assert.match(block,/id='ukiProductoSeleccionActual'/);
 assert.match(block,/Agregar al pedido/);
});
test('Luego de agregar se confirma arriba sin guardar o cobrar',()=>{
 const code=cut('function ukiProductoAgregadoMensaje(){','function ukiCatalogoManualUI(){');
 assert.match(code,/Agregado al pedido/);
 assert.match(code,/todavía no se ha guardado ni cobrado/);
 assert.match(code,/ukiResumenProductosPedido/);
 const selection=cut('function ukiDibujarCatalogoManual(){','function vNuevo(){');
 assert.match(selection,/ukiConfirmarProductoAgregado\(D\.items\[D\.items\.length-1\]\)/);
});
test('Nuevos controles conservan sintaxis válida',()=>{
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/.test(m[1])&&m[2].trim());
 const main=scripts.find(m=>m[2].includes('function ukiDibujarCatalogoManual(){'));
 assert.ok(main);
 assert.doesNotThrow(()=>new vm.Script(main[2]));
});
