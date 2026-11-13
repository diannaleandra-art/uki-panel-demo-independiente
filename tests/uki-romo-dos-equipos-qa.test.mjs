import test from 'node:test';
import assert from 'node:assert/strict';
import {crearControlRomoMismoPanelQA} from '../firebase/uki-romo-panel-control-qa.mjs';
const SUC='Romo’s Sushi La Serena',id='123e4567-e89b-42d3-a456-426614174001';
const msg=['*ROMO’S SUSHI*','N.º de pedido: 271',
 'Sucursal: Romo’s Sushi La Serena','*COCINA*','*− 1 × 24 piezas*',
 'Pollo, palta, panko','*ENTREGA*','Retiro','*PAGO*',
 'Total productos: $7.000','Pago: Efectivo'].join('\n');
const row={id,branch:'serena',estado:'pendiente',codigo_pedido:'271',cliente:'Cliente de prueba',
 telefono:'',mensaje:msg,total_indicado:7000};
const state=()=>({suc:SUC,pedidos:[],clientes:{},propinas:[],cierres:[],
 gastos:[],nextId:1});
const context={numeroTurno:1,turnoClave:'2026-11-13@1763070000000',
 registradoEn:1763070000000};
test('dos teléfonos: una sola solicitud y una sola venta confirmada',async()=>{
 // Servicio de prueba en memoria, NO una base productiva ni cifrado real.
 const server={revision:0,estado:null,estadoSolicitud:'pendiente',
  reserva:null,aceptaciones:0};
 function equipo(label){
  let local={revision:null,estado:null};
  const client=crearControlRomoMismoPanelQA({
   habilitado:true,
   obtenerToken:async()=>label.repeat(40),
   validarClave:async password=>assert(password.length>=12),
   crearInicial:state,
   estadoRemoto:{
    disponible:()=>true,
    cargar:async()=>({revision:server.revision,
     estado:server.estado?structuredClone(server.estado):null})
   },
   bandeja:{
    disponible:()=>true,
    listar:async()=>[{...row,estado:server.estadoSolicitud,
     en_reserva:server.reserva!==null}],
    reservar:async(requestId,token)=>{
     assert.equal(requestId,id);
     if(server.estadoSolicitud!=='pendiente'||server.reserva!==null)
      throw Error('La solicitud ya fue confirmada en otro teléfono');
     server.reserva=token;
    },
    confirmarGuardado:async payload=>{
     if(server.estadoSolicitud!=='pendiente'||server.reserva!==payload.claimToken||
        server.revision!==payload.expectedRevision)
      throw Error('Conflicto de revisión: otro teléfono confirmó');
     server.estado=structuredClone(payload.snapshot.estadoSoloTest);
     server.revision++;server.estadoSolicitud='aceptada';
     server.aceptaciones++;
     return {estado:'aceptada',pedido_interno:payload.pedidoId,
      revision:server.revision};
    }
   },
   cifrarEstado:async candidato=>({
    sucursal:SUC,formato:'uki-v813-browser',
    estadoSoloTest:structuredClone(candidato)
   }),
   validarEstado:(s,name)=>s?.suc===name&&Array.isArray(s.pedidos),
   estadoVisible:()=>local,
   aplicarEstado:async result=>{
    local={revision:result.revision,estado:structuredClone(result.estado)}
   }
  });
  return {client,visible:()=>local};
 }
 const telefono1=equipo('a'),telefono2=equipo('b');
 await telefono1.client.abrir({password:'MismaClaveUki2026'});
 await telefono2.client.abrir({password:'MismaClaveUki2026'});
 const d1=await telefono1.client.seleccionar(id);
 const d2=await telefono2.client.seleccionar(id);
 d1.items[0].precio=7000;d2.items[0].precio=7000;
 const r=await telefono1.client.guardar({
  draft:d1,contexto:context,confirmoArmado:true,confirmoImportes:true
 });
 assert.equal(r.estado,'aceptada');
 await assert.rejects(telefono2.client.guardar({
  draft:d2,contexto:context,confirmoArmado:true,confirmoImportes:true
 }),/confirmada en otro teléfono/);
 assert.equal(server.aceptaciones,1);
 assert.equal(server.revision,1);
 assert.equal(server.estado.pedidos.length,1);
 assert.equal(telefono1.visible().estado.pedidos.length,1);
 assert.equal(telefono2.visible().estado.pedidos.length,0);
 assert.equal(server.estado.pedidos[0].pagado,false);
 assert.equal(server.estado.pedidos[0].timbreEnviadoEn,undefined);
 assert.equal(Object.keys(server.estado.clientes).length,0);
});
