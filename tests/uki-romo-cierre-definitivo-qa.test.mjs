import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararAperturaTurnoRomoQA,prepararCierreDefinitivoRomoQA,
 ROMO_CIERRE_DEFINITIVO_HABILITADO_QA}
 from '../firebase/uki-romo-cierre-definitivo-qa.mjs';
const suc='Romo’s Sushi La Serena',day='2026-11-13';
const inicio=1794574800000,cierreMs=inicio+3600000;
const nuevo=()=>({suc,pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],
 deliveriesManuales:[],solicitudesWhatsApp:[],cajasDiarias:{},clientes:{},nextId:1});
const p=(props={})=>({id:1,suc,registradoEn:inicio+100000,fechaISO:day+'T13:03:00',
 modalidad:'Delivery',subtotal:7000,envio:2000,pagado:true,estado:'Pendiente',
 medio:'Efectivo',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],
 productosPagadosOtroLocal:false,envioPagadoOtroLocal:false,...props});
const abrir=s=>prepararAperturaTurnoRomoQA(s,{
 fechaOperativa:day,inicioMs:inicio,base:18000,responsable:'Encargado QA'});
const cerrar=(s,config={})=>prepararCierreDefinitivoRomoQA(s,{
 fechaOperativa:day,cierreMs,responsable:'Encargado QA',
 efectivoContado:9000,...config});
test('no activa el cierre por importar el módulo',()=>{
 assert.equal(ROMO_CIERRE_DEFINITIVO_HABILITADO_QA,false);
});
test('necesita abrir un turno con base y responsable; dos aperturas se rechazan',()=>{
 const s=nuevo();
 assert.throws(()=>cerrar(s),/Abre primero/);
 const opened=abrir(s);
 assert.equal(opened.tipo,'apertura');
 assert.equal(s.cajasDiarias[suc+'|'+day].base,18000);
 assert.throws(()=>abrir(s),/ya hay un turno/i);
});
test('efectivo contado, medios, delivery y gastos coinciden con formato Uki',()=>{
 const s=nuevo();abrir(s);
 s.pedidos=[p()];
 const result=cerrar(s);
 assert.equal(result.totalMedios,9000);
 assert.equal(result.diferencia,0);
 assert.equal(result.cierre.venta,9000);
 assert.equal(result.cierre.ventaSinDelivery,7000);
 assert.equal(result.cierre.enviosPedidos,2000);
 assert.equal(result.cierre.base,18000);
 assert.equal(result.cierre.efectivoContado,9000);
 assert.equal(s.cierres.length,1);
 assert.equal(s.cajasDiarias[suc+'|'+day].turnoAbierto,false);
 assert.throws(()=>cerrar(s),/Abre primero/);
});
test('cobro mixto y delivery externo no ingresan dinero ajeno en la caja',()=>{
 const s=nuevo();abrir(s);
 s.pedidos=[p({pagosProductos:[{medio:'Débito',monto:4000},
  {medio:'Transferencia',monto:3000}],envioPagadoOtroLocal:true,
  montoEnvioOtroLocal:2000,localPagoExterno:'Uki La Serena'})];
 const r=cerrar(s,{efectivoContado:0});
 assert.equal(r.totalMedios,7000);
 assert.equal(r.cierre.medios.Débito,4000);
 assert.equal(r.cierre.medios.Transferencia,3000);
 assert.equal(r.cierre.medios.Efectivo,0);
 assert.equal(r.cierre.enviosCobradosOtroLocal,2000);
 assert.equal(r.cierre.enviosPedidos,2000);
});
test('gastos efectivo, retiros y pago del repartidor reducen efectivo sin reducir venta dos veces',()=>{
 const s=nuevo();abrir(s);
 s.pedidos=[p()];
 s.gastos=[{suc,registradoEn:inicio+120000,fechaISO:day+'T13:05:00',
  medio:'Efectivo',monto:800}];
 s.retiros=[{suc,registradoEn:inicio+150000,fechaISO:day+'T13:06:00',monto:1000}];
 const caja=s.cajasDiarias[suc+'|'+day];
 caja.pagoDeliveryDia=1500;
 const r=cerrar(s,{efectivoContado:5700});
 assert.equal(r.cierre.venta,9000);
 assert.equal(r.cierre.gastos,800);
 assert.equal(r.cierre.pagadoDelivery,1500);
 assert.equal(r.efectivoEsperado,5700);
 assert.equal(r.cierre.final,6700);
});
test('delivery manual es reparto a conciliar, nunca se suma como venta',()=>{
 const s=nuevo();abrir(s);
 s.deliveriesManuales=[{suc,registradoEn:inicio+10000,fechaISO:day+'T13:02:00',monto:3000}];
 const r=cerrar(s,{efectivoContado:0});
 assert.equal(r.cierre.venta,0);
 assert.equal(r.cierre.enviosManuales,3000);
 assert.equal(r.cierre.efectivo,0);
});
test('diferencia contada exige autorización y explicación',()=>{
 const s=nuevo();abrir(s);s.pedidos=[p()];
 assert.throws(()=>cerrar(s,{efectivoContado:8500}),/diferencia/);
 assert.throws(()=>cerrar(s,{efectivoContado:8500,aceptarDiferencia:true}),/Observaciones/);
 const result=cerrar(s,{efectivoContado:8500,aceptarDiferencia:true,
  observacion:'Faltan 500 por revisar'});
 assert.equal(result.diferencia,-500);
 assert.equal(result.cierre.diferenciaEfectivo,-500);
});
test('pendientes de pago y solicitudes locales bloquean hasta revisar',()=>{
 const s=nuevo();abrir(s);s.pedidos=[p({pagado:false})];
 assert.throws(()=>cerrar(s,{efectivoContado:0}),/sin pagar/);
 const r=cerrar(s,{efectivoContado:0,aceptarPendientesSinPago:true});
 assert.equal(r.cierre.pendientesAlCerrar,1);
 const otro=nuevo();abrir(otro);
 otro.solicitudesWhatsApp=[{suc,estado:'pendiente'}];
 assert.throws(()=>cerrar(otro,{efectivoContado:0}),/solicitudes WhatsApp/);
});
test('dos cierres del mismo día requieren aperturas diferentes y guardan historia',()=>{
 const s=nuevo();abrir(s);s.pedidos=[p()];
 const first=cerrar(s);
 const later=inicio+7200000;
 prepararAperturaTurnoRomoQA(s,{fechaOperativa:day,inicioMs:later,
  base:20000,responsable:'Nuevo encargado'});
 s.pedidos.push(p({id:2,registradoEn:later+60000,subtotal:6000,envio:0,
  modalidad:'Retiro'}));
 const second=prepararCierreDefinitivoRomoQA(s,{
  fechaOperativa:day,cierreMs:later+3600000,responsable:'Nuevo encargado',
  efectivoContado:6000
 });
 assert.notEqual(first.turnoId,second.turnoId);
 assert.equal(s.cierres.length,2);
 assert.equal(first.cierre.venta,9000);
 assert.equal(second.cierre.venta,6000);
});
test('no muta Uki ni admite registros ajenos ni duplicados de cierre',()=>{
 const s=nuevo();abrir(s);s.pedidos=[p({suc:'Uki La Serena'})];
 assert.throws(()=>cerrar(s),/otra sucursal/);
 const other=nuevo();abrir(other);other.pedidos=[p()];
 other.cierres=[{suc,turnoClave:day+'@'+inicio}];
 assert.throws(()=>cerrar(other),/ya tiene cierre/);
});
