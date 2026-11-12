'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const api=require('../api/uki-carta-precios-live.js');
const {listarConMetadatos,categoriasDescuentosHabilitados}=api._testing;
const sql={query:async(text,params=[])=>{
 if(text.includes('uki_carta_items_v1'))return [];
 if(text.includes('uki_carta_productos_custom_v1'))return [];
 if(text.includes('uki_carta_promos_custom_v1'))return [];
 if(text.includes('uki_carta_visibilidad_v1'))return [];
 if(text.includes('SELECT slug,nombre FROM public.uki_carta_categorias_personalizadas_v1'))
  return [{slug:'almuerzos',nombre:'Almuerzos'}];
 if(text.includes('SELECT sku,category_slug FROM public.uki_carta_producto_categoria_v1'))
  return [{sku:'classic:24',category_slug:'almuerzos'}];
 if(text.includes('SELECT sku,discount_percent,version FROM public.uki_carta_descuentos_v1'))
  return [{sku:'classic:24',discount_percent:10,version:2}];
 throw Error('Unexpected query '+text);
}};
test('No activa descuentos de forma involuntaria en producción o previews',()=>{
 assert.equal(categoriasDescuentosHabilitados({VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true'}),false);
 assert.equal(categoriasDescuentosHabilitados({VERCEL_ENV:'preview',UKI_CATEGORIAS_DESCUENTOS_ENABLED:'true'}),false);
 assert.equal(categoriasDescuentosHabilitados({
  VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true',UKI_CATEGORIAS_DESCUENTOS_ENABLED:'true'}),true);
});
test('Carta cliente recibe precio rebajado y admin conserva precio original por SKU y sucursal',async()=>{
 const admin=await listarConMetadatos(sql,'arica',false,true);
 const publicMenu=await listarConMetadatos(sql,'arica',true,true);
 const a=admin.items.find(i=>i.sku==='classic:24'),p=publicMenu.items.find(i=>i.sku==='classic:24');
 assert.ok(a&&p);
 assert.equal(a.price,a.precioOriginal);
 assert.equal(a.precioFinal,Math.round(a.price*0.9));
 assert.equal(p.price,a.precioFinal);
 assert.equal(p.precioOriginal,a.precioOriginal);
 assert.equal(p.categoriaNombre,'Almuerzos');
 assert.equal(a.descuentoPorcentaje,10);
 assert.equal(a.descuentoVersion,2);
 assert.equal(admin.categorias.length,1);
});
test('Sin habilitar tablas nuevas, los precios originales quedan intactos',async()=>{
 const old=await listarConMetadatos(sql,'arica',true,false);
 assert.equal(old.categoriasDescuentosHabilitados,false);
 assert.equal(old.items.find(i=>i.sku==='classic:24').descuentoPorcentaje,undefined);
});
test('El panel tiene controles de categoría y descuento sin activarlos cuando falta flag',()=>{
 const js=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/categoriasDescuentosHabilitados/);
 assert.match(js,/function crearCategoria\(/);
 assert.match(js,/function extraProducto\(/);
 assert.match(js,/expected_discount_version/);
 assert.match(js,/if\(state.categoriasDescuentosHabilitados\)/);
});

test('Vista previa de categorías usa solo la rama aprobada y el host QA de Neon',()=>{
 const {url}=require('../lib/uki-inventario-db-live.cjs');
 const qa={
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'ui/uki-carta-promociones-categorias-descuentos-qa-20261111',
  UKI_INVENTARIO_QA_ENABLED:'true',
  UKI_CATEGORIAS_DESCUENTOS_ENABLED:'true',
  UKI_INVENTARIO_QA_DATABASE_URL:'postgresql://qa:prueba@ep-lingering-glade-b5m4hfhu.c-7.us-east-2.aws.neon.tech/neondb'
 };
 assert.equal(categoriasDescuentosHabilitados(qa),true);
 assert.match(url(qa),/ep-lingering-glade-b5m4hfhu/);
 assert.equal(url({...qa,UKI_INVENTARIO_QA_DATABASE_URL:'postgresql://qa:prueba@ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech/neondb'}),null);
 assert.equal(categoriasDescuentosHabilitados({...qa,VERCEL_GIT_COMMIT_REF:'otra-rama'}),false);
 assert.equal(url({...qa,VERCEL_GIT_COMMIT_REF:'otra-rama'}),null);
});

test('El panel de categorías acepta solo su dirección QA y nunca la autoriza en producción',()=>{
 const {originAllowed}=api._testing;
 const panel='https://uki-sushi-inventario-git-ui-uki-carta-5531d1-diannaleandra-7046.vercel.app';
 const qa={
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'ui/uki-carta-promociones-categorias-descuentos-qa-20261111',
  UKI_INVENTARIO_QA_ENABLED:'true',
  VERCEL_URL:'uki-sushi-inventario-8j5udjgnx-diannaleandra-7046.vercel.app'
 };
 assert.equal(originAllowed(panel,qa),true);
 assert.equal(originAllowed(panel,{...qa,VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true'}),false);
 assert.equal(originAllowed(panel,{...qa,VERCEL_GIT_COMMIT_REF:'qa/uki-promos-tipos-producto-20261110'}),false);
 assert.equal(originAllowed('https://otro-panel-desconocido.vercel.app',qa),false);
 assert.equal(originAllowed('https://uki-sushi-pedidos-2ztmxhepr-diannaleandra-7046.vercel.app',qa),true);
});


test('Renombrar categoría conserva identificador, sucursal y asignaciones',async()=>{
 const requests=[];
 const conn={query:async(sql,values)=>{
  requests.push({sql,values});
  return [{slug:'uki-dulce',nombre:'Postres Uki'}];
 }};
 const output=await api._testing.renombrarCategoria(conn,'arica','uki-dulce','Postres Uki',{uid:'admin-test'});
 assert.deepEqual(output,{slug:'uki-dulce',nombre:'Postres Uki'});
 assert.equal(requests.length,1);
 assert.deepEqual(requests[0].values,['arica','uki-dulce','Postres Uki','admin-test']);
 assert.match(requests[0].sql,/UPDATE public\.uki_carta_categorias_personalizadas_v1/);
 assert.match(requests[0].sql,/c\.branch=\$1 AND c\.slug=\$2/);
 assert.doesNotMatch(requests[0].sql,/UPDATE public\.uki_carta_producto_categoria_v1/);
 assert.equal(await api._testing.renombrarCategoria(conn,'arica','?', 'Nombre',{uid:'x'}),null);
 assert.equal(await api._testing.renombrarCategoria(conn,'arica','uki-dulce', '',{uid:'x'}),null);
 assert.equal(requests.length,1);
});

test('Borrar una categoría desvincula productos sin borrarlos, por sucursal',async()=>{
 const calls=[];
 const conn={query:async(sql,values)=>{
  calls.push({sql,values});
  return [{slug:'uki-dulce',productos_desvinculados:2}];
 }};
 const result=await api._testing.eliminarCategoria(conn,'arica','uki-dulce');
 assert.equal(result.productos_desvinculados,2);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].values,['arica','uki-dulce']);
 assert.match(calls[0].sql,/DELETE FROM public\.uki_carta_producto_categoria_v1/);
 assert.match(calls[0].sql,/DELETE FROM public\.uki_carta_categorias_personalizadas_v1/);
 assert.match(calls[0].sql,/FROM categoria_borrada/);
 assert.doesNotMatch(calls[0].sql,/DELETE FROM public\.uki_carta_productos_custom_v1/);
 assert.doesNotMatch(calls[0].sql,/DELETE FROM public\.uki_carta_items_v1/);
 assert.doesNotMatch(calls[0].sql,/DELETE FROM public\.uki_(?:pedido|venta|caja|cierre|timbre|inventario)/i);
 assert.equal(await api._testing.eliminarCategoria(conn,'arica','X inválido'),null);
 assert.equal(calls.length,1);
});

test('Categorías tienen lista desplegable, editar, eliminar y agregar o quitar sus productos',()=>{
 const panel=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 const server=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.doesNotThrow(()=>new vm.Script(panel));
 for(const label of ['Categorías guardadas','Editar nombre de esta categoría',
  'Guardar nombre','Productos dentro de ','Quitar de esta categoría',
  'Agregar productos a esta categoría','✎ Editar producto completo','🗑 Eliminar categoría'])
  assert.ok(panel.includes(label),'Falta '+label);
 for(const action of ['editar-categoria','eliminar-categoria','asignar-categoria'])
  assert.ok(panel.includes("'"+action+"'"),action);
 assert.match(panel,/await loadPrices\(true\)/);
 assert.match(panel,/window\.confirm\('¿Eliminar la categoría/);
 assert.match(panel,/state\.categoriaAbierta=category\.slug/);
 assert.match(panel,/window\.ukiCartaSeleccion\?\.\('productos'\)/);
 assert.match(server,/if\(action==='editar-categoria'\)/);
 assert.match(server,/if\(action==='eliminar-categoria'\)/);
});
