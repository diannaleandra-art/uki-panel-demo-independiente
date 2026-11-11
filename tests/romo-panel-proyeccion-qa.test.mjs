import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRomoCatalog} from '../lib/romo-catalogo-integracion-qa.mjs';
import {emptyRomoInventory} from '../lib/romo-inventario-integracion-qa.mjs';
import {romoPanelCartaLecturaQA,romoPanelInventarioLecturaQA,romoCartaPublicaVistaQA,romoCatalogoListoParaRevisarQA}
 from '../lib/romo-panel-proyeccion-qa.mjs';
function fixture(){
 const c=emptyRomoCatalog();
 c.productos.push({sku:'romo:gohan',kind:'gohan',name:'Gohan clásico',price:6000,available:true,visible:true});
 c.promociones.push({sku:'romo:promo-24',kind:'sushi',name:'Promo 24',description:'Dos rolls',price:7000,available:true,visible:false,pieces:24,rollCount:2,piecesPerRoll:12,sauceCount:1,korokes:2,payments:['efectivo']});
 c.ingredientes.push({sku:'romo:palta',kind:'vegetal',name:'Palta',price:0,available:true,visible:true});
 return c;
}
test('panel lee el catálogo Romo en su propia sucursal sin habilitar ventas',()=>{
 const r=romoPanelCartaLecturaQA({revision:3,catalog:fixture()});
 assert.equal(r.storeId,'romo:serena');assert.equal(r.branch,'serena');
 assert.equal(r.soloLecturaQA,true);assert.equal(r.puedeRegistrarPedidos,false);
 assert.equal(r.totalPromociones,1);assert.equal(r.items.find(x=>x.kind==='monthly').price,7000);
 assert.equal(r.ingredientes[0].ingredientType,'vegetal');
});
test('la carta pública oculta promociones sin publicar, pero el panel muestra borradores',()=>{
 const c=fixture(),a=romoCartaPublicaVistaQA({revision:1,catalog:c});
 assert.equal(a.ventaHabilitada,false);assert.equal(a.productos.length,1);
 assert.equal(romoPanelCartaLecturaQA({revision:1,catalog:c}).items.length,2);
});
test('sin fotografía de promoción no aparece lista para revisar; nunca habilita ventas',()=>{
 const c=fixture();c.promociones[0].visible=true;
 const r=romoCatalogoListoParaRevisarQA({revision:1,catalog:c});
 assert.deepEqual(r.faltanFotos,['romo:promo-24']);assert.equal(r.listaParaRevision,false);
 const approved=romoCatalogoListoParaRevisarQA({revision:1,catalog:c,fotosPorSku:{'romo:promo-24':true}});
 assert.equal(approved.listaParaRevision,true);assert.equal(approved.ventaHabilitada,false);
});
test('inventario conserva diferencias y mínimos sin descontar automáticamente por ventas',()=>{
 const i=emptyRomoInventory();
 i.items.push({id:'arroz',name:'Arroz',unit:'kg',recibido:10,hay:7,minimo:8});
 const r=romoPanelInventarioLecturaQA({revision:2,inventory:i});
 assert.equal(r.articulos[0].diferencia,3);assert.equal(r.articulos[0].reponer,1);assert.equal(r.puedeModificarCaja,false);
});
test('catálogo vacío no inventa precios y siempre bloquea venta',()=>{
 const r=romoCatalogoListoParaRevisarQA({revision:0,catalog:emptyRomoCatalog()});
 assert.equal(r.listaParaRevision,false);assert.equal(r.productosPublicados,0);assert.equal(r.ventaHabilitada,false);
});
test('rechaza sucursales cruzadas y revisiones negativas',()=>{
 const c=fixture();c.sucursal='uki:serena';
 assert.throws(()=>romoPanelCartaLecturaQA({revision:0,catalog:c}));
 assert.throws(()=>romoPanelCartaLecturaQA({revision:-1,catalog:fixture()}));
 const inv=emptyRomoInventory();inv.sucursal='uki:arica';
 assert.throws(()=>romoPanelInventarioLecturaQA({revision:0,inventory:inv}));
});
