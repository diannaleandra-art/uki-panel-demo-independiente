import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {consultarRomoSoloLecturaQA,prepararConsultaRomoQA} from '../firebase/uki-romo-consulta-qa.mjs';
const doc=JSON.parse(readFileSync(new URL('../data/romo-carta-origen-aprobado-20261112.json',import.meta.url),'utf8')).catalog;
const token='a'.repeat(64);
function fetchValid(area='catalog'){
 return async(url,opt)=>{
  assert.equal(url,'https://uki-sushi-inventario.vercel.app/api/romo-estado-operativo-qa?area='+area);
  assert.equal(opt.method,'GET');assert.equal(opt.credentials,'omit');
  assert.equal(opt.headers.Authorization,'Bearer '+token);
  return {ok:true,json:async()=>area==='catalog'
   ?{ok:true,storeId:'romo:serena',area,revision:1,catalog:doc,ventasHabilitadas:false}
   :{ok:true,storeId:'romo:serena',area,revision:0,
      inventory:{sucursal:'romo:serena',items:[]},ventasHabilitadas:false}};
 };
}
test('Consulta catálogo real de Romo con Google del panel sin POST',async()=>{
 const data=await consultarRomoSoloLecturaQA({area:'catalog',getToken:async()=>token,fetchFn:fetchValid()});
 assert.equal(data.catalog.products.length,7);
 assert.equal(data.catalog.promotions.length,3);
 assert.equal(data.catalog.ingredients.length,40);
 assert.ok(data.catalog.products.every(x=>x.visible===false));
});
test('Consulta inventario Romo sin inventar existencias ni ir a Uki',async()=>{
 const data=await consultarRomoSoloLecturaQA({area:'inventory',getToken:async()=>token,fetchFn:fetchValid('inventory')});
 assert.deepEqual(data.inventory.items,[]);
});
test('Sin Google o área válida no ejecuta consultas',async()=>{
 let calls=0;
 for(const args of [
  {area:'orders',getToken:async()=>token},
  {area:'catalog',getToken:async()=>null},
  {area:'inventory',getToken:async()=>''}
 ]){
  await assert.rejects(consultarRomoSoloLecturaQA({...args,fetchFn:async()=>{calls++;throw Error('No')}}));
 }
 assert.equal(calls,0);
});
test('Rechaza respuestas cruzadas, precios ajenos y ventas inesperadamente activas',async()=>{
 for(const bad of [
  {storeId:'uki:arica'},
  {ventasHabilitadas:true},
  {catalog:{...doc,storeId:'uki:serena'}},
  {catalog:{...doc,products:[{...doc.products[0],name:'Pizza Pepperoni'}]}}
 ]){
  await assert.rejects(consultarRomoSoloLecturaQA({area:'catalog',getToken:async()=>token,
   fetchFn:async()=>({ok:true,json:async()=>({
    ok:true,storeId:'romo:serena',area:'catalog',revision:1,catalog:doc,
    ventasHabilitadas:false,...bad
   })})}),/Romo|inválido/);
 }
});
test('Pintado solo lectura reutiliza el panel original y no ejecuta redes',()=>{
 const d=new JSDOM('<body class="romo-qa"><main id="app"><div id="romoLaSerenaPreparacionQA"></div>'+
  '<section id="ukiPreciosPanel"><button id="guardar">Guardar</button></section>'+
  '<div id="invRoot"></div></main></body>');
 assert.equal(prepararConsultaRomoQA({document:d.window.document,storeId:'romo:serena',qaOnly:true}),true);
 assert.equal(d.window.document.querySelectorAll('.romo-consulta-qa').length,2);
 assert.equal(d.window.document.getElementById('guardar').disabled,false);
 assert.equal(prepararConsultaRomoQA({document:d.window.document,storeId:'uki:arica',qaOnly:true}),false);
 const source=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
 assert.match(source,/ROMO_PANEL_LECTURA_SOLA_ENABLED/);
 assert.match(source,/readonlyRequest/);
 assert.match(source,/romoPrivateReadConfig/);
 assert.match(source,/resolveRomoIdentity/);
 d.window.close();
});
