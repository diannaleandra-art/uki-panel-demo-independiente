import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluarPreparacionRomoQA,consultarPreparacionRomoQA,ROMO_DIAGNOSTICO_HABILITADO_QA}
 from '../lib/romo-preparacion-integral-qa.mjs';
const catalogo={storeId:'romo:serena',
 products:[{sku:'romo:piezas:24',visible:false}],
 promotions:[{sku:'romo:promo:60',visible:false}]};
const duenos={brand:'romo',role:'duenos',branches:['serena'],userId:'test'};
test('un catálogo con todos los productos ocultos no está listo',()=>{
 const r=evaluarPreparacionRomoQA({catalogo,personal:1});
 assert.equal(r.datos.tieneCatalogo,true);
 assert.equal(r.datos.productosVisibles,0);
 assert.equal(r.datos.promocionesVisibles,0);
 assert(r.bloqueos.some(x=>x.includes('visibles')));
 assert.equal(r.listoParaPublicar,false);
 assert.equal(ROMO_DIAGNOSTICO_HABILITADO_QA,false);
});
test('aunque haya productos visibles, no sustituye prueba ni autorización',()=>{
 const r=evaluarPreparacionRomoQA({catalogo:{...catalogo,
  products:[{visible:true}]},personal:5,solicitudes:4,estados:1});
 assert.equal(r.datos.productosVisibles,1);
 assert.equal(r.listoParaVentas,false);
 assert(r.bloqueos.some(x=>x.includes('dos teléfonos')));
});
test('diagnóstico único hace solo SELECT a Romo con storeId fijo',async()=>{
 const calls=[];let ix=0;
 const returns=[[{contenido:catalogo}],[{n:1}],[{n:0}],[{n:0}]];
 const db={query:async(sql,args)=>{calls.push([sql,args]);return returns[ix++]}};
 const r=await consultarPreparacionRomoQA({db,identity:duenos});
 assert.equal(r.datos.empleadosAutorizados,1);
 assert.equal(calls.length,4);
 for(const [sql,args] of calls){
  assert.match(sql,/^SELECT /);assert.match(sql,/public\.romo_/);
  assert.deepEqual(args,['romo:serena']);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE)\b/i);
 }
});
test('sin rol dueños ni sucursal Romo no hay lectura alguna',async()=>{
 let called=0;
 const db={query:async()=>{called++;return [];}};
 for(const identity of [null,{...duenos,role:'agendador'},
  {...duenos,brand:'uki'},{...duenos,branches:['arica']}])
  await assert.rejects(consultarPreparacionRomoQA({db,identity}),/dueños/);
 assert.equal(called,0);
});
test('no confundir Uki ni permitir cierres Romo locales',()=>{
 assert.throws(()=>evaluarPreparacionRomoQA({catalogo:{...catalogo,storeId:'uki:serena'}}));
 assert.throws(()=>evaluarPreparacionRomoQA({catalogo:{...catalogo,products:[{visible:null}]}}));
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(html,/async function cerrar\(\)\{\s*if\(S\.suc===ROMO_SUCURSAL_QA\)/);
 assert.match(html,/async function ndGuardar\(\)\{\s*\/\/ QA Romo:/);
});
