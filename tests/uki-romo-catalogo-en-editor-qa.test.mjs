import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {
 poblarEditorRomoSoloLecturaQA,montarCatalogoEnEditorRomoQA,
 prepararConsultaRomoQA
} from '../firebase/uki-romo-consulta-qa.mjs';

const catalogo=JSON.parse(readFileSync(new URL('../data/romo-carta-origen-aprobado-20261112.json',import.meta.url),'utf8')).catalog;
const result={ok:true,storeId:'romo:serena',area:'catalog',revision:catalogo.revision,catalog:catalogo,ventasHabilitadas:false};
function dom(){
 const d=new JSDOM('<!doctype html><html><body class="romo-qa"><main id="app">'+
  '<div id="romoLaSerenaPreparacionQA"></div>'+
  '<section id="ukiPreciosPanel"><label>Buscar<input id="ukiPriceSearch" disabled></label>'+
  '<select id="ukiPriceGroup" disabled><option value="all">Todas</option><option value="pizza">Pizzas</option></select>'+
  '<button id="ukiPriceReload" disabled>Actualizar precios</button>'+
  '<p id="ukiPriceMessage"></p><div id="ukiPromosListaResumen"></div>'+
  '<div id="ukiPriceList"></div>'+
  '<button id="ukiPriceCreate" disabled>Agregar producto</button>'+
  '<button id="ukiPromoCreate" disabled>Guardar promoción</button></section>'+
  '<section id="ukiCartaDisponibilidad"><input id="ukiDispBuscar" disabled>'+
  '<select id="ukiDispTipo" disabled><option value="all">Todo</option>'+
  '<option value="product">Productos</option><option value="ingredient">Ingredientes</option></select>'+
  '<button id="ukiDispRefrescar" disabled>Actualizar disponibilidad</button>'+
  '<p id="ukiDispMensaje"></p><div id="ukiDispLista"></div></section>'+
  '<div id="invRoot"></div></main></body></html>',{url:'https://prueba.local'});
 return d;
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
test('La carta Romo usa las listas EXISTENTES: 7 productos, 3 promociones y 40 ingredientes',()=>{
 const d=dom(),document=d.window.document;
 const info=poblarEditorRomoSoloLecturaQA({document,catalogo});
 assert.deepEqual([info.productos,info.promociones,info.ingredientes],[7,3,40]);
 assert.equal(document.querySelectorAll('#ukiPriceList .romo-producto-consulta-qa').length,10);
 assert.equal(document.querySelectorAll('#ukiPromosListaResumen p').length,3);
 assert.equal(document.querySelectorAll('#ukiDispLista .romo-disponibilidad-consulta-qa').length,50);
 assert.equal(document.getElementById('ukiPriceCreate').disabled,true);
 assert.equal(document.getElementById('ukiPromoCreate').disabled,true);
 assert.match(document.getElementById('ukiPriceList').textContent,/No publicado/);
 assert.doesNotMatch(document.getElementById('ukiPriceList').textContent,/Pizza/);
 d.window.close();
});
test('Búsqueda en la misma lista y filtros por categoría sin alterar la base',()=>{
 const d=dom(),doc=d.window.document;
 let r=poblarEditorRomoSoloLecturaQA({document:doc,catalogo,busqueda:'sushi 24',categoria:'piezas'});
 assert.equal(r.mostrados,1);
 r=poblarEditorRomoSoloLecturaQA({document:doc,catalogo,busqueda:'korokes',categoria:'promociones',
  disponibilidadTipo:'ingredient',disponibilidadBusqueda:'pollo'});
 assert.equal(r.mostrados,2);
 assert.equal(doc.querySelectorAll('#ukiDispLista .romo-disponibilidad-consulta-qa').length,1);
 assert.ok(doc.querySelector('#ukiDispLista').textContent.includes('Pollo'));
 d.window.close();
});
test('Actualizar, búsqueda y filtros solamente hacen GET al lector inyectado',async()=>{
 const d=dom(),doc=d.window.document;
 let calls=0;
 assert.equal(montarCatalogoEnEditorRomoQA({document:doc,cargarAlAbrir:false,consultar:async()=>{calls++;return result}}),true);
 assert.equal(calls,0);
 for(const id of ['ukiPriceReload','ukiPriceSearch','ukiPriceGroup','ukiDispBuscar','ukiDispTipo','ukiDispRefrescar'])
  assert.equal(doc.getElementById(id).disabled,false);
 for(const id of ['ukiPriceCreate','ukiPromoCreate'])assert.equal(doc.getElementById(id).disabled,true);
 doc.getElementById('ukiPriceReload').click();await flush();
 assert.equal(calls,1);
 assert.equal(doc.querySelectorAll('#ukiPriceList article').length,10);
 doc.getElementById('ukiPriceSearch').value='36';
 doc.getElementById('ukiPriceSearch').dispatchEvent(new d.window.Event('input',{bubbles:true}));
 assert.equal(doc.querySelectorAll('#ukiPriceList article').length,1);
 doc.getElementById('ukiPriceSearch').value='';
 doc.getElementById('ukiPriceGroup').value='promociones';
 doc.getElementById('ukiPriceGroup').dispatchEvent(new d.window.Event('change',{bubbles:true}));
 assert.equal(doc.querySelectorAll('#ukiPriceList article').length,3);
 doc.getElementById('ukiDispTipo').value='ingredient';
 doc.getElementById('ukiDispTipo').dispatchEvent(new d.window.Event('change',{bubbles:true}));
 assert.equal(doc.querySelectorAll('#ukiDispLista p.romo-disponibilidad-consulta-qa').length,40);
 assert.equal(calls,1);
 doc.getElementById('ukiDispRefrescar').click();await flush();assert.equal(calls,2);
 d.window.close();
});
test('Rechaza carta de Uki y nunca convierte borradores en públicos',()=>{
 const d=dom(),document=d.window.document;
 for(const wrong of [
  {...catalogo,storeId:'uki:arica'},
  {...catalogo,products:[{...catalogo.products[0],name:'Pizza mozzarella'}]},
  {...catalogo,revision:-1},
  {...catalogo,products:[{...catalogo.products[0],sku:'uki:arica:24'}]}
 ]){
  assert.throws(()=>poblarEditorRomoSoloLecturaQA({document,catalogo:wrong}),/Romo|inválid/);
 }
 const visible=poblarEditorRomoSoloLecturaQA({document,catalogo});
 assert.equal(visible.productos,7);
 assert.match(document.getElementById('ukiPriceMessage').textContent,/^$/);
 assert.equal(catalogo.products[0].visible,false);
 d.window.close();
});
test('El montaje existente conserva consulta de inventario y no duplica catálogo',()=>{
 const d=dom(),doc=d.window.document;
 assert.equal(prepararConsultaRomoQA({document:doc,storeId:'romo:serena',qaOnly:true}),true);
 // Inventario conserva su consulta y Carta muestra su lista dentro de la plantilla.
 assert.equal(doc.querySelectorAll('.romo-consulta-qa').length,1);
 assert.equal(doc.getElementById('romoConsultaBotoncatalog'),null);
 assert.ok(doc.getElementById('ukiPriceList'));
 assert.equal(doc.getElementById('ukiPriceCreate').disabled,true);
 d.window.close();
});
