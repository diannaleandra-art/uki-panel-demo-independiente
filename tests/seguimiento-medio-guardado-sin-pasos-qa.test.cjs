'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const view=fs.readFileSync(path.join(root,'public/romo-panel-qa/index.html'),'utf8');
const client=fs.readFileSync(path.join(root,'public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs'),'utf8');
const uki=fs.readFileSync(path.join(root,'public/romo-panel-qa/uki-carta-remotas-panel.js'),'utf8');
const duplicate=fs.readFileSync(path.join(root,'firebase/uki-carta-remotas-panel.js'),'utf8');
const server=fs.readFileSync(path.join(root,'api/seguimiento-personal-tres-qa.js'),'utf8');

const start=client.indexOf('function seguimientoMedioSimpleQA(order){');
const end=client.indexOf('window.ukiQAConfirmPaymentMethodAfterSave=',start);
assert.ok(start>=0&&end>start,'El detector debe estar en la bandeja de los tres locales');
const detector=new Function(client.slice(start,end)+'\nreturn seguimientoMedioSimpleQA;')();
const uuid='621bd292-2153-4160-9e85-375978e10352';
const order={id:17,cartaSolicitudRemotaId:uuid,pagado:false,
 subtotal:14000,envio:2000,total:16000,propina:0,
 medio:'Transferencia',medioEnvio:'Transferencia',mixtoProductos:false,mixtoEnvio:false};

test('sin otra pantalla ni botón, Romo valida sólo tras aceptar y guardar en Neon',()=>{
 const accept=view.slice(view.indexOf('async function ukiRomoAceptarSolicitudCartaQA()'),
  view.indexOf('function candidatoEstadoPagadoRomoQA(',view.indexOf('async function ukiRomoAceptarSolicitudCartaQA()')));
 assert.match(accept,/await driver\.guardarSolicitud/);
 assert.match(accept,/if\(result\?\.estado!=='aceptada'\)throw Error/);
 assert.match(accept,/window\.ukiQAConfirmPaymentMethodAfterSave\?\./);
 assert.match(accept,/Number\(p\.id\)===Number\(result\.pedidoId\)/);
 assert.match(accept,/String\(p\.cartaSolicitudRemotaId\|\|''\)===requestId/);
 assert.ok(accept.indexOf('if(result?.estado')<accept.indexOf('window.ukiQAConfirmPaymentMethodAfterSave'));
});
test('ambos módulos Uki sólo validan tras confirmación de aceptación',()=>{
 for(const source of [uki,duplicate]){
  const p=source.indexOf('async function ukiCartaConfirmarRespaldados()');
  const block=source.slice(p,source.indexOf('async function ukiCartaRemotasActualizar()',p));
  assert.match(block,/await ukiCartaApiCambio\(r\.id,'aceptada'/);
  assert.match(block,/window\.ukiQAConfirmPaymentMethodAfterSave\?\./);
  assert.match(block,/branch==='arica'\?'uki:arica':'uki:serena'/);
  assert.ok(block.indexOf('await ukiCartaApiCambio')<block.indexOf('window.ukiQAConfirmPaymentMethodAfterSave'));
 }
});
test('preview deshabilitado por defecto, nunca activa producción o pagos por selección del cliente',()=>{
 assert.match(client,/window\.UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED!==true/);
 assert.match(client,/romos-sushi-panel-\[a-z0-9-\]\+-diannaleandra-7046/);
 assert.match(client,/action:'confirmar_medio_de_pago'/);
 assert.doesNotMatch(client,/action:'confirmar_transferencia'/);
 assert.match(server,/totalValidado:req\.body\.totalValidado/);
 assert.match(server,/AUTH\.authorized/);
});
for(const store of ['uki:arica','uki:serena','romo:serena']){
 test(store+' detecta solo monto y medio únicos, sin marcar pagado',()=>{
  const result=detector({...order,suc:store});
  assert.equal(result.metodo,'transferencia');
  assert.equal(result.totalValidado,16000);
  assert.equal(detector({...order,medio:'Débito',medioEnvio:'Débito'}).metodo,'debito');
  assert.equal(detector({...order,medio:'Crédito',medioEnvio:'Crédito'}).metodo,'credito');
 });
}
test('pagos mixtos, propinas, otro local, entrega distinta y pagos antiguos nunca se validan automáticamente',()=>{
 assert.equal(detector({...order,mixtoProductos:true}),null);
 assert.equal(detector({...order,mixtoEnvio:true}),null);
 assert.equal(detector({...order,productosPagadosOtroLocal:true}),null);
 assert.equal(detector({...order,envioPagadoOtroLocal:true}),null);
 assert.equal(detector({...order,pagado:true}),null);
 assert.equal(detector({...order,propina:500,total:16500}),null);
 assert.equal(detector({...order,total:16500}),null);
 assert.equal(detector({...order,medioEnvio:'Efectivo'}),null);
 assert.equal(detector({...order,medio:'Tarjeta'}),null);
 assert.equal(detector({...order,subtotal:0,envio:0,total:0}),null);
});
