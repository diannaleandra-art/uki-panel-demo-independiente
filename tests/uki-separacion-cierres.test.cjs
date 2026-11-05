'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const modelo=()=>import('../firebase/uki-separacion-cierres-v1.mjs');
const ruta=p=>readFileSync(join(__dirname,'..',p),'utf8');
const arica=()=>({
 suc:'Uki Regimiento Arica',nextId:19,nextIncidenciaId:2,fechaOperativa:'2026-11-05',
 pedidos:[{suc:'Uki Regimiento Arica',id:17,cliente:'Cliente prueba',total:15000}],
 clientes:{A:{nombre:'Cliente prueba'}},borradores:[],incidencias:[],deliveriesManuales:[],
 cierres:[{suc:'Uki Regimiento Arica',dia:'2026-11-05',total:18000}],
 cajasDiarias:{'Uki Regimiento Arica|2026-11-05':{base:18000,precierres:[]}},
 gastos:[{suc:'Uki Regimiento Arica',concepto:'Bolsas',monto:900}],
 retiros:[],propinas:[],ajustesHistoricos:[],base:18000,
 apps:{},pagoDelivery:1000,pagoDeliveryMedio:'Efectivo',cajaChica:{inicial:20000,gastos:[]},
 // Simula un campo nuevo: no debe ir al trabajador por defecto.
 nuevoReporteReservado:{resumen:200000}
});
test('solo las funciones necesarias para trabajar quedan en el paquete de personal',async()=>{
 const {separarEstadoPorAcceso,revisarPaqueteOperativo}=await modelo();
 const {operacion,administracion}=separarEstadoPorAcceso(arica());
 assert.equal(revisarPaqueteOperativo(operacion),true);
 for(const llave of ['cierres','cajasDiarias','gastos','retiros','propinas','ajustesHistoricos',
  'base','apps','pagoDelivery','pagoDeliveryMedio','cajaChica','nuevoReporteReservado']){
  assert.equal(Object.hasOwn(operacion,llave),false,llave+' quedó expuesto');
  assert.ok(Object.hasOwn(administracion,llave),llave+' se perdió');
 }
 assert.equal(operacion.pedidos[0].id,17);
 assert.equal(operacion.nextId,19);
});
test('recomposición administrativa conserva pedidos y cierres, sin alterar datos',async()=>{
 const {separarEstadoPorAcceso,recomponerEstadoAdministracion}=await modelo();
 const original=arica(),parts=separarEstadoPorAcceso(original);
 const merged=recomponerEstadoAdministracion(parts);
 assert.deepEqual(merged,original);
 parts.operacion.pedidos[0].id=123;
 assert.equal(original.pedidos[0].id,17,'la separación no debe mutar el origen');
});
test('impide mezclar Regimiento Arica con La Serena',async()=>{
 const {separarEstadoPorAcceso,recomponerEstadoAdministracion}=await modelo();
 const parts=separarEstadoPorAcceso(arica());
 parts.administracion.suc='Uki La Serena';
 assert.throws(()=>recomponerEstadoAdministracion(parts),/sucursales distintas/);
});
test('impide filtrar cierres añadidos por error al paquete del trabajador',async()=>{
 const {separarEstadoPorAcceso,revisarPaqueteOperativo}=await modelo();
 const parts=separarEstadoPorAcceso(arica());
 parts.operacion.cierres=[{total:18000}];
 assert.throws(()=>revisarPaqueteOperativo(parts.operacion),/administrativo/);
});
test('verificación: migración aún NO conectada al panel real ni al QA operativo',()=>{
 const html=ruta('firebase/uki-sushi-local.html');
 assert.doesNotMatch(html,/from ['"]\.\/uki-separacion-cierres-v1\.mjs/);
 // El cifrado actual incluye todas estas categorías: es un riesgo conocido.
 assert.match(html,/cierres:\[\]/);
 assert.match(html,/cajasDiarias:\{\}/);
 assert.match(html,/JSON\.stringify\(S\)/);
 const staff=ruta('firebase/uki-inventario-revision.html');
 assert.doesNotMatch(staff,/uki-sushi-nube|uki-snapshot-cifrado|cajasDiarias|descifrarBloque/);
});
