import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararEntregaRomoQA,crearGuardadoEntregaRomoQA,
 RomoEntregaInciertaQA} from '../firebase/uki-romo-entrega-atomica-qa.mjs';
const SUC='Romo’s Sushi La Serena';
const now=1794596400000;
const datos=()=>({pedidoId:1,responsable:'Trabajador QA',registradoEn:now});
const initial=()=>({suc:SUC,pedidos:[{id:1,suc:SUC,estado:'Pendiente',
  pagado:false,subtotal:7000,total:9000,envio:2000,productos:[],
  telefono:'+56911112222'}],cierres:[],cajasDiarias:{},nextId:2});
test('entregar Romo exige pedido pendiente y registra responsable, sin mover pagos',()=>{
 const e=initial(),copy=structuredClone(e); const r=prepararEntregaRomoQA(e,datos());
 assert.equal(r.estado,'Entregado');
 assert.equal(e.pedidos[0].entregadoPor,'Trabajador QA');
 assert.equal(e.pedidos[0].historialCambios.at(-1).tipo,'entrega_confirmada');
 for(const k of ['pagado','subtotal','total','envio','productos'])
  assert.deepEqual(e.pedidos[0][k],copy.pedidos[0][k]);
 assert.throws(()=>prepararEntregaRomoQA(e,datos()),/pendiente/);
});
test('Romo bloquea entrega de otro local, premios y timbre obligatorio sin enviar',()=>{
 for(const change of [
 p=>p.suc='Uki La Serena',p=>p.esPremio=true,
 p=>p.estado='Cancelado',
 p=>{p.pagado=true;p.timbreReglaObligatoria=true}
 ]){
  const e=initial();change(e.pedidos[0]);
  assert.throws(()=>prepararEntregaRomoQA(e,datos()));
 }
});
test('Neon confirma antes de mutar pantalla, y nunca doble pedido',async()=>{
 let visible={estado:initial(),revision:3},calls=0;
 const old=structuredClone(visible.estado);
 const worker=crearGuardadoEntregaRomoQA({
  habilitado:true,servidor:{disponible:()=>true,guardarSobreCifrado:async({snapshot,revision})=>{
   assert.equal(revision,3);assert.deepEqual(visible.estado,old);
   assert.equal(snapshot.estadoPrueba.pedidos[0].estado,'Entregado');
   calls++;return {revision:4};
  }},
  estadoVisible:()=>visible,validarEstado:(e,s)=>e?.suc===s,
  cifrarEstado:async e=>({sucursal:SUC,formato:'uki-v813-browser',estadoPrueba:e}),
  aplicarConfirmado:async({estado,revision})=>{visible={estado,revision}}
 });
 const r=await worker.entregar(datos());
 assert.equal(r.ok,true);assert.equal(calls,1);
 assert.equal(visible.estado.pedidos[0].estado,'Entregado');
 assert.equal(visible.estado.pedidos.length,1);
});
test('respuesta incierta de Neon no modifica ni confirma entrega',async()=>{
 let visible={estado:initial(),revision:2},calls=0;
 const worker=crearGuardadoEntregaRomoQA({
  habilitado:true,servidor:{disponible:()=>true,guardarSobreCifrado:async()=>{calls++;throw Error('timeout')}},
  estadoVisible:()=>visible,validarEstado:(e,s)=>e?.suc===s,
  cifrarEstado:async e=>({sucursal:SUC,formato:'uki-v813-browser',estadoPrueba:e}),
  aplicarConfirmado:async()=>{throw Error('No aplicar')}
 });
 await assert.rejects(worker.entregar(datos()),err=>err instanceof RomoEntregaInciertaQA);
 assert.equal(calls,1);
 assert.equal(visible.estado.pedidos[0].estado,'Pendiente');
});
test('el mismo panel delega en CAS y sigue con bandera Romo apagada',()=>{
 const control=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(control,/crearGuardadoEntregaRomoQA/);
 assert.match(control,/async marcarEntregado\(\{pedidoId,responsable,registradoEn\}/);
 assert.match(html,/async function ukiRomoEntregarPedidoQA\(id\)/);
 assert.match(html,/Marcar entregado/);
 assert.match(html,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
