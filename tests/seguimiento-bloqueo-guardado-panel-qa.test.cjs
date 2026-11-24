'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const gate=require('../lib/seguimiento-verificar-cierre-qa.cjs');
const base=path.join(__dirname,'..');
const id='621bd292-2153-4160-9e85-375978e10352';
const stores=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
const orders=(storeId,branch,medio='transferencia')=>({
 id,store_id:storeId,branch,estado:'aceptada',codigo_pedido:'QA-102',
 total_indicado:16000,datos:{medioPago:medio}
});
for(const [storeId,branch] of stores){
 test(storeId+' - bloquea entrega y cobro si transferencia pendiente o avisada',async()=>{
  const queries=[];
  let paidState='avisada';
  const db={query:async(sql,args)=>{
   queries.push({sql,args});
   if(sql.includes('SELECT id,branch,codigo_pedido,estado,total_indicado,datos'))return [orders(storeId,branch)];
   if(sql.includes('SELECT estado_pago,monto_transferencia'))return [{estado_pago:paidState,monto_transferencia:16000}];
   throw Error('Consulta fuera del verificador QA');
  }};
  const check=()=>gate.check({db,storeId,orderId:id,requiereTransferencia:true});
  const a=await check();assert.equal(a.permitido,false);assert.match(a.razon,/verificar|Revisa el abono/);
  paidState='pendiente';assert.equal((await check()).permitido,false);
  paidState='confirmada';assert.equal((await check()).permitido,true);
  assert.equal(queries.filter(x=>/INSERT |UPDATE |DELETE /i.test(x.sql)).length,0);
  const first=queries[0];
  assert.ok(first.sql.includes('branch=$2'));
  assert.ok(first.args.includes(branch));
  if(storeId==='romo:serena')assert.ok(first.args.includes(storeId));
 });
 test(storeId+' - pago con origen desconocido se bloquea por precaución',()=>{
  const unknown=gate.verdict({order:{
   storeId,estado:'aceptada',montoTransferencia:null,pagoSinDeterminar:true
  },paymentState:'confirmada'});
  assert.equal(unknown.permitido,false);
 });
 test(storeId+' - efectivo no requiere una verificación de transferencia',()=>{
  const row=orders(storeId,branch,'efectivo');
  const shared=require('../lib/seguimiento-operacion-unificada-qa.cjs');
  const order=shared.normalizeOrder(storeId,row);
  assert.equal(gate.verdict({order,paymentState:'pendiente'}).permitido,true);
  assert.equal(gate.verdict({order,paymentState:'pendiente',requiereTransferencia:true}).permitido,false);
 });
}
test('API exige sesión y sólo consulta, no modifica ventas o caja',()=>{
 const code=fs.readFileSync(path.join(base,'api/seguimiento-verificar-cierre-qa.js'),'utf8');
 assert.match(code,/ENV\.config\(\)/);assert.match(code,/AUTH\.authorized/);
 assert.match(code,/req\.method!=='GET'/);assert.match(code,/GUARD\.check/);
 assert.doesNotMatch(code,/(\bINSERT INTO\b|\bUPDATE public\.|\bDELETE FROM\b)/i);
});
test('panel usa guardia en marcar pagado, confirmar cobro y marcar entregado',()=>{
 const code=fs.readFileSync(path.join(base,'public/romo-panel-qa/index.html'),'utf8');
 assert.match(code,/async function ukiMarcarPedidoEntregado\(id\)/);
 assert.match(code,/if\(!await ukiSeguimientoPermitirCerrarQA\(p\)\)return/);
 assert.match(code,/if\(D\.pagado&&!await ukiSeguimientoPermitirCerrarQA\(D\)\)return/);
 assert.match(code,/if\(!await ukiSeguimientoPermitirCerrarQA\(original,\{/);
 assert.match(code,/!response\.ok\|\|data\?\.ok!==true/);
 assert.match(code,/No se pudo consultar la verificación bancaria/);
 assert.match(code,/cartaSolicitudRemotaId/);
});
