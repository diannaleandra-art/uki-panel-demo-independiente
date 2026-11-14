import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararCobroPendienteRomoQA,crearGuardadoCobroRomoQA,
 RomoCobroInciertoQA,ROMO_COBRO_PENDIENTE_HABILITADO_QA}
 from '../firebase/uki-romo-cobro-pendiente-qa.mjs';
import {consultarCajaRomoQA} from '../firebase/uki-romo-caja-consulta-qa.mjs';

const SUC='Romo’s Sushi La Serena',DIA='2026-11-14',T=1794631879356;
const turno=DIA+'@'+T;
const pedido=(extra={})=>({
 id:2,suc:SUC,turnoClave:turno,numeroTurno:2,estado:'Pendiente',
 cliente:'CLIENTE SIMULADO',telefono:'+56911112222',codigoCliente:'2222',
 codigoCarta:'ROMO-002',fechaISO:DIA+'T01:53',fechaOperativa:DIA,
 registradoEn:T+90000,pagado:false,subtotal:7000,envio:2000,total:9000,
 propina:0,medio:'Efectivo',medioEnvio:'Efectivo',modalidad:'Delivery',
 productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000,detalle:'Pollo/Palta/Panko; Salsa: soya'}],
 pagosProductos:[],pagosEnvio:[],historialCambios:[],...extra
});
const estado=(extra={})=>({
 suc:SUC,pedidos:[pedido()],cierres:[],propinas:[],clientes:{},gastos:[],
 retiros:[],deliveriesManuales:[],cajasDiarias:{[SUC+'|'+DIA]:{
 turnoId:turno,turnoAbierto:true,inicioMs:T}},...extra
});
const cobro=(extra={})=>({pedidoId:2,responsable:'TRABAJADOR SIMULADO',
 registradoEn:T+120000,confirmoRecepcion:true,
 medioProductos:'Efectivo',medioEnvio:'Efectivo',...extra});
