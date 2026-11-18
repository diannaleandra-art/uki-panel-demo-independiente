'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {simularPromocionRomoQA}=require('../lib/romo-promocion-armado-qa.cjs');
const approved=[
 ['Proteínas','Pollo',{clasicas:0}],
 ['Proteínas','Kanicama',{clasicas:0}],
 ['Proteínas','Camarón',{clasicas:800,mensual_extra:800}],
 ['Proteínas','Cerdo',{clasicas:0,mensual_extra:0}],
 ['Vegetales','Palta',{clasicas:0}],
 ['Vegetales','Cebollín',{clasicas:0}],
 ['Vegetales','Pepino',{clasicas:0}],
 ['Envolturas','Panko',{clasicas:0}],
 ['Envolturas','Tempura',{clasicas:0}],
 ['Envolturas','Palta',{clasicas:1000,mensual_extra:1000}],
 ['Salsas','Soya',{salsas_incluidas:0}],
 ['Salsas','Teriyaki',{salsas_incluidas:0}]
];
const view=()=>({
 ok:true,storeId:'romo:serena',draftOnly:true,publishable:false,readOnly:true,
 revisionComercial:1,revisionAdministracion:3,
 products:[...Array.from({length:40},(_,i)=>({
  sku:'dish:'+i,kind:'dish',name:'Producto '+i,
  precioOriginal:5000,precioFinal:5000,available:true,draftOnly:false
 })),{
  sku:'promo:12345678-0000-4000-8000-123456789012',kind:'monthly',
  name:'Promoción propia Romo',promoType:'sushi',rollCount:2,
  piecesPerRoll:12,sauceCount:1,korokes:2,
  payments:['efectivo','transferencia'],
  precioOriginal:12000,precioFinal:10800,
  available:true,draftOnly:true
 }],
 ingredients:[
  ...approved.map(([category,name,contexts])=>({
   sku:'ingredient:'+category+':'+name,category,name,contexts,
   draftOnly:false,available:true
  })),
  ...Array.from({length:9},(_,i)=>({
   sku:'ingredient:Vegetales:Otro'+i,
   name:'Otro'+i,category:'Vegetales',contexts:{clasicas:0},
   draftOnly:false,available:true
  }))
 ]
});
const roll=(protein='Pollo',vegetable='Palta',wrap='Panko')=>({
 protein,vegetable,wrap,vegetariano:false
});
const input=(qty=2)=>({
 action:'simularPromocion',sku:'promo:12345678-0000-4000-8000-123456789012',
 qty,revisionComercial:1,revisionAdministracion:3,
 rolls:[roll(),roll('Camarón','Cebollín')],
 sauces:['Soya'],payment:'efectivo'
});
test('valida dos rolls, recargo de camarón, descuento y pago sin registrar pedido',()=>{
 const r=simularPromocionRomoQA(view(),input());
 assert.equal(r.piezas,24);
 assert.equal(r.korokes,2);
 assert.equal(r.recargosArmado,800);
 assert.equal(r.baseConDescuento,10800);
 assert.equal(r.unitarioReferencia,11600);
 assert.equal(r.subtotalProductos,23200);
 assert.equal(r.canSendOrder,false);
 assert.equal(r.canPay,false);
 assert.equal(r.countsAsSale,false);
 assert.equal(r.totalComercial,null);
 assert.equal(r.rolls.length,2);
});
test('respeta recargos editados y ingredientes propios de Romo',()=>{
 const v=view();
 v.ingredients.find(x=>x.name==='Camarón').contexts.mensual_extra=1300;
 const first=simularPromocionRomoQA(v,input(1));
 assert.equal(first.recargosArmado,1300);
 v.ingredients.push({
  sku:'ingredient:own',name:'Tomate cherry',category:'vegetal',
  surcharge:450,surfaces:['monthly'],available:true,draftOnly:true
 });
 const raw=input(1);
 raw.rolls[0].vegetable='Tomate cherry';
 const custom=simularPromocionRomoQA(v,raw);
 assert.equal(custom.recargosArmado,1750);
});
test('rechaza agotados, alteraciones y medio de pago no aprobado',()=>{
 const v=view();
 v.ingredients.find(x=>x.name==='Camarón').available=false;
 assert.throws(()=>simularPromocionRomoQA(v,input()),/agotado/);
 assert.throws(()=>simularPromocionRomoQA(view(),{...input(),payment:'junaeb'}),/pago|Configuración/);
 assert.throws(()=>simularPromocionRomoQA(view(),{...input(),revisionAdministracion:2}),/actualiza/);
 assert.throws(()=>simularPromocionRomoQA(view(),{...input(),price:1}),/actualiza/);
 assert.throws(()=>simularPromocionRomoQA(view(),{...input(),sauces:[]}),/completar/);
 assert.throws(()=>simularPromocionRomoQA(view(),{...input(),rolls:[roll()]}),/completar/);
});
test('valida vegetariano, dos vegetales distintos y prohibición de envolver con carne',()=>{
 const one={...input(1)};
 one.rolls=[{protein:'',vegetable:'Palta',vegetable2:'Cebollín',
  wrap:'Panko',vegetariano:true},roll()];
 const ok=simularPromocionRomoQA(view(),one);
 assert.equal(ok.rolls[0].vegetariano,true);
 one.rolls[0].vegetable2='Palta';
 assert.throws(()=>simularPromocionRomoQA(view(),one),/distintos/);
 one.rolls[0].vegetable2='Cebollín';
 one.rolls[0].protein='Pollo';
 assert.throws(()=>simularPromocionRomoQA(view(),one),/sin proteína/);
});
test('no acepta promociones anteriores, pizzas ni cualquier producto de otra tienda',()=>{
 const v=view();
 v.products[v.products.length-1].promoType='pizza';
 assert.throws(()=>simularPromocionRomoQA(v,input()),/Solo promociones/);
 assert.throws(()=>simularPromocionRomoQA(view(),{
  ...input(),sku:'promo:desconocido-01234'
 }),/Solo promociones/);
 const a=view();
 a.products[a.products.length-1].available=false;
 assert.throws(()=>simularPromocionRomoQA(a,input()),/Solo promociones/);
});
