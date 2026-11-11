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
