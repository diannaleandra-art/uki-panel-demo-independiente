'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{warehouseOf,combineSales,physicalWarehouses}=require('../lib/inventario-bodegas-compartidas-v1.cjs');
const make=(store,quantity,start='2026-11-26T00:00:00Z',end='2026-11-27T00:00:00Z')=>({store,liveSales:{available:true,start,end,ingredients:[{name:'pollo',quantity,unit:'g'}],calculated:1,pending:0}});
test('tres operaciones, dos bodegas; ventas de ambas marcas se suman únicamente en La Serena',()=>{
 const r=[make('uki:arica',100),make('uki:serena',200),make('romo:serena',300)];
 assert.equal(warehouseOf('romo:serena'),'serena');
 const out=physicalWarehouses(r);assert.equal(out.length,2);assert.equal(out[0].sales.ingredients[0].quantity,100);assert.equal(out[1].sales.ingredients[0].quantity,500);
 assert.equal(out[1].physical.store,'uki:serena');assert.equal(out[1].coverageComplete,false);
});
test('marca ausente no equivale a cero ventas',()=>{const out=combineSales([make('uki:serena',200)],'serena');assert.equal(out.allBrandsAvailable,false);assert.equal(out.coverageComplete,false);});
test('no suma ventanas diferentes',()=>{const out=combineSales([make('uki:serena',200),make('romo:serena',300,'2026-11-25T00:00:00Z')],'serena');assert.equal(out.available,false);assert.equal(out.sources.length,2);});
