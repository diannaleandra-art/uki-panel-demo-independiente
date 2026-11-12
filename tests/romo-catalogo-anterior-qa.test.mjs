import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyRomoCatalogReview,legacySupabaseUrl} from '../lib/romo-catalogo-anterior-lectura-qa.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const endpoint=require('../api/romo-catalogo-qa.js');
function row(o={}){
 return {id:'promo-24',name:'24 piezas',kind:'promo',pieces:24,price:7500,
  available:true,valid_from:null,valid_until:null,sort_order:1,...o};
}
test('consulta sólo las columnas públicas de productos Romo, no pedidos ni datos personales',()=>{
 const link=legacySupabaseUrl();
 assert.ok(link.startsWith('https://awldmutolllpyucvhicc.supabase.co/rest/v1/romos_products?'));
 assert.match(link,/select=/);
 assert.doesNotMatch(link,/orders|customer|phone|service_role|admin|auth\.users/);
});
test('revisión de precio anterior no suma 500 automáticamente ni marca aprobado',()=>{
 const out=legacyRomoCatalogReview([row()]);
 assert.equal(out.productos[0].precioOriginal,7500);
 assert.equal(out.productos[0].precioPropuesto,null);
 assert.equal(out.ajuste500Aplicado,false);
 assert.equal(out.productos[0].requiereRevisionComposicion,true);
 assert.equal(out.productos[0].fotoAsignada,false);
 assert.equal(out.publicacionHabilitada,false);
});
test('extras y promociones originales no se mezclan, ni se importan por defecto',()=>{
 const out=legacyRomoCatalogReview([row(),row({id:'extra-soya',name:'Soya',kind:'extra',pieces:0,price:800,sort_order:2})]);
 assert.equal(out.cuenta,2);assert.equal(out.productos[1].requiereRevisionComposicion,false);
 assert.equal(out.productos[1].importado,false);
});
test('rechaza precios, piezas, SKU duplicados y pizzas',()=>{
 assert.throws(()=>legacyRomoCatalogReview([row({price:-100})]));
 assert.throws(()=>legacyRomoCatalogReview([row({pieces:25})]));
 assert.throws(()=>legacyRomoCatalogReview([row(),row({name:'otro'})]));
 assert.throws(()=>legacyRomoCatalogReview([row({name:'Pizza familiar'})]));
});
test('API preview: por defecto apagada y POST imposible',async()=>{
 const saved={VERCEL_ENV:process.env.VERCEL_ENV,ROMO_IMPORTACION_CATALOGO_QA_ENABLED:process.env.ROMO_IMPORTACION_CATALOGO_QA_ENABLED};
 try{
  process.env.VERCEL_ENV='production';
  process.env.ROMO_IMPORTACION_CATALOGO_QA_ENABLED='true';
  const res={setHeader(){},status(x){this.code=x;return this},json(v){this.body=v;return this}};
  await endpoint({method:'POST',headers:{}},res);
  assert.equal(res.code,503);assert.equal(res.body.ok,false);
 }finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});

test('modo de carta antigua integrado en misma función no se activa en producción',()=>{
 const active={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/romo-catalogo-inventario-sin-publicar-20261111',
  VERCEL_URL:'uki-sushi-inventario-demo.vercel.app',
  ROMO_CATALOGO_QA_ENABLED:'true',ROMO_IMPORTACION_CATALOGO_QA_ENABLED:'true'};
 assert.equal(endpoint._testing.legacyEnabled(active),true);
 assert.equal(endpoint._testing.legacyEnabled({...active,VERCEL_ENV:'production'}),false);
 assert.equal(endpoint._testing.legacyEnabled({...active,ROMO_IMPORTACION_CATALOGO_QA_ENABLED:'false'}),false);
});
