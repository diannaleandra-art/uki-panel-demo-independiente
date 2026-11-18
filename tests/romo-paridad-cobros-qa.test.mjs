import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararCobroPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs';
const SUC='Romo’s Sushi La Serena';
const DIA='2026-11-18',TURNO=DIA+'@1795000000000';
const clone=x=>structuredClone(x);
function estado(){
 return {
  suc:SUC,nextId:3,
  pedidos:[{
   suc:SUC,id:2,numeroTurno:1,turnoClave:TURNO,
   codigoCarta:'RS-TEST',codigoCliente:'7362',cliente:'Cliente de validación',
   telefono:'+56912345678',fechaISO:'2026-11-18T17:31:00',
   modalidad:'Retiro',estado:'Pendiente',pagado:false,esPremio:false,
   medio:'Transferencia',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],
   productosPagadosOtroLocal:false,envioPagadoOtroLocal:false,
   productos:[{nombre:'Clásico 24',cantidad:1,precioUnit:10000,detalle:'2 rolls'}],
   subtotal:10000,envio:0,total:10000,propina:0
  }],
  propinas:[],cierres:[],clientes:{},
  cajasDiarias:{[SUC+'|'+DIA]:{
   turnoAbierto:true,baseConfirmada:true,turnoId:TURNO
  }}
 };
}
const cobro={
 pedidoId:2,responsable:'Administrador Romo',registradoEn:1795034200000,
 confirmoRecepcion:true,medioProductos:'Transferencia',medioEnvio:'Efectivo'
};
test('Romo confirma un medio sin propina, sin alterar otras sucursales',()=>{
 const s=estado();const r=prepararCobroPendienteRomoQA(s,cobro);
 assert.equal(r.cobradoEnRomo,10000);
 assert.equal(s.pedidos[0].pagado,true);
 assert.equal(s.propinas.length,0);
 assert.equal(Object.keys(s.clientes).length,1);
 assert.throws(()=>prepararCobroPendienteRomoQA(s,cobro),/ya pagado|ya.*pago|Pedido ya/);
});
test('pago mixto de hasta seis medios cuadra exactamente',()=>{
 const s=estado();
 prepararCobroPendienteRomoQA(s,{...cobro,
  pagosProductos:[
   {medio:'Efectivo',monto:1000},{medio:'Transferencia',monto:2000},
   {medio:'Débito',monto:3000},{medio:'Edenred',monto:1000},
   {medio:'Otros',monto:1000},{medio:'Rappi',monto:2000}
  ]
 });
 assert.equal(s.pedidos[0].pagosProductos.length,6);
 assert.throws(()=>prepararCobroPendienteRomoQA(estado(),{...cobro,
  pagosProductos:[{medio:'Efectivo',monto:9000},{medio:'Débito',monto:500}]
 }),/no cuadran/);
});
test('cobro de otro local solo cuenta dinero realmente recibido en Romo',()=>{
 const s=estado();const r=prepararCobroPendienteRomoQA(s,{...cobro,
  productosOtroLocal:4000,localPagoExterno:'Local vecino',
  confirmoPagoExterno:true,
  pagosProductos:[{medio:'Débito',monto:4000},{medio:'Transferencia',monto:2000}],
  propinaMonto:1000,medioPropina:'Transferencia'
 });
 assert.equal(r.cobradoEnRomo,7000);
 assert.equal(r.externo,4000);
 assert.equal(s.pedidos[0].montoProductosOtroLocal,4000);
 assert.equal(s.pedidos[0].propina,1000);
 assert.equal(s.pedidos[0].total,10000);
 assert.equal(s.propinas.length,1);
 assert.equal(s.propinas[0].monto,1000);
 assert.equal(Object.keys(s.clientes).length,0); // no regalar timbre por venta cobrada afuera
});
test('no se admiten pagos externos sin confirmación ni cobro en caja inexistente',()=>{
 assert.throws(()=>prepararCobroPendienteRomoQA(estado(),{
  ...cobro,productosOtroLocal:4000,localPagoExterno:'Otro local'
 }),/Confirma/);
 assert.throws(()=>prepararCobroPendienteRomoQA(estado(),{
  ...cobro,productosOtroLocal:12000,localPagoExterno:'Otro local',
  confirmoPagoExterno:true
 }),/inválido/);
 const s=estado();s.cajasDiarias[SUC+'|'+DIA].turnoAbierto=false;
 assert.throws(()=>prepararCobroPendienteRomoQA(s,cobro),/abierto/);
});

test('no contabilizar cobro en turno olvidado de cuatro días atrás',()=>{
 const s=estado(),anterior='2026-11-14@1794672000000';
 s.pedidos[0].turnoClave=anterior;
 s.cajasDiarias={[SUC+'|2026-11-14']:{turnoAbierto:true,baseConfirmada:true,turnoId:anterior}};
 assert.throws(()=>prepararCobroPendienteRomoQA(s,cobro),/anterior a ayer/);
});
