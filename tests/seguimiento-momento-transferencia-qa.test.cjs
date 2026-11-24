'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const OP=require('../lib/seguimiento-operacion-unificada-qa.cjs');
const shared=require('../lib/seguimiento-tres-sucursales-v1.cjs');
const id='621bd292-2153-4160-9e85-375978e10352';
const stores=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
for(const [storeId,branch] of stores){
 test(storeId+' - cliente puede ver cuenta validada al confirmar elección, sin esperar preparación',()=>{
  const source={id,branch,store_id:storeId,codigo_pedido:'QA-104',estado:'pendiente',
   total_indicado:18000,
   datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:6000}]}};
  const order=OP.normalizeOrder(storeId,source);
  const bank={storeId,verified:true,datos:{banco:'Banco QA',titular:'Solo simulación',rut:'11.111.111-1',
   tipo:'Corriente',cuenta:'DEMO',correo:'qa@example.com'}};
  assert.equal(order.estado,'pendiente');
  assert.equal(order.montoTransferencia,12000);
  const display=OP.view({order,paymentStatus:'pendiente',bank});
  assert.equal(display.datosBancariosVerificados,true);
  assert.equal(display.datosBancariosSucursal,storeId);
  assert.equal(display.estadoPago,'pendiente');
  assert.equal(display.puedeAvisarTransferencia,true);
  assert.equal(OP.canClientNotify({order,paymentStatus:'pendiente',bank}),true);
  assert.equal(shared.clientTransferNotice({storeId,estado:'pendiente',pagos:source.datos.pagos,total:18000},'avisar_transferencia'),true);
  const withoutBank=OP.view({order,paymentStatus:'pendiente',bank:null});
  assert.equal(withoutBank.datosBancarios,null);
  assert.equal(withoutBank.puedeAvisarTransferencia,false);
  assert.equal(OP.canClientNotify({order,paymentStatus:'pendiente',bank:null}),false);
  const wrongBank=OP.view({order,paymentStatus:'pendiente',
   bank:{...bank,storeId:storeId==='uki:arica'?'uki:serena':'uki:arica'}});
  assert.equal(wrongBank.datosBancarios,null);
 });
 test(storeId+' - agendadora no finaliza aunque cliente haya avisado',()=>{
  const source={id,branch,store_id:storeId,codigo_pedido:'QA-105',estado:'aceptada',
   total_indicado:18000,
   datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:6000}]}};
  const order=OP.normalizeOrder(storeId,source);
  const args={order,paidRecorded:true,allMethodsReconciled:true};
  assert.equal(OP.canFinishNormally({...args,transferStatus:'pendiente'}),false);
  assert.equal(OP.canFinishNormally({...args,transferStatus:'avisada'}),false);
  assert.equal(OP.canFinishNormally({...args,transferStatus:'requiere_revision'}),false);
  assert.equal(OP.canFinishNormally({...args,transferStatus:'confirmada'}),true);
  assert.equal(OP.canFinishNormally({...args,transferStatus:'confirmada',paidRecorded:false}),false);
  assert.equal(OP.canFinishNormally({...args,transferStatus:'confirmada',allMethodsReconciled:false}),false);
 });
}
test('interfaz del cliente no espera aceptar para habilitar aviso, pero exige cuenta verificada',()=>{
 const ui=fs.readFileSync(new URL('../public/seguimiento-pedido-qa.html', 'file://'+__filename),'utf8');
 assert.match(ui,/!account\|\|!\['pendiente','aceptada'\]\.includes\(data\.estadoPedido\)/);
 assert.match(ui,/datosBancariosVerificados===true/);
 assert.match(ui,/data\.estadoPago!=='pendiente'/);
});
test('demostración de iPhone bloquea finalizar hasta confirmación real simulada',()=>{
 const demo=fs.readFileSync(new URL('../public/seguimiento-demo-qa.html','file://'+__filename),'utf8');
 assert.match(demo,/Justo después de que el cliente elige/);
 assert.match(demo,/if\(stage===statuses.length-2&&transfer!==2\)/);
 assert.match(demo,/Bloqueado: la agendadora debe verificar/);
});
