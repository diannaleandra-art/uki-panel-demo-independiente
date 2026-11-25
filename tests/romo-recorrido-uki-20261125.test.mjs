import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararEdicionPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-edicion-pendiente-qa.mjs';
import {prepararCobroPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs';
const suc='Romo’s Sushi La Serena',stamp=Date.parse('2026-11-25T12:00:00-03:00'),dia='2026-11-25',turno=dia+'@'+(stamp-60000);
const solicitud='00000000-0000-4000-8000-000000000001';
const original=()=>({suc,id:2,numeroTurno:1,turnoClave:turno,cartaSolicitudRemotaId:solicitud,codigoCarta:'123',codigoCliente:'5678',cliente:'Cliente de validación',telefono:'+56912345678',modalidad:'Retiro',estado:'Pendiente',pagado:false,esPremio:false,medio:'Efectivo',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],productosPagadosOtroLocal:false,envioPagadoOtroLocal:false,productos:[{nombre:'Clásico',cantidad:1,precioUnit:10000,detalle:'',skuCarta:'roll-1',piezasUnidad:24}],subtotal:10000,envio:0,total:10000,propina:0});
const fixture=()=>({suc,nextId:3,pedidos:[original()],propinas:[],cierres:[],clientes:{},cajasDiarias:{[suc+'|'+dia]:{turnoAbierto:true,baseConfirmada:true,turnoId:turno}}});
const draft=(extra={})=>({editando:2,cartaSolicitudRemotaId:solicitud,codigoCarta:'123',cliente:'Cliente de validación',telefono:'+56912345678',modalidad:'Retiro',medio:'Efectivo',medioEnvio:'Efectivo',pagado:false,propinaModo:'ninguna',items:[{nombre:'Clásico',cant:1,precio:10000,det:'',skuCarta:'roll-1',piezasUnidad:24}],...extra});
const editar=(s,d=draft())=>prepararEdicionPendienteRomoQA({estado:s,pedidoId:2,draft:d,responsable:'Personal de prueba',foto:p=>({cliente:p.cliente,telefono:p.telefono,productos:p.productos,total:p.total,medio:p.medio}),codigoWhatsApp:()=> '5678',permitirSinCambios:true,permitirEntregado:true});
const pagar=s=>prepararCobroPendienteRomoQA(s,{pedidoId:2,responsable:'Personal de prueba',registradoEn:stamp,confirmoRecepcion:true,medioProductos:'Efectivo',medioEnvio:'Efectivo'});
test('Marcar pagado reutiliza el pedido de carta existente sin duplicar folio ni timbre de compra',()=>{
 const s=fixture();assert.equal(editar(s).sinCambios,true);pagar(s);assert.equal(s.pedidos.length,1);assert.equal(s.nextId,3);assert.equal(s.pedidos[0].cartaSolicitudRemotaId,solicitud);assert.equal(s.pedidos[0].pagado,true);assert.equal(s.pedidos[0].productos[0].skuCarta,'roll-1');assert.equal(Object.values(s.clientes)[0].movimientos.length,1);assert.throws(()=>pagar(s));
});
test('Editar productos y confirmar cobro usa la misma copia, conservando la identidad',()=>{
 const s=fixture();editar(s,draft({items:[{nombre:'Clásico',cant:2,precio:10000,det:'',skuCarta:'roll-1',piezasUnidad:24}]}));pagar(s);assert.equal(s.pedidos[0].total,20000);assert.equal(s.pedidos[0].id,2);assert.equal(s.pedidos[0].cartaSolicitudRemotaId,solicitud);assert.equal(s.pedidos[0].pagado,true);
});
test('No permite cambiar solicitud, cobrar turno cerrado ni duplicar pago',()=>{
 const s=fixture();assert.throws(()=>editar(s,draft({cartaSolicitudRemotaId:'otra'})));assert.equal(s.pedidos[0].pagado,false);s.cajasDiarias[suc+'|'+dia].turnoAbierto=false;assert.throws(()=>pagar(s));assert.equal(s.pedidos[0].pagado,false);
});
test('Pedido entregado por cobrar conserva el estado al registrar pago',()=>{
 const s=fixture();s.pedidos[0].estado='Entregado';editar(s);pagar(s);assert.equal(s.pedidos[0].estado,'Entregado');assert.equal(s.pedidos[0].pagado,true);
});
test('Botones y timbre usan el recorrido de Uki, sin campo extra de responsable ni popup de guardado manual',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const lista=html.slice(html.indexOf('function ukiRomoPedidosPendientesHTMLQA('),html.indexOf('// Fichas de Clientes del mismo panel Uki;'));
 const manual=html.slice(html.indexOf('async function ukiRomoGuardarPedidoPendienteQA('),html.indexOf('\n}',html.indexOf('async function ukiRomoGuardarPedidoPendienteQA('))+2);
 assert.match(lista,/onclick="togglePagado\(/);assert.doesNotMatch(lista,/ukiRomoCamposCobroQA\(p\)/);
 assert.doesNotMatch(html,/D\.romoResponsableCobro=this.value/);assert.doesNotMatch(manual,/window\.confirm\(/);
 assert.match(manual,/ukiValidarTimbreAntesGuardar\(D,null\)/);assert.match(manual,/ukiAnotarTimbreConfirmadoEnPedido\(pedido,D\)/);
 const edit=html.slice(html.indexOf('async function ukiRomoEditarPedidoPendienteQA('),html.indexOf('\n}',html.indexOf('async function ukiRomoEditarPedidoPendienteQA('))+2);
 assert.match(edit,/ukiValidarTimbreAntesGuardar\(D,original\)/);assert.match(edit,/ukiRevisionBancoBorradorValidaQA\(D,original\)/);
 assert.match(edit,/ukiAnotarTimbreConfirmadoEnPedido\(pedido,D\)/);assert.match(edit,/cobrar\?'confirmar_cobro':null/);
});
