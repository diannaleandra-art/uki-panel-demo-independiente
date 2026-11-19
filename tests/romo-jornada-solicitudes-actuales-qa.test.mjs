import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 verificarSolicitudesParaAvanceRomoQA as comprobarPanel,
 prepararAvanceJornadaSinCajaRomoQA as avanzarPanel
} from '../public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs';
import {
 verificarSolicitudesParaAvanceRomoQA as comprobarUnificado,
 prepararAvanceJornadaSinCajaRomoQA as avanzarUnificado
} from '../firebase/uki-romo-cierre-definitivo-qa.mjs';

const FECHA='2026-11-19';
const registro=Date.parse('2026-11-19T17:42:00.000Z');
const solicitud=(fecha,estado='pendiente')=>({
 branch:'serena',estado,creado_en:fecha
});
const estadoVacio=()=>({
 suc:'Romo’s Sushi La Serena',fechaOperativa:'2026-11-14',
 cajasDiarias:{},pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],
 deliveriesManuales:[],solicitudesWhatsApp:[],incidencias:[],
 ajustesHistoricos:[],nextId:1
});
const drivers=[
 ['Panel Romo',comprobarPanel,avanzarPanel],
 ['Módulo del panel conjunto',comprobarUnificado,avanzarUnificado]
];
for(const [label,comprobar,avanzar] of drivers){
 test(label+': la solicitud nueva de hoy permanece pendiente y no genera dinero',()=>{
  const rows=[solicitud('2026-11-19T17:35:46.282Z'),
   solicitud('2026-11-18T17:32:29.926Z','aceptada')];
  const r=comprobar(rows,FECHA);
  assert.equal(r.hoyPendientes,1);
  assert.equal(r.fechaNueva,FECHA);
  assert.equal(rows[0].estado,'pendiente');
  const s=estadoVacio();
  const next=avanzar(s,{fechaNueva:FECHA,responsable:'Dueña QA',
   motivo:'Jornada antigua sin caja real',registradoEn:registro});
  assert.equal(next.fechaNueva,FECHA);
  assert.equal(s.fechaOperativa,FECHA);
  assert.equal(s.ajustesHistoricos.length,1);
  assert.equal(s.ajustesHistoricos[0].tipo,'jornada_regularizada_sin_caja');
  assert.equal(s.pedidos.length,0);
  assert.equal(s.cierres.length,0);
 });
 test(label+': bloquea la solicitud antigua sin resolver, aunque exista otra de hoy',()=>{
  const rows=[solicitud('2026-11-19T17:35:46.282Z'),
    solicitud('2026-11-14T17:34:39.152Z')];
  assert.throws(()=>comprobar(rows,FECHA),/solicitudes antiguas pendientes/);
 });
 test(label+': rechaza otras sucursales, fechas desconocidas y listas truncadas',()=>{
  assert.throws(()=>comprobar([solicitud('')],FECHA),/fecha desconocida/);
  assert.throws(()=>comprobar([{...solicitud('2026-11-19T17:00:00Z'),branch:'arica'}],FECHA),/otra sucursal/);
  assert.throws(()=>comprobar([solicitud('2026-11-20T17:00:00Z')],FECHA),/posterior/);
  assert.throws(()=>comprobar(Array.from({length:100},()=>solicitud('2026-11-19T17:00:00Z')),FECHA),/completa/);
 });
 test(label+': no avanza una jornada con un pedido antiguo sin cancelar',()=>{
  const s=estadoVacio();
  s.pedidos=[{suc:s.suc,fechaOperativa:'2026-11-14',estado:'Pendiente',pagado:false}];
  assert.throws(()=>avanzar(s,{fechaNueva:FECHA,responsable:'Dueña QA',
   motivo:'Jornada antigua sin caja real',registradoEn:registro}),/pedidos antiguos/);
  assert.equal(s.fechaOperativa,'2026-11-14');
  assert.equal(s.ajustesHistoricos.length,0);
 });
 test(label+': no avanza con caja abierta ni dinero registrado',()=>{
  const s=estadoVacio();
  s.cajasDiarias[s.suc+'|2026-11-14']={turnoAbierto:true};
  assert.throws(()=>avanzar(s,{fechaNueva:FECHA,responsable:'Dueña QA',
   motivo:'Jornada antigua sin caja real',registradoEn:registro}),/caja abierta/);
  assert.equal(s.fechaOperativa,'2026-11-14');
 });
}
test('La interfaz revisa la bandeja por fecha antes de intentar regularizar',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const begin=html.indexOf('async function ukiRomoAvanzarJornadaSinCajaQA()');
 const end=html.indexOf('function ukiRomoCierreTurnoHTMLQA()',begin);
 assert.ok(begin>0&&end>begin);
 const fn=html.slice(begin,end);
 assert.match(fn,/verificarSolicitudesParaAvanceRomoQA\(data\.orders,nueva\)/);
 assert.doesNotMatch(fn,/data\.orders\.some\(o=>o\.estado==='pendiente'\)/);
 assert.match(fn,/ukiRomoGuardarOperacionQA\(copia/);
});
