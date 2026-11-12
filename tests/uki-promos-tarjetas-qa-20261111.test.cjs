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
 const state={promocionesHabilitadas:true,items:[
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

test('Categorías tienen espacio propio para crear y asignar, sin mezclarse con promociones',()=>{
 const fn=cut('function organizarCarta(){','function mount(){');
 for(const mark of ['ukiCartaAreaCategorias','ukiCategoriaBuscar','ukiCategoriaAsignaciones','ukiCategoriesBox']) {
  if(mark==='ukiCartaAreaCategorias')assert.match(fn,/\['categorias','🗂 Categorías'/);
  else assert.ok(fn.includes(mark),'Falta '+mark);
 }
 assert.match(fn,/advanced\.append\(advancedHeading,categorySearchLabel,categorySearch,categoryAssignments\)/);
 assert.match(fn,/areas\.categorias\.append\(advanced\)/);
 assert.match(fn,/move\(\$\('ukiCategoriesBox'\),areas\.categorias\)/);
 const categoryCode=cut('function renderCategoryAssignments(){','function renderCategories(){');
 assert.match(categoryCode,/request\(API,'asignar-categoria'/);
 assert.match(categoryCode,/selector\.value=item\.categoriaSlug\|\|''/);
 assert.match(categoryCode,/categoryVisibleLimit/);
 assert.match(categoryCode,/if\(chosen!==branch\(\)\)return/);
});
test('Una sola lista de promociones: el filtro general no ofrece Promos del mes duplicadas',()=>{
 const source=js.slice(js.indexOf('const pricesPanel='),js.indexOf('window.ukiInventarioPanelHTML='));
 assert.doesNotMatch(source,/<option value="monthly">Promos del mes<\/option>/);
 assert.match(js,/areas\.promociones\.append\(crearArea,existentes\)/);
 assert.match(js,/renderPromoResumen\(\)/);
});

test('Se puede seleccionar una categoría propia al agregar un producto, con guardado por sucursal',async()=>{
 const elements={
  ukiPriceNewKind:{value:'dish'},ukiPriceNewCategory:{value:'almuerzos'},
  ukiPriceNewName:{value:'Gohan vegetariano'},ukiPriceNewDesc:{value:'Vegetales frescos'},
  ukiPriceNewAmount:{value:'6500'},ukiPriceCreate:{disabled:false},ukiPriceAddBox:{open:true}
 };
 const calls=[];let message='';
 const ctx={
  $:id=>elements[id],branch:()=> 'serena',API:'QA',
  state:{busy:false,categoriasDescuentosHabilitados:true,categorias:[{slug:'almuerzos'}]},
  request:async(api,action,params,br)=>{
   calls.push({action,params,branch:br});
   return action==='crear-producto'?{item:{sku:'dish:gohan-qa-1'}}:{ok:true};
  },
  loadPrices:async()=>{},info:(id,text)=>{message=text}
 };
 const create=vm.runInNewContext(cut('async function create(){','async function loadReponer(){')+'\ncreate',ctx);
 await create();
 assert.equal(calls.length,2);
 assert.equal(calls[0].action,'crear-producto');
 assert.equal(calls[1].action,'asignar-categoria');
 assert.equal(calls[1].params.categoriaSlug,'almuerzos');
 assert.equal(calls[1].params.sku,'dish:gohan-qa-1');
 assert.equal(calls[1].branch,'serena');
 assert.match(message,/con su categoría/);
 assert.equal(elements.ukiPriceAddBox.open,false);
});
test('Si falla asignar categoría, NO afirma que el producto no se creó',async()=>{
 const els={ukiPriceNewKind:{value:'dish'},ukiPriceNewCategory:{value:'almuerzos'},
  ukiPriceNewName:{value:'Gohan QA'},ukiPriceNewDesc:{value:'Vegetales'},
  ukiPriceNewAmount:{value:'6500'},ukiPriceCreate:{disabled:false},ukiPriceAddBox:{open:true}};
 let message='',creates=0;
 const ctx={$:id=>els[id],branch:()=> 'arica',API:'QA',
  state:{busy:false,categoriasDescuentosHabilitados:true,categorias:[{slug:'almuerzos'}]},
  request:async(_,action)=>{
   if(action==='crear-producto'){creates++;return {item:{sku:'dish:qa'}};}
   throw Error('Categoría temporalmente no disponible');
  },loadPrices:async()=>{},info:(_,msg)=>{message=msg}};
 const create=vm.runInNewContext(cut('async function create(){','async function loadReponer(){')+'\ncreate',ctx);
 await create();
 assert.equal(creates,1);assert.match(message,/Producto .* creado, pero su categoría no se guardó/);
 assert.match(message,/no vuelvas a agregar el producto/);
});
test('La lista de categorías se carga en el formulario del producto al abrir la sucursal',()=>{
 const f={ukiCategoriesBox:{hidden:true},ukiCategoriesList:{textContent:''},
  ukiPriceNewCategoryBox:{hidden:true},
  ukiPriceNewCategory:{value:'',options:[],disabled:false,
   replaceChildren(...items){this.options=[...items];this.value=items[0]?.value||'';},
   add(item){this.options.push(item)}}};
 let rendered=false;
 const ctx={$:id=>f[id],Option:function(text,value){return {text,value}},
  state:{categoriasDescuentosHabilitados:true,categorias:[{slug:'almuerzos',nombre:'Almuerzos'}]},
  renderCategoryAssignments:()=>{rendered=true}};
 const render=vm.runInNewContext(cut('function renderCategories(){','async function crearCategoria(){')+'\nrenderCategories',ctx);
 render();
 assert.equal(f.ukiPriceNewCategoryBox.hidden,false);
 assert.deepEqual(f.ukiPriceNewCategory.options.map(x=>x.value),['','almuerzos']);
 assert.equal(rendered,true);
});
test('La tarjeta de promoción muestra porcentaje y precio final sin alterar precio original',()=>{
 const make=tag=>({tag,style:{},children:[],textContent:'',className:'',append(...x){this.children.push(...x)},replaceChildren(...x){this.children=[...x]}});
 const target=make('root');
 const ctx={$:id=>id==='ukiPromosListaResumen'?target:id==='ukiPromoBuscar'?{value:''}:null,
  document:{createElement:make},state:{promocionesHabilitadas:true,items:[{
   kind:'monthly',sku:'monthly:promo-72',name:'72 piezas',price:18000,
   precioOriginal:18000,precioFinal:14400,descuentoPorcentaje:20,visible:true,estadoPublicacion:'Publicada'
  }]},line:()=>make('div'),visibilityControl:()=>make('button')};
 vm.runInNewContext(cut('function renderPromoResumen(){','function renderPrices(){')+'\nrenderPromoResumen()',ctx);
 const card=target.children.find(x=>x.className==='uki-promo-edicion-card');
 assert.ok(card);
 const status=card.children[0].children[1];
 const offer=status.children.find(x=>x.className==='uki-promo-descuento');
 assert.match(offer.textContent,/20% menos.*14[.]400 final/);
 assert.match(status.children[0].textContent,/18[.]000/);
});
