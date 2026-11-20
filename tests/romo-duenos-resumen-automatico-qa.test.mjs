import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conciliarCierresRomoResumenQA as conciliar} from '../public/uki-duenos-romo-cierres-conciliados-qa.mjs';

const DIA='2026-11-19';
const TURNO='2026-11-19@1795111200000';
const ref='romo:serena|'+TURNO;
const negocio=[{id:'romo-id',nombre:'Romo’s Sushi'},{id:'uki-id',nombre:'Uki Sushi'}];
const sucursales=[{id:'romo-local',negocio_id:'romo-id',nombre:'La Serena'},
 {id:'uki-local',negocio_id:'uki-id',nombre:'La Serena'}];
const cierre=(extra={})=>({
 source_key:ref,turno_ref:TURNO,fecha_operativa:DIA,revision_neon:8,
 estado_contable:'pendiente_incorporacion',
 venta_total:2500,pedidos:1,gastos_cierre:100,delivery_por_pagar:350,
 propinas:200,medios:{Transferencia:2500},...extra
});
const base=(args={})=>({
 cierres:[cierre()],movimientos:[],negocios:negocio,sucursales,
 desde:DIA,hasta:DIA,lecturaAutorizada:true,movimientosCompletos:true,...args
});
const manual=(extra={})=>({
 id:'m1',negocio_id:'romo-id',tipo:'venta',fuente:'manual',estado:'pagado',
 fecha:DIA,monto:2500,referencia:'venta suelta',...extra
});
test('Cierre Romo aparece automáticamente una vez en el resumen privado QA',()=>{
 const v=conciliar(base());
 assert.equal(v.confirmados,1);
 assert.equal(v.incluidos,1);
 assert.equal(v.items.length,1);
 assert.equal(v.items[0].importe,2500);
 assert.equal(v.items[0].nombre,'Romo’s Sushi');
 assert.equal(v.items[0].marca,'romo');
 assert.equal(v.items[0].gastos,100);
 assert.equal(v.items[0].delivery,0,'Delivery POR PAGAR no es gasto pagado');
 assert.equal(v.items[0].deliveryPorPagar,350);
 assert.equal(v.deliveryPorPagar,350);
 assert.equal(v.soloVistaPrevia,true);
 assert.equal(v.items[0].ref,ref);
});
test('Con venta manual Romo en la misma fecha no se duplica el cierre aunque las referencias difieran',()=>{
 const v=conciliar(base({movimientos:[manual()]}));
 assert.equal(v.incluidos,0);
 assert.equal(v.bloqueados,1);
 assert.match(v.motivo,/ventas manuales Romo/);
});
test('Una venta de Uki en la misma fecha jamás bloquea el cierre Romo',()=>{
 const v=conciliar(base({movimientos:[manual({negocio_id:'uki-id'})]}));
 assert.equal(v.incluidos,1);
});
test('Filtrar por sucursal Uki La Serena no muestra dinero Romo',()=>{
 const v=conciliar(base({sucursal_id:'uki-local'}));
 assert.equal(v.incluidos,0);
});
test('Filtrar por Romo La Serena mantiene su propio cierre',()=>{
 const v=conciliar(base({sucursal_id:'romo-local',negocio_id:'romo-id'}));
 assert.equal(v.incluidos,1);
});
test('Filtrar por negocio Uki no muestra cierres Romo; razón social exige conciliar',()=>{
 assert.equal(conciliar(base({negocio_id:'uki-id'})).incluidos,0);
 assert.equal(conciliar(base({razon_social_id:'razon-x'})).incluidos,0);
});
test('Consulta no autenticada, incompleta o limitada nunca suma dinero Romo',()=>{
 assert.equal(conciliar(base({lecturaAutorizada:false})).incluidos,0);
 assert.equal(conciliar(base({movimientosCompletos:false})).incluidos,0);
 assert.throws(()=>conciliar(base({cierres:Array.from({length:100},()=>cierre())})),
  /consulta financiera completa/);
});
test('Se rechaza toda la consulta si hay claves repetidas o cifras inconsistentes',()=>{
 assert.throws(()=>conciliar(base({cierres:[cierre(),cierre()]})),/duplicado/);
 assert.throws(()=>conciliar(base({cierres:[cierre({medios:{Transferencia:3000}})]})),/inconsistente/);
 assert.throws(()=>conciliar(base({cierres:[cierre({source_key:'uki:serena|'+TURNO})]})),/inconsistente/);
 assert.throws(()=>conciliar(base({cierres:[cierre({delivery_por_pagar:-1})]})),/inconsistente/);
});
test('Una venta manual Romo anulada no bloquea los cierres de Romo',()=>{
 assert.equal(conciliar(base({movimientos:[manual({estado:'anulado'})]})).incluidos,1);
});
test('Sin catálogo de negocios para conciliación no se atribuyen ingresos por conjetura',()=>{
 assert.throws(()=>conciliar(base({negocios:[]})),/negocio Romo/);
});
test('El módulo no usa red ni hace escrituras a fin_movimientos',()=>{
 const s=readFileSync(new URL('../public/uki-duenos-romo-cierres-conciliados-qa.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\bfetch\s*\(|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
});
