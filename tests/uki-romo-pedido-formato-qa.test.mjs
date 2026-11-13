import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararBorradorRomoDesdeSolicitudQA} from '../firebase/uki-romo-recepcion-formulario-qa.mjs';
import {construirCandidatoRomoFormatoUkiQA,ROMO_CANDIDATO_QA_ACTIVO}
 from '../firebase/uki-romo-pedido-formato-qa.mjs';
const SUC='Romo’s Sushi La Serena',id='123e4567-e89b-42d3-a456-426614174001';
const msg=['*ROMO’S SUSHI*','N.º de pedido: 271','Sucursal: Romo’s Sushi La Serena',
 '*COCINA*','*− 1 × 24 piezas*','Roll 1: pollo, palta, panko','Salsa: soya',
 '*ENTREGA*','Delivery','Delivery: $2.000','*PAGO*','Total productos: $7.000',
 'Pago: Efectivo'].join('\n');
const row={id,branch:'serena',estado:'pendiente',codigo_pedido:'271',
 cliente:'Cliente QA',telefono:'+56911112222',mensaje:msg,total_indicado:9000};
const initial=()=>({suc:SUC,pedidos:[],propinas:[],clientes:{},nextId:1,cierres:[],gastos:[]});
const draft=()=>{const d=prepararBorradorRomoDesdeSolicitudQA(row);d.items[0].precio=7000;return d};
const contexto=()=>({numeroTurno:1,turnoClave:'2026-11-13@1763070000000',registradoEn:1763070000000});
test('el módulo no habilita ventas',()=>assert.equal(ROMO_CANDIDATO_QA_ACTIVO,false));
test('construye orden Uki en copia de Romo, conservando armado y total',async()=>{
 const original=initial(),estado=structuredClone(original);
 const r=await construirCandidatoRomoFormatoUkiQA({estado,draft:draft(),contexto:contexto()});
 assert.equal(r.pedidoId,1);assert.equal(r.total,9000);
 assert.equal(original.pedidos.length,0);
 const p=estado.pedidos[0];
 assert.equal(p.suc,SUC);assert.equal(p.pagado,false);assert.equal(p.envio,2000);
 assert.equal(p.cartaSolicitudRemotaId,id);
 assert.match(p.productos[0].detalle,/Salsa: soya/);
 assert.equal(estado.nextId,2);assert.deepEqual(estado.clientes,{});
 const originalUki=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(originalUki,/const nuevoPedido=\{/);
 for(const key of ['numeroTurno','turnoClave','suc','fechaISO','registradoEn',
  'cliente','telefono','codigoCarta','codigoCliente','cartaSolicitudRemotaId',
  'cartaReservaToken','qrSolicitudes','sucursalCarta','mesaReferencia',
  'modalidad','envio','kmRecorrido','medio','medioEnvio','pagado','estado',
  'productos','total','subtotal','propina','propinaModo','medioPropina',
  'textoOriginal','esPremio'])assert(key in p,'Falta clave Uki '+key);
});
test('no se presume cobro por carta y el pago mixto debe cuadrar',async()=>{
 const d=draft();d.pagado=true;d.telefono='';
 d.mixtoProductos=true;d.pagosProductos=[{medio:'Débito',monto:4000},{medio:'Transferencia',monto:3000}];
 d.mixtoEnvio=true;d.pagosEnvio=[{medio:'Efectivo',monto:2000}];
 await assert.rejects(construirCandidatoRomoFormatoUkiQA({estado:initial(),draft:d,contexto:contexto()}),/Pago no confirmado/);
 const estado=initial();
 await construirCandidatoRomoFormatoUkiQA({estado,draft:d,contexto:{...contexto(),confirmoPago:true}});
 assert.equal(estado.pedidos[0].pagosProductos.length,2);
 assert.equal(estado.pedidos[0].pagosEnvio[0].monto,2000);
 assert.equal(Object.values(estado.clientes)[0].movimientos[0].tipo,'venta');
 const malo=draft();malo.telefono='';malo.pagado=true;malo.mixtoProductos=true;
 malo.pagosProductos=[{medio:'Débito',monto:1000}];
 await assert.rejects(construirCandidatoRomoFormatoUkiQA({estado:initial(),draft:malo,
  contexto:{...contexto(),confirmoPago:true}}),/no cuadran/);
});
test('delivery pagado en otro local queda separado',async()=>{
 const d=draft();d.pagado=true;d.telefono='';
 d.envioPagadoOtroLocal=true;d.montoEnvioOtroLocal=2000;d.localPagoExterno='Uki La Serena';
 const estado=initial();
 await construirCandidatoRomoFormatoUkiQA({estado,draft:d,contexto:{...contexto(),confirmoPago:true}});
 assert.equal(estado.pedidos[0].montoEnvioOtroLocal,2000);
 assert.equal(estado.pedidos[0].localPagoExterno,'Uki La Serena');
 assert.equal(estado.cajaEfectivo,undefined);
});
test('timbre exige constancia WhatsApp y no se genera al guardar',async()=>{
 const d=draft();d.pagado=true;
 await assert.rejects(construirCandidatoRomoFormatoUkiQA({estado:initial(),draft:d,
  contexto:{...contexto(),confirmoPago:true}}),/timbre/);
 const stamp='2026-11-13T16:00:00.000Z',firma=JSON.stringify([SUC,null,'56911112222']);
 Object.assign(d,{timbreAvisoAbiertoFirma:firma,timbreAvisoConfirmadoFirma:firma,
  timbreAvisoAbiertoEn:stamp,timbreAvisoConfirmadoEn:stamp,
  timbreAvisoConfirmadoPor:'Trabajador QA'});
 const estado=initial();
 await construirCandidatoRomoFormatoUkiQA({estado,draft:d,contexto:{...contexto(),confirmoPago:true}});
 assert.equal(estado.pedidos[0].timbreEnviadoPor,'Trabajador QA');
 assert.equal(estado.pedidos[0].timbreEventos.length,2);
});
test('diferencia de precio requiere confirmación y no cambia la carta',async()=>{
 const d=draft();d.items[0].precio=8000;
 await assert.rejects(construirCandidatoRomoFormatoUkiQA({estado:initial(),draft:d,
  contexto:contexto()}),/difiere/);
 const estado=initial();
 await construirCandidatoRomoFormatoUkiQA({estado,draft:d,
  contexto:{...contexto(),confirmoDiferenciaTotal:true}});
 assert.equal(estado.pedidos[0].total,10000);
});
test('rechazar estado ajeno, duplicado y precio sin verificar',async()=>{
 const d=draft();
 for(const x of [
  {estado:{...initial(),suc:'Uki La Serena'},draft:d,contexto:contexto()},
  {estado:initial(),draft:{...d,sucursalCarta:'Uki La Serena'},contexto:contexto()},
  {estado:{...initial(),pedidos:[{suc:SUC,id:4,cartaSolicitudRemotaId:id}]},draft:d,contexto:contexto()},
  {estado:initial(),draft:{...d,items:[{...d.items[0],precio:0}]},contexto:contexto()},
  {estado:initial(),draft:{...d,envio:-100},contexto:contexto()}
 ])await assert.rejects(construirCandidatoRomoFormatoUkiQA(x));
});
