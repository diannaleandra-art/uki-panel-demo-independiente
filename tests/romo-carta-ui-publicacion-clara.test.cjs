'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const gestion=fs.readFileSync(path.join(root,'public/romo-panel-qa/romo-carta-gestion-completa-qa.js'),'utf8');
const editionPath=path.join(root,'lib/romo-carta-ediciones-seguras-qa.mjs');
test('Productos de Romo se muestran plegados y legibles, sin encabezados generales oscuros',()=>{
 assert.match(gestion,/const head=css\(E\(collapsible\?'summary':'div'\)/);
 assert.doesNotMatch(gestion,/const head=css\(E\(collapsible\?'summary':'header'\)/);
 assert.match(gestion,/background:#fff!important;color:#241e21!important/);
 assert.match(gestion,/p\._base\?'Carta vigente':'Borrador',true\)/);
 assert.doesNotMatch(gestion,/p\._base\?'Carta vigente':'Borrador',false\)/);
 assert.match(gestion,/const newCard=panel\('＋ Agregar producto a Romo'\)/);
});
test('Ingredientes mantienen buscar, crear, editar y eliminar sin tarjeta duplicada',()=>{
 const a=gestion.indexOf('function renderIngredients(){');
 const b=gestion.indexOf('function desajustePiezas(',a);
 assert.ok(a>=0&&b>a);
 const source=gestion.slice(a,b);
 for(const t of ['ingredient-create','ingredient-edit','ingredient-delete','ingredient-availability','ingredient-base-edit'])
  assert.ok(source.includes(t),'Falta '+t);
 assert.match(source,/item\.append\(f,actions\);list\.append\(item\)/);
 assert.doesNotMatch(source,/card\.append\(item,actions\)/);
});
function diagnostico(){
 const inicio=gestion.indexOf(' function desajustePiezas('),fin=gestion.indexOf(' function promoPublicada(',inicio);
 assert.ok(inicio>=0&&fin>inicio);
 return vm.runInNewContext(gestion.slice(inicio,fin)+'\ndesajustePiezas;',{}, {timeout:1000});
}
test('108 piezas exige 9 rolls de 12, sin alterar precio ni salsas',()=>{
 const f=diagnostico(),promo={name:'Familiar 108 piezas la más vendida',
  price:27000,promoType:'sushi',rollCount:8,piecesPerRoll:12,sauceCount:8};
 const alerta=f(promo);
 assert.equal(alerta.esperadas,108);
 assert.equal(alerta.actuales,96);
 assert.equal(alerta.rollsPropuestos,9);
 assert.equal(f({...promo,rollCount:9}),null);
 assert.equal(f({...promo,promoType:'combo'}),null);
 assert.equal(f({...promo,name:'Familiar',rollCount:8}),null);
});
test('Publicar borrador comprueba foto, guarda corrección, publica y verifica',()=>{
 assert.match(gestion,/async function publicarEnUnPaso\(p,retirar=false\)/);
 const a=gestion.indexOf(' async function publicarEnUnPaso('),b=gestion.indexOf(' function promotionForm(',a);
 const code=gestion.slice(a,b);
 for(const term of ["photoRequest('GET'","action:'promotion-edit'","publicarPromocion(p.sku,retirar,revision)","const final=await request('GET')","estado"]){} 
 assert.match(code,/photoRequest\('GET',null,p\.sku\)/);
 assert.match(code,/fields:\{id:p\.sku,item:datosPromoParaGuardar\(p,diferencia\.rollsPropuestos\)\}/);
 assert.match(code,/publicarPromocion\(p\.sku,retirar,revision\)/);
 assert.match(code,/const final=await request\('GET'\)/);
 assert.match(gestion,/Pendientes de publicación/);
 assert.match(gestion,/no las crees de nuevo/);
});
test('La descripción con viñetas de asterisco es admisible en el catálogo comercial, sin permitir controles',async()=>{
 const {vistaEdicionesRomoQA}=await import('../lib/romo-carta-ediciones-seguras-qa.mjs');
 const categories=['entradas','mensual','clasicos','premium','salsas'].map(slug=>({slug,nombre:'Categoría '+slug}));
 const products=Array.from({length:40},(_,i)=>({sku:'dish:prueba-'+i,name:'Referencia '+i,
  price:3500+i,categoriaSlug:'entradas'}));
 const ingredients=Array.from({length:20},(_,i)=>({sku:'ing:'+i,name:'Ingrediente '+i}));
 const carta={ok:true,storeId:'romo:serena',brand:'romo',branch:'serena',
  readOnly:true,source:'carta-aprobada-en-codigo',categories,products,ingredients};
 const base_sha256=createHash('sha256').update(JSON.stringify({storeId:'romo:serena',categories,products,ingredients})).digest('hex');
 const promo={sku:'monthly:romoq-036c69f1-1769-45c4-8aaa-2d814c206b2a',
  name:'Familiar 108 piezas la más vendida',description:'Pollo * Kanikama · 9 rolls',
  price:27000,available:true,categoriaSlug:'mensual',photoVersion:1,
  config:{promoType:'sushi',rollCount:9,piecesPerRoll:12,sauceCount:8,korokes:0,payments:['efectivo','transferencia']}};
 const mk=p=>({store_id:'romo:serena',revision:2,base_sha256,
  contenido:{storeId:'romo:serena',revision:2,overrides:{},
   gestion:{categories:[],products:[],promotions:[p]}}});
 const r=vistaEdicionesRomoQA(carta,mk(promo));
 assert.equal(r.publishedPromotions.length,1);
 assert.equal(r.publishedPromotions[0].config.rollCount,9);
 assert.throws(()=>vistaEdicionesRomoQA(carta,mk({...promo,description:'Línea\nrota'})));
});
