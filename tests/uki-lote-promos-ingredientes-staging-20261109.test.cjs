'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const api=require('../api/uki-carta-precios-live.js')._testing;
const fotos=require('../api/uki-carta-fotos-live.js')._test;
function mock(){
 const queries=[];
 const sql={query:async(stmt,params)=>{
  queries.push({stmt,branch:params[0]});
  if(stmt.includes('uki_carta_promos_custom_v1'))
   return [{sku:'monthly:promo-qa-12345678',name:'Promo QA',description:'Sólo prueba',
    price:15000,available:true,visible:false,version:1,roll_count:5,
    pieces_per_roll:12,size:60,sauce_count:4,korokes:2,payments:['efectivo']}];
  return [];
 }};
 return {sql,queries};
}
test('Sin bandera no consulta tablas no migradas ni modifica precios originales',async()=>{
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true'}),false);
 const {sql,queries}=mock();
 const items=await api.listing(sql,'arica',false);
 assert.ok(items.length>0);
 assert.ok(queries.every(q=>!q.stmt.includes('uki_carta_promos_custom_v1')&&!q.stmt.includes('uki_carta_visibilidad_v1')));
 assert.ok(items.every(i=>i.kind!=='ingredient'));
 assert.ok(items.every(i=>i.visible===true));
});
test('La bandera requiere backend oficial y no basta activarla por accidente',()=>{
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'production',UKI_PROMOS_VISIBILIDAD_ENABLED:'true'}),false);
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'production',UKI_PROMOS_VISIBILIDAD_ENABLED:'true',UKI_INVENTARIO_LIVE_ENABLED:'true'}),true);
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'preview',UKI_PROMOS_VISIBILIDAD_ENABLED:'true'}),false);
});
test('Una vez migrado y habilitado, cada promoción consulta su sucursal y nace oculta',async()=>{
 for(const branch of ['arica','serena']){
  const {sql,queries}=mock();
  const items=await api.listing(sql,branch,true);
  const p=items.find(i=>i.sku==='monthly:promo-qa-12345678');
  assert.ok(p);
  assert.equal(p.visible,false);
  assert.equal(p.config.rollCount,5);
  assert.equal(p.config.size,60);
  assert.equal(p.config.korokes,2);
  assert.ok(queries.every(q=>q.branch===branch));
  assert.ok(queries.some(q=>q.stmt.includes('uki_carta_visibilidad_v1')));
 }
});
test('Promociones requieren recargos y armado coherente',()=>{
 const item={name:'Promo 60',description:'Pollo',price:16000,
  rollCount:5,piecesPerRoll:12,sauceCount:3,korokes:2,payments:['efectivo']};
 const ok=api.validPromo(item);
 assert.equal(ok.rollCount,5);
 assert.equal(ok.piecesPerRoll,12);
 assert.equal(api.validPromo({...item,rollCount:0}),null);
 assert.equal(api.validPromo({...item,price:-1000}),null);
 assert.equal(api.validPromo({...item,piecesPerRoll:13}),null);
});
test('Fotos normales no consultan promociones mientras la bandera está deshabilitada',async()=>{
 const sql={query:async(q)=>{if(q.includes('uki_carta_promos_custom_v1'))throw Error('NO DEBE CONSULTAR TABLA NUEVA');return [];}};
 assert.equal(fotos.promocionesHabilitadas({}),false);
 assert.equal(await fotos.productExists(sql,'arica','pizza:no-existe',{}),false);
});
test('El panel mantiene el retiro antiguo y no presenta promociones hasta activar API',()=>{
 const code=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
 assert.doesNotThrow(()=>new vm.Script(code));
 assert.match(code,/state\.promocionesHabilitadas=data\.promocionesHabilitadas===true/);
 assert.match(code,/promoBox\.hidden=!state\.promocionesHabilitadas/);
 assert.match(code,/else if\(price\.custom\)/);
 assert.match(html,/uki-carta-precios-admin\.js/);
 assert.match(html,/uki-armado-ingredientes-admin\.js/);
 assert.match(html,/function vPedidos\(\)/);
 assert.match(html,/function cancelarPedido|async function cancelarPedido/);
});
test('Migración es aditiva y aislada de pedidos, ventas y cajas',()=>{
 const sql=fs.readFileSync('sql/uki-carta-promos-visibilidad-v1.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.uki_carta_promos_custom_v1/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.uki_carta_visibilidad_v1/);
 assert.match(sql,/PRIMARY KEY\(branch,sku\)/);
 assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|DELETE FROM|ALTER TABLE public\.uki_pedidos)\b/i);
});
