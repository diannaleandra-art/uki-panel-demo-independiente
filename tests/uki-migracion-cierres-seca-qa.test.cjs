'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const cargar=()=>import('../firebase/uki-migracion-cierres-seca-qa.mjs');
const fixture=suc=>({
 suc,pedidos:[{suc,id:13,total:27000,delivery:3500,medioPago:'mixto'}],
 clientes:{p:{nombre:'Cliente QA'}},borradores:[],incidencias:[],
 deliveriesManuales:[{suc,monto:3500}],nextId:14,nextIncidenciaId:1,
 fechaOperativa:'2026-11-05',
 cierres:[{suc,fechaOperativa:'2026-11-04',venta:25000}],
 cajasDiarias:{[suc+'|2026-11-05']:{base:18000,apps:{},pagoDelivery:3500}},
 gastos:[{suc,concepto:'Bolsas',monto:800}],retiros:[],propinas:[],ajustesHistoricos:[],
 base:18000,apps:{Uber:6000},pagoDelivery:3500,pagoDeliveryMedio:'Efectivo',
 cajaChica:{inicial:20000,gastos:[]},
 filtro:'',filtroFecha:'',filtroCliente:'',
 nuevoReporteReservado:{soloParaAdmin:true}
});
test('prueba seca conserva el 100% de los registros y pagos mixtos en ambas sucursales',async()=>{
 const {prepararMigracionSinGuardarQA,reconstruirMigracionSinGuardarQA}=await cargar();
 for(const suc of ['Uki Regimiento Arica','Uki La Serena']){
  const original=fixture(suc),parts=prepararMigracionSinGuardarQA(original);
  assert.deepEqual(reconstruirMigracionSinGuardarQA(parts),original);
  assert.equal(parts.operacion.pedidos[0].total,27000);
  assert.equal(parts.operacion.pedidos[0].delivery,3500);
  assert.equal(parts.finanzas.pagoDelivery,3500);
  assert.equal(parts.finanzas.cajaChica.inicial,20000);
  assert.equal(parts.finanzas.cierres[0].fechaOperativa,'2026-11-04');
  assert.equal(parts.adicionales.nuevoReporteReservado.soloParaAdmin,true);
  assert.equal(Object.hasOwn(parts.operacion,'cierres'),false);
  assert.equal(Object.hasOwn(parts.operacion,'cajaChica'),false);
  parts.finanzas.gastos[0].monto=999;
  assert.equal(original.gastos[0].monto,800,'la prueba seca no cambia el original');
 }
});
test('impide mezclar pedidos y cierres de dos locales',async()=>{
 const {prepararMigracionSinGuardarQA,reconstruirMigracionSinGuardarQA}=await cargar();
 const v=fixture('Uki Regimiento Arica');
 v.gastos[0].suc='Uki La Serena';
 assert.throws(()=>prepararMigracionSinGuardarQA(v),/otra sucursal/);
 v.gastos[0].suc=v.suc;
 const parts=prepararMigracionSinGuardarQA(v);
 parts.branch='serena';
 assert.throws(()=>reconstruirMigracionSinGuardarQA(parts),/otra sucursal/);
});
test('no reemplaza datos si falta alguna categoría financiera',async()=>{
 const {prepararMigracionSinGuardarQA}=await cargar();
 const v=fixture('Uki La Serena');delete v.cajaChica;
 assert.throws(()=>prepararMigracionSinGuardarQA(v),/Falta campo financiero/);
});
test('no permite filtrar datos administrativos nuevos en el paquete de pedidos',async()=>{
 const {prepararMigracionSinGuardarQA}=await cargar();
 const p=prepararMigracionSinGuardarQA(fixture('Uki La Serena'));
 assert.equal(Object.hasOwn(p.operacion,'nuevoReporteReservado'),false);
 assert.equal(Object.hasOwn(p.finanzas,'nuevoReporteReservado'),false);
});

test('paquete financiero para Neon QA conserva los campos auxiliares sin exponer pedidos',async()=>{
 const {prepararMigracionSinGuardarQA,crearPaquetePrivadoSinGuardarQA,
  reconstruirDesdePaquetePrivadoQA}=await cargar();
 for(const suc of ['Uki Regimiento Arica','Uki La Serena']){
  const estado=fixture(suc),partes=prepararMigracionSinGuardarQA(estado);
  const privado=crearPaquetePrivadoSinGuardarQA(partes);
  assert.equal(Object.keys(privado).length,12);
  assert.equal(Object.hasOwn(privado,'pedidos'),false);
  assert.deepEqual(privado.adicionales.nuevoReporteReservado,{soloParaAdmin:true});
  const recovered=reconstruirDesdePaquetePrivadoQA({
   branch:partes.branch,operacion:partes.operacion,
   privado:JSON.parse(JSON.stringify(privado))
  });
  assert.deepEqual(recovered,estado);
 }
});
test('no permite meter pedidos ni sobres financieros incompletos entre metadatos',async()=>{
 const {prepararMigracionSinGuardarQA,crearPaquetePrivadoSinGuardarQA,
  reconstruirDesdePaquetePrivadoQA}=await cargar();
 const p=prepararMigracionSinGuardarQA(fixture('Uki Regimiento Arica'));
 p.adicionales.pedidos=[];
 assert.throws(()=>crearPaquetePrivadoSinGuardarQA(p),/duplicado/);
 delete p.adicionales.pedidos;
 const completo=crearPaquetePrivadoSinGuardarQA(p);
 delete completo.adicionales;
 assert.throws(()=>reconstruirDesdePaquetePrivadoQA({
  branch:p.branch,operacion:p.operacion,privado:completo
 }),/metadatos privados/);
});
