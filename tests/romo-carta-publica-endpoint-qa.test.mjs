import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizarCatalogoCompletoRomoQA,vistaCartaRomoQA} from '../lib/romo-editor-carta-compatibilidad-qa.mjs';
const file=JSON.parse(readFileSync(new URL('../data/romo-carta-origen-aprobado-20261112.json',import.meta.url),'utf8'));
const doc=normalizarCatalogoCompletoRomoQA(file.catalog);
const src=readFileSync(new URL('../api/romo-carta-publica-qa.js',import.meta.url),'utf8');
const origin='https://romo-menu.example';
const env={VERCEL_ENV:'production',ROMO_CARTA_ALLOWED_ORIGIN:origin,
 ROMO_CARTA_PUBLICA_LIVE_ENABLED:'true'};
function fake(){
 const counters={reads:0,dbConnections:0},module={exports:{}};
 const db={async query(sql,params){
  counters.reads++;
  assert.match(sql,/^SELECT revision,contenido FROM public\.romo_catalogo_v1/);
  assert.deepEqual(params,['romo:serena']);
  return [{revision:1,contenido:doc}];
 }};
 const reading={romoPrivateReadConfig:()=>({storeId:'romo:serena',url:'postgresql://qa:fake@private-neon.example/romos_sushi'})};
 const repository={async leerCartaPublicaRomoQA({db:instance}){
  return vistaCartaRomoQA((await instance.query('SELECT revision,contenido FROM public.romo_catalogo_v1 WHERE store_id=$1',['romo:serena']))[0].contenido);
 }};
 const content=src
  .replace("await import('../lib/romo-claves-lectura-servidor-qa.mjs')","await Promise.resolve(readingMock)")
  .replace("await import('../lib/romo-editor-carta-repositorio-qa.mjs')","await Promise.resolve(repositoryMock)");
 new Function('module','process','require','readingMock','repositoryMock',content)(
  module,{env},name=>{
   assert.equal(name,'@neondatabase/serverless');
   return {neon:url=>{
    assert.match(url,/\/romos_sushi$/);counters.dbConnections++;
    return Object.assign(()=>{}, {query:db.query});
   }};
  },reading,repository
 );
 return {run:module.exports,counters};
}
function response(){
 return {code:0,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this},
  status(n){this.code=n;return this},json(x){this.body=x;return this},
  end(){this.ended=true;return this}};
}
async function invoke(handler,method='GET',requestOrigin=origin){
 const res=response();
 await handler({method,headers:{origin:requestOrigin},query:{}},res);
 return res;
}
test('catalogo borrador no filtra precios ni promociones a carta publica',()=>{
 const publicView=vistaCartaRomoQA(doc);
 assert.equal(publicView.products.length,0);
 assert.equal(publicView.promotions.length,0);
 assert.equal(publicView.ingredients.length,0);
 assert.equal(publicView.storeId,'romo:serena');
});
test('muestra únicamente fichas Romo visibles y conserva descuentos con precio original',()=>{
 const partial=structuredClone(doc);
 partial.products[0].visible=true;
 partial.products[0].discountPercent=10;
 partial.promotions[0].visible=true;
 partial.ingredients[0].visible=true;
 const view=vistaCartaRomoQA(partial);
 assert.equal(view.products.length,1);
 assert.equal(view.promotions.length,1);
 assert.equal(view.ingredients.length,1);
 assert.equal(view.products[0].price,7200);
 assert.equal(view.products[0].precioOriginal,8000);
 assert.equal(view.products[0].descuentoPorcentaje,10);
 assert.ok(JSON.stringify(view).includes('uki:arica')===false);
});
test('sin activar env o en preview no acepta consultas',async()=>{
 const {run,counters}=fake();
 const old=env.ROMO_CARTA_PUBLICA_LIVE_ENABLED;
 try{
  env.ROMO_CARTA_PUBLICA_LIVE_ENABLED='false';
  const denied=await invoke(run);
  assert.equal(denied.code,503);
  assert.equal(counters.dbConnections,0);
 }finally{env.ROMO_CARTA_PUBLICA_LIVE_ENABLED=old}
});
test('origen ajeno no hace consultas, y POST no puede editar catalogo',async()=>{
 const {run,counters}=fake();
 const alien=await invoke(run,'GET','https://uki.example');
 assert.equal(alien.code,503);
 const post=await invoke(run,'POST');
 assert.equal(post.code,405);
 assert.equal(counters.dbConnections,0);
});
test('GET correcto devuelve solo lectura, ninguna ficha de borrador ni cuentas',async()=>{
 const {run,counters}=fake();
 const ok=await invoke(run);
 assert.equal(ok.code,200);
 assert.equal(ok.body.ok,true);
 assert.equal(ok.body.storeId,'romo:serena');
 assert.equal(ok.body.products.length,0);
 assert.equal(ok.body.promotions.length,0);
 assert.equal(ok.body.ingredients.length,0);
 assert.equal(ok.body.owner,undefined);
 assert.equal(ok.body.orders,undefined);
 assert.equal(ok.headers['Access-Control-Allow-Methods'],'GET,OPTIONS');
 assert.equal(counters.reads,1);
});
