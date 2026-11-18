'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ensamblarArmadoRomoQA}=require('../lib/romo-simular-armado-qa.cjs');
const view={
 ok:true,storeId:'romo:serena',draftOnly:true,publishable:false,
 revisionComercial:1,revisionAdministracion:1,
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?'classic:24':'dish:'+i,kind:i===0?'classic':'dish',
  name:i===0?'24 piezas':'Plato '+i,available:true,
  precioOriginal:i===0?9000:5000,precioFinal:i===0?8100:5000,
  descuentoPorcentaje:i===0?10:0,draftOnly:false
 }))
};
const input={
 action:'simularArmado',revisionComercial:1,revisionAdministracion:1,
 item:{kind:'classic',size:24,qty:2,rolls:[],sauces:[]}
};
const modelo={
 ok:true,storeId:'romo:serena',previewOnly:true,
 canSendOrder:false,countsAsSale:false,sku:'classic:24',
 precioBaseAprobado:8000,unitarioModelo:8800,extrasModelo:800,cantidad:2
};
const admin={data:{ingredients:[],ingredientOverrides:{}}};
test('combina base aprobada, descuento y extras del motor de Romo, sin venta',()=>{
 const q=ensamblarArmadoRomoQA(view,admin,input,modelo);
 assert.equal(q.subtotalBase,16200);
 assert.equal(q.subtotalExtras,1600);
 assert.equal(q.subtotalProductos,17800);
 assert.equal(q.unitarioReferencia,8900);
 assert.equal(q.countsAsSale,false);
 assert.equal(q.canSendOrder,false);
 assert.equal(q.totalComercial,null);
});
test('rechaza revisiones antiguas o modificación de identidad del producto',()=>{
 assert.throws(()=>ensamblarArmadoRomoQA(view,admin,{...input,revisionAdministracion:0},modelo),/Actualiza|cambió/);
 assert.throws(()=>ensamblarArmadoRomoQA(view,admin,input,{...modelo,sku:'premium:24'}),/coincide/);
 assert.throws(()=>ensamblarArmadoRomoQA(view,admin,input,{...modelo,unitarioModelo:2}),/motor/);
});
test('no cotiza productos agotados, borradores sin receta ni cambios de ingredientes no soportados',()=>{
 const unavailable=structuredClone(view);unavailable.products[0].available=false;
 assert.throws(()=>ensamblarArmadoRomoQA(unavailable,admin,input,modelo),/deshabilitado/);
 // La integración ya no bloquea el carrito solo porque existan cambios de
 // ingredientes: se aplican sobre la proyección validada del catálogo.
 const custom=structuredClone(view);custom.products[0].draftOnly=true;
 assert.throws(()=>ensamblarArmadoRomoQA(custom,admin,input,modelo),/no aprobado/);
});
test('rechaza extras falsificados e importes fuera de rango',()=>{
 assert.throws(()=>ensamblarArmadoRomoQA(view,admin,input,{...modelo,extrasModelo:-1}),/motor/);
 assert.throws(()=>ensamblarArmadoRomoQA(view,admin,input,{...modelo,extrasModelo:600000,unitarioModelo:608000}),/extras/);
});
