'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
test('Trabajador muestra comparación orientativa únicamente con conteos guardados',()=>{
 for(const file of ['firebase/uki-inventario-turno.html','public/index.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const src=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(src);
  assert.doesNotThrow(()=>new vm.Script(src.replace(/^import .*$/gm,'')));
  const i=src.indexOf('function diferenciaTurno('),j=src.indexOf('const OPCIONES',i);
  // La función pura no tiene efectos ni necesita base de datos.
  const end=src.indexOf('}',i)+1;
  assert.ok(i>=0&&end>i);
  const diferencia=vm.runInNewContext(src.slice(i,end)+'\ndiferenciaTurno');
  assert.equal(diferencia(0,5,2),3);
  assert.equal(diferencia(2,1,2),1);
  assert.equal(diferencia(5,2,7),0);
  assert.equal(diferencia(5,0,7),-2);
  assert.equal(diferencia(-1,5,2),null);
  assert.match(src,/stockAlAbrir\.set\(item\.sku/);
  assert.match(src,/revisados\.has\(item\.sku\)/);
  assert.match(src,/posible consumo o diferencia de conteo/);
  assert.match(src,/revisar entrada o corrección de conteo/);
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
