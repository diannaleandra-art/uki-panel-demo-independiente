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
 assert.match(code,/if\(!await ukiSeguimientoPermitirCerrarQA\(comprobacionManual\)\)return/);
 const entregaRomo=code.slice(code.indexOf("async function ukiRomoCambiarEstadoQA(id,accion)"),
  code.indexOf("const ROMO_MEDIOS_SALIDAS_QA="));
 assert.match(entregaRomo,/else if\(accion==='entregar'\)/);
 assert.match(entregaRomo,/if\(!await ukiSeguimientoPermitirCerrarQA\(comprobacionManual\)\)return/);
 assert.match(entregaRomo,/if\(S\.suc!==ROMO_SUCURSAL_QA\|\|p\.estado!=='Pendiente'/);
 assert.match(code,/if\(D\.pagado&&!await ukiSeguimientoPermitirCerrarQA\(D\)\)return/);
 assert.match(code,/if\(!await ukiSeguimientoPermitirCerrarQA\(comprobacionManual,\{/);
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
  let montoConfirmado=16000;
  const fetchMock=async()=>{
   apiCalls++;
   return {ok:true,json:async()=>({ok:true,storeId,orderId:id,
    permitido:allowed,razon:allowed?'verificado':'pendiente',total:16000,montoTransferencia:montoConfirmado})};
  };
  const messages=[];
  const {check,has}=new Function('S','ROMO_SUCURSAL_QA','aviso','window',
   'fetch','URLSearchParams','AbortSignal','ukiLineasPago',body)(
   {suc:shop},'Romo’s Sushi La Serena',
   x=>messages.push(x),mockWindow,fetchMock,URLSearchParams,AbortSignal,
   (p,tipo,monto)=>monto>0?(p[tipo==='productos'?'pagosProductos':'pagosEnvio']?.length?
    p[tipo==='productos'?'pagosProductos':'pagosEnvio']:[{medio:tipo==='productos'?p.medio:p.medioEnvio,monto}]):[]);
  const transferencia={medio:'Transferencia',cartaSolicitudRemotaId:id,
   subtotal:16000,total:16000,modalidad:'Retiro'};
  assert.equal(await check({medio:'Efectivo'}),true);
  assert.equal(apiCalls,0,'Los pedidos manuales en efectivo no consultan banco');
  // El pedido de carta sí contrasta su medio en el servidor, sin pedirle
  // un paso adicional al trabajador ni exigir banco para la tarjeta.
  allowed=true;
  assert.equal(await check({medio:'Débito',cartaSolicitudRemotaId:id}),true);
  assert.equal(apiCalls,1,'Pedido de carta: comprobar medio definitivo en servidor');
  assert.equal(await check({medio:'Transferencia'}),false);
  assert.equal(apiCalls,1,'Transferencia sin identificador se bloquea localmente');
  allowed=false;
  assert.equal(await check(transferencia),false);
  assert.equal(apiCalls,2);
  assert.equal(opened,1);
  allowed=true;
  assert.equal(await check(transferencia),true);
  assert.equal(apiCalls,3);
  allowed=false;
  assert.equal(await check({medio:'Efectivo',cartaSolicitudRemotaId:id}),false);
  assert.equal(apiCalls,4,'Cambiar a efectivo no evita la consulta al servidor');
  assert.equal(has({medio:'Débito',pagosProductos:[{medio:'Transferencia',monto:1000}]}),true);
  allowed=true;
  assert.equal(await check({...transferencia,subtotal:18000,total:18000}),false);
  const mixto={...transferencia,medio:'Débito',pagosProductos:[{medio:'Transferencia',monto:6000},{medio:'Débito',monto:10000}]};
  assert.equal(await check(mixto),false,'No reutilizar abono de otro importe');
  montoConfirmado=6000;
  assert.equal(await check(mixto),true,'Solo coincide el importe exacto de transferencia');
  assert.equal(await check(transferencia),false,'No usar el abono parcial para todo el pedido');
 }
});


test('el servidor niega cambio de transferencia a efectivo aunque banco esté confirmado',()=>{
 const order={
  storeId:'uki:arica',estado:'aceptada',montoTransferencia:12000,
  pagoSinDeterminar:false
 };
 assert.equal(gate.verdict({order,paymentState:'confirmada',requiereTransferencia:true}).permitido,true);
 const mismatch=gate.verdict({order,paymentState:'confirmada',requiereTransferencia:false});
 assert.equal(mismatch.permitido,false);
 assert.match(mismatch.razon,/otro medio|registra transferencia/i);
 const cash={...order,montoTransferencia:0};
 assert.equal(gate.verdict({order:cash,paymentState:'pendiente',requiereTransferencia:false}).permitido,true);
 assert.equal(gate.verdict({order:cash,paymentState:'pendiente',requiereTransferencia:true}).permitido,false);
});



test('en edición Uki/Romo se conserva el ID original sin pedir otro paso al trabajador',()=>{
 const src=fs.readFileSync(path.join(base,'public/romo-panel-qa/index.html'),'utf8');
 const start=src.indexOf('function ukiSeguimientoConservarOrigenEdicionQA(){');
 const end=src.indexOf('async function ndGuardar(){',start);
 assert.ok(start>0&&end>start);
 const code=src.slice(start,end)+'\nreturn ukiSeguimientoConservarOrigenEdicionQA;';
 const id='621bd292-2153-4160-9e85-375978e10352';
 for(const shop of ['Uki Regimiento Arica','Uki La Serena','Romo’s Sushi La Serena']){
  const old={suc:shop,id:22,cartaSolicitudRemotaId:id,
   seguimientoSolicitudId:id,pagado:false,medio:'Transferencia'};
  const S={suc:shop,pedidos:[old]};
  const alerts=[];
  const draft={editando:22,medio:'Efectivo',pagado:false};
  const helper=new Function('S','D','aviso',code)(S,draft,m=>alerts.push(m));
  assert.equal(helper(),true);
  assert.equal(draft.cartaSolicitudRemotaId,id);
  assert.equal(draft.seguimientoSolicitudId,id);
  assert.equal(alerts.length,0);
  const altered={editando:22,cartaSolicitudRemotaId:
   'f04cbd3f-b14c-40d3-bb79-9461fd5ad122'};
  const no=new Function('S','D','aviso',code)(S,altered,m=>alerts.push(m));
  assert.equal(no(),false);
  assert.match(alerts.at(-1),/referencia original/i);
  assert.equal(altered.cartaSolicitudRemotaId,
   'f04cbd3f-b14c-40d3-bb79-9461fd5ad122');
 }
 assert.match(src,/async function ndGuardar\(\)\{\s*if\(!ukiSeguimientoConservarOrigenEdicionQA\(\)\)return/);
});

test('el cambio de medio en edición normal no permite retirar una transferencia, en las tres sucursales',()=>{
 const src=fs.readFileSync(path.join(base,'public/romo-panel-qa/index.html'),'utf8');
 const start=src.indexOf('function ukiSeguimientoValidarCambioMedioQA('),end=src.indexOf('async function ndGuardar(){',start);
 const guard=new Function('ukiSeguimientoHayTransferenciaQA','aviso',src.slice(start,end)+'\nreturn ukiSeguimientoValidarCambioMedioQA;')(
  p=>p?.medio==='Transferencia',()=>{});
 for(const [shop] of stores){
  assert.equal(guard({suc:shop,medio:'Transferencia'},{medio:'Efectivo'}),false);
  assert.equal(guard({suc:shop,medio:'Transferencia'},{medio:'Transferencia'}),true);
  assert.equal(guard({suc:shop,medio:'Efectivo'},{medio:'Débito'}),true);
 }
 assert.match(src,/async function ndGuardar\(\)\{[\s\S]{0,450}if\(!ukiSeguimientoValidarCambioMedioQA\(pedidoAnteriorQA,D\)\)return/);
});

test('transferencia manual no necesita enlace de carta, sólo comprobación y mismo importe',async()=>{
 const src=fs.readFileSync(path.join(base,'public/romo-panel-qa/index.html'),'utf8');
 const start=src.indexOf('function ukiSeguimientoHayTransferenciaQA(');
 const end=src.indexOf('async function ukiMarcarPedidoEntregado(',start);
 const code=src.slice(start,end)+'\nreturn {prepare:ukiSeguimientoPrepararManualQA,valid:ukiSeguimientoManualValidaQA,gate:ukiSeguimientoPermitirCerrarQA,attach:ukiSeguimientoAnotarManualQA};';
 for(const suc of ['Uki Regimiento Arica','Uki La Serena','Romo’s Sushi La Serena']){
  const S={suc,nextId:15,pedidos:[]};let calls=0,accept=false;
  const line=(p,t,m)=>m>0?[{medio:t==='productos'?p.medio:p.medioEnvio,monto:m}]:[];
  const f=new Function('S','ROMO_SUCURSAL_QA','ukiLineasPago','window','aviso','fmt','ukiTimbreResponsableActual',code)(
   S,'Romo’s Sushi La Serena',line,{confirm:()=>{calls++;return accept}},()=>{},String,()=> 'Agendadora QA');
  const p={cliente:'Cliente QA',telefono:'',items:[{nombre:'Pedido',cant:1,precio:16000}],modalidad:'Retiro',medio:'Transferencia',pagado:true};
  assert.equal(f.prepare(p),false);
  assert.equal(await f.gate(p),false);
  accept=true;
  assert.equal(f.prepare(p),true);
  assert.equal(await f.gate(p),true);
  assert.equal(calls,2);
  assert.equal(f.prepare(p),true);assert.equal(calls,2);
  const saved={id:15,suc,cliente:'Cliente QA',telefono:'',subtotal:16000,total:16000,envio:0,modalidad:'Retiro',medio:'Transferencia',pagado:true};
  f.attach(saved,p);
  assert.equal(f.valid(saved),true);
  assert.equal(await f.gate(saved),true);
  assert.equal(f.valid({...saved,id:16}),false);
  assert.equal(f.valid({...saved,subtotal:17000,total:17000}),false);
  assert.equal(f.valid({...saved,suc:'otra'}),false);
  assert.equal(f.valid({...saved,cartaSolicitudRemotaId:'123'}),false);
 }
});
