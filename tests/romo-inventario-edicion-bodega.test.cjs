'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {normalize}=require('node:path');
const root=normalize(__dirname+'/../public/romo-panel-qa/');
const list=fs.readFileSync(root+'uki-inventario-historial-admin.js','utf8');
const admin=fs.readFileSync(root+'uki-inventario-admin-embebido.js','utf8');
const local=fs.readFileSync(root+'index.html','utf8');
const fresh={sku:'ingredient:vegetal-aceituna-amarga',name:'Aceituna amarga',stock_qty:0.125,stock_unit:'kg',min_stock_qty:0,version:2};
const old={sku:'r_base_vegetal_aceituna_amarga',name:fresh.name,stock_qty:0,min_stock_qty:0};
function extract(src,start,end){return src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));}
test('Romo hace clic sobre la ficha vigente, no sobre el SKU del inventario anterior',async()=>{
 const nodes={
  invRoot:{},ukiMiniInventario:{},ukiMiniFilas:{replaceChildren(){}},
  invSearch:{dispatchEvent(){}},
  invSelect:{options:[{value:fresh.sku}],dispatchEvent(e){if(e.type==='change')this.opened=this.value;}},
  invAdmin:{hidden:false,style:{},focus(){this.focused=true;},scrollIntoView(){this.revealed=true;}}
 };
 const x={items:[old],loaded:false};let live,queries=0;
 const context={x,$:id=>nodes[id],sucursal:()=>'romo',nombreSucursal:()=>'',status(){},
  renderCurrent(){},request:()=>{throw Error('No consulta la lista antigua de Romo');},
  Event,document:{addEventListener(name,fn){assert.equal(name,'romo:existencias-panel-actualizadas');live=fn;}},
  window:{async romoConsultarExistenciasPanelQA({refresh}){
   assert.equal(refresh,true);queries++;
   return {items:[fresh],loadedAt:'2026-11-27T00:43:00Z'};
  }}
 };
 const script=extract(list,'function aplicarExistencias(','function currentSnapshot(')+'\n;({loadCurrent,edit})';
 const {loadCurrent,edit}=vm.runInNewContext(script,context);
 await loadCurrent(true);
 assert.equal(queries,1);
 assert.equal(x.items[0],fresh);
 edit(x.items[0].sku);
 assert.equal(nodes.invSelect.opened,fresh.sku);
 assert.equal(nodes.invAdmin.revealed,true);
 live({detail:{root:nodes.invRoot,items:[{...fresh,min_stock_qty:2}]}});
 assert.equal(x.items[0].min_stock_qty,2);
});
test('la edición y las consultas de Romo conservan el control del catálogo compartido',async()=>{
 const code=extract(admin,'async function requestSharedRomo(','async function romoArticuloOperacion(')+'\n;requestRomo';
 const X={branch:'romo',shared:false,items:[fresh],romoRevision:1};
 const sent=[];
 const result=vm.runInNewContext(code,{
  X,S:{suc:'Romo’s Sushi La Serena'},window:{ukiInventarioToken:async()=>'x'.repeat(32)},
  API:'https://uki-sushi-inventario.vercel.app/api/inventario-turno-live',
  fetch:async(url,opt)=>{
   const params=opt.body?JSON.parse(opt.body):null;
   sent.push({url,method:opt.method,params});
   if(url==='/api/romo-inventario-qa')return {ok:true,json:async()=>({ok:true,storeId:'romo:serena',revision:1,
    contenido:{version:1,items:[old],movimientos:[]},bodegaCompartida:true})};
   return {ok:true,json:async()=>({ok:true,branch:'serena',items:[fresh],revisiones:[]})};
  }
 });
 const live=await result('inventario-completo');
 assert.equal(live.items[0].sku,fresh.sku);
 assert.equal(live.items[0].stock_qty,0.125);
 await result('configurar-unidad',{sku:fresh.sku,stock_unit:'kg',stock_qty:0.125,min_stock_qty:2,expected_version:2});
 assert.equal(sent.filter(x=>x.url==='/api/romo-inventario-qa'&&x.method==='POST').length,0);
 assert.deepEqual(sent.at(-1).params,{branch:'serena',action:'configurar-unidad',sku:fresh.sku,stock_unit:'kg',stock_qty:0.125,min_stock_qty:2,expected_version:2});
 await assert.rejects(result('configurar-unidad',{},'arica'),/solo consulta/);
 assert.match(local,/uki-inventario-admin-embebido\.js\?v=20261126-editar-bodega-v1/);
 assert.match(local,/uki-inventario-historial-admin\.js\?v=20261127-agenda-recepcion-v1/);
});
