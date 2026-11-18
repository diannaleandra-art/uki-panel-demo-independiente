'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const {validarGohanRomoQA}=require('../lib/romo-gohan-qa.cjs');
const {prepararIngredientesRomoQA,calcularRecargosRomoQA}=require('../lib/romo-ingredientes-armado-qa.cjs');
function view(){
 const list=[
 ['Salsas','Soya',{salsas_incluidas:0}],['Salsas','Teriyaki',{salsas_incluidas:0}],
 ['Vegetales','Palta',{clasicas:0}],['Vegetales','Cebollín',{clasicas:0}],
 ['Vegetales','Pepino',{clasicas:0}],['Vegetales','Tomate',{clasicas:0}],
 ...Array.from({length:20},(_,i)=>['Vegetales','Otro'+i,{clasicas:0}])
 ];
 return {ok:true,storeId:'romo:serena',readOnly:true,draftOnly:true,publishable:false,
  products:['gohan-vegetariano','gohan-pollo','gohan-camaron','gohan-salmon'].map(id=>({
    sku:'dish:'+id,available:true,draftOnly:false})),
  ingredients:list.map(([category,name,contexts])=>({
    sku:'ingredient:'+category+':'+name,name,category,contexts,available:true,draftOnly:false}))
 };
}
const order=(productId,vegetables)=>({kind:'dish',productId,qty:1,vegetables,sauce:'Soya'});
test('gohan con proteína acepta un vegetal y salsa incluida',()=>{
 const v=view(),i=order('gohan-pollo',['Cebollín']);
 assert.equal(validarGohanRomoQA(v,i).vegetales,1);
 assert.deepEqual(prepararIngredientesRomoQA(v,i).normalizado,i);
});
test('gohan vegetariano exige dos vegetales distintos y no acepta palta duplicada',()=>{
 const v=view();
 assert.equal(validarGohanRomoQA(v,order('gohan-vegetariano',['Cebollín','Pepino'])).vegetales,2);
 assert.throws(()=>validarGohanRomoQA(v,order('gohan-vegetariano',['Cebollín'])),/Completa/);
 assert.throws(()=>validarGohanRomoQA(v,order('gohan-vegetariano',['Pepino','Pepino'])),/distintos/);
 assert.throws(()=>validarGohanRomoQA(v,order('gohan-vegetariano',['Palta','Pepino'])),/incluida/);
});
test('vegetal nuevo respeta disponibilidad, no se pierde selección y suma solo el recargo',()=>{
 const v=view();
 v.ingredients.push({sku:'ingredient:qa:frutilla',name:'Frutilla',category:'vegetal',
  surcharge:400,surfaces:['gohan'],available:true,draftOnly:true});
 const i=order('gohan-vegetariano',['Cebollín','Frutilla']);
 validarGohanRomoQA(v,i);
 const normalized=prepararIngredientesRomoQA(v,i).normalizado;
 assert.notEqual(normalized.vegetables[0],normalized.vegetables[1]);
 assert.deepEqual(i.vegetables,['Cebollín','Frutilla']);
 assert.equal(calcularRecargosRomoQA(v,i,{extrasModelo:0,
  componentesModelo:{surcharge:0,sauceExtra:0,toppingExtra:0,rolls:[]}}),400);
 v.ingredients[v.ingredients.length-1].available=false;
 assert.throws(()=>validarGohanRomoQA(v,i),/no disponible/);
});
test('rechaza cambios ilegales de producto o salsa y evita encargos',()=>{
 const v=view();
 assert.throws(()=>validarGohanRomoQA(v,order('gohan-otro',['Cebollín'])),/Completa/);
 assert.throws(()=>validarGohanRomoQA(v,{...order('gohan-pollo',['Cebollín']),sauce:'Wasabi'}),/Completa/);
 assert.throws(()=>validarGohanRomoQA(v,{...order('gohan-pollo',['Cebollín']),payment:'efectivo'}),/Completa/);
 v.products.find(x=>x.sku==='dish:gohan-pollo').available=false;
 assert.throws(()=>validarGohanRomoQA(v,order('gohan-pollo',['Cebollín'])),/no disponible/);
});
