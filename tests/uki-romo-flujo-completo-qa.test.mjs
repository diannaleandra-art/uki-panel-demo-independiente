import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararBorradorRomoDesdeSolicitudQA} from '../firebase/uki-romo-recepcion-formulario-qa.mjs';
import {crearGuardadoRomoDesdeFormularioQA,RomoGuardadoInciertoQA}
 from '../firebase/uki-romo-guardado-atomico-qa.mjs';
const suc='Romo’s Sushi La Serena';
const id='123e4567-e89b-42d3-a456-426614174001';
const token='123e4567-e89b-42d3-a456-426614174002';
const mensaje=['*ROMO’S SUSHI*','N.º de pedido: 271',
 'Sucursal: Romo’s Sushi La Serena','*COCINA*','*− 1 × 24 piezas*',
 'Roll 1: Pollo / Palta / Panko','Salsa: soya','*ENTREGA*','Delivery',
 'Delivery: $2.000','*PAGO*','Total productos: $7.000','Pago: Efectivo'].join('\n');
const solicitud={id,branch:'serena',estado:'pendiente',
 codigo_pedido:'271',cliente:'Cliente Romo',telefono:'+56911112222',
 mensaje,total_indicado:9000};
const estado=()=>({suc,pedidos:[],clientes:{},propinas:[],cierres:[],
 nextId:1,gastos:[],cajasDiarias:{}});
const draft=()=>{const d=prepararBorradorRomoDesdeSolicitudQA(solicitud);
 d.items[0].precio=7000;return d};
function entorno({errorServidor=false,aplica=false,pagado=false}={}){
 const visible={revision:0,estado:estado()};
 let vista=visible,commits=0,reservas=0,guardados=0;
 const hechos=[];
 const userDraft=draft();
 if(pagado){userDraft.pagado=true;userDraft.telefono='';
  userDraft.mixtoProductos=true;
  userDraft.pagosProductos=[{medio:'Débito',monto:4000},{medio:'Efectivo',monto:3000}];
  userDraft.mixtoEnvio=true;userDraft.pagosEnvio=[{medio:'Transferencia',monto:2000}];
 }
 const driver=crearGuardadoRomoDesdeFormularioQA({
  habilitado:true,
  bandeja:{
   disponible:()=>true,
   reservar:async(o,t)=>{hechos.push('reserva');reservas++;assert.equal(o,id);assert.equal(t,token)},
   confirmarGuardado:async args=>{
    hechos.push('Neon');
    assert.equal(args.expectedRevision,0);
    assert.equal(args.pedidoId,'1');
    assert.equal(args.snapshot.sucursal,suc);
    // Este mock verifica el contrato: en producción va cifrado AES-GCM.
    assert.equal(args.snapshot.pedidosDePrueba.length,1);
    assert.equal(vista.estado.pedidos.length,0,'la caja NO vio la venta antes de Neon');
    assert.equal(args.snapshot.pedidosDePrueba[0].suc,suc);
    if(errorServidor)throw Error('Corte durante respuesta Neon');
    commits++;return {estado:'aceptada',pedido_interno:'1',revision:1};
   }
  },
  contextoPedido:async({estado:estadoCopia,draft})=>{
   hechos.push('turno Uki');
   assert.equal(estadoCopia.suc,suc);
   assert.equal(draft.cartaSolicitudRemotaId,id);
   return {numeroTurno:1,turnoClave:'2026-11-13@1763070000000',
    registradoEn:1763070000000,confirmoPago:pagado};
  },
  validarEstado:(s,expected)=>s?.suc===expected&&Array.isArray(s.pedidos),
  cifrarEstado:async copia=>{
   hechos.push('cifrado');
   return {sucursal:suc,formato:'uki-v813-browser',
    pedidosDePrueba:copia.pedidos};
  },
  estadoVisible:()=>vista,
  aplicarConfirmado:async({estado:confirmado,revision})=>{
   hechos.push('aplicar');guardados++;
   if(!aplica)throw Error('Pantalla no disponible');
   vista={estado:confirmado,revision};
  },
  nuevoToken:()=>token
 });
 return {driver,userDraft,hechos,visible:()=>vista,
  contadores:()=>({commits,reservas,guardados})};
}
test('carta Romo -> mismo objeto Uki -> cifrado -> Neon -> vista, en ese orden',async()=>{
 const q=entorno({aplica:true});
 const actual=estado(),copia=structuredClone(actual);
 const result=await q.driver.guardarSolicitud({
  solicitud,draft:q.userDraft,estado:copia,revision:0,
  confirmoArmado:true,confirmoImportes:true
 });
 assert.equal(result.estado,'aceptada');
 assert.equal(result.pedidoId,1);
 assert.deepEqual(q.hechos,['turno Uki','cifrado','reserva','Neon','aplicar']);
 assert.deepEqual(actual,estado(),'el estado original no fue alterado');
 assert.equal(q.visible().estado.pedidos.length,1);
 assert.equal(q.visible().estado.pedidos[0].suc,suc);
 assert.equal(q.visible().estado.pedidos[0].pagado,false);
 assert.equal(q.visible().estado.pedidos[0].total,9000);
 assert.deepEqual(q.visible().estado.clientes,{});
 assert.equal(q.contadores().commits,1);
});
test('la confirmación de cobros mixtos se ve solo tras guardar Neon',async()=>{
 const q=entorno({aplica:true,pagado:true});
 const result=await q.driver.guardarSolicitud({
  solicitud,draft:q.userDraft,estado:estado(),revision:0,
  confirmoArmado:true,confirmoImportes:true
 });
 assert.equal(result.estado,'aceptada');
 const p=q.visible().estado.pedidos[0];
 assert.equal(p.pagado,true);
 assert.equal(p.pagosProductos.length,2);
 assert.equal(p.pagosEnvio.length,1);
 assert.equal(Object.values(q.visible().estado.clientes)[0].movimientos[0].tipo,'venta');
 assert.equal(q.visible().estado.propinas.length,0);
});
test('sin revisión de importe no reserva ni construye el pedido',async()=>{
 const q=entorno({aplica:true});
 await assert.rejects(q.driver.guardarSolicitud({
  solicitud,draft:q.userDraft,estado:estado(),revision:0,
  confirmoArmado:true,confirmoImportes:false
 }),/Verifica/);
 assert.deepEqual(q.hechos,[]);
});
test('un fallo de respuesta Neon no registra ni muestra ventas falsas',async()=>{
 const q=entorno({errorServidor:true,aplica:true});
 await assert.rejects(q.driver.guardarSolicitud({
  solicitud,draft:q.userDraft,estado:estado(),revision:0,
  confirmoArmado:true,confirmoImportes:true
 }),err=>err instanceof RomoGuardadoInciertoQA);
 assert.deepEqual(q.hechos,['turno Uki','cifrado','reserva','Neon']);
 assert.equal(q.visible().estado.pedidos.length,0);
 assert.equal(q.contadores().guardados,0);
});
test('sin proveedor de folio turno no se puede fingir la operación',async()=>{
 const q=entorno({aplica:true});
 const sinFolio=crearGuardadoRomoDesdeFormularioQA({
  habilitado:true,bandeja:{disponible:()=>true},
  cifrarEstado:async()=>{},validarEstado:()=>true,
  estadoVisible:()=>({revision:0,estado:estado()}),
  aplicarConfirmado:async()=>{}
 });
 await assert.rejects(sinFolio.guardarSolicitud({
  solicitud,draft:q.userDraft,estado:estado(),revision:0,
  confirmoArmado:true,confirmoImportes:true
 }),/Falta conexion/);
});
