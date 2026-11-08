'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
test('La reorganización conserva llamadas de operaciones, pagos y esperas',()=>{
 for(const key of ['ukiPausarPedido()','ukiRetomarBorrador(','ukiWhatsAppRechazar(','ukiWhatsAppAceptarYRevisar(','ndGuardar()','ukiDatosPago(D,sub)','ukiErrorDistribucionPago','ukiCajaAcumulada','ukiQRPermitirCobroDefinitivo']) assert.ok(html.includes(key),key);
 for(const label of ['Revisar solicitud','Dejar abierto y atender otro','Ver mensaje original','1 · Cliente y entrega','2 · Productos y total','3 · Pago del pedido','Guardar pedido · por cobrar','Guardar pedido · pago confirmado'])assert.ok(html.includes(label),label);
 assert.doesNotMatch(html,/✅ Guardar pedido \+1 timbre/);
});
test('Orden visual: filtros antes de recibidos, esperas y pedidos registrados',()=>{
 const start=html.indexOf('function vPedidos()'),end=html.indexOf('let pedidoExpandido=',start);
 const ui=html.slice(start,end);
 assert.ok(ui.indexOf('Ver pedidos por estado')<ui.indexOf('🔔 Recibidos'));
 assert.ok(ui.indexOf('🔔 Recibidos')<ui.indexOf('ukiBorradoresResumenPedidos()'));
 assert.ok(ui.indexOf('ukiBorradoresResumenPedidos()')<ui.indexOf('Pedidos registrados · revisar pagos y entregas'));
 assert.match(html,/borradores se conservan solo en este dispositivo/);
});
test('Sintaxis JS de los scripts del panel',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  const s=m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2];
  assert.doesNotThrow(()=>new vm.Script(s));
 }
});

test('Los rechazados quedan fuera de recibidos y del listado activo, sin borrar su historial',()=>{
 const begin=html.indexOf('function vPedidos()');
 const end=html.indexOf('let pedidoExpandido=',begin);
 const ui=html.slice(begin,end);
 assert.match(ui,/uki-solicitudes-rechazadas/);
 assert.match(ui,/Rechazados · /);
 assert.match(ui,/historial, sin venta/);
 assert.match(ui,/visiblesRemotas\.filter\(r=>r\.estado==='rechazada'\)/);
 assert.match(ui,/visiblesSolicitudes\.filter\(s=>s\.estado==='rechazada'\)/);
 assert.match(ui,/Ver solicitudes recibidas/);
 assert.match(ui,/ukiCambiarCategoriaPedidos\(&quot;por-confirmar&quot;\)/);
 assert.doesNotMatch(ui,/ukiCambiarCategoriaPedidos\(&quot;pendientes&quot;\)/);
});
