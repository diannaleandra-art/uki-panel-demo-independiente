'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../firebase/uki-romo-carta-panel-qa.js'),'utf8');
function createDOM(){
 const nodes=new Map();
 const make=tag=>({
  tagName:tag,children:[],disabled:false,textContent:'',className:'',dataset:{},style:{},addEventListener() {},
  appendChild(child){this.children.push(child)},
  append(...children){this.children.push(...children)},
  replaceChildren(...children){this.children=[...children]}
 });
 const document={createElement:make,getElementById(id){return nodes.get(id)||null}};
 for(const id of ['romoQACartaEstado','romoQACartaConsultar','romoQACartaBuscar','romoQACartaAnteriorEstado','romoQACartaAnteriorListado','romoQACategoriaproductos','romoQACategoriapromociones','romoQACategoriaingredientes','romoQACartaAgregar','romoQACartaEditor','romoQAEditorEstado','romoQAEditorSeccion','romoQAEditorTipo','romoQAEditorNombre','romoQAEditorDescripcion','romoQAEditorPrecio','romoQAEditorRolls','romoQAEditorPorRoll','romoQAEditorSalsas','romoQAEditorKorokes','romoQAEditorDisponible','romoQAEditorPromoExtras','romoQAEditorFoto','romoQAEditorGuardar'])
  nodes.set(id,make('div'));
 return {document,nodes};
}
function run(){
 const {document,nodes}=createDOM();
 const win={document,location:{hostname:'example.net'},crypto:{randomUUID:()=> '12345678-1234-4123-8123-123456789abc'},confirm:()=>true};
 const ctx={window:win,Intl,structuredClone,setTimeout,clearTimeout,AbortController,fetch:async()=>{throw Error('No debe hacer red')}};
 vm.runInNewContext(source,ctx);
 return {win,nodes};
}
const payload=()=>({ok:true,storeId:'romo:serena',revision:1,catalog:{
 formato:'romo-catalogo-v1',sucursal:'romo:serena',
 productos:[{sku:'romo:gohan',name:'Gohan',price:6000,available:true,visible:true}],
 promociones:[{sku:'romo:24',name:'Promo 24',price:7000,available:false,visible:false,pieces:24,rollCount:2,sauceCount:1,korokes:2}],
 ingredientes:[{sku:'romo:palta',name:'Palta',price:0,available:true,visible:true}]
}});
test('mismo panel incluye vista Romo sin segundo login ni menú',()=>{
 assert.match(html,/uki-romo-carta-panel-qa\.js/);
 assert.match(html,/ukiRomoCartaPanelHTMLQA\?\.\(\)/);
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/SUCURSALES_PANEL_QA\.map\(s=>/);
});
test('vista de Romo muestra carta, promociones, ingredientes e inventario en un solo lugar',()=>{
 const {win}=run();
 const ui=win.ukiRomoCartaPanelHTMLQA();
 for(const value of ['Carta y precios','romoQACategoriaproductos','romoQACategoriapromociones','romoQACategoriaingredientes','Inventario'])
  assert.ok(ui.includes(value),value);
 assert.doesNotMatch(ui,/Crear acceso|Registrar nuevo pedido|Cobrar pedido/);
});
test('API cliente deshabilitada por defecto: no consulta Uki ni hace ventas',async()=>{
 const {win,nodes}=run();
 assert.equal(await win.ukiRomoCartaPanelConsultarQA(),false);
 assert.match(nodes.get('romoQACartaEstado').textContent,/versión protegida de pruebas/i);
 assert.match(source,/const ENDPOINT='\/api\/romo-catalogo-qa';/);
 assert.doesNotMatch(source,/localStorage\.setItem|S\.suc\s*=/);
});
test('normaliza lectura Romo sin texto HTML ejecutable ni datos cruzados',()=>{
 const {win,nodes}=run();
 const p=payload();
 p.catalog.productos[0].name='<img src=x onerror=alert(1)>';
 win.ukiRomoCatalogoRenderQA(p);
 const rows=nodes.get('romoQACategoriaproductos').children;
 assert.equal(rows[1].children[0].textContent,'<img src=x onerror=alert(1)>');
 assert.equal(rows[1].children[0].children.length,0);
 assert.match(nodes.get('romoQACartaEstado').textContent,/revisión 1/i);
 p.catalog.sucursal='uki:serena';
 assert.throws(()=>win.ukiRomoCatalogoRenderQA(p));
});
test('rechaza artículos con códigos ajenos a Romo',()=>{
 const {win}=run(),p=payload();
 p.catalog.productos[0].sku='uki:gohan';
 assert.throws(()=>win.ukiRomoCatalogoRenderQA(p));
});

