'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {simularCarritoBorradorRomoQA}=require('../lib/romo-carrito-borrador-qa.cjs');
const {empty}=require('../lib/romo-carta-administracion-qa.cjs');
const {proyectarVistaAdminRomoQA}=require('../lib/romo-carta-vista-previa-admin-qa.cjs');
const carta={
 storeId:'romo:serena',readOnly:true,revision:1,
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?'classic:24':i===1?'monthly:romo-72-clasicas':'dish:'+i,
  kind:i===0?'classic':i===1?'monthly':'dish',name:'Producto '+i,
  price:8000+i*100,available:true,description:'',
  categoriaSlug:i===0?'clasicas':i===1?'mensual':'entradas'
 })),
 categories:[{slug:'clasicas',nombre:'Clásicas'},{slug:'mensual',nombre:'Promociones'},
  {slug:'entradas',nombre:'Entradas'},{slug:'premium',nombre:'Premium'},
  {slug:'handroll',nombre:'Handroll'}],
 ingredients:Array.from({length:21},(_,i)=>({sku:'ingredient:'+i,
  name:'Ingrediente '+i,category:'Vegetales',contexts:{clasicas:0}}))
};
const data=empty();
data.categories.push({slug:'prueba-romo',nombre:'PRUEBA ROMO'});
data.assignments['classic:24']='prueba-romo';
data.baseProductOverrides['classic:24']={price:9000};
data.discounts['classic:24']=10;
data.products.push({sku:'custom:ejemplo',name:'Ejemplo prueba',price:6500,
 description:'',categoriaSlug:'entradas',available:true});
data.promotions.push({sku:'promo:ejemplo',name:'Promo test',price:12000,
 description:'',promoType:'sushi',rollCount:2,piecesPerRoll:12,
 sauceCount:1,korokes:0,payments:['efectivo'],available:true});
const make=()=>proyectarVistaAdminRomoQA(carta,
 {store_id:'romo:serena',revision:2,contenido:data},[]);
const req=(lines,revision=2)=>({action:'simular',revisionComercial:1,
 revisionAdministracion:revision,items:lines});
test('suma precios de servidor, descuentos y cantidades sin aceptar precios del navegador',()=>{
 const out=simularCarritoBorradorRomoQA(make(),req([
  {sku:'classic:24',qty:2},{sku:'custom:ejemplo',qty:1}
 ]));
 assert.equal(out.subtotalProductos,8100*2+6500);
 assert.equal(out.lineas[0].unitario,8100);
 assert.equal(out.lineas[0].precioOriginal,9000);
 assert.equal(out.qtyTotal,3);
 assert.equal(out.canSendOrder,false);
 assert.equal(out.canPay,false);
 assert.equal(out.countsAsSale,false);
 assert.equal(out.totalComercial,null);
 assert.equal(out.deliveryFee,null);
});
test('la promoción creada en Romo queda disponible en el simulador, no publicada',()=>{
 const out=simularCarritoBorradorRomoQA(make(),req([{sku:'promo:ejemplo',qty:1}]));
 assert.equal(out.subtotalProductos,12000);
 assert.equal(out.lineas[0].requiereArmado,true);
 assert.equal(out.status,'qa-carrito-sin-pedidos');
});
test('rechaza revisión antigua del catálogo',()=>{
 assert.throws(()=>simularCarritoBorradorRomoQA(make(),
  req([{sku:'classic:24',qty:1}],1)),/actualiza/);
});
test('rechaza productos ajenos, agotados, repetidos y campos de precio falsificados',()=>{
 const projection=make();
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,
  req([{sku:'pizza:ajena',qty:1}])),/no pertenece/);
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,
  req([{sku:'classic:24',qty:1},{sku:'classic:24',qty:2}])),/duplicad/);
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,
  req([{sku:'classic:24',qty:1,price:10}])),/inválid/);
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,
  req([{sku:'classic:24',qty:21}])),/inválid/);
 const other=structuredClone(projection);
 other.products[0].available=false;
 assert.throws(()=>simularCarritoBorradorRomoQA(other,
  req([{sku:'classic:24',qty:1}])),/agotados/);
});
test('rechaza carritos demasiado grandes o con extras no cotizados',()=>{
 const projection=make();
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,
  req(Array.from({length:36},(_,i)=>({sku:projection.products[i].sku,qty:1})))),/35/);
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,
  req([{sku:'classic:24',qty:1,ingredients:['extra-protein']}])),/inválid/);
 assert.throws(()=>simularCarritoBorradorRomoQA(projection,{
  action:'enviar',revisionComercial:1,revisionAdministracion:2,
  items:[{sku:'classic:24',qty:1}]
 }),/actualiza/);
});
