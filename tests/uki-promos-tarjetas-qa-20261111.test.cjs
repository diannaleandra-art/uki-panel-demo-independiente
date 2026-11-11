'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
const cut=(a,b)=>{const i=js.indexOf(a),j=js.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Marcador faltante: '+a);return js.slice(i,j)};
test('El script administrativo completo conserva sintaxis JavaScript válida',()=>assert.doesNotThrow(()=>new vm.Script(js)));
test('Crear promoción y editar existentes están separados en secciones independientes',()=>{
 const fn=cut('function organizarCarta(){','function mount(){');
 for(const id of ['ukiPromoNuevaZona','ukiPromoExistentesZona','ukiPromoAddBox','ukiPromosResumen'])assert.match(fn,new RegExp(id));
 assert.match(fn,/areas.promociones.append\(crearArea,existentes\)/);
 assert.match(js,/\$\('ukiPromoCreate'\)\.onclick=\(\)=>void crearPromo\(\)/);
});
test('Cada promoción está cerrada de inicio, con su propio precio, estado, editar y retirar',()=>{
 const src=cut('function renderPromoResumen(){','function renderPrices(){');
 const element=tag=>({
  tag,children:[],style:{},className:'',value:'',textContent:'',append(...a){this.children.push(...a)},
  replaceChildren(...a){this.children=[...a]}
 });
 const output=element('div'),search=element('input');
 const state={items:[
   {sku:'monthly:demo1',kind:'monthly',name:'Promo A',price:7000,available:true,estadoPublicacion:'Publicada'},
   {sku:'monthly:demo2',kind:'monthly',name:'Promo B',price:9000,available:true,estadoPublicacion:'Borrador'}]};
 let edits=0,vis=0;
 const ctx={$:id=>id==='ukiPromosListaResumen'?output:id==='ukiPromoBuscar'?search:null,
  state,document:{createElement:element},
  peso:n=>'$'+n,line:()=>{edits++;return element('div')},
  visibilityControl:()=>{vis++;return element('button')}};
 const render=vm.runInNewContext(src+'\nrenderPromoResumen',ctx);
 render();
 const cards=output.children.filter(c=>c.className==='uki-promo-edicion-card');
 assert.equal(cards.length,2);assert.equal(edits,2);assert.equal(vis,2);
 for(const card of cards){assert.equal(card.tag,'details');assert.notEqual(card.open,true);
  assert.equal(card.children[0].tag,'summary');assert.equal(card.children[1].tag,'section');}
});
test('Se conserva la edición del precio y el manejo por sucursal',()=>{
 assert.match(js,/request\(API,'editar-precio'/);
 assert.match(js,/request\(API,'crear-promocion'/);
 assert.match(js,/request\(API,'editar-promocion'/);
 assert.match(js,/request\(API,action,/);
 assert.match(js,/const selectedBranch=branch\(\)/);
});
