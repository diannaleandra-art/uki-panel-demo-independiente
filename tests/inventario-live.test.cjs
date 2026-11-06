'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {url}=require('../lib/uki-inventario-db-live.cjs');
const pin=require('../lib/uki-inventario-pin-live.cjs');
const core=require('../lib/uki-inventario-core-live.cjs');
const api=require('../api/inventario-turno-live.js');
const main=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../firebase/uki-inventario-turno.html'),'utf8');
const admin=fs.readFileSync(path.join(__dirname,'../firebase/uki-inventario-administracion.html'),'utf8');
const SQL=fs.readFileSync(path.join(__dirname,'../migrations/2026-11-06-uki-inventario-live-aislado.sql'),'utf8');
test('aislamiento absoluto: inventario de producción nunca usa Neon QA ni previews',()=>{
 assert.equal(url({VERCEL_ENV:'preview',UKI_INVENTARIO_LIVE_ENABLED:'true',UKI_INVENTARIO_LIVE_DATABASE_URL:'postgres://u:p@ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech/db'}),null);
 assert.equal(url({VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true',UKI_INVENTARIO_LIVE_DATABASE_URL:'postgres://u:p@ep-lingering-glade-b5m4hfhu.c-7.us-east-2.aws.neon.tech/db'}),null);
 assert.ok(url({VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true',UKI_INVENTARIO_LIVE_DATABASE_URL:'postgres://u:p@ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech/db'}));
 assert.equal(pin.habilitado({VERCEL_ENV:'preview',UKI_INVENTARIO_LIVE_ENABLED:'true'}),false);
 assert.equal(pin.habilitado({VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true'}),true);
});
test('API sólo acepta el sitio real; no permite QR, pruebas ni orígenes terceros',()=>{
 assert.equal(api._testing.permitido('https://uki-sushi-inventario.vercel.app'),true);
 assert.equal(api._testing.permitido('https://uki-sushi-panel.vercel.app'),false);
 assert.equal(api._testing.permitido('https://evil.example'),false);
});
test('el panel sólo suma enlaces al inventario y conserva sus secciones existentes',()=>{
 assert.match(main,/firebase\/uki-inventario-turno\.html/);
 assert.match(main,/firebase\/uki-inventario-administracion\.html/);
 assert.match(main,/uki-operativo-seguridad/);
 assert.match(main,/ukiEstadoOperativo/);
 assert.match(main,/function ukiGuardarPrecierre/);
 assert.match(worker,/\/api\/inventario-turno-live/);
 assert.match(admin,/\/api\/inventario-turno-live/);
 assert.doesNotMatch(worker,/uki-sushi-pedidos-d6o9vuqzr/);
});
test('tablas nuevas nunca alteran la carta ni registros de caja',()=>{
 assert.match(SQL,/CREATE TABLE IF NOT EXISTS public.uki_inventario_items_live/);
 assert.match(SQL,/CREATE TABLE IF NOT EXISTS public.uki_inventario_pin_live/);
 assert.match(SQL,/CREATE OR REPLACE FUNCTION public.uki_factura_recibir_live/);
 assert.doesNotMatch(SQL,/ALTER TABLE public\.uki_carta/);
 assert.doesNotMatch(SQL,/INSERT INTO public\.uki_carta/);
 assert.doesNotMatch(SQL,/UPDATE public\.uki_carta/);
 assert.doesNotMatch(SQL,/DELETE FROM public\.uki_/);
});
test('ingredientes base independientes por sucursal; cantidades iniciales cero',async()=>{
 for(const branch of ['arica','serena']){
  const sql={query:async(q,args)=>{assert.match(q,/public\.uki_inventario_items_live/);assert.equal(args[0],branch);return [];}};
  const rows=await core.listar(sql,branch);
  assert.ok(rows.length>=12,'debe mostrar ingredientes');
  assert.ok(rows.every(x=>x.kind==='ingredient'&&x.stock_qty===0&&x.min_stock_qty===0));
 }
});
test('guardado de conteo de ingrediente requiere versión y registra auditoría atómica',async()=>{
 let statement;
 const sql={query:async(q,args)=>{statement=q;assert.equal(args[0],'arica');return [{sku:'ingredient:proteina-pollo',name:'Pollo',stock_unit:'un',stock_qty:4,min_stock_qty:0,version:1}]}};
 const row=await core.guardarMovimiento(sql,'arica','ingredient:proteina-pollo','conteo',4,0,'Dayana',{cantidad:4,unidad:'un'});
 assert.equal(row.stock_qty,4);
 assert.match(statement,/WITH changed AS/);
 assert.match(statement,/JOIN logged ON TRUE/);
 assert.doesNotMatch(statement,/uki_carta_items_v1/);
});
test('admin puede configurar gramos, litros o kilos sin cambiar disponible/agota-do',async()=>{
 const sql={query:async(q,args)=>[{sku:'ingredient:proteina-pollo',name:'Pollo',stock_unit:'kg',stock_qty:10,min_stock_qty:2,version:1}]};
 const x=await core.configurar(sql,'arica','ingredient:proteina-pollo',{stock_unit:'kg',stock_qty:10,min_stock_qty:2},0,'admin');
 assert.equal(x.stock_qty,10);assert.equal(x.min_stock_qty,2);assert.equal(x.stock_unit,'kg');
});

test('public inventory pages served from public root',()=>{ const a=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8'); const b=fs.readFileSync(path.join(__dirname,'../public/administracion.html'),'utf8'); assert.match(a,/uki-sushi-inventario\.vercel\.app/);assert.match(b,/uki-sushi-inventario\.vercel\.app/);assert.match(a,/iniciarFacturaLive/);assert.match(b,/GoogleAuthProvider/);assert.match(b,/href="\/"/);});

test('catálogo de inventario funciona en servidor sin importar archivos estáticos públicos',async()=>{
 const cat=require('../lib/uki-catalogo-v1.cjs');
 const data=require('../lib/uki-inventario-base-data.cjs');
 const catSource=fs.readFileSync(path.join(__dirname,'../lib/uki-catalogo-v1.cjs'),'utf8');
 assert.doesNotMatch(catSource,/import\(['"]\.\.\/public\/candidata\//);
 assert.match(catSource,/require\('\.\/uki-inventario-base-data\.cjs'\)/);
 assert.equal(data.proteins.length,8);
 assert.equal(data.monthlyExtraProteins.length,5);
 for(const branch of ['arica','serena']){
  const a=await cat.baseItems(branch);
  const ingredients=a.filter(x=>x.kind==='ingredient');
  assert.ok(ingredients.length>=40);
  assert.equal(ingredients.filter(x=>x.name==='Pollo').length,1);
  assert.equal(ingredients.filter(x=>x.name==='Nori').length,1);
  assert.equal(new Set(ingredients.map(x=>x.sku)).size,ingredients.length);
 }
});
