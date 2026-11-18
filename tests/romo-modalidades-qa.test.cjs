'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {simularModalidadRomoQA,tarifaEscenarioKm}=require('../lib/romo-modalidades-qa.cjs');
const {empty}=require('../lib/romo-carta-administracion-qa.cjs');
const {proyectarVistaAdminRomoQA}=require('../lib/romo-carta-vista-previa-admin-qa.cjs');
const base={
 storeId:'romo:serena',readOnly:true,revision:1,
 products:Array.from({length:40},(_,i)=>({sku:'dish:entrada-'+i,
 kind:'dish',name:'Entrada '+i,price:6000,available:true,
 description:'',categoriaSlug:'entradas'})),
 categories:[{slug:'entradas',nombre:'Entradas'},{slug:'clasicas',nombre:'Clásicas'},
 {slug:'mensual',nombre:'Promociones'},{slug:'premium',nombre:'Premium'},
 {slug:'gohan',nombre:'Gohan'}],
 ingredients:Array.from({length:21},(_,i)=>({sku:'ingredient:otro:'+i,
 name:'Otro '+i,category:'Vegetales',contexts:{clasicas:0},available:true}))
};
const data=empty();
data.products.push({sku:'custom:12345678-0000-4000-8000-111111111111',
 name:'Entrada Romo',price:6500,description:'',categoriaSlug:'entradas',available:true});
const vista=()=>proyectarVistaAdminRomoQA(base,
 {store_id:'romo:serena',revision:4,contenido:data},[]);
const row={sku:'custom:12345678-0000-4000-8000-111111111111',qty:2};
const req=(mode,payment='efectivo',extras={})=>({
 action:'simularModalidad',revisionComercial:1,revisionAdministracion:4,
 mode,payment,items:[row],...extras
});
test('retiro y consumo no agregan costo de delivery ni crean pedidos',()=>{
 for(const mode of ['retiro','consumo']){
  const r=simularModalidadRomoQA(vista(),req(mode,'debito'));
  assert.equal(r.productos,13000);
  assert.equal(r.tarifaEscenario,0);
  assert.equal(r.referenciaSinCobro,13000);
  assert.equal(r.requiresRealRoute,false);
  assert.equal(r.canSendOrder,false);
  assert.equal(r.canPay,false);
  assert.equal(r.totalComercial,null);
 }
});
test('delivery sin dirección ni ruta verificada no da total comercial',()=>{
 const r=simularModalidadRomoQA(vista(),req('delivery'));
 assert.equal(r.productos,13000);
 assert.equal(r.kmEscenario,null);
 assert.equal(r.tarifaEscenario,null);
 assert.equal(r.referenciaSinCobro,null);
 assert.equal(r.requiresRealRoute,true);
 assert.equal(r.totalComercial,null);
});
test('escenarios de distancia reproducen tarifa aprobada, no son rutas reales',()=>{
 const bands=[[0,1000],[1,1000],[2,1500],[3,2000],[4,2500],
 [4.5,2750],[5,3000],[6,3200],[7,3400],[8,3600]];
 for(const [km,expected] of bands){
  assert.equal(tarifaEscenarioKm(km),expected);
  const r=simularModalidadRomoQA(vista(),req('delivery','efectivo',{kmEscenario:km}));
  assert.equal(r.tarifaEscenario,expected);
  assert.equal(r.referenciaSinCobro,13000+expected);
  assert.equal(r.deliveryFee,null);
  assert.equal(r.countsAsSale,false);
 }
 const outside=simularModalidadRomoQA(vista(),req('delivery','transferencia',{kmEscenario:9}));
 assert.equal(outside.outsideRadius,true);
 assert.equal(outside.tarifaEscenario,null);
 assert.equal(outside.referenciaSinCobro,null);
});
test('bloquea medios de pago no compatibles, rutas fingidas y versiones antiguas',()=>{
 const v=vista();
 assert.throws(()=>simularModalidadRomoQA(v,req('delivery','debito')),/medio de pago/);
 assert.throws(()=>simularModalidadRomoQA(v,req('delivery','credito')),/medio de pago/);
 assert.throws(()=>simularModalidadRomoQA(v,req('retiro','junaeb')),/medio de pago/);
 assert.throws(()=>simularModalidadRomoQA(v,req('consumo','efectivo',{kmEscenario:2})),/Modalidad/);
 assert.throws(()=>simularModalidadRomoQA(v,req('delivery','efectivo',{kmEscenario:-1})),/Distancia/);
 assert.throws(()=>simularModalidadRomoQA(v,{...req('consumo'),revisionAdministracion:3}),/versión/);
});
