'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
test('El trabajador cuenta lo que quedó sin estimar consumo desde un saldo de apertura',()=>{
 for(const file of ['firebase/uki-inventario-turno.html','public/index.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const src=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(src);
  assert.doesNotThrow(()=>new vm.Script(src.replace(/^import .*$/gm,'')));
  assert.match(src,/revisados\.has\(item\.sku\)/);
  assert.doesNotMatch(src,/stockAlAbrir|posible consumo o diferencia de conteo/);
  assert.match(src,/Dejar en blanco no cuenta como cero|countValue.placeholder='Lo que quedó'/);
 }
});
test('Administración muestra faltantes en tarjetas claras, busca y pagina',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../firebase/uki-carta-precios-admin.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(s));
 const start=s.indexOf('async function loadReponer(){'),end=s.indexOf('// Navegación compacta',start);
 assert.ok(start>=0&&end>start);
 const fn=s.slice(start,end);
 assert.match(fn,/Buscar producto para reponer/);
 assert.match(fn,/Mostrar 15 más/);
 assert.match(fn,/Hay/);
 assert.match(fn,/Mínimo/);
 assert.match(fn,/Pedir/);
 assert.match(fn,/Para comprar/);
 assert.match(fn,/Mínimo alcanzado/);
 assert.match(fn,/selected!==branch\(\)/);
 assert.match(fn,/request\(STOCK_API,'articulos',\{\},selected\)/);
 assert.doesNotMatch(fn,/crear-articulo|editar-articulo|guardarMovimiento|INSERT|DELETE/i);
});
