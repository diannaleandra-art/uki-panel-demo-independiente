const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const R=require('../lib/rectificacion-pago-edicion-v2.cjs');
const {detalleDistribucion}=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
const p1='cf31f358-349c-4b52-ae1e-85900d086c35';
const secret='ab'.repeat(32);
const locales={'Uki La Serena':'uki:serena','Uki Regimiento Arica':'uki:arica','Romo’s Sushi La Serena':'romo:serena'};

const linea=(medio,monto)=>({medio,monto});
const plan={storeId:'uki:serena',id:'',pedidoInterno:'72',total:14500,montoOtroLocal:0,
 propinaTransferencia:0,montoAnterior:12000,montoRestante:0,
 pagosAntes:[linea('efectivo',2500),linea('transferencia',12000)],
 pagos:[linea('debito',12000),linea('efectivo',2500)],
 repartoAntes:[[linea('transferencia',12000)],[linea('efectivo',2500)]],
 repartoDespues:[[linea('debito',12000)],[linea('efectivo',2500)]]};
const params=(plan,campos)=>({secret,actor:{storeId:plan.storeId,userId:'duena-sesion',role:'duenos'},
 body:{plan,motivo:'Verificada por error. Cobro por otro medio.',responsable:'Encargada',sinAbonoRectificado:true,abonoRestante:plan.montoRestante},
 detalleDistribucion,comprobarRevision:async()=>{},...campos});
for(const storeId of Object.values(locales))test('Autorización por local '+storeId,async()=>{
 const p={...plan,storeId};
 const {recibo}=await R.registrar(params(p));
 const actor={storeId};
 assert.equal(R.verificar({secret,actor,body:{plan:p,recibo},detalleDistribucion}).confirmado,true);
 assert.throws(()=>R.verificar({secret,actor,body:{plan:{...p,pedidoInterno:'73'},recibo},detalleDistribucion}),/no coincide/);
 const bad=params(p);bad.actor.role='agendador';
 await assert.rejects(R.registrar(bad),/cuenta Google/);
 const otro=params(p);otro.actor.storeId='otro local';
 await assert.rejects(R.registrar(otro),/cuenta Google/);
 const revision=params(p,{comprobarRevision:async()=>{throw Error('revisión cambiada');}});
 await assert.rejects(R.registrar(revision),/revisión cambiada/);
});
test('Carta: preserva la constancia bancaria original y devuelve la misma autorización al reintentar',async()=>{
 const p={...plan,id:p1};
 const datos={pagos:p.pagosAntes};
 const banco={estado_pago:'confirmada',monto_transferencia:12000,confirmada_por:'dueña',
  confirmada_en:'2026-11-25T23:01:00Z',abono_verificado_en:'2026-11-25T23:01:01Z'};
 const meta={branch:'serena',uki:true,source:'solicitud',payment:'banco'};
 const order={orderId:p1,storeId:p.storeId,total:p.total,montoTransferencia:12000,estado:'aceptada',snapshotDatos:JSON.stringify(datos)};
 let patch;
 let cambios=0;
 const db={query:async(sql,args)=>{
  if(sql.startsWith('SELECT'))return [banco];
  assert.doesNotMatch(sql,/UPDATE banco/);assert.match(sql,/s.pedido_interno=\$4/);
  patch=JSON.parse(args[6]);cambios++;return [{id:p1}];
 }};
 const {recibo}=await R.registrar(params(p,{db,meta,order}));
 assert.equal(R.estadoRectificado(patch,banco,0),'pendiente');
 assert.equal(patch.rectificacionTransferenciaV2.confirmacionOriginal.monto,12000);
 const again=await R.registrar(params(p,{db,meta,order:{...order,montoTransferencia:0,snapshotDatos:JSON.stringify({...datos,...patch})}}));
 assert.equal(again.recibo.id,recibo.id);
 assert.equal(cambios,1);
});
