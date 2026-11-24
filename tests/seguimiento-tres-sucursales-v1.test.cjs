'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const s=require('../lib/seguimiento-tres-sucursales-v1.cjs');
const stores=['uki:arica','uki:serena','romo:serena'];
for(const tienda of stores){
 test(tienda+' · seguimiento idéntico y separado',()=>{
  const pay=[{medio:'Transferencia',monto:12000},{medio:'Efectivo',monto:6000}];
  assert.deepEqual(s.statusForClient({storeId:tienda,orderStatus:'aceptada',paymentStatus:'avisada',payments:pay,total:18000}),
   {storeId:tienda,local:s.STORES[tienda].name,pedido:'Pedido aceptado',
    pago:'Transferencia por verificar',montoTransferencia:12000,confirmado:false});
  assert.equal(s.clientTransferNotice({storeId:tienda,estado:'aceptada',pagos:pay,total:18000},'avisar_transferencia'),true);
  assert.equal(s.canFinalize({storeId:tienda,estado:'aceptada',pagos:pay,total:18000,
   pagado:true,cobroConfirmadoServidor:true,estadoPagoTransferencia:'avisada'}),false);
  assert.equal(s.canFinalize({storeId:tienda,estado:'aceptada',pagos:pay,total:18000,
   pagado:true,cobroConfirmadoServidor:true,estadoPagoTransferencia:'confirmada'}),true);
 });
}
test('sin datos bancarios verificados no muestra cuenta ni la mezcla entre tiendas',()=>{
 const bank={'romo:serena':{verificado:true,sucursal:'romo:serena',banco:'Santander',
  titular:'Empresa Demo',rut:'11.111.111-1',tipo:'Cuenta Corriente',cuenta:'1234567',correo:'demo@example.com'}};
 assert.equal(s.bankDetailsFor('uki:serena',bank),null);
 assert.equal(s.bankDetailsFor('uki:arica',bank),null);
 assert.equal(s.bankDetailsFor('romo:serena',bank).cuenta,'1234567');
 bank['romo:serena'].sucursal='uki:arica';
 assert.equal(s.bankDetailsFor('romo:serena',bank),null);
});
test('pagos mixtos no suman fuera del total ni suponen montos',()=>{
 assert.equal(s.transferDue([{medio:'Transferencia',monto:10000},{medio:'Débito',monto:8000}],18000),10000);
 assert.equal(s.transferDue([{medio:'Transferencia',monto:10000}],18000),null);
 assert.equal(s.transferDue([{medio:'Transferencia',monto:0}],0),null);
});
test('sólo trabajador autorizado puede confirmar y sólo si revisó abono',()=>{
 assert.equal(s.canConfirmTransfer({storeId:'uki:arica',role:'cliente',bankChecked:true,receivedAmount:10000,due:10000}),false);
 assert.equal(s.canConfirmTransfer({storeId:'uki:arica',role:'agendador',bankChecked:false,receivedAmount:10000,due:10000}),false);
 assert.equal(s.canConfirmTransfer({storeId:'uki:arica',role:'duenos',bankChecked:true,receivedAmount:9999,due:10000}),false);
 assert.equal(s.canConfirmTransfer({storeId:'uki:arica',role:'agendador',bankChecked:true,receivedAmount:10000,due:10000}),true);
});
test('chat sólo del pedido y sucursal permitida',()=>{
 assert.equal(s.validateChatMessage({storeId:'romo:serena',scope:'cliente',body:'Hola'}).body,'Hola');
 assert.equal(s.validateChatMessage({storeId:'romo:arica',scope:'cliente',body:'Hola'}),null);
 assert.equal(s.validateChatMessage({storeId:'uki:serena',scope:'otro',body:'Hola'}),null);
 assert.equal(s.validateChatMessage({storeId:'uki:serena',scope:'cliente',body:'x'.repeat(900)}),null);
});
