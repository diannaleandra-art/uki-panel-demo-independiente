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
test('el panel incluye la administración de inventario, conserva sus secciones, y el trabajador sigue separado',()=>{
 assert.match(main,/onclick="ir\('inventario'\)"/);
 assert.match(main,/window\.ukiInventarioPanelHTML/);
 assert.match(main,/uki-inventario-admin-embebido\.js/);
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
 const sql={query:async(q,args)=>{
  statement=q;
  assert.deepEqual(args,['arica','ingredient:proteina-pollo','conteo',4,'Agendador',4,'un','Pollo']);
  assert.deepEqual([...new Set([...q.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b),args.map((_,i)=>i+1));
  return [{sku:'ingredient:proteina-pollo',name:'Pollo',stock_unit:'un',stock_qty:4,min_stock_qty:0,version:1}];
 }};
 const row=await core.guardarMovimiento(sql,'arica','ingredient:proteina-pollo','conteo',4,0,'Agendador',{cantidad:4,unidad:'un'});
 assert.equal(row.stock_qty,4);
 assert.match(statement,/WITH changed AS/);
 assert.match(statement,/JOIN logged ON TRUE/);
 assert.doesNotMatch(statement,/uki_carta_items_v1/);
});
test('bodega La Serena: conteo y entrada de 125 g en la ficha existente en kg sin parámetros omitidos',async()=>{
 const {convertir}=require('../lib/uki-inventario-unidades-live.cjs');
 const sku='ingredient:vegetal-aceituna-amarga',base=convertir(125,'g','kg');
 for(const action of ['conteo','entrada']){
  const sql={query:async(q,args)=>{
   assert.deepEqual(args,['serena',sku,action,0.125,'Agendador',125,'g',1]);
   assert.deepEqual([...new Set([...q.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b),args.map((_,i)=>i+1));
   assert.match(q,/WHERE branch=\$1 AND sku=\$2 AND version=\$8/);
   assert.match(q,/JOIN logged ON TRUE/);
   return [{sku,name:'Aceituna amarga',stock_unit:'kg',stock_qty:0.125,min_stock_qty:0,version:2}];
  }};
  const r=await core.guardarMovimiento(sql,'serena',sku,action,base,1,'Agendador',{cantidad:125,unidad:'g'});
  assert.equal(r.stock_qty,0.125);assert.equal(r.stock_unit,'kg');
 }
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

test('acceso Google iPhone por redirección con helper en el mismo dominio',()=>{
 const admin=fs.readFileSync(path.join(__dirname,'../public/administracion.html'),'utf8');
 const routing=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
 assert.match(admin,/authDomain:'uki-sushi-inventario\.vercel\.app'/);
 assert.match(admin,/signInWithRedirect\(auth,new GoogleAuthProvider\(\)\)/);
 assert.match(admin,/getRedirectResult\(auth\)/);
 assert.match(admin,/onAuthStateChanged\(auth,user/);
 assert.doesNotMatch(admin,/signInWithPopup\(auth/);
 assert.deepEqual(routing.rewrites.find(x=>x.source==='/__/auth/:path*'),{
   source:'/__/auth/:path*',
   destination:'https://uki-panel-f4909.firebaseapp.com/__/auth/:path*'
 });
 assert.ok(routing.rewrites.every(x=>x.destination.startsWith('https://uki-panel-f4909.firebaseapp.com/__/')));
});

test('flujo de cierre consulta el último informe de su bodega y conteos posteriores, sin mutaciones',async()=>{
 const cierre={id:'last',created_at:'2026-11-25T23:55:00Z',items:[{sku:'ingredient:arroz',stock_qty:10}]};
 const calls=[];
 const sql={query:async(statement,params)=>{
  calls.push([statement,params]);
  assert.match(statement,/^\s*SELECT\b/);
  assert.match(statement,/WHERE branch=\$1/);
  assert.equal(params[0],'serena');
  if(statement.includes('uki_inventario_revisiones_live'))return [cierre];
  assert.equal(params[1],cierre.created_at);
  assert.match(statement,/HAVING MAX/);
  assert.match(statement,/'entrada'/);
  return statement.includes('_extras_')?[]:[{sku:'ingredient:arroz',contado_en:'2026-11-26T23:15:00Z'}];
 }};
 assert.deepEqual(await api._testing.flujoCierre(sql,'serena'),{
  cierre,conteos:[{sku:'ingredient:arroz',fecha:'2026-11-26T23:15:00Z'}]
 });
 assert.equal(calls.length,3);
});

test('flujo de cierre distingue primer cierre, ningún conteo y conteos no consultados',async()=>{
 let fail=false;
 const sql={query:async(statement,params)=>{
  assert.equal(params[0],'arica');
  if(statement.includes('uki_inventario_revisiones_live'))return [];
  assert.equal(params[1],null);
  assert.match(statement,/America\/Santiago/);
  if(fail)throw Error('DB error');
  return [];
 }};
 assert.deepEqual(await api._testing.flujoCierre(sql,'arica'),{cierre:null,conteos:[]});
 fail=true;
 assert.deepEqual(await api._testing.flujoCierre(sql,'arica'),{cierre:null,conteos:null});
});

test('las dos entradas al inventario separan Compra, Cierre y consulta del cierre anterior',()=>{
 for(const page of ['public/index.html','firebase/uki-inventario-turno.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
  const source=html.match(/<script type="module">([\s\S]+?)<\/script>/)[1];
  assert.doesNotThrow(()=>new (require('node:vm').Script)(source.replace(/^import .*$/gm,'')));
  const purchases=html.match(/<section class="card" id="invPurchases" hidden>[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(purchases,/enviar|cierre|reporte.*guardar/i);
  assert.match(html,/No se puede calcular cuánto pedir/);
  assert.match(html,/id="invPrevious"/);
  assert.match(source,/invFinish'\)\.hidden=mode!=='reporte'/);
  assert.match(source,/invPurchases'\)\.hidden=mode!=='compras'/);
  assert.match(source,/api\('listar',\{flujo_cierre:true\}\)/);
  assert.doesNotMatch(source,/countValue\.value\s*=\s*String\(qty\)/);
 }
});
