import test from 'node:test';
import assert from 'node:assert/strict';
import {
 prepararTimbreRomoQA,crearGuardadoTimbreRomoQA,RomoTimbreInciertoQA
} from '../firebase/uki-romo-timbres-atomicos-qa.mjs';
const SUC='Romo’s Sushi La Serena';
const abierto='2026-11-13T19:00:00.000Z';
const confirmado='2026-11-13T19:01:00.000Z';
const datos=()=>({pedidoId:1,responsable:'Trabajador QA',
 whatsappAbiertoEn:abierto,whatsappConfirmadoEn:confirmado,envioConfirmado:true});
const inicial=()=>({suc:SUC,pedidos:[{suc:SUC,id:1,telefono:'+56911112222',
 pagado:true,estado:'Pendiente',timbreEventos:[]}],cierres:[],nextId:2});
test('solo confirma un timbre REAL y no modifica pagos ni totales',()=>{
 const estado=inicial(),antes=structuredClone(estado);
 assert.deepEqual(prepararTimbreRomoQA(estado,datos()),{
  pedidoId:1,timbreEnviadoEn:confirmado,responsable:'Trabajador QA'});
 assert.equal(estado.pedidos[0].timbreEventos.length,2);
 assert.equal(estado.pedidos[0].timbreEnviadoEn,confirmado);
 assert.equal(estado.pedidos[0].pagado,antes.pedidos[0].pagado);
 assert.equal(estado.nextId,antes.nextId);
 assert.throws(()=>prepararTimbreRomoQA(estado,datos()),/ya tiene timbre/);
});
test('no fabrica timbre ni marca WhatsApp si falta confirmación',()=>{
 const estado=inicial(),antes=JSON.stringify(estado);
 assert.throws(()=>prepararTimbreRomoQA(estado,{...datos(),envioConfirmado:false}),
  /Confirma el envío real/);
 assert.equal(JSON.stringify(estado),antes);
 assert.throws(()=>prepararTimbreRomoQA(estado,{...datos(),
  whatsappAbiertoEn:'2026-11-13T19:02:00.000Z'}),/Primero abre WhatsApp/);
 assert.equal(JSON.stringify(estado),antes);
});
test('rechaza otros locales, impagos, entregados y pagos externos',()=>{
 for(const mut of [
  p=>p.suc='Uki La Serena',p=>p.pagado=false,p=>p.estado='Entregado',
  p=>p.productosPagadosOtroLocal=true,p=>p.telefono=''
 ]){
  const estado=inicial();mut(estado.pedidos[0]);
  assert.throws(()=>prepararTimbreRomoQA(estado,datos()));
 }
});
test('la vista sólo cambia DESPUÉS de confirmación de Neon',async()=>{
 const e=inicial(),antes=structuredClone(e);
 let vista={estado:e,revision:2},escrituras=0;
 const ctrl=crearGuardadoTimbreRomoQA({
  habilitado:true,servidor:{disponible:()=>true,
   guardarSobreCifrado:async({snapshot,revision})=>{
    assert.equal(revision,2);assert.deepEqual(vista.estado,antes);
    assert.equal(snapshot.estadoSoloPrueba.pedidos[0].timbreEventos.length,2);
    escrituras++;return {revision:3};
   }},
  estadoVisible:()=>vista,
  validarEstado:(x,s)=>x?.suc===s&&Array.isArray(x.pedidos),
  cifrarEstado:async x=>({sucursal:SUC,formato:'uki-v813-browser',
   estadoSoloPrueba:structuredClone(x)}),
  aplicarConfirmado:async({estado,revision})=>{vista={estado,revision}}
 });
 const out=await ctrl.confirmar(datos());
 assert.equal(out.ok,true);assert.equal(escrituras,1);assert.equal(vista.revision,3);
 assert.equal(vista.estado.pedidos[0].timbreEnviadoEn,confirmado);
 assert.deepEqual(antes.pedidos[0].timbreEventos,[]);
});
test('fallo incierto no marca ni reenvía el timbre',async()=>{
 let vista={estado:inicial(),revision:1},intentos=0;
 const ctrl=crearGuardadoTimbreRomoQA({
  habilitado:true,servidor:{disponible:()=>true,guardarSobreCifrado:async()=>{
   intentos++;throw Error('corte de red')}},
  estadoVisible:()=>vista,validarEstado:(x,s)=>x?.suc===s,
  cifrarEstado:async x=>({sucursal:SUC,formato:'uki-v813-browser'}),
  aplicarConfirmado:async()=>{throw Error('Nunca aplicar')}
 });
 await assert.rejects(ctrl.confirmar(datos()),x=>x instanceof RomoTimbreInciertoQA);
 assert.equal(intentos,1);
 assert.equal(vista.estado.pedidos[0].timbreEnviadoEn,undefined);
});
test('el mismo panel delega el timbre, sin activar las ventas',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
 assert.match(source,/crearGuardadoTimbreRomoQA/);
 assert.match(source,/async confirmarTimbre\(\{pedidoId,responsable/);
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(html,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
