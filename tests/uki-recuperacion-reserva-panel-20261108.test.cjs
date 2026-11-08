'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const front=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
test('recuperación de reserva vencida es un botón visible en la solicitud, no una venta',()=>{
 new vm.Script(front,{filename:'uki-carta-remotas-panel.js'});
 assert.match(front,/const recuperable=reservado&&r\.reserva_recuperable===true/);
 assert.match(front,/🔓 Recuperar solicitud/);
 assert.match(front,/function ukiCartaRemotaRecuperar\(id\)/);
 assert.match(front,/await ukiCartaApiCambio\(r\.id,'recuperar','',\{confirmarSinPedido:true\}\)/);
 assert.doesNotMatch(front.slice(front.indexOf('async function ukiCartaRemotaRecuperar('),front.indexOf('async function ukiCartaRemotaRechazar(')),/S\.pedidos\.push|S\.nextId\+\+|pagado=true/);
});
test('requiere nube activa y verifica que la solicitud no aparezca ya en caja',()=>{
 const start=front.indexOf('async function ukiCartaRemotaRecuperar(');
 const end=front.indexOf('async function ukiCartaRemotaRechazar(',start);
 const code=front.slice(start,end);
 for(const x of ['ukiCancelacionNubeLista','await ukiCartaRemotasActualizar()',
  "r.reserva_recuperable!==true",'ukiCartaPedidoAceptadoEnCaja','ukiRegistroMismoOrigen',
  'ukiSolicitudPegadaYaRecibida','window.confirm','ukiCartaRecuperando'])
  assert.ok(code.includes(x),x);
 assert.ok(code.indexOf('ukiCartaPedidoAceptadoEnCaja')<code.indexOf("ukiCartaApiCambio(r.id,'recuperar'"));
 assert.ok(code.indexOf('window.confirm')<code.indexOf("ukiCartaApiCambio(r.id,'recuperar'"));
});
