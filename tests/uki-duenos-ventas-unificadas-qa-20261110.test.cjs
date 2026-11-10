'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../firebase/uki-duenos-ventas-unificadas-qa.mjs')).href);
const businesses=[{id:'uki',nombre:'Uki Sushi'},{id:'romo',nombre:'Romo Sushi'}];
const branches=[{id:'a',nombre:'Regimiento Arica',negocio_id:'uki'},{id:'s',nombre:'La Serena',negocio_id:'uki'},
 {id:'r',nombre:'Regimiento Arica',negocio_id:'romo'}];
const ref='uki|arica|1794259200123';
const movimientos=[
 {id:'manual-1',tipo:'venta',fuente:'manual',fecha:'2026-11-10',monto:5000,estado:'pagado',
  negocio_id:'uki',sucursal_id:'a',referencia:'Venta extra'},
 {id:'manual-2',tipo:'venta',fuente:'cierre',fecha:'2026-11-09',monto:27000,estado:'pagado',
  negocio_id:'uki',sucursal_id:'a',referencia:ref},
 {id:'manual-anulada',tipo:'venta',fuente:'manual',fecha:'2026-11-08',monto:2500,
  estado:'anulado',negocio_id:'uki',sucursal_id:'a'},
 {id:'gasto',tipo:'gasto',fecha:'2026-11-09',monto:900000,estado:'pagado'}
];
const cierres=[
 {branch:'arica',turno_ref:ref,fecha_operativa:'2026-11-09',venta_total:27000,
  gastos_cierre:800,delivery_por_pagar:1200,propinas:300,retiros:200,medios:{Efectivo:7000,Transferencia:20000}},
 {branch:'serena',turno_ref:'uki|serena|1794260200123',fecha_operativa:'2026-11-10',
  venta_total:40000,medios:{Efectivo:40000}}
];
test('Todas las ventas reúne ambos orígenes por fecha sin duplicar cierre de igual referencia',async()=>{
 const {unirVentasDuenos}=await load();
 const d=unirVentasDuenos({movimientos,cierres,negocios:businesses,sucursales:branches});
 assert.equal(d.manuales,3);assert.equal(d.cierresConfirmados,2);
 assert.equal(d.coincidencias,1);assert.equal(d.conflictos,0);
 assert.equal(d.items.length,4,'El cierre de Arica coincidente aparece una sola vez');
 assert.equal(d.items[0].fecha,'2026-11-10');
 assert.equal(d.items.filter(x=>x.ref===ref).length,1);
 assert.equal(d.items.find(x=>x.ref===ref).confirmado,true);
 assert.equal(d.items.filter(x=>x.tipo==='cierre').length,1);
 assert.equal(d.totalManual,32000,'No sumar movimiento anulado');
 assert.equal(d.totalCierresSoloInformativo,67000,'Los cierres no se suman al importe manual');
});
test('Cada sucursal y negocio muestra solo sus cierres; filtro legal no inventa razón social',async()=>{
 const {unirVentasDuenos}=await load();
 const base={movimientos:[],cierres,negocios:businesses,sucursales:branches};
 assert.equal(unirVentasDuenos({...base,negocio_id:'uki',sucursal_id:'a'}).cierresConfirmados,1);
 assert.equal(unirVentasDuenos({...base,negocio_id:'uki',sucursal_id:'s'}).cierresConfirmados,1);
 assert.equal(unirVentasDuenos({...base,negocio_id:'romo'}).cierresConfirmados,0);
 assert.equal(unirVentasDuenos({...base,negocio_id:'romo',sucursal_id:'r'}).cierresConfirmados,0);
 assert.equal(unirVentasDuenos({...base,razon_social_id:'razon-1'}).cierresConfirmados,0);
 assert.equal(unirVentasDuenos({...base,desde:'2026-11-10',hasta:'2026-11-10'}).cierresConfirmados,1);
});
test('Referencias repetidas se deduplican; diferencias de monto quedan señaladas sin alterar datos',async()=>{
 const {unirVentasDuenos}=await load();
 const sample={movimientos,cierres:[...cierres,cierres[0]],negocios:businesses,sucursales:branches};
 const a=unirVentasDuenos(sample);
 assert.equal(a.cierresConfirmados,2);assert.equal(a.coincidencias,1);
 const mismatch=unirVentasDuenos({...sample,cierres:[{...cierres[0],venta_total:29000}]});
 assert.equal(mismatch.conflictos,1);
 assert.equal(mismatch.items.filter(x=>x.ref===ref).length,2,
  'No ocultar diferencias ni sobrescribir un cierre');
});
test('Rechaza registros malformados y no muta cierres ni ventas de origen',async()=>{
 const {unirVentasDuenos}=await load();
 const m=JSON.parse(JSON.stringify(movimientos)),c=JSON.parse(JSON.stringify(cierres));
 const d=unirVentasDuenos({movimientos:m,cierres:[...c,{...c[0],turno_ref:'otro',venta_total:-100}],
  negocios:businesses,sucursales:branches});
 assert.equal(d.cierresConfirmados,2);
 assert.deepEqual(m,movimientos);assert.deepEqual(c,cierres);
});
