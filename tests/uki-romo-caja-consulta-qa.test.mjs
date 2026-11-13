import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarCajaRomoQA,ROMO_CAJA_CONSULTA_QA_SOLO_LECTURA}
 from '../firebase/uki-romo-caja-consulta-qa.mjs';
const SUC='Romo’s Sushi La Serena',day='2026-11-13';
const source=()=>({suc:SUC,pedidos:[],gastos:[],retiros:[],propinas:[],
  cierres:[],deliveriesManuales:[]});
const base=(props={})=>({
 suc:SUC,id:1,fechaISO:day+'T15:01:00',estado:'Pendiente',
 modalidad:'Delivery',subtotal:7000,envio:2000,pagado:true,
 medio:'Efectivo',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],
 productosPagadosOtroLocal:false,envioPagadoOtroLocal:false,
 ...props
});
test('se consulta solo el estado de Romo y no altera el original',()=>{
 const db=source();db.pedidos=[base({pagado:false}),base({id:2,estado:'Cancelado'}),
  base({id:3,fechaISO:'2026-11-12T15:01:00'})];
 const original=structuredClone(db);
 const x=consultarCajaRomoQA(db,{fechaOperativa:day});
 assert.equal(ROMO_CAJA_CONSULTA_QA_SOLO_LECTURA,true);
 assert.equal(x.pagados,0);assert.equal(x.pendientes,1);
 assert.equal(x.pedidosCancelados,1);assert.equal(x.cobrosEnRomo,0);
 assert.deepEqual(db,original);
});
test('pago mixto suma por medio sin registrar dos veces el pedido',()=>{
 const db=source();db.pedidos=[base({pagosProductos:[
  {medio:'Efectivo',monto:4000},{medio:'Débito',monto:3000}],
 pagosEnvio:[{medio:'Transferencia',monto:2000}]})];
 const x=consultarCajaRomoQA(db,{fechaOperativa:day});
 assert.equal(x.pagados,1);
 assert.equal(x.cobrosEnRomo,9000);
 assert.deepEqual([x.medios.Efectivo,x.medios.Débito,x.medios.Transferencia],[4000,3000,2000]);
 assert.equal(x.deliveryParaRepartidor,2000);
});
test('delivery cobrado en otro local no suma en efectivo de Romo',()=>{
 const db=source();db.pedidos=[base({envioPagadoOtroLocal:true,
 montoEnvioOtroLocal:2000,localPagoExterno:'Uki Regimiento Arica'})];
 const x=consultarCajaRomoQA(db,{fechaOperativa:day});
 assert.equal(x.cobrosEnRomo,7000);assert.equal(x.medios.Efectivo,7000);
 assert.equal(x.deliveryCobradoOtroLocal,2000);
 assert.equal(x.deliveryCobradoRomo,0);
 assert.equal(x.deliveryParaRepartidor,2000);
});
test('parte de productos externa y entrega interna no mezclan cajas',()=>{
 const db=source();db.pedidos=[base({productosPagadosOtroLocal:true,
 montoProductosOtroLocal:3000,localPagoExterno:'Uki La Serena',
 pagosProductos:[{medio:'Efectivo',monto:4000}],medioEnvio:'Débito'})];
 const x=consultarCajaRomoQA(db,{fechaOperativa:day});
 assert.equal(x.productosCobradosOtroLocal,3000);
 assert.equal(x.productosCobradosRomo,4000);
 assert.equal(x.cobrosEnRomo,6000);assert.equal(x.medios.Débito,2000);
});
test('delivery manual nunca entra a ventas ni dinero recibido',()=>{
 const db=source();db.deliveriesManuales=[{
 suc:SUC,fechaISO:day+'T15:02:00',monto:3500}];
 const x=consultarCajaRomoQA(db,{fechaOperativa:day});
 assert.equal(x.entregasManualesAConciliar,3500);
 assert.equal(x.cobrosEnRomo,0);assert.equal(x.deliveryParaRepartidor,0);
});
test('sin cierre no se inventa un cierre y cierres anteriores son solo lectura',()=>{
 const db=source();db.cierres=[{suc:SUC,fechaOperativa:'2026-11-12',
 fechaMs:1763000000000,venta:10000,efectivo:5000}];
 const original=structuredClone(db);
 const x=consultarCajaRomoQA(db,{fechaOperativa:day});
 assert.equal(x.historial.length,1);assert.equal(x.historial[0].venta,10000);
 assert.equal(x.cobrosEnRomo,0);assert.deepEqual(db,original);
});
test('registros cruzados, pagos inconsistentes y cobros sin local generan error',()=>{
 for(const db of [
  {...source(),pedidos:[base({suc:'Uki La Serena'})]},
  {...source(),pedidos:[base({pagosProductos:[{medio:'Débito',monto:1000}]})]},
  {...source(),pedidos:[base({envioPagadoOtroLocal:true,montoEnvioOtroLocal:3000,
   localPagoExterno:'Uki La Serena'})]},
  {...source(),pedidos:[base({envioPagadoOtroLocal:true,montoEnvioOtroLocal:2000})]},
  {...source(),pedidos:[base({pagosEnvio:[{medio:'PedidosYa',monto:2000}]})]}
 ])assert.throws(()=>consultarCajaRomoQA(db,{fechaOperativa:day}));
});
