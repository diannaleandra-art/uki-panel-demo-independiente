import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const start=html.indexOf('async function ukiRomoMontarEditorDuenosEnPromosQA(){');
const stop=html.indexOf('function render(){',start);
assert.ok(start>=0&&stop>start,'El panel debe enlazar el editor de dueños a su interfaz');
const helper=html.slice(start,stop);
const make=({sucursal='Romo’s Sushi La Serena',area='promos',token='a'.repeat(42),status=200,detach=false}={})=>{
 let fetches=0,mounts=0;
 const root={isConnected:true,hidden:true};
 const S={suc:sucursal,vista:area};
 const window={
  ukiInventarioToken:async()=>token,
  romoMontarCartaEditorSeguroQA:async({container,storeId})=>{
   assert.equal(container,root);assert.equal(storeId,'romo:serena');
   mounts++;root.hidden=false;return true;
  }
 };
 const fetch=async(url,options)=>{
  fetches++;assert.equal(url,'/api/romo-carta-ediciones-seguras-qa');
  assert.equal(options.method,'GET');
  assert.equal(options.headers.Authorization,'Bearer '+token);
  if(detach)root.isConnected=false;
  return {ok:status===200,status,json:async()=>status===200?
   {ok:true,storeId:'romo:serena',products:Array(40).fill({sku:'x'})}:
   {ok:false,error:'No autorizado'}};
 };
 const context=vm.createContext({window,document:{getElementById:id=>{
  assert.equal(id,'romoCartaEditorDuenosQA');return root;
 }},S,ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena',fetch});
 vm.runInContext(helper,context,{timeout:300});
 return {context,root,S,get mounts(){return mounts},get fetches(){return fetches}};
};
test('No se presenta ningún editor a quien no tiene sesión Google',async()=>{
 const ctx=make({token:null});
 assert.equal(await ctx.context.ukiRomoMontarEditorDuenosEnPromosQA(),false);
 assert.equal(ctx.root.hidden,true);assert.equal(ctx.fetches,0);assert.equal(ctx.mounts,0);
});
test('No se presenta editor si el servidor rechaza el rol dueños',async()=>{
 const ctx=make({status:403});
 assert.equal(await ctx.context.ukiRomoMontarEditorDuenosEnPromosQA(),false);
 assert.equal(ctx.mounts,0);assert.equal(ctx.root.hidden,true);
});
test('Sólo dueño autorizado ve el editor y confirmación inicial',async()=>{
 const ctx=make();
 assert.equal(await ctx.context.ukiRomoMontarEditorDuenosEnPromosQA(),true);
 assert.equal(ctx.fetches,1);assert.equal(ctx.mounts,1);assert.equal(ctx.root.hidden,false);

});
test('No hay editor en otra marca ni sección',async()=>{
 for(const fields of [{sucursal:'Uki La Serena'},{area:'pedidos'}]){
  const ctx=make(fields);
  assert.equal(await ctx.context.ukiRomoMontarEditorDuenosEnPromosQA(),false);
  assert.equal(ctx.fetches,0);assert.equal(ctx.mounts,0);
 }
});
test('Si cambia de pantalla durante la verificación, no monta editor obsoleto',async()=>{
 const ctx=make({detach:true});
 assert.equal(await ctx.context.ukiRomoMontarEditorDuenosEnPromosQA(),false);
 assert.equal(ctx.mounts,0);
});
test('La pestaña Promos conserva banners y añade contenedor oculto para dueños',()=>{
 assert.match(html,/window\.ukiRomoBannerAdminMount\?\.\(\)/);
 assert.match(html,/<section id="romoCartaEditorDuenosQA" class="card" hidden><\/section>/);
 assert.match(html,/window\.romoMontarCartaEditorSeguroQA/);
 assert.match(html,/S\.suc===ROMO_SUCURSAL_QA&&S\.vista==='promos'/);
});
