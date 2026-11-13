import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {prepararBorradorSolicitudRomoQA,ROMO_BORRADOR_PENDIENTE_NO_ES_VENTA}
 from '../firebase/uki-romo-formulario-solicitud-qa.mjs';
import {montarSolicitudesRomoEnPedidosQA,ROMO_PANEL_BANDEJA_HABILITADA_QA}
 from '../firebase/uki-romo-solicitudes-panel-qa.mjs';
const id='00000000-0000-4000-8000-000000000001',codigo='RMO-128';
const texto=[
 '*ROMO’S SUSHI*','N.º de pedido: RMO-128','Código del cliente: 5678',
 '13/11/2026, 00:55 · Chile','Cliente: Cliente QA','WhatsApp: +56912345678',
 'Sucursal: Romo’s Sushi La Serena','','*COCINA*','*− 1 × Clásico 24 piezas*',
 'Roll 1: Pollo / Palta / Panko','Roll 2: Kanicama / Pepino / Tempura',
 'Salsas: 1 × Soya · 1 × Teriyaki','Korokes: 2','',
 '*− 2 × 60 piezas + 3 korokes*','Roll 1: Pollo / Palta / Panko',
 'Nota: Sin queso','','*ENTREGA*','Delivery','Recibe: Cliente QA',
 'Dirección: Balmaceda 1612',
 'Ubicación: https://maps.google.com/?q=-29.91,-71.25','',
 '*PAGO*','Total productos: $40.000','Delivery: $2.000',
 'Total con delivery: $42.000','Pago: Transferencia'
].join('\n');
const row={id,store_id:'romo:serena',codigo_pedido:codigo,cliente:'Cliente QA',
 telefono:'+56912345678',mensaje:texto,estado:'pendiente',en_reserva:false,
 pedido_interno:'',total_indicado:42000,whatsapp_confirmado:false};
test('Borrador de Nuevo pedido conserva armado y deja pago pendiente',()=>{
 const d=prepararBorradorSolicitudRomoQA(row);
 assert.equal(ROMO_BORRADOR_PENDIENTE_NO_ES_VENTA,true);
 assert.equal(d.cartaSolicitudRemotaId,id);
 assert.equal(d.cartaReservaToken,'');
 assert.equal(d.sucursalCarta,'Romo’s Sushi La Serena');
 assert.equal(d.codigoCarta,codigo);
 assert.equal(d.modalidad,'Delivery');
 assert.equal(d.envio,2000);
 assert.equal(d.medio,'Transferencia');
 assert.equal(d.pagado,false);
 assert.equal(d.items.length,2);
 assert.deepEqual(d.items.map(x=>[x.nombre,x.cant,x.precio]),[
  ['Clásico 24 piezas',1,0],['60 piezas + 3 korokes',2,0]
 ]);
 assert.match(d.items[0].det,/Salsas: 1 × Soya/);
 assert.match(d.items[1].det,/Sin queso/);
 assert.equal(Object.isFrozen(d),true);
});
test('Bloquea solicitud atendida, ajena, reservada, de otro local y duplicada cancelada',()=>{
 const already=[{suc:'Romo’s Sushi La Serena',estado:'Cancelado',cartaSolicitudRemotaId:id}];
 for(const wrong of [
  {...row,store_id:'uki:serena'},
  {...row,estado:'aceptada'},
  {...row,en_reserva:true},
  {...row,pedido_interno:'123'},
  {...row,mensaje:row.mensaje.replace('ROMO’S SUSHI','UKI SUSHI')},
  {...row,mensaje:row.mensaje.replace('Romo’s Sushi La Serena','Uki La Serena')},
  {...row,mensaje:row.mensaje.replace('N.º de pedido: RMO-128','N.º de pedido: RMO-129')},
  {...row,mensaje:row.mensaje.replace('WhatsApp: +56912345678','WhatsApp: +56987654321')}
 ])assert.throws(()=>prepararBorradorSolicitudRomoQA(wrong),/Romo/);
 assert.throws(()=>prepararBorradorSolicitudRomoQA(row,already),/registrada/);
});
test('El texto no confirma precios ni cobros y bloquea pizzas o mensajes sin productos',()=>{
 assert.equal(prepararBorradorSolicitudRomoQA(row).items.every(x=>x.precio===0),true);
 assert.equal(prepararBorradorSolicitudRomoQA(row).pagado,false);
 assert.throws(()=>prepararBorradorSolicitudRomoQA({...row,mensaje:texto.replace(
 '*− 1 × Clásico 24 piezas*','*− 1 × Pizza familiar*'
 )}),/producto|inválid/i);
 assert.throws(()=>prepararBorradorSolicitudRomoQA({...row,mensaje:texto.replace(
 '*− 1 × Clásico 24 piezas*','Clásico 24 piezas'
 ).replace('*− 2 × 60 piezas + 3 korokes*','60 piezas + 3 korokes')}),/productos/);
});
function dom(){return new JSDOM('<!doctype html><html><body class="romo-qa"><div id="app"><div id="romoLaSerenaPreparacionQA"></div></div></body></html>',{url:'https://qa.local'})}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
test('La tarjeta de Romo muestra Aceptar y revisar solo a solicitudes libres',async()=>{
 const d=dom(),document=d.window.document;
 const opened=[];
 const mounted=montarSolicitudesRomoEnPedidosQA({
  document,storeId:'romo:serena',qaOnly:true,sessionVerified:true,
  enabled:true,consultar:async()=>({orders:[row,{...row,id:'00000000-0000-4000-8000-000000000002',en_reserva:true}]}),
  abrirEnFormulario:arg=>{opened.push(arg);return true}
 });
 assert.equal(mounted,true);
 document.querySelector('#romoSolicitudesEnPanelQA button').click();
 await flush();
 const actions=document.querySelectorAll('.romo-aceptar-revisar-qa');
 assert.equal(actions.length,1);
 assert.match(document.querySelector('#romoSolicitudesEnPanelQA').textContent,/En revisión en otro equipo/);
 actions[0].click();
 assert.equal(opened.length,1);
 assert.equal(opened[0].borrador.cartaSolicitudRemotaId,id);
 assert.equal(opened[0].borrador.pagado,false);
 assert.equal(opened[0].borrador.items[0].precio,0);
 d.window.close();
});
test('La bandeja comercial permanece apagada hasta autorización de publicación',()=>{
 const d=dom(),doc=d.window.document;
 assert.equal(ROMO_PANEL_BANDEJA_HABILITADA_QA,false);
 montarSolicitudesRomoEnPedidosQA({document:doc,storeId:'romo:serena',qaOnly:true,
  sessionVerified:true});
 assert.equal(doc.querySelector('#romoSolicitudesEnPanelQA button').disabled,true);
 assert.equal(doc.querySelector('.romo-aceptar-revisar-qa'),null);
 d.window.close();
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(html,/window\.ukiRomoAbrirSolicitudEnFormularioQA=ukiRomoAbrirSolicitudEnFormularioQA/);
 assert.match(html,/session\?\.resumen\(\)\.bloqueada/);
 assert.match(html,/S\.pedidos\|\|\[\]/);
 assert.match(html,/pagado:false,editando:null/);
 const handler=html.slice(html.indexOf('function ukiRomoAbrirSolicitudEnFormularioQA('),
  html.indexOf('function ukiRomoIrQA('));
 assert.doesNotMatch(handler,/ukiCartaApiCambio|S\.pedidos\.push/);
});
