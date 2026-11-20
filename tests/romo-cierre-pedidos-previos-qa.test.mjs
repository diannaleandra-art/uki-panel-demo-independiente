import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pedidosPreviosSinConciliarRomoQA as revisarPanel} from '../public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs';
import {pedidosPreviosSinConciliarRomoQA as revisarUnificado} from '../firebase/uki-romo-cierre-definitivo-qa.mjs';

const suc='Romo’s Sushi La Serena';
const fechaOperativa='2026-11-19';
const turnoActual='2026-11-19@1795146049177'; // Apertura a las 00:40 del 20/11 en Chile
const turnoAnterior='2026-11-19@1795118862816'; // Pedido 19/11, 17:07 Chile
const inicioMs=1795146049177;
const params={fechaOperativa,turnoId:turnoActual,inicioMs};
const estado=()=>({suc,cajasDiarias:{},pedidos:[],gastos:[],retiros:[],propinas:[],
 cierres:[],deliveriesManuales:[]});
const pedido=(a={})=>({suc,id:4,codigoCarta:'RS-8F7F1DA50BC6',
 estado:'Pendiente',pagado:false,registradoEn:1795118862816,
 turnoClave:turnoAnterior,fechaOperativa,...a});
for(const [nombre,revisar] of [
 ['Panel Romo',revisarPanel],['Módulo conjunto',revisarUnificado]
]){
 test(nombre+': detecta pedido por cobrar ANTERIOR al turno de cierre',()=>{
  const s=estado();s.pedidos=[pedido()];
  const original=JSON.stringify(s);
  assert.deepEqual(revisar(s,params),['RS-8F7F1DA50BC6']);
  assert.equal(JSON.stringify(s),original,'La comprobación no cambia importes ni pedidos');
 });
 test(nombre+': no excluye cobros antiguos aún sin constancia de cierre',()=>{
  const s=estado();s.pedidos=[pedido({pagado:true,medio:'Transferencia'})];
  assert.deepEqual(revisar(s,params),['RS-8F7F1DA50BC6']);
 });
 test(nombre+': permite pedido anterior cancelado SIN dinero real',()=>{
  const s=estado();s.pedidos=[pedido({estado:'Cancelado',pagado:false})];
  assert.deepEqual(revisar(s,params),[]);
 });
 test(nombre+': cancelación que conserva medios de pago NO se omite',()=>{
  const s=estado();s.pedidos=[pedido({estado:'Cancelado',
    pagosProductos:[{medio:'Transferencia',monto:2500}]})];
  assert.deepEqual(revisar(s,params),['RS-8F7F1DA50BC6']);
 });
 test(nombre+': no vuelve a sumar pedidos de turnos ya cerrados',()=>{
  const s=estado();s.pedidos=[pedido()];
  s.cierres=[{suc,turnoClave:turnoAnterior}];
  assert.deepEqual(revisar(s,params),[]);
 });
 test(nombre+': pedido de este mismo turno se comprueba en la caja ordinaria',()=>{
  const s=estado();s.pedidos=[pedido({turnoClave:turnoActual,
   registradoEn:inicioMs+5000})];
  assert.deepEqual(revisar(s,params),[]);
 });
 test(nombre+': no toma pedidos de otras jornadas',()=>{
  const s=estado();s.pedidos=[pedido({fechaOperativa:'2026-11-18',
   turnoClave:'2026-11-18@1795020000000'})];
  assert.deepEqual(revisar(s,params),[]);
 });
}
test('El motor real bloquea cierres de jornada con pedidos antiguos sin conciliar',()=>{
 const a=readFileSync(new URL('../public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs',import.meta.url),'utf8');
 assert.match(a,/const pedidosAnteriores=pedidosPreviosSinConciliarRomoQA\(estado,/);
 assert.match(a,/CHECK\(pedidosAnteriores.length===0,/);
 assert.match(a,/Hay pedidos anteriores de esta jornada sin cierre conciliado/);
});
