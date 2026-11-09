'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const helpers=html.slice(
 html.indexOf('function ukiQREsCorreccionDePagoExistente('),
 html.indexOf('let ukiQRComprobandoCobro=false;')
);
const start=html.indexOf('async function ndGuardar(){');
const end=html.indexOf('  if(D.sucursalCarta &&',start);
assert.ok(start>0&&end>start);
const guard=html.slice(start,end);

function scenario({oldPaid=false,paid=true,accountError='No hay exactamente una cuenta QR abierta para esta mesa.',montoRecibido='16800',wrongMesa=false,editando=true}={}){
 const logs=[],prompts=[],calls=[];
 const p={id:244,suc:'Uki Regimiento Arica',pagado:oldPaid,modalidad:'Consumo en local',
   mesaReferencia:'Mesa 2',qrSolicitudes:['MESA-abc123'],subtotal:16800,total:16800};
 const d={editando:editando?244:null,pagado:paid,modalidad:'Consumo en local',
   mesaReferencia:wrongMesa?'Mesa 3':'Mesa 2',qrSolicitudes:['MESA-abc123'],
   items:[{nombre:'producto corregido',cant:1,precio:10000}],envio:0,propinaModo:'ninguna'};
 const ctx={S:{suc:p.suc,pedidos:[p]},D:d,
  ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,
  UKI_MESAS_ENDPOINT:'live',UKI_MESAS_LIVE_URL:'live',
  ukiMesaNumeroReferencia:x=>Number(String(x).replace(/\D/g,''))||null,
  ukiMontoPropina:()=>0,
  aviso:m=>logs.push(String(m)),window:{prompt:(m,v)=>{prompts.push({mensaje:m,valorInicial:v});return montoRecibido;}}};
 const code=helpers+
   '\nasync function ukiQRPermitirCobroDefinitivo(d){ calls.push(\'verificar_cuenta\'); ukiUltimoErrorQR=cuentaError; return false; }\n'+
   guard+'  return \'sigue_guardado\';\n  }finally{ukiGuardadoSolicitudEnCurso=false;}\n}\nndGuardar;';
 ctx.calls=calls;ctx.cuentaError=accountError;
 const fn=vm.runInNewContext(code,ctx,{timeout:1000});
 return {fn,p,d,logs,prompts,calls};
}
test('Pedido #244 QR registrado con cuenta ya cerrada admite corrección supervisada, sin cobrar otra vez',async()=>{
 const s=scenario();
 assert.equal(await s.fn(),'sigue_guardado');
 assert.deepEqual(s.calls,['verificar_cuenta']);
 assert.equal(s.prompts.length,1);
 assert.match(s.prompts[0].mensaje,/cuánto YA recibiste realmente/);
 assert.equal(s.prompts[0].valorInicial,'16800');
});
test('Nunca permite saltar un fallo de autorización, nube o API de QR',async()=>{
 for(const err of ['Este equipo debe estar autorizado para consultar cuentas QR.','Error de red','Cambió el estado de la nube mientras comprobábamos el pago.']){
  const s=scenario({accountError:err});
  assert.equal(await s.fn(),undefined);
  assert.equal(s.prompts.length,0);
 }
});
test('Sin confirmación explícita del cobro real no se guarda como pagado',async()=>{
 const s=scenario({montoRecibido:null});
 assert.equal(await s.fn(),undefined);
 assert.equal(s.prompts.length,1);
});
test('No permite alterar mesa o rondas aun cuando la cuenta antigua ya no está abierta',async()=>{
 const s=scenario({wrongMesa:true});
 assert.equal(await s.fn(),undefined);
 assert.equal(s.calls.length,0);
 assert.match(s.logs.join(' '),/conserva la sucursal, mesa y rondas/);
});
test('Un QR nuevo sigue requiriendo cuenta abierta y nunca ofrece conciliación manual',async()=>{
 const s=scenario({editando:false});
 assert.equal(await s.fn(),undefined);
 assert.equal(s.prompts.length,0);
 assert.deepEqual(s.calls,['verificar_cuenta']);
});
test('Un QR ya pagado permite corregir producto y medio sin validar otra vez la cuenta',async()=>{
 const s=scenario({oldPaid:true});
 assert.equal(await s.fn(),'sigue_guardado');
 assert.equal(s.calls.length,0);
 assert.equal(s.prompts.length,0);
});
test('La edición existente no crea otro pedido y exige responsable antes de guardar',()=>{
 const save=html.slice(start,html.indexOf('\nfunction cerrar(){',start));
 assert.match(save,/autorizacion=String\(ukiTimbreResponsableActual\(\)/);
 assert.match(save,/S\.vista="pedidos"; render\(\); return/);
 assert.ok(save.indexOf('S.pedidos.push(nuevoPedido)')>save.indexOf('if(D.editando){\n    const p='));
 assert.match(save,/conciliacionQRManual:conciliacionQRManual/);
 assert.match(save,/cobroRecibidoQR:conciliacionQRManual/);
});

test('La corrección de $16.800 a $14.000 conserva los $16.800 recibidos hasta devolver $2.800',()=>{
 const begin=html.indexOf('        if(requiereAjuste&&(snapshot.pagado||ukiCobroPendiente(snapshot)))');
 const end=html.indexOf('        const antes=ukiFotoCorreccionPedido(snapshot)',begin);
 assert.ok(begin>0&&end>begin);
 const ctx={
  requiereAjuste:true,snapshot:{pagado:false},p:{pagado:true,medio:'Transferencia',subtotal:14000},
  conciliacionQRManual:true,cobroRecibidoQR:{medio:'Transferencia',monto:16800},
  ukiCobroPendiente:()=>null,
  ukiPrepararAjusteCobro:()=>{throw Error('No se debe re-cobrar cuenta antigua');},
  ukiCobrosRealesMedios:()=>({Transferencia:14000}),
  ukiImporteMedios:x=>Object.values(x||{}).reduce((n,v)=>n+v,0),
  ahora:()=> '2026-11-08T21:00:00'
 };
 vm.runInNewContext(html.slice(begin,end),ctx);
 assert.equal(ctx.p.ajusteCobroPendiente.saldo,2800);
 assert.equal(ctx.p.ajusteCobroPendiente.recibido.Transferencia,16800);
});
test('Sin dinero recibido realmente no se permite declarar pagado un QR ya cerrado',async()=>{
 const s=scenario({montoRecibido:'0'});
 assert.equal(await s.fn(),undefined);
 assert.match(s.logs.join(' '),/monto recibido debe ser un número positivo/);
});
