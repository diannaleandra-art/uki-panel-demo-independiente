'use strict';
/* Pruebas puras de vista previa privada: jamás consultan Neon ni publican. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {empty}=require('../lib/romo-carta-administracion-qa.cjs');
const {proyectarVistaAdminRomoQA}=require('../lib/romo-carta-vista-previa-admin-qa.cjs');
const carta={
 storeId:'romo:serena',readOnly:true,revision:1,
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?'classic:24':i===1?'monthly:promo-60':'dish:'+i,
  name:i===0?'Sushi 24':i===1?'Promo 60':'Plato '+i,
  kind:i===0?'classic':i===1?'monthly':'dish',
  sourceId:String(i),price:8000+i*100,available:true,
  categoriaSlug:i===0?'clasicas':i===1?'mensual':'entradas',
  description:'',...(i===1?{rollCount:5,payments:['efectivo']}:{})
 })),
 categories:[{slug:'clasicas',nombre:'Clásicas'},{slug:'premium',nombre:'Premium'},
  {slug:'mensual',nombre:'Promociones'},{slug:'entradas',nombre:'Entradas'},
  {slug:'handroll',nombre:'Handroll'}],
 ingredients:Array.from({length:21},(_,i)=>({
  sku:'ingredient:'+i,name:'Ingrediente '+i,category:'Vegetales',
  contexts:{clasicas:0},available:true
 }))
};
const makeRow=payload=>({store_id:'romo:serena',revision:2,contenido:payload});
test('con cero borradores conserva 40 productos y no publica',()=>{
 const copy=JSON.stringify(carta);
 const view=proyectarVistaAdminRomoQA(carta,makeRow(empty()),[]);
 assert.equal(view.summary.totalProducts,40);
 assert.equal(view.summary.newProducts,0);
 assert.equal(view.summary.newPromotions,0);
 assert.equal(view.publishable,false);
 assert.equal(view.draftOnly,true);
 assert.equal(view.products[0].price,8000);
 assert.equal(view.promotions.length,1);
 assert.equal(view.promotions[0].rollCount,5);
 assert.equal(JSON.stringify(carta),copy);
});
test('proyecta categorías, nuevos productos, descuentos, recargos y fotos',()=>{
 const data=empty();
 data.categories.push({slug:'nueva',nombre:'Nueva'});
 data.assignments['classic:24']='nueva';
 data.baseProductOverrides['classic:24']={price:9000,available:false};
 data.discounts['classic:24']=10;
 data.products.push({sku:'custom:1',name:'Gohan Prueba',kind:'dish',price:6500,
  available:true,description:'',categoriaSlug:'nueva'});
 data.promotions.push({sku:'promo:1',name:'Promo QA',kind:'monthly',price:11000,
  available:true,categoriaSlug:'mensual',description:'',rollCount:2,
  piecesPerRoll:12,sauceCount:1,korokes:2,payments:['efectivo']});
 data.ingredientOverrides['ingredient:1']={contexts:{clasicas:400},available:false};
 const view=proyectarVistaAdminRomoQA(carta,makeRow(data),[{sku:'classic:24',version:2}]);
 assert.equal(view.summary.totalProducts,42);
 assert.equal(view.summary.newProducts,1);
 assert.equal(view.summary.newPromotions,1);
 assert.equal(view.summary.photos,1);
 assert.equal(view.summary.discounts,1);
 assert.equal(view.products[0].price,9000);
 assert.equal(view.products[0].precioFinal,8100);
 assert.equal(view.products[0].categoriaSlug,'nueva');
 assert.equal(view.products[0].photoVersion,2);
 assert.equal(view.products[0].pendingChanges,true);
 assert.equal(view.ingredients[1].contexts.clasicas,400);
 assert.equal(view.ingredients[1].available,false);
 assert.equal(view.categories.length,6);
 assert.equal(view.publishable,false);
});
test('rechaza referencias incompletas, fotos duplicadas y descuentos inválidos',()=>{
 assert.throws(()=>proyectarVistaAdminRomoQA({...carta,products:carta.products.slice(1)},makeRow(empty())));
 assert.throws(()=>proyectarVistaAdminRomoQA(carta,makeRow(empty()),
  [{sku:'classic:24',version:1},{sku:'classic:24',version:2}]));
 const data=empty();data.discounts['classic:24']=101;
 assert.throws(()=>proyectarVistaAdminRomoQA(carta,makeRow(data)));
});
