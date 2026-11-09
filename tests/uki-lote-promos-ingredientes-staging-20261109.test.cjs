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
    price:15000,available:true,visible:false,published_at:null,version:1,roll_count:5,
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
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'production',UKI_PROMOS_VISIBILIDAD_ENABLED:'true',UKI_INVENTARIO_LIVE_ENABLED:'true'}),false);
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'production',UKI_PROMOS_VISIBILIDAD_ENABLED:'true',UKI_INVENTARIO_LIVE_ENABLED:'true',UKI_INGREDIENTES_ARMADO_ENABLED:'true'}),true);
 assert.equal(api.promocionesHabilitadas({VERCEL_ENV:'preview',UKI_PROMOS_VISIBILIDAD_ENABLED:'true'}),false);
});
test('Una vez migrado y habilitado, cada promoción consulta su sucursal y nace oculta',async()=>{
 for(const branch of ['arica','serena']){
  const {sql,queries}=mock();
  const items=await api.listing(sql,branch,true);
  const p=items.find(i=>i.sku==='monthly:promo-qa-12345678');
  assert.ok(p);
  assert.equal(p.visible,false);
  assert.equal(p.estadoPublicacion,'Borrador');
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

test('Las promociones pueden eliminarse de la carta en cualquier momento, como ingredientes, sin borrar el historial',()=>{
 const ui=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 const backend=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 const ingredients=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
 const preview=fs.readFileSync('public/vista-previa-carta-precios.html','utf8');
 assert.match(ui,/Elimina[r]? promoción de la carta|Eliminar promoción de la carta/);
 assert.match(ui,/Volver a publicar promoción/);
 assert.match(ui,/esPromoDelMes&&estado==='Borrador'\?'publicar-promocion':'restaurar-producto'/);
 assert.match(ui,/Los pedidos anteriores se conservan/);
 assert.match(backend,/if\(entry\.kind==='monthly'&&entry\.custom\)\{/);
 assert.match(backend,/UPDATE public\.uki_carta_promos_custom_v1 SET visible=\$3,published_at=CASE WHEN \$3 THEN COALESCE\(published_at,NOW\(\)\) ELSE published_at END,version=version\+1/);
 assert.match(backend,/WHERE branch=\$1 AND sku=\$2 AND version=\$4 AND visible IS DISTINCT FROM \$3/);
 assert.doesNotMatch(backend,/\bDELETE FROM public\.uki_carta_promos_custom_v1\b/i);
 assert.match(ingredients,/request\(remove\?'retirar':'restaurar'/);
 assert.match(preview,/promoEstadosDemo=\{arica:\['Publicada','Borrador'\],serena:\['Publicada','Retirada'\]\}/);
 assert.match(preview,/Eliminar promoción de la carta/);
 assert.match(preview,/↩ Volver a publicar/);
 assert.doesNotMatch(preview,/\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/);
});

test('Borrador, Publicada y Retirada son estados distintos y con memoria histórica',async()=>{
 const rows=[
  {visible:false,published_at:null,expected:'Borrador'},
  {visible:true,published_at:'2026-11-09T14:00:00.000Z',expected:'Publicada'},
  {visible:false,published_at:'2026-11-09T14:00:00.000Z',expected:'Retirada'}
 ];
 for(const r of rows){
  assert.equal(api.estadoPromocion(r.visible,r.published_at),r.expected);
  const queries=[];
  const sql={query:async(q,params)=>{
   queries.push({q,branch:params[0]});
   if(q.includes('FROM public.uki_carta_promos_custom_v1'))return [{
    sku:'monthly:qa-estado-12345678',name:'QA Promo',description:'Ejemplo',price:5000,
    available:true,visible:r.visible,published_at:r.published_at,version:2,roll_count:2,
    pieces_per_roll:12,size:24,sauce_count:1,korokes:0,payments:['efectivo']
   }];
   return [];
  }};
  const data=await api.listing(sql,'arica',true);
  assert.equal(data.find(x=>x.sku==='monthly:qa-estado-12345678').estadoPublicacion,r.expected);
  assert.ok(queries.some(x=>x.q.includes('published_at')));
  assert.ok(queries.every(x=>x.branch==='arica'));
 }
});
test('El servidor conserva la fecha de primera publicación al retirar y permite publicar borradores con foto',()=>{
 const apiCode=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 const migration=fs.readFileSync('sql/uki-carta-promos-visibilidad-v1.sql','utf8');
 const ui=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 assert.match(migration,/published_at TIMESTAMPTZ/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ/);
 assert.doesNotMatch(migration,/DROP COLUMN|DELETE FROM|TRUNCATE/i);
 assert.match(apiCode,/COALESCE\(published_at,NOW\(\)\)/);
 assert.match(apiCode,/ELSE published_at END/);
 assert.match(apiCode,/if\(!photo.length\)return fail\(res,409/);
 assert.match(ui,/estado==='Borrador'\?'✓ Publicar promoción'/);
 assert.match(ui,/Estado de promoción: /);
 assert.match(ui,/estado==='Publicada'/);
 assert.match(ui,/estado==='Retirada'/);
});


test('Panel organiza opciones base y personalizadas de vegetales, proteínas y envolturas sin duplicar',()=>{
 const source=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
 const begin=source.indexOf('// Catálogo base del menú Uki aprobado');
 const end=source.indexOf('function renderEditorIngrediente(item,target){',begin);
 assert.ok(begin>=0&&end>begin,'Vista agrupada creada');
 const nodes=[];
 function createElement(tag){const node={tag,style:{},children:[],textContent:'',title:'',open:false,
  append(...xs){this.children.push(...xs)},replaceChildren(){this.children=[]}};
  nodes.push(node);return node;}
 const root=createElement('root'),edits=[];
 const ctx={
  document:{createElement},get:id=>id==='ukiIngLista'?root:null,
  state:{items:[{name:'Frutilla',category:'vegetal',surcharge:0,available:true},
   {name:'Nuez',category:'vegetal',surcharge:500,available:true}]},
  renderEditorIngrediente:(item,container)=>{edits.push(item.name);container.append(createElement('editable'));}
 };
 vm.runInNewContext(source.slice(begin,end)+'\nrender();',ctx);
 const panels=root.children.filter(x=>x.tag==='details');
 assert.equal(panels.length,3);
 assert.match(panels[0].children[0].textContent,/Vegetales/);
 assert.match(panels[1].children[0].textContent,/Proteínas/);
 assert.match(panels[2].children[0].textContent,/Envolturas/);
 assert.deepEqual(edits,['Frutilla','Nuez']);
 const chips=nodes.filter(x=>x.tag==='span').map(x=>x.textContent);
 assert.ok(chips.includes('Palta')&&chips.includes('Pollo')&&chips.includes('Panko'));
 assert.ok(!chips.includes('Frutilla'),'No duplicar Frutilla agregada respecto de la base');
 const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
 assert.match(html,/uki-armado-ingredientes-admin\.js\?v=uki-tres-vistas-qa-20261109/);
});

test('Panel muestra resumen por sucursal de promociones con acceso a precios existentes',()=>{
 const code=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 const a=code.indexOf('function renderPromoResumen(){'),b=code.indexOf('function renderPrices(){',a);
 assert.ok(a>=0&&b>a);
 function createElement(tag){return {tag,children:[],style:{},textContent:'',
  append(...xs){this.children.push(...xs)},replaceChildren(){this.children=[]}}}
 const target=createElement('root'),search={value:''},group={value:''};
 const roots={ukiPromosListaResumen:target,ukiPriceSearch:search,ukiPriceGroup:group,
  ukiPriceList:{style:{},scrollIntoView(){}}};
 let refreshed=0;
 const state={items:[{kind:'monthly',name:'Promo especial QA',price:16000,visible:true},
  {kind:'classic',name:'Clásico QA',price:8000}],group:'all',query:''};
 vm.runInNewContext(code.slice(a,b)+'\nrenderPromoResumen();',{
  document:{createElement},state,$:id=>roots[id],renderPrices:()=>refreshed++,
  visibilityControl:()=>createElement('button'),
  window:{ukiCartaSeleccion:()=>{}}
 });
 const rows=target.children.filter(x=>x.tag==='div');
 assert.equal(rows.length,1);
 assert.match(rows[0].children[0].children[0].textContent,/Promo especial QA/);
 assert.match(rows[0].children[0].children[1].textContent,/16\.000/);
 rows[0].children[1].onclick();
 assert.equal(group.value,'monthly');assert.equal(search.value,'Promo especial QA');
 assert.equal(refreshed,1);
 const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
 assert.match(html,/uki-carta-precios-admin\.js\?v=uki-tres-vistas-qa-20261109/);
});


test('QA organización: cada área de carta contiene buscar, agregar y acceso a retirar sin perder controles',()=>{
 const precios=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 const ingredientes=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
 const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
 assert.doesNotThrow(()=>new vm.Script(precios));
 assert.doesNotThrow(()=>new vm.Script(ingredientes));
 for(const name of ['productos','ingredientes','promociones'])
  assert.match(precios,new RegExp("'"+name+"'"));
 assert.match(precios,/function organizarCarta\(\)/);
 assert.match(precios,/window\.ukiCartaSeleccion=choose/);
 assert.match(precios,/areas\[name\]\.hidden=name!==key/);
 assert.match(precios,/ukiPriceSearch/);
 assert.match(precios,/ukiPriceAddBox/);
 assert.match(precios,/ukiPriceList/);
 assert.match(precios,/ukiPromoBuscar/);
 assert.match(precios,/ukiPromoAddBox/);
 assert.match(precios,/ukiPromosResumen/);
 assert.match(precios,/row\.append\(visibilityControl\(promo\)\)/);
 assert.match(precios,/Buscar en todas/);
 assert.match(ingredientes,/ukiIngBuscar/);
 assert.match(ingredientes,/ukiCartaAreaIngredientes/);
 assert.match(ingredientes,/ukiIngAddPlegable/);
 assert.match(ingredientes,/function renderEditorIngrediente\(item,target\)/);
 assert.match(ingredientes,/request\(remove\?'retirar':'restaurar'/);
 assert.match(html,/uki-carta-precios-admin\.js\?v=uki-tres-vistas-qa-20261109/);
 assert.match(html,/uki-armado-ingredientes-admin\.js\?v=uki-tres-vistas-qa-20261109/);
 // Las funciones originales siguen disponibles y fuera de los nuevos filtros.
 for(const text of ['function visibilityControl','function crearPromo','function loadPrices','function renderPrices','function create','function promoEditor'])
  assert.ok(precios.includes(text),text);
 for(const text of ['async function request','async function send','async function toggleIngredient','async function load','function render'])
  assert.ok(ingredientes.includes(text),text);
});
