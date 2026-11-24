'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const c=require('../lib/romo-seguimiento-transferencia-v1.cjs');
const id='621bd292-2153-4160-9e85-375978e10352',key='4ba72a9f6f8c47a1bdd021e91aa2d382',secret='testonly-0123456789-long-secret-9876543210';
test('enlace privado firmado sin divulgar clave de servidor',()=>{
 const t=c.issueToken(id,key,secret);
 assert.deepEqual(c.readToken(t,secret),{id,key});
 assert.equal(c.readToken(t.slice(0,-1)+'x',secret),null);
 assert.equal(c.readToken(t,secret+'otro'),null);
});
test('no enlaza pedidos sin token verificable',()=>{
 assert.equal(c.readToken('cualquiercosa',secret),null);
 assert.throws(()=>c.issueToken('id-invalido',key,secret));
});
test('transferencia utiliza total, no inventa pagos mixtos',()=>{
 assert.equal(c.transferAmount({metodo:'transferencia',total:18000}),18000);
 assert.equal(c.transferAmount({metodo:'efectivo',total:18000}),null);
 assert.equal(c.transferAmount({metodo:'transferencia',total:18000,transferenciaMonto:5000}),5000);
 assert.equal(c.transferAmount({metodo:'transferencia',total:18000,transferenciaMonto:19000}),null);
});
test('avisar transferencia NO equivale a pago confirmado',()=>{
 assert.equal(c.customerStatus({orderStatus:'aceptada',transferStatus:'avisada',method:'transferencia'}).paid,false);
 assert.equal(c.customerStatus({orderStatus:'aceptada',transferStatus:'confirmada',method:'transferencia'}).paid,true);
});
test('no finalizar transferencia pendiente aunque pedido aparezca pagado',()=>{
 assert.equal(c.canFinalize({estado:'Pendiente',medio:'Transferencia',pagado:true},false),false);
 assert.equal(c.canFinalize({estado:'Pendiente',medio:'Transferencia',pagado:false},true),false);
 assert.equal(c.canFinalize({estado:'Pendiente',medio:'Transferencia',pagado:true},true),true);
});
