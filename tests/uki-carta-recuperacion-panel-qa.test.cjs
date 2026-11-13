'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const src=readFileSync(new URL('../firebase/uki-carta-remotas-panel.js',import.meta.url),'utf8');
const a=src.indexOf('function ukiCartaReservaVencidaQA(r){');
const b=src.indexOf('// Consulta el permiso usando la MISMA sesión autenticada del personal de Pedidos.',a);
assert.ok(a>0&&b>a);
const expired=new Function(src.slice(a,b)+';return ukiCartaReservaVencidaQA;')();
test('el botón solo corresponde a solicitudes pendientes reservadas y vencidas',()=>{
 const now=Date.now();
 const old=new Date(now-60*1000).toISOString();
 const future=new Date(now+60*1000).toISOString();
 assert.equal(expired({estado:'pendiente',en_reserva:true,reserva_hasta:old}),true);
 assert.equal(expired({estado:'pendiente',en_reserva:true,reserva_hasta:future}),false);
 assert.equal(expired({estado:'aceptada',en_reserva:true,reserva_hasta:old}),false);
 assert.equal(expired({estado:'pendiente',en_reserva:false,reserva_hasta:old}),false);
 assert.equal(expired({estado:'pendiente',en_reserva:true,reserva_hasta:null}),false);
});
test('solo se muestra Recuperar cuando el servidor habilita el acceso del panel normal',()=>{
 assert.match(src,/ukiCartaReservaVencidaQA\(r\)&&ukiCartaRecuperacionPuedeQA/);
 assert.match(src,/try\{token=await ukiCartaApiSesion\(\)\}/);
 assert.match(src,/data\.puedeRecuperar===true/);
 assert.match(src,/modo=recuperacion/);
 assert.match(src,/🔓 Recuperar solicitud/);
});
test('debe actualizar la bandeja y comprobar pedido antes de liberar',()=>{
 const a=src.indexOf('async function ukiCartaRecuperarReservaQA(id){');
 const b=src.indexOf('async function ukiCartaRemotaRechazar(id){',a);
 const func=src.slice(a,b);
 assert.ok(a>=0&&b>a);
 assert.match(func,/await ukiCartaRemotasActualizar\(\)/);
 assert.match(func,/ukiCartaSolicitudYaRegistrada\(r\)/);
 assert.match(func,/ukiCartaPedidoAceptadoEnCaja\(r\)/);
 assert.match(func,/ukiCancelacionNubeLista\?\.\(\)/);
 assert.match(func,/window\.prompt\(/);
 assert.match(func,/window\.confirm\(/);
 assert.match(func,/confirmoSinPedido:true/);
 assert.match(func,/estado:'recuperar'/);
 assert.match(func,/const token=await ukiCartaApiSesion\(\)/);
 assert.match(func,/nombreResponsable/);
 assert.doesNotMatch(func,/S\.pedidos\.push|S\.caja\s*=|ukiCartaReservarRegistro\(/);
});
test('solicitudes normales, rechazo y registro de pedidos siguen intactos',()=>{
 for(const expected of [
  'async function ukiCartaRemotasActualizar()',
  'async function ukiCartaApiCambio(',
  'async function ukiCartaRemotaRechazar(',
  'function ukiCartaRemotaAbrir(',
  'async function ukiCartaConfirmarRespaldados()',
  'function ukiCartaSolicitudYaRegistrada('
 ]) assert.ok(src.includes(expected),expected);
});
