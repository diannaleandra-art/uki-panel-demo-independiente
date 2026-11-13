import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararCancelacionRomoQA,crearGuardadoCancelacionRomoQA,RomoCancelacionInciertaQA}
 from '../firebase/uki-romo-cancelacion-atomica-qa.mjs';
const SUC='Romo’s Sushi La Serena',now=1794596700000;
const args=()=>({pedidoId:1,registradoEn:now,responsable:'Trabajador QA',motivo:'Cliente solicitó cancelar'});
const initial=()=>({suc:SUC,pedidos:[{id:1,suc:SUC,estado:'Pendiente',pagado:false,
 total:9000,subtotal:7000,envio:2000,turnoClave:'2026-11-13@1794590000000'}],
 cierres:[],propinas:[],nextId:2});
test('cancelación exige responsable, motivo y no inventa devoluciones',()=>{
 const e=initial(),before=structuredClone(e);
 assert.deepEqual(prepararCancelacionRomoQA(e,args()),{
  pedidoId:1,estado:'Cancelado',responsable:'Trabajador QA',motivo:'Cliente solicitó cancelar'});
 assert.equal(e.pedidos[0].estado,'Cancelado');
 assert.equal(e.pedidos[0].historialCambios.at(-1).tipo,'cancelacion');
 assert.equal(e.pedidos[0].devolucionPendiente,undefined);
 for(const key of ['total','subtotal','envio','pagado'])
  assert.equal(e.pedidos[0][key],before.pedidos[0][key]);
 assert.throws(()=>prepararCancelacionRomoQA(e,args()),/pendiente/);
});
test('impide cancelar pedidos con pagos, propinas, premio o cierre',()=>{
 const changes=[
  e=>e.pedidos[0].pagado=true,
  e=>e.pedidos[0].envioPagadoOtroLocal=true,
  e=>e.pedidos[0].pagosProductos=[{medio:'Efectivo',monto:1000}],
  e=>e.propinas.push({pedidoId:1,monto:1000}),
  e=>e.cierres.push({suc:SUC,turnoClave:e.pedidos[0].turnoClave}),
  e=>e.pedidos[0].esPremio=true
 ];
 for(const f of changes){const e=initial();f(e);
  assert.throws(()=>prepararCancelacionRomoQA(e,args()));}
});
test('motivo obligatorio y no modifica otra sucursal',()=>{
 for(const a of [{...args(),motivo:''},{...args(),motivo:'abc'},
   {...args(),responsable:''}]){
  const e=initial(),orig=JSON.stringify(e);
  assert.throws(()=>prepararCancelacionRomoQA(e,a));
  assert.equal(JSON.stringify(e),orig);
 }
 const e=initial();e.suc='Uki La Serena';
 assert.throws(()=>prepararCancelacionRomoQA(e,args()),/Romo/);
});
test('solo cambia la copia de pantalla después de Neon',async()=>{
 let visible={revision:1,estado:initial()},updates=0;
 const orig=structuredClone(visible.estado);
 const d=crearGuardadoCancelacionRomoQA({
  habilitado:true,servidor:{disponible:()=>true,
   guardarSobreCifrado:async({snapshot,revision})=>{
    assert.equal(revision,1);assert.deepEqual(visible.estado,orig);
    assert.equal(snapshot.estadoPrueba.pedidos[0].estado,'Cancelado');
    return {revision:2};
   }},
  estadoVisible:()=>visible,validarEstado:(e,s)=>e?.suc===s,
  cifrarEstado:async e=>({sucursal:SUC,formato:'uki-v813-browser',estadoPrueba:e}),
  aplicarConfirmado:async({estado,revision})=>{updates++;visible={estado,revision}}
 });
 assert.equal((await d.cancelar(args())).ok,true);
 assert.equal(updates,1);assert.equal(visible.estado.pedidos[0].estado,'Cancelado');
});
test('respuesta incierta no indica que canceló el pedido',async()=>{
 let visible={revision:1,estado:initial()};
 const d=crearGuardadoCancelacionRomoQA({
  habilitado:true,servidor:{disponible:()=>true,guardarSobreCifrado:async()=>{throw Error('corte')}},
  estadoVisible:()=>visible,validarEstado:(e,s)=>e?.suc===s,
  cifrarEstado:async e=>({sucursal:SUC,formato:'uki-v813-browser',estadoPrueba:e}),
  aplicarConfirmado:async()=>{throw Error('No guardar')}
 });
 await assert.rejects(d.cancelar(args()),e=>e instanceof RomoCancelacionInciertaQA);
 assert.equal(visible.estado.pedidos[0].estado,'Pendiente');
});
test('panel Romo conecta cancelación sin alterar Uki',()=>{
 const control=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(control,/crearGuardadoCancelacionRomoQA/);
 assert.match(control,/async cancelarSinPago\(\{pedidoId,responsable,motivo,registradoEn\}/);
 assert.match(panel,/async function ukiRomoCancelarSinPagoQA\(id\)/);
 assert.match(panel,/Cancelar sin pago/);
 assert.match(panel,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
