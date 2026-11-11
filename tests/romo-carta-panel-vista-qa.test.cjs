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
  tagName:tag,children:[],disabled:false,textContent:'',className:'',
  appendChild(child){this.children.push(child)},
  append(...children){this.children.push(...children)},
  replaceChildren(...children){this.children=[...children]}
 });
 const document={createElement:make,getElementById(id){return nodes.get(id)||null}};
 for(const id of ['romoQACartaEstado','romoQACartaConsultar','romoQACategoriaproductos','romoQACategoriapromociones','romoQACategoriaingredientes'])
  nodes.set(id,make('div'));
 return {document,nodes};
}
function run(){
 const {document,nodes}=createDOM();
 const win={document};
 const ctx={window:win,Intl,setTimeout,clearTimeout,AbortController,fetch:async()=>{throw Error('No debe hacer red')}};
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
 assert.match(nodes.get('romoQACartaEstado').textContent,/no está habilitada/i);
 assert.match(source,/const ENDPOINT='';/);
 assert.doesNotMatch(source,/method:'POST'|localStorage\.setItem|S\.suc\s*=/);
});
test('normaliza lectura Romo sin texto HTML ejecutable ni datos cruzados',()=>{
 const {win,nodes}=run();
 const p=payload();
 p.catalog.productos[0].name='<img src=x onerror=alert(1)>';
 win.ukiRomoCatalogoRenderQA(p);
 const rows=nodes.get('romoQACategoriaproductos').children;
 assert.equal(rows[1].children[0].textContent,'<img src=x onerror=alert(1)>');
 assert.equal(rows[1].children[0].children.length,0);
 assert.match(nodes.get('romoQACartaEstado').textContent,/Revisión 1/);
 p.catalog.sucursal='uki:serena';
 assert.throws(()=>win.ukiRomoCatalogoRenderQA(p));
});
test('rechaza artículos con códigos ajenos a Romo',()=>{
 const {win}=run(),p=payload();
 p.catalog.productos[0].sku='uki:gohan';
 assert.throws(()=>win.ukiRomoCatalogoRenderQA(p));
});
