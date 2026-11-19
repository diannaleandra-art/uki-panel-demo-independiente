import test from 'node:test';
import assert from 'node:assert/strict';
import {crearGuardadoRomoDesdeFormularioQA as publicDriver} from '../public/romo-panel-qa/uki-romo-guardado-atomico-qa.mjs';
import {crearGuardadoRomoDesdeFormularioQA as unifiedDriver} from '../firebase/uki-romo-guardado-atomico-qa.mjs';
import {construirCandidatoRomoFormatoUkiQA as publicCandidate} from '../public/romo-panel-qa/uki-romo-pedido-formato-qa.mjs';
import {construirCandidatoRomoFormatoUkiQA as unifiedCandidate} from '../firebase/uki-romo-pedido-formato-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const ID='812fc037-2895-4ca8-9953-62bac5c1b058';
const OTHER_ID='8b0b5d64-ad08-48da-9727-e1f3801ed8ba';
const TOKEN='c72d5ca1-cb87-49ed-9b88-e0e123d28e25';
const solicitud={id:ID,estado:'pendiente',branch:'serena',codigo_pedido:'RS-123'};
const draft={
 sucursalCarta:SUC,cartaSolicitudRemotaId:ID,codigoCarta:'RS-123',
 cliente:'Cliente Romo',items:[{nombre:'24 piezas',cant:1,precio:7000}],
 modalidad:'Retiro',envio:0,medio:'Transferencia',
 pagado:false,propinaModo:'ninguna',mixtoProductos:false,mixtoEnvio:false
};
const makeState=()=>({suc:SUC,pedidos:[],propinas:[],nextId:1});
const drivers=[['Panel de Romo',publicDriver],['Panel unido',unifiedDriver]];
const builders=[['Panel de Romo',publicCandidate],['Panel unido',unifiedCandidate]];
const setup=crear=>{
 let reserva=0,confirmacion=0,candidatos=0,aplicados=0;
 const estado=makeState();
 const bandeja={
  disponible:()=>true,
  reservar:async()=>{reserva++;},
  confirmarGuardado:async()=>{confirmacion++;return {
   estado:'aceptada',pedido_interno:'1',revision:3
  };}
 };
 const driver=crear({
  habilitado:true,bandeja,nuevoToken:()=>TOKEN,
  validarEstado:(s,sucursal)=>s.suc===sucursal,
  estadoVisible:()=>({estado,revision:2}),
  construirCandidato:async({estado:candidato})=>{
   candidatos++;
   candidato.pedidos.push({
    id:1,suc:SUC,cartaSolicitudRemotaId:ID,codigoCarta:'RS-123',
    productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000}],
    total:7000,pagado:false
   });
   return {pedidoId:1};
  },
  cifrarEstado:async()=>({sucursal:SUC,formato:'uki-v813-browser'}),
  aplicarConfirmado:async()=>{aplicados++;}
 });
 const args={solicitud:{...solicitud},draft:{...draft},estado,revision:2,
  confirmoArmado:true,confirmoImportes:true,confirmoPago:false};
 return {driver,args,counts:()=>({reserva,confirmacion,candidatos,aplicados})};
};

for(const [label,crear] of drivers){
 test(label+': una referencia de carta distinta rechaza el guardado antes de reservar',async()=>{
  const x=setup(crear);
  x.args.draft.codigoCarta='RS-999';
  await assert.rejects(()=>x.driver.guardarSolicitud(x.args),/código de carta no coincide/);
  assert.deepEqual(x.counts(),{reserva:0,confirmacion:0,candidatos:0,aplicados:0});
 });
 test(label+': código ya presente en pedido cancelado sigue bloqueado',async()=>{
  const x=setup(crear);
  x.args.estado.pedidos.push({id:99,suc:SUC,estado:'Cancelado',codigoCarta:' rs-123 '});
  await assert.rejects(()=>x.driver.guardarSolicitud(x.args),/código de carta ya tiene un pedido/);
  assert.deepEqual(x.counts(),{reserva:0,confirmacion:0,candidatos:0,aplicados:0});
 });
 test(label+': una solicitud correcta conserva una sola aceptación',async()=>{
  const x=setup(crear);
  const result=await x.driver.guardarSolicitud(x.args);
  assert.equal(result.estado,'aceptada');
  assert.equal(result.pedidoId,1);
  assert.equal(result.revision,3);
  assert.deepEqual(x.counts(),{reserva:1,confirmacion:1,candidatos:1,aplicados:1});
 });
}

for(const [label,construir] of builders){
 test(label+': el constructor bloquea códigos repetidos con otra ID de solicitud',async()=>{
  const estado=makeState();estado.nextId=2;
  estado.pedidos.push({id:1,suc:SUC,cartaSolicitudRemotaId:OTHER_ID,
   codigoCarta:' rs-123 ',estado:'Cancelado'});
  await assert.rejects(
   ()=>construir({estado,draft:{...draft},contexto:{}}),
   /Código de carta duplicado/
  );
  assert.equal(estado.pedidos.length,1);
 });
}
