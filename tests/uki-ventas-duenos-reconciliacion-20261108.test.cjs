'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeTurno,deduplicateTurnos,reconcile}=require('../lib/uki-ventas-duenos-reconciliacion.cjs');
const base={sucursal:'arica',turno_id:'2026-11-08@1731001000',
 fecha_operativa:'2026-11-08',revision:562,estado:'abierto',pedidos:12,venta_total:93300,
 medios:{Efectivo:30000,Transferencia:63300}};
test('No se duplica una venta cuando el mismo turno se sincroniza varias veces',()=>{
 const rows=deduplicateTurnos([base,{...base,revision:563,venta_total:93300},
  {...base,revision:560,venta_total:93300}]);
 assert.equal(rows.length,1);assert.equal(rows[0].revision,563);
});
test('Un turno cerrado no puede retroceder por un registro antiguo abierto',()=>{
 const closed={...base,estado:'cerrado',revision:563};
 const rows=deduplicateTurnos([base,closed,{...base,revision:564}]);
 assert.equal(rows.length,1);assert.equal(rows[0].estado,'cerrado');
});
test('Sucursales con mismo número de turno no se mezclan',()=>{
 const laSerena={...base,sucursal:'serena',venta_total:65000,medios:{Transferencia:65000}};
 const rows=deduplicateTurnos([base,laSerena]);
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.sucursal==='arica').venta_total,93300);
 assert.equal(rows.find(x=>x.sucursal==='serena').venta_total,65000);
});
test('No aceptar un cierre cuyo desglose no cuadra ni sumar delivery manual como venta',()=>{
 assert.equal(normalizeTurno({...base,venta_total:97000}),null);
 assert.equal(normalizeTurno({...base,medios:{Efectivo:30000,Transferencia:63300,'Delivery manual':3500}}),null);
 assert.equal(normalizeTurno({...base,cliente:'Cliente'}).cliente,undefined);
});
test('Si un cierre manual coincide con automático, se separa para conciliación sin duplicarlo',()=>{
 const manual={tipo:'venta',estado:'registrado',sucursal_codigo:'arica',
  fecha:'2026-11-08',referencia:base.turno_id,monto:93300,fuente:'manual'};
 const other={tipo:'venta',estado:'registrado',sucursal_codigo:'serena',
  fecha:'2026-11-08',referencia:'cierre-serena',monto:10000,fuente:'manual'};
 const result=reconcile({automaticas:[base],manuales:[manual,other]});
 assert.equal(result.totalAuto,93300);
 assert.equal(result.totalManual,10000);
 assert.equal(result.posiblesDuplicados.length,1);
 assert.equal(result.manuales.length,1);
});
