'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {listing,modifyPrice}=require('../api/uki-carta-precios-live.js')._testing;
function fixture(){
 const calls=[];
 const sql={query:async(q,params)=>{
  calls.push({sql:q,params});
  assert.equal(params.length,1);
  if(q.includes('uki_carta_items_v1')){
   return params[0]==='arica'?
    [{sku:'classic:24',price:8700,available:false,version:4},
     {sku:'dish:gyozas-pollo',price:3800,available:true,version:2}]:
    [{sku:'classic:24',price:7300,available:true,version:1}];
  }
  if(q.includes('uki_carta_productos_custom_v1')){
   return params[0]==='arica'?
    [{sku:'pizza:cuatro-quesos-ab12cd34',kind:'pizza',group_key:'pizzas',name:'Pizza Cuatro Quesos',
      description:'Cuatro quesos',price:10900,available:true,version:1}]:[];
  }
  if(q.includes('uki_carta_promos_custom_v1')||q.includes('uki_carta_visibilidad_v1'))return [];
  throw Error('SQL inesperada');
 }};
 return {sql,calls};
}
test('la carta aplica precio y agotado manual sin cruzar Regimiento Arica y La Serena',async()=>{
 const {sql,calls}=fixture();
 const [arica,serena]=await Promise.all([listing(sql,'arica'),listing(sql,'serena')]);
 const a=arica.find(x=>x.sku==='classic:24'),s=serena.find(x=>x.sku==='classic:24');
 assert.equal(a.price,8700);
 assert.equal(a.available,false,'cambiar precio no debe reactivar un agotado');
 assert.equal(a.version,4);
 assert.equal(s.price,7300);
 assert.equal(s.available,true);
 assert.equal(s.version,1);
 assert.ok(arica.some(x=>x.kind==='pizza'&&x.custom===true&&x.name==='Pizza Cuatro Quesos'));
 assert.ok(!serena.some(x=>x.kind==='pizza'),'La Serena no comercializa pizzas');
 assert.ok(!arica.some(x=>x.kind==='ingredient'),'los insumos no son productos de venta');
 assert.ok(calls.every(x=>x.params[0]==='arica'||x.params[0]==='serena'));
});
test('editar precio de un producto existente conserva agotado, stock y control de concurrencia',async()=>{
 let query='',params=[];
 const sql={query:async(q,p)=>{
  query=q;params=p;return [{sku:p[1],price:p[6],version:5}];
 }};
 const item={sku:'classic:24',kind:'classic',group:'promos',name:'Sushi clásico 24 piezas',
  description:'',price:8700,available:false,version:4,custom:false};
 const r=await modifyPrice(sql,'arica',item,9000,4,'usuario-autorizado');
 assert.equal(r[0].price,9000);
 assert.ok(/ON CONFLICT\(branch,sku\) DO UPDATE SET price/.test(query));
 assert.ok(/version=\$9/.test(query));
 assert.ok(!/SET\s+available=/.test(query));
 assert.ok(!/SET\s+stock_qty=/.test(query));
 assert.deepEqual(params,[
  'arica','classic:24','classic','promos','Sushi clásico 24 piezas','',
  9000,'usuario-autorizado',4
 ]);
});
test('editar nueva pizza limita precio por versión y sucursal, sin editar inventario',async()=>{
 let query='',params=[];
 const sql={query:async(q,p)=>{query=q;params=p;return[{sku:p[1],price:p[2],version:2}];}};
 const item={sku:'pizza:cuatro-quesos-ab12cd34',custom:true};
 const r=await modifyPrice(sql,'arica',item,11900,1,'usuario-autorizado');
 assert.equal(r[0].price,11900);
 assert.match(query,/uki_carta_productos_custom_v1/);
 assert.match(query,/WHERE branch=\$1 AND sku=\$2 AND version=\$4/);
 assert.doesNotMatch(query,/stock_qty|available=\$/);
 assert.deepEqual(params,['arica','pizza:cuatro-quesos-ab12cd34',11900,1,'usuario-autorizado']);
});
