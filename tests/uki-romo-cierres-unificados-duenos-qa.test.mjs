import test from 'node:test';
import assert from 'node:assert/strict';
import {unirVentasDuenos,unirVentasDuenosConRomoQA}
 from '../public/uki-duenos-ventas-unificadas-qa.mjs';
const negocio=[{id:'r',nombre:"Romo's Sushi"},{id:'u',nombre:'Uki Sushi'}];
const sucursales=[{id:'r1',negocio_id:'r',nombre:'La Serena'},
 {id:'u1',negocio_id:'u',nombre:'La Serena'}];
const fecha='2026-11-13',turno=fecha+'@1794574800000';
const cierre=()=>({store_id:'romo:serena',source_key:'romo:serena|'+turno,
 turno_ref:turno,fecha_operativa:fecha,estado:'cerrado',venta_total:9000,
 medios:{Efectivo:9000},gastos_cierre:500,delivery_por_pagar:2000,
 propinas:100,retiros:0});
const inputs=()=>({negocios:negocio,sucursales,cierresRomo:[cierre()]});
test('Romo aparece separado, no altera datos informativos Uki',()=>{
 const a=unirVentasDuenosConRomoQA(inputs());
 assert.equal(a.cierresRomoConfirmados,1);
 assert.equal(a.items.length,1);
 assert.equal(a.items[0].nombre,'Romo’s Sushi');
 assert.equal(a.items[0].delivery,2000);
 assert.equal(a.totalManual,0);
 assert.equal(a.totalCierresSoloInformativo,0);
 assert.equal(a.totalCierresRomoSoloInformativo,9000);
 assert.equal(unirVentasDuenos(inputs()).items.length,0);
});
test('no atribuye cierre Romo si se filtra por Uki o por otro local',()=>{
 for(const sel of [
  {negocio_id:'u'}, {sucursal_id:'u1'},
  {negocio_id:'r',sucursal_id:'u1'},
  {razon_social_id:'otro'}
 ]){
  const a=unirVentasDuenosConRomoQA({...inputs(),...sel});
  assert.equal(a.cierresRomoConfirmados,0);
  assert.equal(a.items.some(x=>x.nombre==='Romo’s Sushi'),false);
 }
});
test('misma venta manual con igual referencia no se duplica',()=>{
 const manual={id:'x',negocio_id:'r',sucursal_id:'r1',tipo:'venta',
  fuente:'cierre',fecha,monto:9000,referencia:'romo:serena|'+turno,
  estado:'pagado'};
 const a=unirVentasDuenosConRomoQA({...inputs(),movimientos:[manual]});
 assert.equal(a.items.length,1);
 assert.equal(a.cierresRomoConfirmados,1);
 assert.equal(a.coincidenciasRomo,1);
 assert.equal(a.items[0].confirmado,true);
 assert.equal(a.items[0].importe,9000);
});
test('cifras distintas se informan como conflicto, no se fusionan',()=>{
 const manual={id:'x',negocio_id:'r',sucursal_id:'r1',tipo:'venta',
  fuente:'cierre',fecha,monto:7000,referencia:turno,estado:'pagado'};
 const a=unirVentasDuenosConRomoQA({...inputs(),movimientos:[manual]});
 assert.equal(a.items.length,2);
 assert.equal(a.conflictosRomo,1);
});
test('dos registros repetidos del mismo cierre muestran una sola línea',()=>{
 const x=cierre();
 const a=unirVentasDuenosConRomoQA({...inputs(),cierresRomo:[x,x]});
 assert.equal(a.items.length,1);
 assert.equal(a.cierresRomoConfirmados,1);
});
