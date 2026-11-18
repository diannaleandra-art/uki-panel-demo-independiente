'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {simularCarritoMixtoRomoQA}=require('../lib/romo-carrito-mixto-qa.cjs');
const {empty}=require('../lib/romo-carta-administracion-qa.cjs');
const {proyectarVistaAdminRomoQA}=require('../lib/romo-carta-vista-previa-admin-qa.cjs');
const original={
 storeId:'romo:serena',readOnly:true,revision:1,
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?'classic:24':i===1?'dish:gohan-pollo':i===2?'dish:papitas':'dish:test-'+i,
  kind:i===0?'classic':'dish',name:'Producto '+i,
  price:8000+i*100,available:true,description:'',
  categoriaSlug:i===0?'clasicas':'entradas'
 })),
 categories:[{slug:'clasicas',nombre:'Clásicas'},{slug:'entradas',nombre:'Entradas'},
  {slug:'mensual',nombre:'Promociones'},{slug:'fusion',nombre:'Fusión'},
  {slug:'premium',nombre:'Premium'}],
 ingredients:[
  ...[
   ['Proteínas','Pollo',{clasicas:0}],['Proteínas','Camarón',{clasicas:800,mensual_extra:800}],
   ['Vegetales','Palta',{clasicas:0}],['Vegetales','Cebollín',{clasicas:0}],
   ['Envolturas','Panko',{clasicas:0}],['Envolturas','Tempura',{clasicas:0}],
   ['Salsas','Soya',{salsas_incluidas:0}],['Salsas','Teriyaki',{salsas_incluidas:0}]
  ].map(([category,name,contexts])=>({sku:'ingredient:'+category+':'+name,
   category,name,contexts,available:true})),
  ...Array.from({length:14},(_,i)=>({sku:'ingredient:extra:'+i,
   name:'Otro '+i,category:'Vegetales',contexts:{clasicas:0},available:true}))
 ]
};
const data=empty();
data.categories.push({slug:'test',nombre:'PRUEBA'});
data.products.push({sku:'custom:product-test',name:'Producto de Romo',
 price:6500,categoriaSlug:'entradas',description:'Solo prueba',available:true});
data.promotions.push(
 {sku:'promo:12345678-0000-4000-8000-111111111111',name:'Sushi creado en Romo',
  promoType:'sushi',price:12000,rollCount:2,piecesPerRoll:12,sauceCount:1,
  korokes:1,payments:['efectivo'],available:true,description:''},
 {sku:'promo:12345678-0000-4000-8000-222222222222',name:'Combo fijo de prueba',
  promoType:'combo',price:7000,rollCount:0,piecesPerRoll:12,sauceCount:0,
  korokes:0,payments:['efectivo','debito'],available:true,description:''},
 {sku:'promo:12345678-0000-4000-8000-333333333333',name:'Gohan fijo de prueba',
  promoType:'gohan',price:6000,rollCount:0,piecesPerRoll:12,sauceCount:0,
  korokes:0,payments:['debito'],available:true,description:''}
);
data.discounts['promo:12345678-0000-4000-8000-111111111111']=10;
const view=()=>proyectarVistaAdminRomoQA(original,{
 store_id:'romo:serena',revision:4,contenido:data
},[]);
const roll=(protein='Pollo')=>({protein,vegetable:'Palta',wrap:'Panko',vegetariano:false});
const req=(items,payment='efectivo')=>({
 action:'simularMixto',revisionComercial:1,revisionAdministracion:4,payment,items
});
const sushi={sku:data.promotions[0].sku,qty:2,
 config:{rolls:[roll(),roll('Camarón')],sauces:['Soya']}};
test('suma producto de panel con promoción armada y recalcula recargos',()=>{
 const out=simularCarritoMixtoRomoQA(view(),req([
  {sku:'custom:product-test',qty:1},sushi
 ]));
 assert.equal(out.subtotalProductos,6500+(10800+800)*2);
 assert.equal(out.qtyTotal,3);
 assert.equal(out.lineas[1].recargos,800);
 assert.equal(out.promocionesConfiguradas,true);
 assert.equal(out.countsAsSale,false);
 assert.equal(out.canSendOrder,false);
 assert.equal(out.canPay,false);
 assert.equal(out.totalComercial,null);
});
test('combo fijo sin rolls se puede incluir con producto sencillo, sin inventar receta',()=>{
 const out=simularCarritoMixtoRomoQA(view(),req([
  {sku:'dish:papitas',qty:1},
  {sku:data.promotions[1].sku,qty:2,config:{}}
 ]));
 assert.equal(out.subtotalProductos,8200+14000);
 assert.equal(out.lineas[1].promoType,'combo');
 assert.equal(out.lineas[1].requiereArmado,false);
});
test('gohan fijo sin personalización solo permite pagos declarados',()=>{
 assert.throws(()=>simularCarritoMixtoRomoQA(view(),req([
  {sku:data.promotions[2].sku,qty:1,config:{}}
 ])),/ficha|pago/);
 const out=simularCarritoMixtoRomoQA(view(),req([
  {sku:data.promotions[2].sku,qty:1,config:{}}
 ],'debito'));
 assert.equal(out.subtotalProductos,6000);
});
test('no acepta rolls sin personalizar, productos originales con armado o promociones falsas',()=>{
 const v=view();
 assert.throws(()=>simularCarritoMixtoRomoQA(v,req([
  {sku:'classic:24',qty:1}
 ])),/armado original/);
 assert.throws(()=>simularCarritoMixtoRomoQA(v,req([
  {sku:'dish:gohan-pollo',qty:1}
 ])),/armado original/);
 assert.throws(()=>simularCarritoMixtoRomoQA(v,req([
  {sku:sushi.sku,qty:1}
 ])),/configuración/);
 assert.throws(()=>simularCarritoMixtoRomoQA(v,req([
  {sku:sushi.sku,qty:1,config:{}}
 ])),/rolls|completar/);
 assert.throws(()=>simularCarritoMixtoRomoQA(v,req([
  {sku:'promo:otra-empresa',qty:1,config:{}}
 ])),/desconocido/);
});
test('los descuentos y promociones requieren la revisión exacta y no aceptan precios externos',()=>{
 assert.throws(()=>simularCarritoMixtoRomoQA(view(),{
  ...req([{sku:'custom:product-test',qty:1}]),
  revisionAdministracion:3
 }),/versión/);
 assert.throws(()=>simularCarritoMixtoRomoQA(view(),req([
  {sku:'custom:product-test',qty:1,price:5}
 ])),/Línea inválida/);
 assert.throws(()=>simularCarritoMixtoRomoQA(view(),req([
  {sku:'custom:product-test',qty:1},
  {sku:'custom:product-test',qty:1}
 ])),/repetido/);
 assert.throws(()=>simularCarritoMixtoRomoQA(view(),req([
  {sku:data.promotions[1].sku,qty:1,config:{rolls:[]}}
 ])),/fija/);
});
