import test from 'node:test';
import assert from 'node:assert/strict';
import {crearControlRomoMismoPanelQA,ROMO_PANTALLA_OPERATIVA_HABILITADA_QA}
 from '../firebase/uki-romo-panel-control-qa.mjs';
const SUC='Romo’s Sushi La Serena',id='123e4567-e89b-42d3-a456-426614174001';
const token='123e4567-e89b-42d3-a456-426614174002';
const make=()=>({suc:SUC,pedidos:[],propinas:[],clientes:{},gastos:[],cierres:[],nextId:1});
const texto=['*ROMO’S SUSHI*','N.º de pedido: 271','Sucursal: Romo’s Sushi La Serena',
 '*COCINA*','*− 1 × 24 piezas*','Pollo, palta, panko','*ENTREGA*','Retiro',
 '*PAGO*','Total productos: $7.000','Pago: Efectivo'].join('\n');
const row={id,branch:'serena',estado:'pendiente',codigo_pedido:'271',
 cliente:'Cliente QA',telefono:'',mensaje:texto,total_indicado:7000};
const contexto={numeroTurno:1,turnoClave:'2026-11-13@1763070000000',registradoEn:1763070000000};
function setup({enabled=true,conflict=false}={}){
 let rendered={revision:null,estado:null},saves=0,fetches=0;
 const events=[];
 const control=crearControlRomoMismoPanelQA({
  habilitado:enabled,
  obtenerToken:async()=>{events.push('google');return 'token_seguro_'.repeat(6)},
  validarClave:async()=>events.push('clave Uki'),
  confirmarClaveInicial:async()=>true,
  crearInicial:make,
  estadoRemoto:{disponible:()=>true,cargar:async()=>{
   events.push('Neon leer');return {revision:0,estado:null}}},
  bandeja:{
   disponible:()=>true,
   listar:async()=>{events.push('lista');return [row]},
   reservar:async(a,b)=>{events.push('reservar');assert.equal(a,id);assert.ok(b)},
   confirmarGuardado:async p=>{
    events.push('Neon confirmar');assert.equal(p.expectedRevision,0);
    assert.equal(p.snapshot.sucursal,SUC);
    assert.equal(rendered.estado.pedidos.length,0);
    if(conflict)throw Error('Conflicto 409');
    saves++;return {estado:'aceptada',pedido_interno:'1',revision:1}
   }},
  cifrarEstado:async state=>{events.push('AES-GCM');
   assert.equal(state.pedidos.length,1);
   return {formato:'uki-v813-browser',sucursal:SUC,cifrado:'dummy-test'}},
  validarEstado:(state,suc)=>state?.suc===suc&&Array.isArray(state.pedidos),
  estadoVisible:()=>rendered,
  aplicarEstado:async ({estado,revision})=>{
   events.push('mostrar');rendered={estado,revision}
  }
 });
 return {control,events,visible:()=>rendered,counts:()=>({saves,fetches})};
}
test('apagado no consulta Google, claves ni datos de otra sucursal',async()=>{
 const x=setup({enabled:false});
 assert.equal(ROMO_PANTALLA_OPERATIVA_HABILITADA_QA,false);
 await assert.rejects(x.control.abrir({password:'ClaveHabitualDeUki_123'}),/preparación/);
 assert.deepEqual(x.events,[]);
});
test('mismo panel: abre con Google+clave, lee Neon, selecciona carta, confirma después',async()=>{
 const x=setup();
 await x.control.abrir({password:'ClaveHabitualDeUki_123'});
 assert.deepEqual(x.events,['google','clave Uki','Neon leer','mostrar']);
 assert.equal(x.visible().estado.pedidos.length,0);
 const d=await x.control.seleccionar(id);
 d.items[0].precio=7000;
 const result=await x.control.guardar({
  draft:d,contexto,confirmoArmado:true,confirmoImportes:true
 });
 assert.equal(result.estado,'aceptada');
 assert.deepEqual(x.events.slice(4),['lista','AES-GCM','reservar','Neon confirmar','mostrar']);
 assert.equal(x.visible().revision,1);
 assert.equal(x.visible().estado.pedidos.length,1);
 assert.equal(x.visible().estado.pedidos[0].pagado,false);
 assert.equal(x.control.resumen().solicitudId,null);
 assert.equal(x.counts().saves,1);
});
test('error de confirmación conserva cero ventas y solicitud por revisar',async()=>{
 const x=setup({conflict:true});
 await x.control.abrir({password:'ClaveHabitualDeUki_123'});
 const d=await x.control.seleccionar(id);d.items[0].precio=7000;
 await assert.rejects(x.control.guardar({
  draft:d,contexto,confirmoArmado:true,confirmoImportes:true
 }),/Revisa la bandeja/);
 assert.equal(x.visible().estado.pedidos.length,0);
 assert.equal(x.control.resumen().solicitudId,id);
 assert.equal(x.counts().saves,0);
});
test('no se permite seleccionar ni guardar antes de abrir Romo',async()=>{
 const x=setup();
 await assert.rejects(x.control.listar(),/Primero abre/);
 await assert.rejects(x.control.seleccionar(id),/Primero abre/);
});
