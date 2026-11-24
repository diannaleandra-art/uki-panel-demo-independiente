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
 const entregaRomo=code.slice(code.indexOf("async function ukiRomoCambiarEstadoQA(id,accion)"),
  code.indexOf("const ROMO_MEDIOS_SALIDAS_QA="));
 assert.match(entregaRomo,/else if\(accion==='entregar'\)/);
 assert.match(entregaRomo,/if\(!await ukiSeguimientoPermitirCerrarQA\(p\)\)return/);
 assert.match(entregaRomo,/if\(S\.suc!==ROMO_SUCURSAL_QA\|\|p\.estado!=='Pendiente'/);
 assert.match(code,/if\(D\.pagado&&!await ukiSeguimientoPermitirCerrarQA\(D\)\)return/);
 assert.match(code,/if\(!await ukiSeguimientoPermitirCerrarQA\(original,\{/);
 assert.match(code,/!response\.ok\|\|data\?\.ok!==true/);
 assert.match(code,/No se pudo consultar la verificación bancaria/);
 assert.match(code,/cartaSolicitudRemotaId/);
});

test('aceptación de carta y pedido manual Romo no esquivan verificación',()=>{
 const code=fs.readFileSync(path.join(base,'public/romo-panel-qa/index.html'),'utf8');
 const between=(start,end)=>{
  const i=code.indexOf(start),j=code.indexOf(end,i+1);
  assert.ok(i>=0&&j>i,'Flujo de Romo no encontrado: '+start);
  return code.slice(i,j);
 };
 const carta=between('async function ukiRomoAceptarSolicitudCartaQA()',
  'function candidatoEstadoPagadoRomoQA');
 const manual=between('async function ukiRomoGuardarPedidoPendienteQA()',
  'async function ukiRomoGuardarEdicionUnicaQA()');
 for(const flow of [carta,manual]){
  assert.match(flow,/D\.pagado&&ukiSeguimientoHayTransferenciaQA\(D\)/);
  assert.match(flow,/!await ukiSeguimientoPermitirCerrarQA\(D\)\)return/);
 }
 assert.match(carta,/Se guardará PENDIENTE de pago/);
 assert.match(manual,/pagado:false,estado:'Pendiente'/);
});


test('efectivo y tarjeta no pasan por el banco; transferencia pendiente se bloquea en los tres locales',async()=>{
 const src=fs.readFileSync(path.join(base,'public/romo-panel-qa/index.html'),'utf8');
 const h1=src.indexOf('function ukiSeguimientoHayTransferenciaQA(');
 const h2=src.indexOf('\n async function ukiSeguimientoPermitirCerrarQA(',h1);
 const g1=src.indexOf('async function ukiSeguimientoPermitirCerrarQA(');
 const g2=src.indexOf('\nasync function ukiMarcarPedidoEntregado(',g1);
 assert.ok(h1>=0&&h2>h1&&g1>=0&&g2>g1);
 const body=src.slice(h1,h2)+'\n'+src.slice(g1,g2)+
  '\nreturn {check:ukiSeguimientoPermitirCerrarQA,has:ukiSeguimientoHayTransferenciaQA};';
 for(const [shop,storeId] of [
  ['Uki Regimiento Arica','uki:arica'],
  ['Uki La Serena','uki:serena'],
  ['Romo’s Sushi La Serena','romo:serena']
 ]){
  let apiCalls=0,allowed=false,opened=0;
  const mockWindow={
   ukiMesasTokenConfirmar:async()=> 'qa-identity-not-real-12345678901234567',
   ukiQAOpenOrderTracking:async()=>{opened++}
  };
  const fetchMock=async()=>{
   apiCalls++;
   return {ok:true,json:async()=>({ok:true,storeId,orderId:id,
    permitido:allowed,razon:allowed?'verificado':'pendiente'})};
  };
  const messages=[];
  const {check,has}=new Function('S','ROMO_SUCURSAL_QA','aviso','window',
   'fetch','URLSearchParams','AbortSignal',body)(
   {suc:shop},'Romo’s Sushi La Serena',
   x=>messages.push(x),mockWindow,fetchMock,URLSearchParams,AbortSignal);
  assert.equal(await check({medio:'Efectivo'}),true);
  assert.equal(await check({medio:'Débito',cartaSolicitudRemotaId:id}),true);
  assert.equal(apiCalls,0,'Ningún pago en efectivo/tarjeta debe consultar el banco');
  assert.equal(await check({medio:'Transferencia'}),false);
  assert.equal(apiCalls,0,'Transferencia sin identificador se bloquea localmente');
  assert.equal(await check({medio:'Transferencia',cartaSolicitudRemotaId:id}),false);
  assert.equal(apiCalls,1);
  assert.equal(opened,1);
  allowed=true;
  assert.equal(await check({medio:'Transferencia',cartaSolicitudRemotaId:id}),true);
  assert.equal(apiCalls,2);
  assert.equal(has({medio:'Débito',pagosProductos:[{medio:'Transferencia',monto:1000}]}),true);
 }
});
