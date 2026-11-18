'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepararCartaRomoQA}=require('../lib/romo-carta-prepublicacion-qa.cjs');
const {empty}=require('../lib/romo-carta-administracion-qa.cjs');
const {proyectarVistaAdminRomoQA}=require('../lib/romo-carta-vista-previa-admin-qa.cjs');
const carta={
 storeId:'romo:serena',readOnly:true,revision:1,
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?'classic:24':'dish:entrada-'+i,
  kind:i===0?'classic':'dish',name:'Producto '+i,
  price:8000+i*100,available:true,description:'',
  categoriaSlug:i===0?'clasicas':'entradas'
 })),
 categories:[{slug:'clasicas',nombre:'Clásicas'},{slug:'entradas',nombre:'Entradas'},
  {slug:'mensual',nombre:'Promociones'},{slug:'fusion',nombre:'Fusión'},
  {slug:'premium',nombre:'Premium'}],
 ingredients:Array.from({length:22},(_,i)=>({
  sku:'ingredient:'+i,category:'Vegetales',name:'Vegetal '+i,
  contexts:{clasicas:0},available:true
 }))
};
const data=empty();
data.categories=[{slug:'nueva',nombre:'Nueva'}];
data.products=[{sku:'custom:12345678-0000-4000-8000-111111111111',
 name:'Entrada propia',price:6500,description:'Con palta',available:true,
 categoriaSlug:'nueva'}];
data.promotions=[{sku:'promo:12345678-0000-4000-8000-222222222222',
 name:'Sushi Romo QA',price:12000,description:'',available:true,
 promoType:'sushi',rollCount:2,piecesPerRoll:12,sauceCount:1,
 korokes:0,payments:['efectivo','transferencia']}];
const projection=()=>proyectarVistaAdminRomoQA(carta,{
 store_id:'romo:serena',revision:4,contenido:data
},[]);
test('genera propuesta de catálogo sin escribir ni autorizar publicación',()=>{
 const v=projection(),orig=JSON.stringify(v);
 const pkg=prepararCartaRomoQA(v,{data});
 assert.equal(pkg.publishable,false);
 assert.equal(pkg.draftOnly,true);
 assert.equal(pkg.readOnly,true);
 assert.equal(pkg.items.length,42);
 assert.equal(pkg.summary.nuevos,2);
 assert.equal(pkg.revisionAdministracion,4);
 assert.equal(pkg.items[40].sku,'dish:romoq-12345678-0000-4000-8000-111111111111');
 assert.equal(pkg.items[40].group,'entradas');
 assert.equal(pkg.items[41].sku,'monthly:romoq-12345678-0000-4000-8000-222222222222');
 assert.equal(pkg.items[41].config.rollCount,2);
 assert.equal(pkg.items[41].config.size,24);
 assert.equal(pkg.items[41].group,'promos');
 assert.ok(pkg.pendientes.some(x=>x.includes('autorización')));
 assert.equal(JSON.stringify(v),orig);
});
test('advierte que descuentos, fotos e ingredientes requieren adaptador publico',()=>{
 const d=structuredClone(data);
 d.discounts[d.products[0].sku]=15;
 d.ingredients=[{sku:'ingredient:own',name:'Nuevo vegetal',
  category:'vegetal',surcharge:200,surfaces:['classic'],available:true}];
 const v=proyectarVistaAdminRomoQA(carta,{
  store_id:'romo:serena',revision:4,contenido:d
 },[{sku:'classic:24',version:2}]);
 const pkg=prepararCartaRomoQA(v,{data:d});
 assert.ok(pkg.pendientes.some(x=>x.includes('precio original tachado')));
 assert.ok(pkg.pendientes.some(x=>x.includes('Vincular fotografías')));
 assert.ok(pkg.pendientes.some(x=>x.includes('ingredientes editados')));
 assert.equal(pkg.publishable,false);
});
test('nunca convierte las promociones de Junaeb en promociones publicables sin soporte',()=>{
 const d=structuredClone(data);
 d.promotions[0].payments=['junaeb'];
 const v=proyectarVistaAdminRomoQA(carta,{
  store_id:'romo:serena',revision:4,contenido:d
 },[]);
 const pkg=prepararCartaRomoQA(v,{data:d});
 assert.ok(pkg.pendientes.some(x=>x.includes('Junaeb')));
 assert.equal(pkg.publishable,false);
});
test('rechaza productos con IDs no reconocidos o de otra sucursal',()=>{
 const v=projection();v.products[40].sku='pizza:12345678';
 assert.throws(()=>prepararCartaRomoQA(v,{data}),/SKU|Identificador/);
 const other=structuredClone(projection());other.storeId='uki:serena';
 assert.throws(()=>prepararCartaRomoQA(other,{data}),/no verificada/);
});
