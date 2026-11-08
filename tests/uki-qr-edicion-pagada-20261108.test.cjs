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
test('Se bloquean cambios de mesa, QR, subtotal o propina de QR ya pagado',()=>{
 for(const bad of [
  d=>{d.qrSolicitudes=['MESA-OTRA'];},
  d=>{d.qrSolicitudes=[];},
  d=>{d.mesaReferencia='Mesa 3';},
  d=>{d.modalidad='Retiro';},
  d=>{d.items[0].precio=12500;},
  d=>{d.propinaModo='otro';d.propinaPersonalizada=1000;}
 ]){const {ctx,original,draft}=scenario();bad(draft);
  assert.equal(ctx.ukiQRPagoEditadoConservaCuenta(draft,original),false);
 }
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
