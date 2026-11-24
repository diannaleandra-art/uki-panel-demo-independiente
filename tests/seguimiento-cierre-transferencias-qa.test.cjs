'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const O=require('../lib/seguimiento-operacion-unificada-qa.cjs');
const id='621bd292-2153-4160-9e85-375978e10352';
for(const [storeId,branch] of [['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']]){
 test(storeId+' no finaliza normalmente sin transferencia comprobada',()=>{
  const row={id,branch,store_id:storeId,estado:'aceptada',total_indicado:17000,
   datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:5000}]}};
  const order=O.normalizeOrder(storeId,row);
  assert.equal(order.montoTransferencia,12000);
  const args={order,paidRecorded:true,allMethodsReconciled:true};
  assert.equal(O.canFinishNormally({...args,transferStatus:'pendiente'}),false);
  assert.equal(O.canFinishNormally({...args,transferStatus:'avisada'}),false);
  assert.equal(O.canFinishNormally({...args,transferStatus:'requiere_revision'}),false);
  assert.equal(O.canFinishNormally({...args,transferStatus:'confirmada'}),true);
  assert.equal(O.canFinishNormally({...args,transferStatus:'confirmada',paidRecorded:false}),false);
  assert.equal(O.canFinishNormally({...args,transferStatus:'confirmada',allMethodsReconciled:false}),false);
 });
 test(storeId+' rechazos y pago de origen incierto nunca pasan como cobro',()=>{
  const base={id,branch,store_id:storeId,estado:'aceptada',total_indicado:17000,
   datos:{origen:'carta-normal'}};
  const unknown=O.normalizeOrder(storeId,base);
  assert.equal(unknown.pagoSinDeterminar,true);
  assert.equal(O.canFinishNormally({order:unknown,paidRecorded:true,allMethodsReconciled:true,transferStatus:'confirmada'}),false);
  const rejected=O.normalizeOrder(storeId,{...base,estado:'rechazada'});
  assert.equal(O.canFinishNormally({order:rejected,paidRecorded:true,allMethodsReconciled:true,transferStatus:'confirmada'}),false);
 });
}
