'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {normalize,chooseUpdate,aggregate}=require('../lib/uki-fin-resumen-auto-qa.cjs');
const example={branch:'arica',turno_ref:'arica|2026-11-08|1794190000000',
 fecha_operativa:'2026-11-08',estado:'abierto',revision:11,venta_total:27000,pedidos:3,
 medios:{Efectivo:3500,Transferencia:20000,'Débito':3500}};
test('Valida las cifras de la sucursal y no confunde delivery manual con efectivo',()=>{
 const p=normalize(example);
 assert.ok(p);
 assert.equal(p.venta_total,27000);
 assert.equal(p.medios.Efectivo,3500);
 assert.equal(p.medios.Transferencia,20000);
 assert.equal(p.pedidos,3);
 assert.match(p.source_key,/^[a-f0-9]{64}$/);
 assert.notEqual(normalize({...example,branch:'serena',turno_ref:'serena|2026-11-08|1794190000000'}).source_key,p.source_key);
});
test('Rechaza pagos sin cuadrar, ingresos negativos, estado incorrecto y campo extra malicioso',()=>{
 assert.equal(normalize({...example,venta_total:27001}),null);
 assert.equal(normalize({...example,medios:{Efectivo:-1,Transferencia:27001}}),null);
 assert.equal(normalize({...example,estado:'rechazado'}),null);
 assert.equal(normalize({...example,branch:'unknown'}),null);
 assert.equal(normalize({...example,turno_ref:'arica\r\ninvalid'}),null);
 assert.equal(normalize({...example,revision:0}),null);
 assert.equal(normalize({...example,fecha_operativa:'2026-11-32'}),null);
 assert.equal(normalize({...example,medios:{Efectivo:27000,Criptomoneda:0}}),null);
});
test('Reintentos no generan ventas duplicadas; turno cerrado queda bloqueado',()=>{
 const a=normalize(example);
 assert.equal(chooseUpdate(null,a),'nuevo');
 assert.equal(chooseUpdate(a,a),'ya_registrado');
 assert.equal(chooseUpdate(a,normalize({...example,revision:12,venta_total:27500,
 medios:{Efectivo:4000,Transferencia:20000,'Débito':3500}})),'actualizar');
 assert.equal(chooseUpdate(a,normalize({...example,revision:10})),'obsoleto');
 const closed=normalize({...example,estado:'cerrado',revision:13});
 assert.equal(chooseUpdate(closed,normalize({...example,revision:14,estado:'abierto'})),'cierre_bloqueado');
 assert.equal(chooseUpdate(closed,normalize({...example,revision:14,estado:'cerrado'})),'cierre_bloqueado');
});
test('Suma fuentes únicas por sucursal sin modificar ni sumar ventas manuales',()=>{
 const arica=normalize(example);
 const serena=normalize({...example,branch:'serena',turno_ref:'serena|2026-11-08|1794190000000',
 venta_total:12000,medios:{Efectivo:12000},estado:'cerrado'});
 const total=aggregate([arica,serena]);
 assert.deepEqual(total.arica,{abierto:27000,cerrado:0,pedidos:3,turnos:1});
 assert.deepEqual(total.serena,{abierto:0,cerrado:12000,pedidos:3,turnos:1});
});
test('Seguridad: lectura necesita sesión Google + PIN, ingesta nunca escribe a fin_movimientos',()=>{
 const src=fs.readFileSync('api/mi-administracion-qa.js','utf8');
 const add=src.indexOf("if(action==='recibir_uki_auto')");
 const auth=src.indexOf('if(!await authorized(sql,req,who))');
 const view=src.indexOf("if(action==='consultar_uki_auto')");
 assert.ok(add>0&&auth>add&&view>auth);
 assert.match(src,/UKI_FIN_QA_ENABLED==='true'/);
 const write=src.slice(add,auth);
 assert.doesNotMatch(write,/INSERT INTO\s+public\.fin_movimientos|UPDATE\s+public\.fin_movimientos|DELETE\s+FROM\s+public\.fin_movimientos/i);
 assert.match(write,/INSERT INTO public\.fin_uki_snapshots_qa/);
 const sql=fs.readFileSync('sql/fin-uki-snapshots-qa-20261108.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.fin_uki_snapshots_qa/);
 assert.doesNotMatch(sql,/\bDROP\b|\bTRUNCATE\b|\bDELETE FROM\b/i);
});
test('Interfaz de dueños conserva formulario manual y separa la bandeja automática',()=>{
 const src=fs.readFileSync('firebase/mi-administracion.html','utf8');
 assert.match(src,/id="saveSale"/);
 assert.match(src,/id="ukiAutoSummary"/);
 assert.match(src,/id="ukiAutoArica"/);
 assert.match(src,/id="ukiAutoSerena"/);
 assert.match(src,/await cargarUkiAutomaticas\(\)/);
 assert.match(src,/No contabilizado/);
 assert.match(src,/hayPosibleRepeticionManual/);
});