test('la función se prepara desactivada por defecto',()=>{
 assert.equal(ROMO_COBRO_PENDIENTE_HABILITADO_QA,false);
 const driver=crearGuardadoCobroRomoQA();
 assert.equal(driver.disponible(),false);
});
test('cobro simple de un pendiente: cuadre de 9000, timbre no se inventa',()=>{
 const s=estado(),r=prepararCobroPendienteRomoQA(s,cobro());
 assert.equal(r.total,9000);assert.equal(s.pedidos[0].pagado,true);
 assert.equal(s.pedidos[0].timbreEnviadoEn,undefined);
 assert.equal(s.pedidos[0].cobroConfirmadoPor,'TRABAJADOR SIMULADO');
 assert.equal(s.pedidos[0].historialCambios.length,1);
 assert.equal(s.pedidos[0].historialCambios[0].anterior.pagado,false);
 assert.equal(s.pedidos[0].historialCambios[0].nuevo.pagado,true);
 const caja=consultarCajaRomoQA(s,{fechaOperativa:DIA});
 assert.equal(caja.pendientes,0);assert.equal(caja.pagados,1);
 assert.equal(caja.cobrosEnRomo,9000);
 assert.equal(caja.medios.Efectivo,9000);
 assert.equal(s.clientes['telefono:56911112222'].pedidos,1);
 assert.equal(s.clientes['telefono:56911112222'].gastado,7000);
 assert.equal(s.clientes['telefono:56911112222'].movimientos.length,1);
});
test('pago mixto de productos y delivery en medios separados sin sumar dos veces',()=>{
 const s=estado();
 prepararCobroPendienteRomoQA(s,cobro({
  pagosProductos:[{medio:'Débito',monto:4000},{medio:'Transferencia',monto:3000}],
  medioProductos:'Débito',
  medioEnvio:'Efectivo'
 }));
 const caja=consultarCajaRomoQA(s,{fechaOperativa:DIA});
 assert.equal(caja.cobrosEnRomo,9000);
 assert.equal(caja.medios.Débito,4000);
 assert.equal(caja.medios.Transferencia,3000);
 assert.equal(caja.medios.Efectivo,2000);
 assert.equal(s.pedidos[0].total,9000);
});
test('cobros mixtos incoherentes y medios de delivery de plataforma son rechazados',()=>{
 for(const args of [
  cobro({pagosProductos:[{medio:'Débito',monto:3000},{medio:'Transferencia',monto:3000}]}),
  cobro({pagosProductos:[{medio:'Débito',monto:0},{medio:'Transferencia',monto:7000}]}),
  cobro({medioEnvio:'Rappi'}),
  cobro({pagosEnvio:[{medio:'Efectivo',monto:1000},{medio:'Rappi',monto:1000}]}),
  cobro({pagosEnvio:[{medio:'Débito',monto:500},{medio:'Efectivo',monto:500}]}),
  cobro({medioProductos:'No existe'})
 ]){
  const s=estado(),antes=structuredClone(s);
  assert.throws(()=>prepararCobroPendienteRomoQA(s,args));
  // El preparador muta solo copia descartable. Ninguna operación llega a Neon.
  assert.equal(antes.pedidos[0].pagado,false);
 }
});
test('no se cobra automáticamente ni dos veces, tampoco en turno cerrado',()=>{
 const escenarios=[
  {data:estado(),args:cobro({confirmoRecepcion:false})},
  {data:estado({pedidos:[pedido({pagado:true})]}),args:cobro()},
  {data:estado({pedidos:[pedido({estado:'Cancelado'})]}),args:cobro()},
  {data:estado({pedidos:[pedido({codigoCarta:'QA-ROMO-001'})]}),args:cobro()},
  {data:estado({pedidos:[pedido({cliente:'PRUEBA INTERNA NO CLIENTE'})]}),args:cobro()},
  {data:estado({pedidos:[pedido({productosPagadosOtroLocal:true})]}),args:cobro()},
  {data:estado({pedidos:[pedido({subtotal:8000})]}),args:cobro()},
  {data:estado({cajasDiarias:{[SUC+'|'+DIA]:{turnoId:turno,turnoAbierto:false}}}),args:cobro()},
  {data:estado({cierres:[{suc:SUC,turnoClave:turno}]}),args:cobro()},
  {data:estado({pedidos:[pedido({suc:'Uki La Serena'})]}),args:cobro()}
 ];
 for(const x of escenarios)assert.throws(()=>prepararCobroPendienteRomoQA(x.data,x.args));
});
test('CAS cifra la copia y muestra pago solo después de Neon, sin doble registro',async()=>{
 let live={estado:estado(),revision:2},writes=0,shown=0;
 const original=JSON.stringify(live.estado);
 const driver=crearGuardadoCobroRomoQA({
  habilitado:true,
  servidor:{disponible:()=>true,guardarSobreCifrado:async({snapshot,revision})=>{
   assert.equal(revision,2);assert.equal(JSON.stringify(live.estado),original);
   assert.equal(snapshot.data.pedidos[0].pagado,true);
   assert.equal(snapshot.data.pedidos[0].total,9000);
   writes++;return {revision:3};
  }},
  estadoVisible:()=>live,
  validarEstado:(d,s)=>d?.suc===s,
  cifrarEstado:async(data)=>({sucursal:SUC,formato:'uki-v813-browser',data}),
  aplicarConfirmado:async({estado,revision})=>{shown++;live={estado,revision};}
 });
 const response=await driver.confirmar(cobro());
 assert.equal(response.revision,3);
 assert.equal(live.estado.pedidos[0].pagado,true);
 assert.equal(writes,1);assert.equal(shown,1);
 await assert.rejects(driver.confirmar(cobro()),/ya pagado/);
 assert.equal(writes,1);assert.equal(live.revision,3);
});
test('fallo incierto de Neon no marca ventas ni cuenta cliente localmente',async()=>{
 let live={estado:estado(),revision:2};
 const driver=crearGuardadoCobroRomoQA({
  habilitado:true,servidor:{disponible:()=>true,
   guardarSobreCifrado:async()=>{throw Error('corte de conexión')}},
  estadoVisible:()=>live,validarEstado:(d,s)=>d?.suc===s,
  cifrarEstado:async(data)=>({sucursal:SUC,formato:'uki-v813-browser',data}),
  aplicarConfirmado:async()=>{throw Error('no mostrar')}
 });
 await assert.rejects(driver.confirmar(cobro()),e=>e instanceof RomoCobroInciertoQA);
 assert.equal(live.estado.pedidos[0].pagado,false);
 assert.deepEqual(live.estado.clientes,{});
});
test('el controlador del panel expone cobro pero no lo habilita públicamente',()=>{
 const s=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
 assert.match(s,/async confirmarCobroPendiente\(datos=\{\}\)/);
 assert.match(s,/crearGuardadoCobroRomoQA/);
 const pub=readFileSync(new URL('../public/romo-qa/uki-romo-panel-control-qa.mjs',import.meta.url));
 assert.deepEqual(pub,readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url)));
 const worker=readFileSync(new URL('../firebase/uki-romo-cobro-pendiente-qa.mjs',import.meta.url));
 assert.deepEqual(worker,readFileSync(new URL('../public/romo-qa/uki-romo-cobro-pendiente-qa.mjs',import.meta.url)));
 const backend=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(backend,/if\(config\.qaOnly\)return fail\(res,403/);
});
