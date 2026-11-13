import test from 'node:test';
import assert from 'node:assert/strict';
import {crearGuardadoRomoDesdeFormularioQA,RomoGuardadoInciertoQA,RomoYaGuardadoQA,
 ROMO_GUARDADO_ATOMICO_HABILITADO_QA} from '../firebase/uki-romo-guardado-atomico-qa.mjs';
const suc='Romo’s Sushi La Serena';
const id='123e4567-e89b-42d3-a456-426614174001';
const tok='123e4567-e89b-42d3-a456-426614174002';
const initial=()=>({suc,pedidos:[],gastos:[],cierres:[],propinas:[],nextId:1});
const draft=()=>({cartaSolicitudRemotaId:id,cliente:'Cliente',codigoCarta:'271',
 modalidad:'Retiro',pagado:false,items:[{nombre:'24 piezas',cant:1,precio:7000}]});
const args={solicitud:{id,estado:'pendiente'},draft:draft(),estado:initial(),revision:1,
 confirmoArmado:true,confirmoImportes:true};
function mock({denied=false,ambiguous=false,changeAfter=false,failApply=false}={}){
 const trace=[],original=initial();
 let current={revision:1,estado:structuredClone(original)};
 const cfg={habilitado:true,
  bandeja:{disponible:()=>true,
   reservar:async(a,b)=>{trace.push('reserva');assert.equal(a,id);assert.equal(b,tok);
    if(denied)throw Error('Reservado por otro telefono');},
   confirmarGuardado:async a=>{trace.push('confirma');
    assert.equal(a.expectedRevision,1);assert.equal(a.snapshot.sucursal,suc);
    if(ambiguous)throw Error('Sin respuesta de la nube');
    if(changeAfter)current={revision:2,estado:current.estado};
    return {estado:'aceptada',pedido_interno:'1',revision:2};}},
  validarEstado:(s,x)=>s?.suc===x&&Array.isArray(s.pedidos),
  estadoVisible:()=>current,
  nuevoToken:()=>tok,
  construirCandidato:async({estado,draft})=>{trace.push('construye');
   assert.equal(draft.pagado,false);
   estado.pedidos.push({id:1,suc,cartaSolicitudRemotaId:id,pagado:false,
    total:7000,productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000}]});
   estado.nextId=2;
   return {pedidoId:1};},
  cifrarEstado:async state=>{trace.push('cifra');assert.equal(state.pedidos.length,1);
   return {formato:'uki-v813-browser',sucursal:suc,cifrado:'solo-test'};},
  aplicarConfirmado:async x=>{trace.push('muestra');
   if(failApply)throw Error('Pantalla rota');
   current={revision:x.revision,estado:x.estado};}};
 return {cfg,trace,original,visible:()=>current};
}
test('QA apagada sin acceso a nube',async()=>{
 const x=mock();
 assert.equal(ROMO_GUARDADO_ATOMICO_HABILITADO_QA,false);
 const flow=crearGuardadoRomoDesdeFormularioQA({...x.cfg,habilitado:false});
 assert.equal(flow.disponible(),false);
 await assert.rejects(flow.guardarSolicitud(args),/deshabilitado/);
 assert.deepEqual(x.trace,[]);
});
test('misma venta: confirma primero y solo entonces aparece en el panel',async()=>{
 const x=mock(),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg);
 const done=await flow.guardarSolicitud(args);
 assert.deepEqual(x.trace,['construye','cifra','reserva','confirma','muestra']);
 assert.equal(done.pedidoId,1);assert.equal(x.visible().revision,2);
 assert.equal(x.visible().estado.pedidos.length,1);
 assert.equal(x.original.pedidos.length,0);
});
test('sin precios confirmados no reserva ni crea una venta',async()=>{
 const x=mock(),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg);
 await assert.rejects(flow.guardarSolicitud({...args,confirmoImportes:false}),/Verifica/);
 await assert.rejects(flow.guardarSolicitud({...args,
  draft:{...draft(),items:[{nombre:'Roll',cant:1,precio:0}]}}),/precio/);
 assert.deepEqual(x.trace,[]);
});
test('un pedido cancelado de la misma solicitud tampoco se duplica',async()=>{
 const x=mock(),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg),prev=initial();
 prev.pedidos.push({id:1,suc,estado:'Cancelado',cartaSolicitudRemotaId:id});
 await assert.rejects(flow.guardarSolicitud({...args,estado:prev}),/ya tiene un pedido/);
 assert.deepEqual(x.trace,[]);
});
test('segundo dispositivo rechazado no muestra pedido en caja',async()=>{
 const x=mock({denied:true}),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg);
 await assert.rejects(flow.guardarSolicitud(args),/Reservado/);
 assert.deepEqual(x.trace,['construye','cifra','reserva']);
 assert.equal(x.visible().estado.pedidos.length,0);
});
test('fallo incierto requiere conciliar, no libera ni reintenta',async()=>{
 const x=mock({ambiguous:true}),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg);
 await assert.rejects(flow.guardarSolicitud(args),e=>e instanceof RomoGuardadoInciertoQA);
 assert.deepEqual(x.trace,['construye','cifra','reserva','confirma']);
 assert.equal(x.visible().estado.pedidos.length,0);
});
test('si la nube confirma pero el panel cambia, exigir recarga sin reingresar',async()=>{
 const x=mock({changeAfter:true}),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg);
 await assert.rejects(flow.guardarSolicitud(args),e=>e instanceof RomoYaGuardadoQA);
 assert.equal(x.trace.includes('muestra'),false);
});
test('fallo de pantalla posterior no intenta guardar dos veces',async()=>{
 const x=mock({failApply:true}),flow=crearGuardadoRomoDesdeFormularioQA(x.cfg);
 await assert.rejects(flow.guardarSolicitud(args),e=>e instanceof RomoYaGuardadoQA);
 assert.equal(x.trace.filter(t=>t==='confirma').length,1);
});
