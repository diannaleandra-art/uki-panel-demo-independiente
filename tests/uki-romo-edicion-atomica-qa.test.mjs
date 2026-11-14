import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararEdicionPendienteRomoQA,crearGuardadoEdicionRomoQA,
 RomoEdicionInciertaQA} from '../firebase/uki-romo-edicion-atomica-qa.mjs';
const SUC='Romo’s Sushi La Serena',DIA='2026-11-13',T=1794590000000;
const turno=DIA+'@'+T;
const base=()=>({suc:SUC,clientes:{},pedidos:[{
  suc:SUC,id:1,turnoClave:turno,numeroTurno:1,estado:'Pendiente',pagado:false,
  modalidad:'Delivery',propina:0,subtotal:7000,envio:1500,total:8500,
  productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000,detalle:'Soya'}]
 }],cierres:[],propinas:[],cajasDiarias:{[SUC+'|'+DIA]:{
  turnoId:turno,turnoAbierto:true,inicioMs:T}}});
const cambio=()=>({pedidoId:1,responsable:'Encargado QA',motivo:'Cliente corrigió el envío',
 registradoEn:T+120000,envio:2000,productos:[{
 nombre:'24 piezas',cantidad:1,precioUnit:7000,detalle:'Soya'}]});
test('cambiar delivery impago registra antes y después sin generar ingresos',()=>{
 const x=base(),before=structuredClone(x),r=prepararEdicionPendienteRomoQA(x,cambio());
 assert.deepEqual({anterior:r.totalAnterior,nuevo:r.totalNuevo},{anterior:8500,nuevo:9000});
 assert.equal(x.pedidos[0].historialCambios[0].anterior.envio,1500);
 assert.equal(x.pedidos[0].historialCambios[0].nuevo.envio,2000);
 assert.equal(x.pedidos[0].historialCambios[0].responsable,'Encargado QA');
 assert.equal(x.pedidos[0].pagado,false);
 assert.deepEqual(x.cajasDiarias,before.cajasDiarias);
 assert.deepEqual(x.clientes,before.clientes);
 assert.deepEqual(x.propinas,before.propinas);
 assert.equal(x.pedidos[0].numeroTurno,1);
});
test('editar cantidades y detalles es seguro y mantiene identificadores',()=>{
 const x=base();
 const d=cambio();d.envio=1500;d.productos=[{nombre:'24 piezas',
   cantidad:2,precioUnit:7500,detalle:'Teriyaki, sin queso'}];
 prepararEdicionPendienteRomoQA(x,d);
 assert.equal(x.pedidos[0].subtotal,15000);
 assert.equal(x.pedidos[0].total,16500);
 assert.equal(x.pedidos[0].productos[0].detalle,'Teriyaki, sin queso');
 assert.equal(x.pedidos[0].turnoClave,turno);
});
test('rechaza ventas pagadas, timbres, otros locales, turnos cerrados y faltantes',()=>{
 const edits=[
 x=>x.pedidos[0].pagado=true,
 x=>x.pedidos[0].productosPagadosOtroLocal=true,
 x=>x.pedidos[0].timbreEnviadoEn=new Date(T).toISOString(),
 x=>x.propinas.push({pedidoId:1,monto:100}),
 x=>x.cierres.push({suc:SUC,turnoClave:turno}),
 x=>x.cajasDiarias[SUC+'|'+DIA].turnoAbierto=false,
 x=>x.pedidos[0].suc='Uki La Serena',
 x=>x.pedidos[0].estado='Entregado',
 ];
 for(const f of edits){
  const x=base();f(x);
  const before=JSON.stringify(x);
  assert.throws(()=>prepararEdicionPendienteRomoQA(x,cambio()));
  assert.equal(JSON.stringify(x),before);
 }
});
test('no permite total incongruente, precios cero ni cambios nulos',()=>{
 for(const d of [
  {...cambio(),envio:-100},
  {...cambio(),productos:[{nombre:'24 piezas',cantidad:1,precioUnit:0,detalle:'Soya'}]},
  {...cambio(),envio:1500},
  {...cambio(),motivo:'a'}
 ]){
  const x=base(),before=JSON.stringify(x);
  assert.throws(()=>prepararEdicionPendienteRomoQA(x,d));
  assert.equal(JSON.stringify(x),before);
 }
});
test('Neon CAS confirma antes de mostrar edición, sin doble abono',async()=>{
 let state={revision:2,estado:base()},writes=0;const before=structuredClone(state.estado);
 const x=crearGuardadoEdicionRomoQA({
  habilitado:true,servidor:{disponible:()=>true,
  guardarSobreCifrado:async({snapshot,revision})=>{
   assert.equal(revision,2);assert.deepEqual(state.estado,before);
   assert.equal(snapshot.data.pedidos[0].envio,2000);writes++;return {revision:3};}},
  estadoVisible:()=>state,validarEstado:(x,s)=>x?.suc===s,
  cifrarEstado:async(data)=>({formato:'uki-v813-browser',sucursal:SUC,data}),
  aplicarConfirmado:async({estado,revision})=>{state={estado,revision}}
 });
 const r=await x.editar(cambio());
 assert.equal(r.ok,true);assert.equal(writes,1);
 assert.equal(state.estado.pedidos[0].envio,2000);
 assert.equal(state.estado.pedidos[0].historialCambios.length,1);
});
test('error incierto no altera visual y exige revisar Neon',async()=>{
 let state={revision:0,estado:base()};
 const x=crearGuardadoEdicionRomoQA({
  habilitado:true,servidor:{disponible:()=>true,guardarSobreCifrado:async()=>{throw Error('sin red')}},
  estadoVisible:()=>state,validarEstado:(e,s)=>e?.suc===s,
  cifrarEstado:async(data)=>({formato:'uki-v813-browser',sucursal:SUC,data}),
  aplicarConfirmado:async()=>{throw Error('no mostrar')}
 });
 await assert.rejects(x.editar(cambio()),e=>e instanceof RomoEdicionInciertaQA);
 assert.equal(state.estado.pedidos[0].envio,1500);
});
test('edición se conecta al mismo panel; no activa comercio ni cambia Uki',()=>{
 const panel=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const ctrl=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
 assert.match(panel,/async function ukiRomoEditarSinPagoQA\(id\)/);
 assert.match(panel,/Editar pedido sin pago/);
 assert.match(ctrl,/async editarSinPago\(\{pedidoId,responsable,motivo,registradoEn,productos,envio\}/);
 assert.match(panel,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=location\.hostname===/);
});
