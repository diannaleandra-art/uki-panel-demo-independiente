'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const extract=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return html.slice(i,j)};
const id='12345678-1234-4234-8234-123456789abc',suc='Uki Regimiento Arica';
const comanda='*ENTREGA*\nDelivery\nTotal productos: $21.700\nDelivery: $1.400\nTotal con delivery: $23.100';
const old={id:688,suc,pagado:false,estado:'Pendiente',modalidad:'Delivery',envio:1400,subtotal:21700,total:23100,medio:'Transferencia',medioEnvio:'Transferencia',cartaSolicitudRemotaId:id,textoOriginal:comanda};
const pendiente={...old,modalidad:'Retiro',envio:0,total:21700};
const draft={editando:688,modalidad:'Retiro',envio:0,items:[{nombre:'Roll',cant:1,precio:21700}],medio:'Transferencia',cartaSolicitudRemotaId:id,responsableEdicion:'Prueba'};
const ctx={S:{suc},ukiMontoPropina:()=>0,ukiLineasPago:(p,t,m)=>m?[{medio:t==='productos'?p.medio:p.medioEnvio,monto:m}]:[]};
vm.createContext(ctx);vm.runInContext(extract('function extraerMensajeCartaUki','function leerTextoD')+extract('function ukiValidarResponsableEdicion(d){','function ukiRevisionBancoBorradorValidaQA(')+
  extract('function ukiPlanRetiroSinAbonoQA','function ukiPideRectificacionPago'),ctx);
test('cambio de entrega conserva productos y pedido, incluso si se confirma el pago nuevo',()=>{assert.equal(ctx.ukiCambioRetiroSinAbonoQA(old,draft),true);assert.equal(ctx.ukiCambioRetiroSinAbonoQA(old,{...draft,pagado:true}),true);});
test('recupera el delivery original de un retiro ya guardado como por cobrar en cada Uki',()=>{
 for(const branch of ['Uki Regimiento Arica','Uki La Serena']){
  ctx.S.suc=branch;
  const plan=ctx.ukiPlanRetiroSinAbonoQA({...pendiente,suc:branch},{...draft,pagado:true});
  assert.ok(plan);assert.equal(plan.delivery,1400);assert.equal(plan.subtotal,21700);assert.equal(plan.id,id);
 }
 ctx.S.suc=suc;
 assert.equal(ctx.ukiCambioRetiroSinAbonoQA({...pendiente,textoOriginal:comanda.replace('\nDelivery\n','\nRetiro\n')},draft),false);
 assert.equal(ctx.ukiCambioRetiroSinAbonoQA({...pendiente,cambioRetiroSinAbonoQA:{}},draft),false);
});
test('no usa la excepción en pedidos pagados, otra sucursal o productos cambiados',()=>{for(const p of [{...old,pagado:true},{...old,suc:'Uki La Serena'},{...old,estado:'Entregado'},{...old,ajusteCobroPendiente:{estado:'pendiente'}}])assert.equal(ctx.ukiCambioRetiroSinAbonoQA(p,draft),false);for(const d of [{...draft,items:[{nombre:'Roll',cant:1,precio:19000}]},{...draft,cartaSolicitudRemotaId:''}])assert.equal(ctx.ukiCambioRetiroSinAbonoQA(old,d),false);});
test('respaldo rechaza reducción sin constancia y exige abono si se marca pagado',async()=>{
 const {verificarGuardadoUki}=await import('../firebase/uki-seguimiento-guardado-nube-v1.mjs');
 const edited=pendiente;
 const proof={ok:true,storeId:'uki:arica',orderId:id,pedidoInterno:'688',permitido:false,cambioRetiro:{pedidoInterno:'688',totalAnterior:23100,delivery:1400,totalNuevo:21700,montoTransferencia:21700}};
 const run=(p,r,prev=old)=>verificarGuardadoUki({anterior:{suc,pedidos:[prev]},nuevo:{suc,pedidos:[p]},sucursal:suc,importes:x=>({total:x.total,montoTransferencia:x.total}),hayTransferencia:()=>true,manualValido:()=>false,consultar:async()=>r});
 await assert.rejects(()=>run(edited,{...proof,cambioRetiro:undefined}),/cambio a retiro/);
 assert.equal((await run(edited,proof)).ok,true);
 await assert.rejects(()=>run({...edited,pagado:true},proof),/Transferencia pendiente/);
 assert.equal((await run({...edited,pagado:true},{...proof,permitido:true,total:21700,montoTransferencia:21700})).ok,true);
 await assert.rejects(()=>run({...edited,pagado:true},{...proof,permitido:true,total:23100,montoTransferencia:23100}),/importe modificado/);
 const reabierto={...edited,pagado:true,cambioRetiroSinAbonoQA:proof.cambioRetiro};
 await assert.rejects(()=>run(reabierto,{...proof,pedidoInterno:'689'},pendiente),/cambio a retiro/);
 await assert.rejects(()=>run(reabierto,proof,pendiente),/Transferencia pendiente/);
 assert.equal((await run(reabierto,{...proof,permitido:true,total:21700,montoTransferencia:21700},pendiente)).ok,true);
});
test('un solo guardado, incluso desde Retiro por cobrar, y no se intenta guardar sin banco',async()=>{
 let trace=[];
 const S={suc,vista:'nuevo',pedidos:[pendiente]};
 const D={...draft,pagado:true};
 const caja={S,D,ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,esDelPeriodo:()=>true,
  ukiCierreConfirmadoPedido:()=>false,ukiMontoPropina:()=>0,aviso:m=>trace.push(m),
  ukiRevisionBancoBorradorValidaQA:()=>false,ukiPideRectificacionPago:()=>false,
  ukiGuardarFormularioQA:async p=>{assert.equal(p.id,688);trace.push('guardar el mismo pedido');},
  window:{UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED:true,ukiQACambiarRetiroSinAbono:async (p,d,plan)=>{
   assert.equal(p.id,688);assert.equal(plan.delivery,1400);trace.push('sincronizar retiro');return {pedidoInterno:'688'};
  }}};
 vm.createContext(caja);
 vm.runInContext(extract('function extraerMensajeCartaUki','function leerTextoD')+
  extract('function ukiValidarResponsableEdicion(d){','function ukiRevisionBancoBorradorValidaQA(')+
  extract('function ukiPlanRetiroSinAbonoQA','function ukiPideRectificacionPago')+
  extract('async function ndGuardar(){','async function ukiGuardarFormularioQA'),caja);
 await caja.ndGuardar();assert.match(trace[0],/abono real/);assert.equal(trace.length,1);
 trace=[];caja.ukiRevisionBancoBorradorValidaQA=()=>true;
 await caja.ndGuardar();assert.deepEqual(trace,['sincronizar retiro','guardar el mismo pedido']);
});
