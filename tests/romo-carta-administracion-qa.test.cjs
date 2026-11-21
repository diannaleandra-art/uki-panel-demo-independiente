'use strict';
/* Pruebas sin red, sin datos reales y sin escrituras a Neon. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {empty,read,view,apply}=require('../lib/romo-carta-administracion-qa.cjs');
const base={
 ok:true,storeId:'romo:serena',brand:'romo',branch:'serena',readOnly:true,
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?'classic:24':'dish:'+i,
  name:i===0?'Sushi clásico 24 piezas':'Plato '+i,price:8000+i*100,
  categoriaSlug:i===0?'clasicas':'entradas',kind:i===0?'classic':'dish',
  available:true,description:''
 })),
 categories:[{slug:'clasicas',nombre:'Promociones clásicas'},
  {slug:'entradas',nombre:'Entradas'},{slug:'mensual',nombre:'Promociones'}],
 ingredients:[{sku:'ingredient:Proteínas:Pollo',name:'Pollo',
  category:'Proteínas',contexts:{clasicas:0,premium:200}},
  {sku:'ingredient:Vegetales:Palta',name:'Palta',
  category:'Vegetales',contexts:{clasicas:0}}]
};
const item={name:'Sushi promoción prueba',description:'No comercial',
 price:15500,promoType:'sushi',rollCount:2,piecesPerRoll:12,
 sauceCount:2,korokes:3,payments:['efectivo','debito'],available:true};
test('la revisión 0 es un documento vacío y solo lectura',()=>{
 const x=read({store_id:'romo:serena',revision:0,contenido:{}});
 assert.equal(x.revision,0);
 const page=view({store_id:'romo:serena',revision:0,contenido:{}},base);
 assert.equal(page.draftOnly,true);assert.equal(page.baseCount,40);
 assert.equal(page.data.products.length,0);
});
test('CRUD completo, descuentos e ingredientes no cambian el catálogo original',()=>{
 const original=JSON.stringify(base);let state={revision:1,data:empty()};
 const act=(action,fields)=>{
  const next=apply(state,base,action,fields);
  assert.equal(next.revision,state.revision+1);
  state={revision:next.revision,data:next.data};
 };
 act('category-create',{name:'Prueba Gourmet'});
 assert.equal(state.data.categories[0].slug,'prueba-gourmet');
 assert.throws(()=>apply(state,base,'category-create',{name:'Prueba Gourmet'}));
 act('category-rename',{id:'prueba-gourmet',name:'Prueba Superior'});
 act('category-assign',{id:'classic:24',category:'prueba-gourmet'});
 act('product-base-edit',{id:'classic:24',item:{name:'Sushi clásico 24 piezas',
  description:'',price:8500,available:false}});
 assert.equal(state.data.baseProductOverrides['classic:24'].price,8500);
 act('product-create',{item:{name:'Gohan especial',description:'Con palta',
  price:6800,categoriaSlug:'prueba-gourmet',available:true}});
 const id=state.data.products[0].sku;
 act('product-edit',{id,item:{name:'Gohan XXL',description:'Con palta',
  price:7200,categoriaSlug:'prueba-gourmet',available:true}});
 act('discount-set',{id,percent:15});
 assert.equal(state.data.discounts[id],15);
 act('ingredient-create',{item:{name:'Frutilla test',category:'vegetal',
  surcharge:0,surfaces:['classic','gohan'],available:true}});
 const ingredient=state.data.ingredients[0].sku;
 act('ingredient-edit',{id:ingredient,item:{name:'Frutilla test',
  category:'vegetal',surcharge:200,surfaces:['classic'],available:true}});
 act('ingredient-availability',{id:ingredient,available:false});
 act('ingredient-base-edit',{id:'ingredient:Proteínas:Pollo',
  contexts:{clasicas:300,premium:200},available:false});
 assert.equal(state.data.ingredientOverrides['ingredient:Proteínas:Pollo'].contexts.clasicas,300);
 act('promotion-create',{item});
 const promo=state.data.promotions[0].sku;
 act('promotion-edit',{id:promo,item:{...item,price:14900}});
 act('promotion-delete',{id:promo});
 act('product-delete',{id});
 act('category-delete',{id:'prueba-gourmet'});
 assert.equal(state.data.products.length,0);
 assert.equal(state.data.promotions.length,0);
 assert.equal(state.data.categories.length,0);
 assert.equal(state.revision,17);
 assert.equal(JSON.stringify(base),original);
});
test('rechaza valores, cambios y tipos no permitidos sin mutar los datos',()=>{
 const state={revision:1,data:empty()},original=JSON.stringify(state);
 const rejected=[
 ['category-assign',{id:'classic:24',category:'fantasma'}],
 ['product-base-edit',{id:'classic:24',
   item:{name:'No aprobado',description:'',price:8500,available:false}}],
 ['discount-set',{id:'classic:24',percent:100}],
 ['ingredient-create',{item:{name:'Camarón test',category:'proteina',
   surcharge:1000,surfaces:['gohan'],available:true}}],
 ['ingredient-base-edit',{id:'ingredient:Proteínas:Pollo',
   contexts:{clasicas:300,premium:200,handroll:200},available:true}],
 ['promotion-create',{item:{...item,promoType:'pizza'}}],
 ['product-delete',{id:'classic:24'}]
 ];
 for(const [action,data] of rejected){
  assert.throws(()=>apply(state,base,action,data),undefined,action);
  assert.equal(JSON.stringify(state),original,action);
 }
});

test('Retiro de ingrediente original es persistente y permite restaurar sin mutar la receta',()=>{
 const state={revision:1,data:empty()},id='ingredient:Vegetales:Palta',old=JSON.stringify(base);
 const first=apply(state,base,'ingredient-base-archive',{id});
 assert.deepEqual(first.data.archivedIngredients,[id]);
 assert.equal(first.data.ingredientOverrides[id].available,false);
 const loaded=read({store_id:'romo:serena',revision:first.revision,contenido:first.data});
 assert.deepEqual(loaded.data.archivedIngredients,[id]);
 assert.throws(()=>apply(loaded,base,'ingredient-base-edit',{id,available:true,contexts:{clasicas:0}}),/Restaura primero/);
 const last=apply(loaded,base,'ingredient-base-restore',{id});
 assert.deepEqual(last.data.archivedIngredients,[]);
 assert.equal(last.data.ingredientOverrides[id],undefined);
 assert.equal(JSON.stringify(base),old);
});
