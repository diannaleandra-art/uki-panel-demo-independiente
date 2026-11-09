'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const a=html.indexOf('function ukiQREsCorreccionDePagoExistente(');
const b=html.indexOf('let ukiQRComprobandoCobro=false;',a);
assert.ok(a>0&&b>a,'debe existir control diferenciado de corrección');
function scenario(){
 const S={suc:'Uki Regimiento Arica'};
 const ctx={S,ukiMesaNumeroReferencia:x=>Number(String(x).replace(/\D/g,''))||null,ukiMontoPropina:(d,sub)=>d.propinaModo==='diez'?Math.round(sub*0.1):d.propinaModo==='otro'?Number(d.propinaPersonalizada||0):0};
 vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);
 const original={id:244,suc:S.suc,modalidad:'Consumo en local',mesaReferencia:'Mesa 2',pagado:true,
  qrSolicitudes:['MESA-abc123'],subtotal:11800,total:11800,envio:0,propina:0,medio:'Efectivo'};
 const draft={editando:244,modalidad:'Consumo en local',mesaReferencia:'Mesa 2',pagado:true,
  qrSolicitudes:['MESA-abc123'],items:[{nombre:'24 piezas',cant:1,precio:11800}],medio:'Tarjeta',envio:0,propinaModo:'ninguna'};
 return {ctx,original,draft};
}
test('QR ya pagado admite corregir cliente y medio de pago sin otra cuenta abierta',()=>{
 const {ctx,original,draft}=scenario();
 assert.equal(ctx.ukiQREsCorreccionDePagoExistente(draft,original),true);
 assert.equal(ctx.ukiQRPagoEditadoConservaCuenta(draft,original),true);
 draft.cliente='Cliente corregido';draft.medio='Transferencia';
 assert.equal(ctx.ukiQRPagoEditadoConservaCuenta(draft,original),true);
});
test('Se protege la ronda, mesa y modalidad del QR original ya pagado',()=>{
 for(const bad of [
  d=>{d.qrSolicitudes=['MESA-OTRA'];},
  d=>{d.qrSolicitudes=[];},
  d=>{d.mesaReferencia='Mesa 3';},
  d=>{d.modalidad='Retiro';}
 ]){const {ctx,original,draft}=scenario();bad(draft);
  assert.equal(ctx.ukiQRPagoEditadoConservaCuenta(draft,original),false);
 }
});
test('El precio y la propina de un QR cobrado son corregibles con conciliación',()=>{
 const {ctx,original,draft}=scenario();
 draft.items[0].precio=12500;
 assert.equal(ctx.ukiQRPagoEditadoConservaCuenta(draft,original),true);
 draft.propinaModo='otro';draft.propinaPersonalizada=1000;
 assert.equal(ctx.ukiQRPagoEditadoConservaCuenta(draft,original),true);
 assert.match(html,/¿Quién editó este pedido\\?/);
 assert.match(html,/ukiPrepararAjusteCobro\(snapshot,p,false\)/);
});
test('Cobro QR nuevo o cuenta por cobrar que pasa a pagada conserva control central',()=>{
 const {ctx,original,draft}=scenario();
 assert.equal(ctx.ukiQREsCorreccionDePagoExistente(draft,null),false);
 original.pagado=false;
 assert.equal(ctx.ukiQREsCorreccionDePagoExistente(draft,original),false);
 assert.match(html,/permitir=await ukiQRPermitirCobroDefinitivo\(D\)/);
 assert.match(html,/UKI_MESAS_ENDPOINT===UKI_MESAS_LIVE_URL&&!editandoPagoQRConfirmado/);
});
test('Guardado protege originales, validación de pagos y cierres previos',()=>{
 const save=html.slice(html.indexOf('async function ndGuardar(){'),html.indexOf('\nfunction cerrar(){'));
 assert.ok(save.indexOf('ukiQRPagoEditadoConservaCuenta(D,originalQR)')<save.indexOf('permitir=await ukiQRPermitirCobroDefinitivo(D)'));
 assert.match(save,/ukiErrorDistribucionPago/);
 assert.match(save,/ukiCierreConfirmadoPedido\(p\)/);
 assert.match(save,/Los cobros QR de cierres anteriores no se cambian desde el formulario/);
 assert.match(save,/p\.pagado=D\.pagado/);
});
test('En edición no aparece la opción de pegar WhatsApp ni el bloque de borradores',()=>{
 assert.match(html,/function ukiVistaBorradores\(\)\{[\s\S]*?if\(D\.editando\)return '';/);
 assert.match(html,/modoNuevo="manual";ir\("nuevo"\); aviso\(`Editando pedido/);
 assert.match(html,/style="\$\{D\.editando\?'display:none;'/);
});
test('La edición termina antes de añadir un pedido nuevo a la caja',()=>{
 const save=html.slice(html.indexOf('async function ndGuardar(){'),html.indexOf('\nfunction cerrar(){'));
 const edit=save.indexOf('if(D.editando){\n    const p=');
 assert.ok(edit>0);
 assert.match(save.slice(edit),/S\.vista="pedidos"; render\(\); return;/);
 assert.ok(edit<save.indexOf('S.pedidos.push(nuevoPedido)'));
});

function guardScenario({originalPagado=true,editando=true,paid=true,approval=false,change=null}={}){
 const {original,draft}=scenario();
 original.pagado=originalPagado;draft.pagado=paid;
 if(!editando)draft.editando=null;
 if(change)change(draft);
 const log=[];
 const context={
  S:{suc:original.suc,pedidos:editando?[original]:[]},D:draft,
  ukiMesaNumeroReferencia:x=>Number(String(x).replace(/\D/g,''))||null,
  ukiMontoPropina:(d,sub)=>d.propinaModo==='diez'?Math.round(sub*0.1):d.propinaModo==='otro'?Number(d.propinaPersonalizada||0):0,
  UKI_MESAS_ENDPOINT:'live',UKI_MESAS_LIVE_URL:'live',
  ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,
  aviso:m=>log.push(String(m)),ukiQRPermitirCobroDefinitivo:async()=>{log.push('QR_VERIFICADO');return approval;}
 };
 const start=html.indexOf('async function ndGuardar(){');
 const stop=html.indexOf('  if(D.sucursalCarta &&',start);
 assert.ok(start>0&&stop>start);
 const excerpt=html.slice(start,stop);
 const f=vm.runInNewContext(html.slice(a,b)+'\n'+excerpt+'  return true;\n  }finally{ukiGuardadoSolicitudEnCurso=false;}\n}\nndGuardar;',context);
 return {f,log,context};
}
test('Integración: guardar corrección de pago ya cobrado no llama validación remota QR',async()=>{
 const q=guardScenario({originalPagado:true});
 assert.equal(await q.f(),true);assert.deepEqual(q.log,[]);
});
test('Integración: cobrar desde cero o confirmar cuenta pendiente consulta QR central',async()=>{
 for(const editando of [false,true]){
  const q=guardScenario({editando,originalPagado:false,approval:false});
  assert.equal(await q.f(),undefined);
  assert.deepEqual(q.log,['QR_VERIFICADO']);
 }
});
test('Integración: mesa y rondas incorrectas se bloquean, pero cambiar precio no repite cobro QR',async()=>{
 for(const change of [
  d=>{d.mesaReferencia='Mesa 3';},
  d=>{d.qrSolicitudes=[];}
 ]){
  const q=guardScenario({originalPagado:true,change});
  assert.equal(await q.f(),undefined);
  assert.equal(q.log.length,1);
  assert.match(q.log[0],/conserva la sucursal, mesa y rondas originales/);
 }
 const corregido=guardScenario({originalPagado:true,change:d=>{d.items[0].precio=12500;}});
 assert.equal(await corregido.f(),true);
 assert.deepEqual(corregido.log,[]);
});
