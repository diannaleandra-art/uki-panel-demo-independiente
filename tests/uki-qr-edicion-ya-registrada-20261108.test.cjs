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

function scenario({oldPaid=false,paid=true,accountError='No hay exactamente una cuenta QR abierta para esta mesa.',confirm=true,wrongMesa=false,editando=true}={}){
 const logs=[],confirms=[],calls=[];
 const p={id:244,suc:'Uki Regimiento Arica',pagado:oldPaid,modalidad:'Consumo en local',
   mesaReferencia:'Mesa 2',qrSolicitudes:['MESA-abc123']};
 const d={editando:editando?244:null,pagado:paid,modalidad:'Consumo en local',
   mesaReferencia:wrongMesa?'Mesa 3':'Mesa 2',qrSolicitudes:['MESA-abc123'],
   items:[{nombre:'producto corregido',cant:1,precio:10000}],envio:0,propinaModo:'ninguna'};
 const ctx={S:{suc:p.suc,pedidos:[p]},D:d,
  ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,
  UKI_MESAS_ENDPOINT:'live',UKI_MESAS_LIVE_URL:'live',
  ukiMesaNumeroReferencia:x=>Number(String(x).replace(/\D/g,''))||null,
  ukiMontoPropina:()=>0,
  aviso:m=>logs.push(String(m)),window:{confirm:m=>{confirms.push(m);return confirm;}}};
 const code=helpers+
   '\nasync function ukiQRPermitirCobroDefinitivo(d){ calls.push(\'verificar_cuenta\'); ukiUltimoErrorQR=cuentaError; return false; }\n'+
   guard+'  return \'sigue_guardado\';\n  }finally{ukiGuardadoSolicitudEnCurso=false;}\n}\nndGuardar;';
 ctx.calls=calls;ctx.cuentaError=accountError;
 const fn=vm.runInNewContext(code,ctx,{timeout:1000});
 return {fn,p,d,logs,confirms,calls};
}
test('Pedido #244 QR registrado con cuenta ya cerrada admite corrección supervisada, sin cobrar otra vez',async()=>{
 const s=scenario();
 assert.equal(await s.fn(),'sigue_guardado');
 assert.deepEqual(s.calls,['verificar_cuenta']);
 assert.equal(s.confirms.length,1);
 assert.match(s.confirms[0],/pago YA fue recibido realmente/);
});
test('Nunca permite saltar un fallo de autorización, nube o API de QR',async()=>{
 for(const err of ['Este equipo debe estar autorizado para consultar cuentas QR.','Error de red','Cambió el estado de la nube mientras comprobábamos el pago.']){
  const s=scenario({accountError:err});
  assert.equal(await s.fn(),undefined);
  assert.equal(s.confirms.length,0);
 }
});
test('Sin confirmación explícita del cobro real no se guarda como pagado',async()=>{
 const s=scenario({confirm:false});
 assert.equal(await s.fn(),undefined);
 assert.equal(s.confirms.length,1);
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
 assert.equal(s.confirms.length,0);
 assert.deepEqual(s.calls,['verificar_cuenta']);
});
test('Un QR ya pagado permite corregir producto y medio sin validar otra vez la cuenta',async()=>{
 const s=scenario({oldPaid:true});
 assert.equal(await s.fn(),'sigue_guardado');
 assert.equal(s.calls.length,0);
 assert.equal(s.confirms.length,0);
});
test('La edición existente no crea otro pedido y exige responsable antes de guardar',()=>{
 const save=html.slice(start,html.indexOf('\nfunction cerrar(){',start));
 assert.match(save,/autorizacion=String\(ukiTimbreResponsableActual\(\)/);
 assert.match(save,/S\.vista="pedidos"; render\(\); return/);
 assert.ok(save.indexOf('S.pedidos.push(nuevoPedido)')>save.indexOf('if(D.editando){\n    const p='));
 assert.match(save,/conciliacionQRManual:conciliacionQRManual/);
});
