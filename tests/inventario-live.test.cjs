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
test('admin puede configurar mínimos y mantener el saldo de un ingrediente existente',async()=>{
 const sku='ingredient:vegetal-aceituna-amarga',patch={stock_unit:'kg',stock_qty:0.125,min_stock_qty:2};
 for(const version of [0,3]){
  const sql={query:async(q,args)=>{
   assert.deepEqual(args,version?[ 'serena',sku,'kg',0.125,2,'admin',3 ]:
    [ 'serena',sku,'Aceituna amarga','kg',0.125,2,'admin' ]);
   assert.deepEqual([...new Set([...q.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b),args.map((_,i)=>i+1));
   if(version)assert.match(q,/WHERE branch=\$1 AND sku=\$2 AND version=\$7/);
   assert.doesNotMatch(q,/availability|available|uki_carta/);
   return [{sku,name:'Aceituna amarga',...patch,version:version+1}];
  }};
  const x=await core.configurar(sql,'serena',sku,patch,version,'admin');
  assert.equal(x.stock_qty,0.125);assert.equal(x.min_stock_qty,2);assert.equal(x.stock_unit,'kg');
 }
 const conflict={query:async()=>[]};
 await assert.rejects(core.configurar(conflict,'serena',sku,patch,3,'admin'),error=>error.status===409);
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
  assert.doesNotMatch(purchases,/id="enviar"|cierre|reporte.*guardar/i);
  assert.match(html,/No se puede calcular cuánto pedir/);
  assert.match(html,/id="invPrevious"/);
  assert.match(source,/invFinish'\)\.hidden=mode!=='reporte'/);
  assert.match(source,/invPurchases'\)\.hidden=mode!=='compras'/);
  assert.match(source,/api\('listar',\{flujo_cierre:true\}\)/);
  assert.doesNotMatch(source,/countValue\.value\s*=\s*String\(qty\)/);
 }
});

test('el menú del trabajador separa recepción, conteo, cierre y lo que falta pedir',async()=>{
 for(const page of ['public/index.html','firebase/uki-inventario-turno.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
  const home=html.slice(html.indexOf('id="invAppHome"'),html.indexOf('id="invAppBar"'));
  assert.match(home,/data-inv-view="entradas"[^>]*><strong>📦 Mercadería que entra/);
  assert.match(home,/data-inv-view="conteo"[^>]*><strong>📋 Hacer inventario<\/strong><small>Al finalizar el turno/);
  assert.match(home,/data-inv-view="reporte"[^>]*><strong>✅ Cerrar inventario de hoy/);
  assert.match(home,/data-inv-view="compras"[^>]*>[\s\S]*?Lo que falta pedir/);
  assert.doesNotMatch(home,/data-inv-view="alta"/);
  assert.match(html,/id="invPurchases" hidden>\s*<p[^>]*>[^<]*No es un historial de compras realizadas/);
  const nodes=new Map(),nav=[];
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,dataset:{},hidden:true,textContent:'',
   querySelector(){return null;},prepend(el){this.notice=el.textContent;}});return nodes.get(id);};
  for(const m of html.matchAll(/data-inv-view="([^"]+)"/g))nav.push({dataset:{invView:m[1]}});
  const llamadas=[],context={
   $:element,branch:'arica',bodegaCompartida:true,cierreGuardado:null,busy:false,
   cierreLocalGuardado:false,visibleLimit:12,items:[],reporteFinal:null,requestId:null,
   cierreTitulo:()=>'',renderAnterior(){},renderCompras(){llamadas.push('compras');},
   renderCierre(){llamadas.push('cierre');},render(){llamadas.push('lista');},
   api:async(action,data)=>{llamadas.push({action,data});return {item:{sku:'inv:prueba',name:'Panko'}};},
   setBusy:v=>{context.busy=v;},elt:(t,value)=>({textContent:value,setAttribute(){}}),
   window:{scrollTo(){}},document:{querySelectorAll:()=>nav}
  };
  element('factModoRecibir').click=()=>llamadas.push('factura');
  const a=html.indexOf("let invAppMode='inicio'"),b=html.indexOf("$('invCategory').onchange",a);
  const c=html.indexOf("$('invAppBack').onclick="),d=html.indexOf("$('invPrevSearch').oninput=",c);
  const vm=require('node:vm');
  vm.runInNewContext(html.slice(a,b)+html.slice(c,d),context);
  const open=mode=>nav.find(x=>x.dataset.invView===mode).onclick();
  open('entradas');
  assert.deepEqual(['invRecepcion','invListHeader','facturaQA','invFinish'].map(id=>element(id).hidden),[false,true,true,true]);
  open('entrada');
  assert.deepEqual(['invRecepcion','invListHeader','facturaQA','invFinish'].map(id=>element(id).hidden),[true,false,true,true]);
  open('alta');assert.equal(element('invQuickAdd').hidden,false);assert.equal(element('facturaQA').hidden,true);
  element('invAppBack').onclick();assert.equal(element('invAppTitle').textContent,'Registrar mercadería manualmente');
  open('alta');element('invQuickName').value='Panko';element('invQuickCat').value='ingrediente';element('invQuickUnit').value='kg';
  await element('invQuickSave').onclick();
  assert.equal(element('invAppTitle').textContent,'Registrar mercadería manualmente');
  assert.equal(element('buscar').value,'Panko');
  assert.match(element('items').notice,/Ahora registra cuánto llegó/);
  assert.equal(llamadas.filter(v=>typeof v==='object').length,1);
  assert.equal(llamadas.find(v=>typeof v==='object').action,'crear-insumo-trabajador');
  assert.equal(Object.hasOwn(llamadas.find(v=>typeof v==='object').data.item,'stock_qty'),false);
  element('invAppBack').onclick();open('factura');
  assert.deepEqual(['invRecepcion','invListHeader','facturaQA','invFinish'].map(id=>element(id).hidden),[true,true,false,true]);
  element('invAppBack').onclick();element('invAppBack').onclick();
  open('conteo');assert.equal(element('invCierreBar').hidden,false);
  open('reporte');assert.equal(element('invFinish').hidden,false);assert.equal(element('invListHeader').hidden,true);
  open('compras');assert.equal(element('invPurchases').hidden,false);assert.equal(element('invFinish').hidden,true);
  assert.ok(llamadas.includes('factura'));
 }
});

test('compras comparte por WhatsApp solo cantidades por pedir de la bodega, sin requerir un cierre',()=>{
 for(const path of ['public/index.html','firebase/uki-inventario-turno.html']){
  const html=fs.readFileSync(path,'utf8'),vm=require('node:vm');
  const buttons={},nodes={invAppLocal:{textContent:'La Serena · Uki y Romo (bodega compartida)'},invPurchaseWhatsApp:buttons,invPurchaseNote:{},resumen:{},resumenArticulos:{replaceChildren(){},append(){}}};
  const mensajes=[];
  const ctx={
   $:id=>nodes[id],branch:'serena',invAppMode:'compras',busy:false,
   items:[{name:'Aceite',stock_qty:2,min_stock_qty:5,stock_unit:'l'},{name:'Palta',stock_qty:0,min_stock_qty:0,stock_unit:'kg'},{name:'Arroz',stock_qty:2,min_stock_qty:2,stock_unit:'kg'}],
   elt:()=>({append(){}}),formato:(n,u)=>n+' '+u,
   window:{open(url,target){assert.equal(target,'_blank');mensajes.push(new URL(url));return {};}}
  };
  const a=html.indexOf('function faltantesParaPedir(){'),b=html.indexOf('function fechaChile(date){',a);
  const render=vm.runInNewContext(html.slice(a,b)+'\nrenderCompras',ctx);
  render();assert.equal(buttons.disabled,false);
  buttons.onclick();assert.equal(mensajes.length,1);
  assert.equal(mensajes[0].hostname,'wa.me');
  const text=mensajes[0].searchParams.get('text');
  assert.match(text,/LO QUE FALTA PEDIR/);assert.match(text,/La Serena · Uki y Romo/);
  assert.match(text,/Aceite — Pedir 3 l/);assert.doesNotMatch(text,/Arroz|Palta/);
  ctx.items=[];render();assert.equal(buttons.disabled,true);buttons.onclick();assert.equal(mensajes.length,1);
 }
});
