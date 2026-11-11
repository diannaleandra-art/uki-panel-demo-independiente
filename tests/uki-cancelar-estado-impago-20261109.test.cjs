'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
function segment(begin,end){
 const i=html.indexOf(begin),j=html.indexOf(end,i+begin.length);
 assert.ok(i>0&&j>i,'No encontrado '+begin);
 return html.slice(i,j);
}
function escenario({pagado=false,estado='Pendiente',ajuste=null,closed=false,turno=true,detalle='El cliente desistió del pedido',declaracion='',responsable='Sara',guardarOk=true,nube=true}={}){
 const p={id:257,suc:'Uki Regimiento Arica',pagado,estado,ajusteCobroPendiente:ajuste,
  productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000}]};
 const S={suc:p.suc,pedidos:[p],busy:false};
 let registros=0,confirmaciones=0,msg=[];
 const ctx={
  S,esDelPeriodo:()=>turno,ukiCierreConfirmadoPedido:()=>closed?{}:null,
  ukiCobroPendiente:x=>x?.ajusteCobroPendiente?.estado==='pendiente'?x.ajusteCobroPendiente:null,
  window:{ukiCancelacionNubeLista:()=>nube},
  confirm:()=>{confirmaciones++;return true;},
  document:{body:{classList:{contains:()=>false}}},
  $:id=>{
   if(id.startsWith('ukiErrorCancelar'))return {
    hidden:true,scrollIntoView(){},set textContent(text){msg.push(String(text));}
   };
   return {value:id.startsWith('detalleCancelacion')?detalle:
    id.startsWith('motivoCancelacion')?'cliente':
    id.startsWith('cobroCancelacion')?declaracion:
    id.startsWith('respCancelacion')?responsable:''};
  },
  ukiImporteMedios:x=>Object.values(x||{}).reduce((n,v)=>n+(Number(v)||0),0),
  ukiFotoCorreccionPedido:p=>({id:p.id,estado:p.estado,pagado:p.pagado}),
  fmt:n=>'$'+Number(n),render:()=>{},
  guardarEnLocalStorage:async()=>{registros++;return guardarOk},
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
 assert.match(x.msg.join(' '),/Escribe por qué se cancela/);
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
 assert.match(refund.msg.join(' '),/diferencia|revisión|revisarse/);
 const closed=escenario({closed:true});
 assert.equal(closed.ctx.puedeCancelarPedido(closed.p),false);
 assert.match(closed.ctx.ukiAyudaCancelarPedido(closed.p),/cerrado|anterior/);
 const old=escenario({turno:false});
 assert.equal(old.ctx.puedeCancelarPedido(old.p),false);
});
test('Se pide aclarar si nunca se cobró o si ya se devolvió, en el mismo formulario',async()=>{
 const q={estado:'pendiente',saldo:7000,recibido:{Efectivo:7000}};
 const falta=escenario({ajuste:q});
 assert.equal(falta.ctx.puedeCancelarPedido(falta.p),true);
 await falta.ctx.cancelarPedido(257);
 assert.equal(falta.registros(),0);
 assert.match(falta.msg.join(' '),/Selecciona si nunca se recibió/);
 const pendiente=escenario({ajuste:q,declaracion:'pendiente'});
 await pendiente.ctx.cancelarPedido(257);
 assert.equal(pendiente.registros(),0);
 assert.match(pendiente.msg.join(' '),/falta devolver/);
});
test('Si el pago previo fue marcado por error se documenta y cancela sin inventar una devolución',async()=>{
 const x=escenario({ajuste:{estado:'pendiente',saldo:7000,recibido:{Efectivo:7000}},declaracion:'no_recibido'});
 await x.ctx.cancelarPedido(257);
 assert.equal(x.p.estado,'Cancelado');
 assert.equal(x.p.ajusteCobroPendiente,null);
 assert.equal(x.p.correccionesTurno.length,1);
 assert.equal(x.p.correccionesTurno[0].accion,'pago_erroneo_no_cobrado');
 assert.equal(x.p.correccionesTurno[0].responsable,'Sara');
 assert.equal(x.p.correccionesTurno[0].importe,7000);
 assert.equal(x.registros(),1);
});
test('Si YA se devolvió dinero, guarda declaración diferente y exige responsable',async()=>{
 const q={estado:'pendiente',saldo:7000,recibido:{Transferencia:7000}};
 const x=escenario({ajuste:q,declaracion:'devuelto',responsable:''});
 await x.ctx.cancelarPedido(257);
 assert.equal(x.registros(),0);
 assert.match(x.msg.join(' '),/escribe quién verificó/);
 const conf=escenario({ajuste:q,declaracion:'devuelto',responsable:'Jorge'});
 await conf.ctx.cancelarPedido(257);
 assert.equal(conf.p.estado,'Cancelado');
 assert.equal(conf.p.correccionesTurno[0].accion,'devolucion_cancelacion_confirmada');
 assert.equal(conf.p.correccionesTurno[0].responsable,'Jorge');
});
test('Ante fallo de guardado, se restituyen el pedido y la diferencia de cobro',async()=>{
 const q={estado:'pendiente',saldo:7000,recibido:{Efectivo:7000}};
 const x=escenario({ajuste:q,declaracion:'no_recibido',guardarOk:false});
 await x.ctx.cancelarPedido(257);
 assert.equal(x.p.estado,'Pendiente');
 assert.equal(x.p.ajusteCobroPendiente,q);
 assert.equal(x.p.correccionesTurno,undefined);
 assert.equal(x.p.motivoCancelacion,undefined);
 assert.equal(x.p.motivoDetalleCancelacion,undefined);
 assert.equal(x.registros(),1);
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
 assert.match(view,/id="detalleCancelacion\$\{p\.id\}" rows="2"/);
 assert.doesNotMatch(view,/id="detalleCancelacion\$\{p\.id\} rows=/);
 assert.match(view,/cobroCancelacion/);
 assert.match(view,/respCancelacion/);
 assert.match(view,/ukiErrorCancelar/);
 assert.match(view,/\$\{ukiFormularioCancelarDisponible\(p\)\?/);
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
 assert.match(foto,/\['estado','Estado del pedido'\]/);
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