test('sin permiso servidor no aparecen controles de edición',()=>{
 const {win,nodes}=run();
 win.ukiRomoCatalogoRenderQA({...payload(),edicionHabilitada:false});
 assert.equal(nodes.get('romoQACartaAgregar').hidden,true);
 assert.equal(nodes.get('romoQACartaEditor').hidden,true);
});
test('añadir borrador y guardar requiere URL de prueba, dueño y confirmación',async()=>{
 const {win,nodes}=run();
 win.ukiRomoCatalogoRenderQA({...payload(),edicionHabilitada:true});
 assert.equal(win.ukiRomoCartaPanelAgregarQA(),false);
 assert.equal(await win.ukiRomoCartaPanelGuardarQA(),false);
 assert.match(nodes.get('romoQAEditorEstado').textContent,/no habilitada/i);
});

test('fotos antiguas son galería QA, no asociación automática',()=>{
 const {win,nodes}=run();
 const html=win.ukiRomoCartaPanelHTMLQA();
 for(const name of ['promo-foto-1.jpg','promo-foto-2.jpg','promo-foto-3.jpg','promo-foto-4.jpg'])assert.ok(html.includes(name));
 const response={...payload(),edicionHabilitada:false};
 response.catalog.promociones[0].photoId='promo-foto-3';
 win.ukiRomoCatalogoRenderQA(response);
 const card=nodes.get('romoQACategoriapromociones').children[1];
 assert.equal(card.children.find(x=>x.tagName==='img').src,'./romo-assets/promo-foto-3.jpg');
});

test('consulta catálogo anterior sólo para revisión, sin copiar precios ni usar POST',async()=>{
 const {win,nodes}=run();
 const html=win.ukiRomoCartaPanelHTMLQA();
 assert.ok(html.includes('Revisar productos de la carta anterior'));
 assert.equal(await win.ukiRomoCartaAnteriorConsultarQA(),false);
 assert.match(nodes.get('romoQACartaAnteriorEstado').textContent,/versión privada/i);
 assert.doesNotMatch(source,/fetch\('\/rest\/v1\/romos_products/);
});

test('precios acordados se ven sólo en revisión Romo sin alta ni sumas nuevas',()=>{
 const {win}=run();
 const html=win.ukiRomoCartaPanelHTMLQA();
 for(const pieces of [24,36,48,60,72,84,96])assert.ok(html.includes(pieces+' piezas'),pieces);
 for(const prices of ['8.000','12.000','16.000','19.000','21.000','24.000','26.000'])
  assert.ok(html.includes(prices),prices);
 for(const promo of ['24 piezas + 2 korokes','60 piezas + 3 korokes','72 piezas'])
  assert.ok(html.includes(promo),promo);
 assert.ok(html.includes('No volver a sumar $500'));
 assert.ok(html.includes('No están cargados en Neon ni publicados'));
});

test('buscar por nombre en Carta y precios sin perder borradores ni cambiar precios',()=>{
 const {win,nodes}=run();
 const p=payload();
 win.ukiRomoCatalogoRenderQA({...p,edicionHabilitada:false});
 assert.equal(win.ukiRomoCartaPanelBuscarQA('gohan'),true);
 assert.equal(nodes.get('romoQACategoriaproductos').children.length,2);
 assert.equal(nodes.get('romoQACategoriapromociones').children.length,2);
 assert.equal(nodes.get('romoQACategoriapromociones').children[1].textContent,'Sin registros todavía. No se han copiado datos de Uki.');
 assert.equal(win.ukiRomoCartaPanelBuscarQA(''),true);
 assert.equal(nodes.get('romoQACategoriapromociones').children[1].children[0].textContent,'Promo 24');
 assert.match(source,/ROMO_PRECIOS_ACORDADOS_QA=Object.freeze/);
});

test('ingresos de Romo usan el mismo procedimiento de Uki sin duplicar cuentas',()=>{
 const {win}=run();
 const ui=win.ukiRomoCartaPanelHTMLQA();
 assert.match(ui,/Ingresos · igual que Uki/);
 assert.match(ui,/misma cuenta Google del panel y contraseña habitual/);
 assert.match(ui,/no lo concede/);
 assert.match(ui,/nombre y usar un código exclusivo de inventario de 6 números/);
 assert.match(ui,/El código de inventario no abre pedidos, caja ni cierres/);
 assert.match(ui,/no introduzcas códigos de trabajadores en esta pantalla de prueba/);
 assert.doesNotMatch(ui,/id="romoNuevoGoogle"|id="romoNuevoPin"/);
 assert.match(html,/Vista de prueba abierta con la clave habitual de Uki/);
});
