const test=require('node:test');
const assert=require('node:assert/strict');
const id='cf31f358-349c-4b52-ae1e-85900d086c35';
const suc='Uki La Serena';
const pago=(medio,monto)=>({medio,monto});
const antes=[pago('edenred',12000),pago('transferencia',2500)];
const despues=[pago('edenred',12000),pago('efectivo',2500)];
const r={id:'a21b4e8f-e4b3-4863-9617-a2f934a36848',motivo:'Sin abono bancario. Recibido en efectivo.',en:'2026-11-26T00:00:00Z'};
test('Caja en nube acepta únicamente el mismo pedido con una constancia confirmada',async()=>{
 const lib=await import('../firebase/uki-rectificar-transferencia-v1.mjs');
 const guard=await import('../firebase/uki-seguimiento-guardado-nube-v1.mjs');
 const p={id:72,suc,estado:'Entregado',pagado:true,modalidad:'Delivery',cartaSolicitudRemotaId:id,
  subtotal:12000,envio:2500,total:14500,medio:'Edenred',medioEnvio:'Transferencia',productos:[{nombre:'Roll',cantidad:1}]};
 const nuevo=lib.aplicarRectificacion(p,{constanciaId:r.id,motivo:r.motivo,en:r.en});
 assert.deepEqual(nuevo.productos,p.productos);
 assert.equal(nuevo.estado,p.estado);
 assert.equal(nuevo.pagado,p.pagado);
 assert.equal(nuevo.medio,'Edenred');
 assert.equal(nuevo.medioEnvio,'Efectivo');
 const prueba={ok:true,permitido:true,total:14500,storeId:'uki:serena',orderId:id,pedidoInterno:'72',
  montoTransferencia:0,rectificacion:{id:r.id,monto:2500,pagos:despues}};
 const opts={sucursal:suc,anterior:{suc,pedidos:[p]},nuevo:{suc,pedidos:[nuevo]},
  importes:()=>null,hayTransferencia:o=>o.medioEnvio==='Transferencia',manualValido:()=>false,
  consultar:async q=>{assert.equal(q.requiereTransferencia,false);return prueba;}};
 assert.deepEqual(await guard.verificarGuardadoUki(opts),{ok:true,checked:1});
 for(const cambio of [{total:15000},{medio:'Efectivo'},{pagado:false},{productos:[]},{estado:'Pendiente'}])
  await assert.rejects(guard.verificarGuardadoUki({...opts,nuevo:{suc,pedidos:[{...nuevo,...cambio}]}}));
 await assert.rejects(guard.verificarGuardadoUki({...opts,consultar:async()=>({...prueba,rectificacion:undefined})}));
 await assert.rejects(guard.verificarGuardadoUki({...opts,consultar:async()=>({...prueba,rectificacion:{...prueba.rectificacion,pagos:antes}})}));
 const {rectificacionTransferenciaDeliveryV1,...editado}=nuevo;
 await assert.rejects(guard.verificarGuardadoUki({...opts,nuevo:{suc,pedidos:[editado]}}));
});
