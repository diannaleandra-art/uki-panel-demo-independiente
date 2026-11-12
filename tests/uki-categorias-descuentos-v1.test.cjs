'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const h=require('../lib/uki-categorias-descuentos-v1.cjs');
test('descuento 10 por ciento de 10000 da 9000 y no cambia precio original',()=>{
 const original={sku:'dish:ejemplo',price:10000};
 const result=h.mostrarDescuento(original,{discount_percent:10,version:3});
 assert.equal(result.price,9000);
 assert.equal(result.precioOriginal,10000);
 assert.equal(result.descuentoVersion,3);
 assert.equal(original.price,10000);
});
test('descuento 0 restaura precio original y nunca entrega precio cero',()=>{
 assert.equal(h.precioConDescuento(7900,0),7900);
 assert.equal(h.precioConDescuento(1,99),1);
 assert.equal(h.precioConDescuento(16000,25),12000);
});
test('rechaza porcentajes negativos, fraccionarios o superiores a 99',()=>{
 for(const n of [-1,1.5,100,'10',NaN])assert.throws(()=>h.precioConDescuento(10000,n));
});
test('categorías se normalizan y no aceptan inyección HTML',()=>{
 assert.equal(h.claveCategoria('  Bebidas Frías '),'bebidas-frias');
 assert.equal(h.nombreCategoria('<img onerror=alert(1)>'),'');
 assert.equal(h.claveCategoria('!'),'');
 assert.equal(h.categoriaValida('bebidas-frias'),true);
 assert.equal(h.categoriaValida('..'),false);
});
test('sin descuento mantiene compatibilidad de precio',()=>{
 const obj={sku:'monthly:ejemplo',price:7000};
 const x=h.mostrarDescuento(obj,null);
 assert.equal(x.price,7000);
 assert.equal(x.descuentoPorcentaje,0);
});
