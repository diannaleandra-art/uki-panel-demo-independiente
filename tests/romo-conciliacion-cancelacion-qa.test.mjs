import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararConciliacionCancelacionRomoQA} from '../public/romo-panel-qa/uki-romo-conciliacion-cancelacion-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const timestamp=1794948000000;
const datos=categoria=>({
 pedidoId:1,categoria,responsable:'Local de Romo',
 motivo:'Pedido de prueba sin preparar, entregar ni cobrar',
 registradoEn:timestamp
});
const estado=()=>({
 suc:SUC,fechaOperativa:'2026-11-14',base:18000,
 cajaChica:{inicial:20000,gastos:[]},
 pedidos:[{
  suc:SUC,id:1,estado:'Pendiente',cliente:'PRUEBA QA',
  turnoClave:'2026-11-14@1794676606187',pagado:false,total:1000,
  subtotal:1000,modalidad:'Retiro',historialCambios:[]
 },{
  suc:SUC,id:2,estado:'Entregado',pagado:true,total:5000,
  historialCambios:[{tipo:'cobro_pendiente',fecha:'2026-11-14T17:17:00Z'}]
 }],
 cierres:[],propinas:[],gastos:[],retiros:[],
 deliveriesManuales:[],cajasDiarias:{
  [SUC+'|2026-11-14']:{base:18000,cajaChica:20000}
 },
 clientes:{},pagoDelivery:0,pagoDeliveryMedio:'Efectivo'
});
const clone=obj=>JSON.parse(JSON.stringify(obj));
const paidTotal=s=>s.pedidos.filter(p=>p.pagado&&p.estado!=='Cancelado')
 .reduce((t,p)=>t+(Number(p.total)||0),0);

test('Romo: cancelación propuesta aparece en Pedidos y crea solo evento en Historial',()=>{
 for(const categoria of ['local','cliente']){
  const antes=estado(),firmado=JSON.stringify(antes);
  const {estadoPropuesto:c,resumen:r}=prepararConciliacionCancelacionRomoQA(antes,datos(categoria));
  assert.equal(JSON.stringify(antes),firmado);
  assert.equal(antes.pedidos[0].estado,'Pendiente');
  assert.equal(c.pedidos[0].estado,'Cancelado');
  assert.equal(c.pedidos[0].historialCambios.length,1);
  assert.equal(c.pedidos[0].historialCambios[0].tipo,'cancelacion');
  assert.equal(c.pedidos[0].historialCambios[0].categoria,categoria);
  assert.equal(c.pedidos[0].historialCambios[0].motivo,datos(categoria).motivo);
  assert.equal(c.pedidos[0].canceladoPor,datos(categoria).responsable);
  assert.equal(r.antes,'Pendiente');assert.equal(r.despues,'Cancelado');
  assert.equal(r.cobro,false);assert.equal(r.devolucion,false);
  assert.equal(r.modificacionCaja,false);
  assert.equal(r.guardadoEnNeon,false);
 }
});

test('No altera pagos, otros pedidos, cierres, caja, clientes ni totales cobrados',()=>{
 const s=estado(),{estadoPropuesto:c}=prepararConciliacionCancelacionRomoQA(s,datos('local'));
 const x=clone(s),y=clone(c);
 delete x.pedidos;delete y.pedidos;
 assert.deepEqual(y,x);
 assert.deepEqual(c.pedidos[1],s.pedidos[1]);
 assert.equal(c.pedidos[0].total,1000);
 assert.equal(paidTotal(s),5000);
 assert.equal(paidTotal(c),5000);
 assert.equal(s.pedidos.filter(x=>x.estado==='Pendiente').length,1);
 assert.equal(c.pedidos.filter(x=>x.estado==='Pendiente').length,0);
 assert.equal(c.pedidos.filter(x=>x.estado==='Cancelado').length,1);
});

test('Rechaza pagos, propinas, turno cerrado, pedido inexistente y doble cancelación',()=>{
 for(const alter of [
  s=>{s.pedidos[0].pagado=true},
  s=>{s.pedidos[0].pagosProductos=[{medio:'Efectivo',monto:1000}]},
  s=>{s.propinas=[{pedidoId:1,monto:200}]},
  s=>{s.cierres=[{suc:SUC,turnoClave:s.pedidos[0].turnoClave}]},
  s=>{s.pedidos[0].estado='Cancelado'},
  s=>{s.pedidos.splice(0,1)}
 ]){
  const s=estado();alter(s);const original=JSON.stringify(s);
  assert.throws(()=>prepararConciliacionCancelacionRomoQA(s,datos('local')));
  assert.equal(JSON.stringify(s),original);
 }
});
test('Rechaza sucursal distinta, responsable inválido y categoría omitida',()=>{
 const s=estado();s.suc='Uki La Serena';
 assert.throws(()=>prepararConciliacionCancelacionRomoQA(s,datos('local')),/Romo/);
 assert.throws(()=>prepararConciliacionCancelacionRomoQA(estado(),{...datos('local'),responsable:'x'}),/responsable|cancela/i);
 assert.throws(()=>prepararConciliacionCancelacionRomoQA(estado(),{...datos('local'),categoria:''}),/quién canceló|historial esperado/i);
});
test('Con 100 eventos históricos conserva máximo 100 y añade la cancelación',()=>{
 const s=estado();
 s.pedidos[0].historialCambios=Array.from({length:100},(_,i)=>({tipo:'observacion',fecha:String(i)}));
 const r=prepararConciliacionCancelacionRomoQA(s,datos('local'));
 assert.equal(r.estadoPropuesto.pedidos[0].historialCambios.length,100);
 assert.equal(r.resumen.historialAntes,100);
 assert.equal(r.resumen.historialDespues,100);
 assert.equal(r.estadoPropuesto.pedidos[0].historialCambios.at(-1).tipo,'cancelacion');
});

test('El formulario exige copia conciliada de Neon antes de proponer y guardar',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const segment=html.slice(html.indexOf('async function ukiRomoCambiarEstadoQA('),
  html.indexOf('const ROMO_MEDIOS_SALIDAS_QA='));
 assert.match(segment,/sesion\.coincideEstadoOperativo\(anterior\)!==true/);
 assert.match(segment,/prepararConciliacionCancelacionRomoQA\(anterior,/);
 assert.match(segment,/guardadoEnNeon!==false/);
 assert.match(segment,/modificacionCaja!==false/);
 assert.ok(segment.indexOf('prepararConciliacionCancelacionRomoQA(')<
   segment.indexOf('ukiRomoGuardarOperacionQA('));
 assert.match(html,/if\(window\.ukiRomoGuardadoHabilitadoQA\?\.\(\)!==true\)/);
});

test('La conciliación no contiene red, almacenamiento ni escrituras directas',()=>{
 const src=readFileSync(new URL('../public/romo-panel-qa/uki-romo-conciliacion-cancelacion-qa.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/fetch\s*\(|\.guardar\(|localStorage\.|\bUPDATE\s+public\.|\bINSERT\s+INTO\b/);
});
