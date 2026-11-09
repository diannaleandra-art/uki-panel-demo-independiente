'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
function segment(begin,end){
 const i=html.indexOf(begin),j=html.indexOf(end,i+begin.length);
 assert.ok(i>0&&j>i,'No encontrado '+begin);
 return html.slice(i,j);
}
function escenario({pagado=false,estado='Pendiente',ajuste=null,closed=false,turno=true,detalle='El cliente desistió del pedido'}={}){
 const p={id:257,suc:'Uki Regimiento Arica',pagado,estado,ajusteCobroPendiente:ajuste,
  productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000}]};
 const S={suc:p.suc,pedidos:[p],busy:false};
 let registros=0,confirmaciones=0,msg=[];
 const ctx={
  S,esDelPeriodo:()=>turno,ukiCierreConfirmadoPedido:()=>closed?{}:null,
  ukiCobroPendiente:x=>x?.ajusteCobroPendiente?.estado==='pendiente'?x.ajusteCobroPendiente:null,
  window:{ukiCancelacionNubeLista:()=>true},
  confirm:()=>{confirmaciones++;return true;},
  document:{body:{classList:{contains:()=>false}}},
  $:id=>({value:id.startsWith('detalleCancelacion')?detalle:'cliente'}),
  guardarEnLocalStorage:async()=>{registros++;return true},
  aviso:x=>msg.push(String(x))
 };
 vm.createContext(ctx);
 vm.runInContext('let cancelacionGuardando=false;\n'+segment('function ukiEstadoTrasRetirarPago(','// El código visible sale siempre'),ctx);
 return {ctx,p,S,registros:()=>registros,confirmaciones:()=>confirmaciones,msg};
}
test('Al quitar pagado en pedido entregado, estado nuevo es Pendiente sin mutar antes de guardar',()=>{
 const {ctx,p}=escenario({pagado:true,estado:'Entregado'});
 assert.equal(ctx.ukiEstadoTrasRetirarPago(p,false),'Pendiente');
 assert.equal(p.estado,'Entregado');
 assert.equal(ctx.ukiEstadoTrasRetirarPago(p,true),'Entregado');
 assert.equal(ctx.ukiEstadoTrasRetirarPago({...p,pagado:false},false),'Pendiente'); // caso ya guardado sin pago
 assert.equal(ctx.ukiEstadoTrasRetirarPago({...p,estado:'Cancelado'},false),'Cancelado');
 assert.equal(ctx.ukiEstadoTrasRetirarPago({...p,estado:'Pendiente'},false),'Pendiente');
});
test('No pagado, entregado por error: puede cancelar con motivo y sin tocar la caja',async()=>{
 const x=escenario({pagado:false,estado:'Entregado'});
 assert.equal(x.ctx.puedeCancelarPedido(x.p),true);
 await x.ctx.cancelarPedido(257);
 assert.equal(x.p.estado,'Cancelado');
 assert.equal(x.p.motivoCancelacion,'cliente');
 assert.equal(x.p.motivoDetalleCancelacion,'El cliente desistió del pedido');
 assert.equal(x.registros(),1);
 assert.equal(x.confirmaciones(),1);
 assert.equal(x.S.pedidos.length,1);
});
test('No permite cancelar si no se escribió motivo específico',async()=>{
 const x=escenario({detalle:'   '});
 await x.ctx.cancelarPedido(257);
 assert.equal(x.registros(),0);
 assert.equal(x.confirmaciones(),0);
 assert.equal(x.p.estado,'Pendiente');
 assert.match(x.msg.join(' '),/Escribe el motivo específico/);
});
test('Un pedido pagado no puede cancelarse directamente',async()=>{
 const x=escenario({pagado:true,estado:'Entregado'});
 assert.equal(x.ctx.puedeCancelarPedido(x.p),false);
 await x.ctx.cancelarPedido(257);
 assert.equal(x.p.estado,'Entregado');
 assert.equal(x.registros(),0);
 assert.match(x.msg.join(' '),/pagado/);
});
test('No cancelar con devolución pendiente, ni un pedido de cierre anterior',async()=>{
 const refund=escenario({ajuste:{estado:'pendiente',saldo:7000}});
 assert.equal(refund.ctx.puedeCancelarPedido(refund.p),false);
 await refund.ctx.cancelarPedido(257);
 assert.equal(refund.registros(),0);
 assert.match(refund.msg.join(' '),/devolución|regularizar/);
 const closed=escenario({closed:true});
 assert.equal(closed.ctx.puedeCancelarPedido(closed.p),false);
 assert.match(closed.ctx.ukiAyudaCancelarPedido(closed.p),/cerrado|anterior/);
 const old=escenario({turno:false});
 assert.equal(old.ctx.puedeCancelarPedido(old.p),false);
});
test('Un pedido pendiente sin pagar sí puede cancelarse; uno cancelado no',()=>{
 const x=escenario({pagado:false,estado:'Pendiente'});
 assert.equal(x.ctx.puedeCancelarPedido(x.p),true);
 x.p.estado='Cancelado';
 assert.equal(x.ctx.puedeCancelarPedido(x.p),false);
});
test('El detalle ofrece Cancelar pedido con motivo incluso si no está permitido, explicando por qué',()=>{
 const view=segment('function vPedidos(){','let pedidoExpandido=null;');
 assert.match(view,/uki-cancelar-pedido/);
 assert.match(view,/❌ Cancelar pedido/);
 assert.match(view,/ukiAyudaCancelarPedido\(p\)/);
 assert.match(view,/Confirmar cancelación del pedido/);
 assert.match(view,/motivoCancelacion/);
 assert.match(view,/detalleCancelacion/);
 assert.match(view,/Motivo obligatorio/);
 assert.match(view,/El cliente desistió del pedido/);
 assert.match(view,/\$\{puedeCancelarPedido\(p\)\?/);
});
test('Una edición indica que cancelar edición NO cancela pedido y exige responsable',()=>{
 const form=segment('function vNuevo(){','// Corrección histórica:');
 assert.match(form,/Cancelar edición \(no cancela el pedido\)/);
 assert.match(form,/Para cancelar el pedido, guarda primero/);
 assert.match(form,/id="ukiResponsableEdicion"/);
});
test('Auditoría conserva Entregado → Pendiente y caja intacta',()=>{
 const foto=segment('function ukiFotoCorreccionPedido(p){','function ukiVCorreccionesPedido(p){');
 assert.match(foto,/"modalidad","estado"/);
 assert.match(foto,/Estado de entrega/);
 const save=segment('async function ndGuardar(){','function cerrar(){');
 assert.match(save,/p\.estado=ukiEstadoTrasRetirarPago\(snapshot,D\.pagado\);p\.pagado=D\.pagado/);
 assert.match(save,/ukiPrepararAjusteCobro\(snapshot,p,false\)/);
 assert.doesNotMatch(segment('function ukiEstadoTrasRetirarPago(','// El código visible sale siempre'),/S\.cierres\s*=/);
});
test('El motivo específico se guarda, se puede consultar y se restaura si falla el respaldo',()=>{
 const code=segment('async function cancelarPedido(id){','// El código visible sale siempre');
 assert.match(code,/p\.motivoDetalleCancelacion=detalle/);
 assert.match(code,/anterior\.detalle===undefined\)delete p\.motivoDetalleCancelacion/);
 const detalle=segment('function vPedidos(){','let pedidoExpandido=null;');
 assert.match(detalle,/p\.motivoDetalleCancelacion/);
 const history=segment('function fichaHistorial(','function compartirImagenTimbres(');
 assert.match(history,/motivoDetalleCancelacion/);
});
test('Toda la lógica JavaScript del panel es sintácticamente válida',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const main=scripts.find(x=>x.includes('function vPedidos(){'));
 assert.ok(main);
 assert.doesNotThrow(()=>new vm.Script(main));
});