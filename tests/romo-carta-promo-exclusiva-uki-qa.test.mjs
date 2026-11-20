import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vistaEdicionesRomoQA,prepararCambioRomoQA} from '../lib/romo-carta-ediciones-seguras-qa.mjs';

const storeId='romo:serena';
const skuUki='dish:sushi-burger-promo';
const carta={
 ok:true,storeId,brand:'romo',branch:'serena',readOnly:true,
 source:'carta-aprobada-en-codigo',
 categories:['mensual','clasicas','premium','burger','salsas'].map(slug=>({slug,nombre:slug})),
 ingredients:Array.from({length:21},(_,i)=>({sku:'ingredient:'+i,name:'Ingrediente '+i})),
 products:Array.from({length:40},(_,i)=>({
  sku:i===0?skuUki:'dish:romo-'+i,
  kind:'dish',sourceId:i===0?'sushi-burger-promo':'romo-'+i,
  name:i===0?'Sushi Burguer · Promo del mes':'Producto Romo '+i,
  price:i===0?5800:2500+i*100,categoriaSlug:'mensual',available:true
 }))
};
const base=vistaEdicionesRomoQA(carta,null);
const row={store_id:storeId,revision:1,base_sha256:base.baseSha256,
 contenido:{storeId,revision:1,overrides:{}}};
const owner={brand:'romo',role:'duenos',userId:'duenos_test_qa'};

test('Los 40 SKU confirmados mantienen el mismo hash y la promoción Uki se ve no disponible',()=>{
 assert.equal(base.products.length,40);
 assert.equal(base.products.filter(p=>p.available!==false).length,39);
 assert.equal(base.products.find(p=>p.sku===skuUki).available,false);
 assert.equal(base.products.find(p=>p.sku==='dish:romo-1').available,true);
 assert.equal(base.baseSha256,vistaEdicionesRomoQA(carta,row).baseSha256);
 assert.equal(carta.products[0].available,true,'La base aprobada inmutable no se reescribe');
});

test('Ni siquiera una sesión autorizada puede activar o alterar el SKU exclusivo de Uki en Romo',()=>{
 for(const patch of [{available:true},{name:'Promo Romo falsa'},{price:5900}]){
  assert.throws(()=>prepararCambioRomoQA({
   carta,row,expectedRevision:1,baseSha256:base.baseSha256,
   sku:skuUki,patch,motivo:'Control de QA',identity:owner
  }),/promoción Sushi Burguer de Uki no puede editarse/);
 }
 assert.equal(row.revision,1);
 assert.deepEqual(row.contenido.overrides,{});
});

test('No se bloquea inadvertidamente la edición autorizada de otros SKU Romo',()=>{
 const c=prepararCambioRomoQA({
  carta,row,expectedRevision:1,baseSha256:base.baseSha256,
  sku:'dish:romo-1',patch:{available:false},motivo:'Producto agotado',
  identity:owner
 });
 assert.equal(c.revision,2);
 assert.equal(c.sku,'dish:romo-1');
 assert.deepEqual(c.contenido.overrides['dish:romo-1'],{available:false});
});

test('El editor Romo omite la promoción Uki de listas y categorías sin eliminar el registro en Neon',()=>{
 const code=readFileSync(new URL('../public/romo-panel-qa/romo-carta-editor-seguro-qa.js',import.meta.url),'utf8');
 assert.match(code,/SKU_PROMO_SOLO_UKI='dish:sushi-burger-promo'/);
 assert.match(code,/current\.products\.filter\(visibleRomo\)/);
 assert.match(code,/visibleRomo\(p\)&&\(!cat/);
 assert.match(code,/visibleRomo\(x\)&&x\.sku===state\.selectedSku/);
});
