'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const inicio=html.indexOf('function ukiOlvidosCierre(c){');
const fin=html.indexOf('function ukiOlvidoCambiarTurno(){',inicio);
assert.ok(inicio>0&&fin>inicio);
const S={suc:'Uki Regimiento Arica',ajustesHistoricos:[],cierres:[]};
const context={S,fechaCierreMs:c=>c.fechaMs};
vm.createContext(context);vm.runInContext(html.slice(inicio,fin),context);
const cierre=()=>({suc:'Uki Regimiento Arica',fechaMs:Date.parse('2026-11-08T23:42:00-03:00'),
 fechaOperativa:'2026-11-08',pedidos:5,venta:50000,ventaSinDelivery:47000,final:40000,
 medios:{Efectivo:20000,Transferencia:30000},efectivoContado:10000,efectivo:12000,
 gasto:0,fecha:'08-11-26, 23:42'});
const datos=()=>[
 {tipo:'pedido_olvidado',suc:'Uki Regimiento Arica',cierreMs:cierre().fechaMs,fechaISO:'2026-11-09T03:30:00Z',
  id:501,cliente:'C',detalle:'sushi',codigoCarta:'501',responsable:'A',motivo:'Olvido',
  total:10000,subtotal:8000,envio:2000,modalidad:'Delivery',recibidoUki:9000,
  recibidoOtroLocal:1000,deliveryCobradoUki:1000,repartoRealizado:true,medioUki:'Efectivo'},
 {tipo:'pedido_olvidado',suc:'Uki Regimiento Arica',cierreMs:cierre().fechaMs,fechaISO:'2026-11-09T03:32:00Z',
  id:502,cliente:'D',detalle:'24 piezas',responsable:'B',motivo:'Se omitió',
  total:5000,subtotal:5000,envio:0,modalidad:'Retiro',recibidoUki:5000,
  recibidoOtroLocal:0,deliveryCobradoUki:0,repartoRealizado:false,medioUki:'Transferencia'}];
test('Cierre original permanece intacto, rectificación muestra un solo consolidado',()=>{
 const original=cierre();S.ajustesHistoricos=datos();
 const vigente=context.ukiCierreInformeVigente(original);
 assert.notEqual(vigente,original);
 assert.equal(vigente.pedidos,7);
 assert.equal(vigente.venta,64000);
 assert.equal(vigente.ventaSinDelivery,60000);
 assert.equal(vigente.final,54000);
 assert.equal(vigente.medios.Efectivo,29000);
 assert.equal(vigente.medios.Transferencia,35000);
 assert.equal(vigente.efectivoContado,10000);
 assert.equal(vigente.rectificacion.version,3);
 assert.equal(vigente.rectificacion.cobradoUki,14000);
 assert.equal(vigente.rectificacion.cobradoOtros,1000);
 assert.equal(vigente.rectificacion.deliveryPendiente,2000);
 assert.equal(vigente.rectificacion.efectivoAdicional,9000);
 assert.equal(original.pedidos,5);
 assert.equal(original.venta,50000);
 assert.equal(original.final,40000);
 assert.equal(original.medios.Efectivo,20000);
 assert.equal(context.ukiCierreInformeVigente(original).venta,64000,
  'generar el informe otra vez no duplica los ajustes');
});
test('No mezcla sucursales ni inventa subtotales de delivery antiguo',()=>{
 const original=cierre();
 S.ajustesHistoricos=[{...datos()[0],suc:'Uki La Serena'}];
 assert.equal(context.ukiCierreInformeVigente(original),original);
 S.ajustesHistoricos=[{...datos()[0],deliveryCobradoUki:undefined}];
 const vigente=context.ukiCierreInformeVigente(original);
 assert.equal(vigente.rectificacion.sinDeliveryVerificado,false);
 assert.equal(vigente.ventaSinDelivery,47000);
});
test('Hora real se conserva al rectificar después, sin cambiar corte de turno',()=>{
 S.ajustesHistoricos=datos();
 const original=cierre();
 const vigente=context.ukiCierreInformeVigente(original);
 assert.equal(context.ukiHoraCierreHistorial(vigente),'23:42');
 assert.equal(vigente.fechaMs,original.fechaMs);
});
test('Solo se exige efectivo contado para precierre y cierre: cero es válido',()=>{
 const pre=html.slice(html.indexOf('function ukiGuardarPrecierre(){'),html.indexOf('function vPrecierreTrabajadores(){'));
 const start=html.slice(html.indexOf('function cerrar(){'),html.indexOf('function descargarPDF('));
 const cierreUI=html.slice(html.indexOf('function vCierre(){'),html.indexOf('// Fechas independientes:',html.indexOf('function vCierre(){')));
 assert.match(pre,/if\(contadoTexto===""\)/);
 assert.match(pre,/Number\.isSafeInteger\(contado\)/);
 assert.match(start,/if\(contadoStr===""\)/);
 assert.match(cierreUI,/Conteo obligatorio/);
 assert.match(cierreUI,/Compartir y descargar · al final del cierre/);
});
test('WhatsApp, PDF y Excel ofrecen versión vigente y hora, sin agregar otro cierre al libro',()=>{
 const wa=html.slice(html.indexOf('function ukiMensajeCierreHistorico('),html.indexOf('function ukiCompartirCierreHistorial('));
 const pdf=html.slice(html.indexOf('function ukiCrearPdfResumenHistorico('),html.indexOf('async function ukiPDFCierreHistorial('));
 const hist=html.slice(html.indexOf('function vHistorial(){'),html.indexOf('window.ukiQAGet=',html.indexOf('function vHistorial(){')));
 assert.match(wa,/const c=ukiCierreInformeVigente\(original\)/);
 assert.match(wa,/ukiHoraCierreHistorial\(c\)/);
 assert.match(pdf,/const c=ukiCierreInformeVigente\(original\)/);
 assert.match(pdf,/INFORME RECTIFICADO/);
 assert.match(hist,/ukiCierreInformeVigente\(original\)/);
 assert.match(hist,/ukiAccionesHistorial\(original\)/);
 assert.match(html,/function ukiExcelCierreHistorial\(i\)/);
 assert.match(html,/Pedidos pagados SIN timbre registrado/);
});
test('Pedido olvidado puede registrar cero delivery recibido en Uki sin duplicar pago',()=>{
 const codigo=html.slice(html.indexOf('function ukiAjustePedidoOlvidado(){'),
   html.indexOf('function ukiVAgregarPedidoOlvidado(){'));
 assert.match(codigo,/n\("ukiOlvidoDeliveryUki",false\)/);
 assert.match(codigo,/deliveryCobradoUki>envio/);
 assert.match(codigo,/deliveryCobradoUki>recibidoUki/);
});
test('Sintaxis completa del código de panel sigue siendo válida',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const main=scripts.find(x=>x.includes('function vCierre(){'));
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
});
