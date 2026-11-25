import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {prepararConciliacionCancelacionRomoQA} from '../public/romo-panel-qa/uki-romo-conciliacion-cancelacion-qa.mjs';

const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const suc='Romo’s Sushi La Serena', dia='2026-11-25', turno=dia+'@1795621000000';
const activo={id:23,suc,turnoClave:turno,estado:'Pendiente',pagado:false,total:10000};
const clone=x=>JSON.parse(JSON.stringify(x));
const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const interfaz=take('function ukiRomoCancelacionBloqueoQA','function ukiRomoPedidosPendientesHTMLQA');
const controlador=take('async function ukiRomoCambiarEstadoQA','const ROMO_MEDIOS_SALIDAS_QA')
 .replace("await import('./uki-romo-conciliacion-cancelacion-qa.mjs')",'moduloCancelacion');
function setup({worker='Agendadora de prueba',write=true,pedido=activo,cerrado=false}={}){
 const S={suc,pedidos:[clone(pedido),{...activo,id:24,pagado:true}],cierres:[],propinas:[],
  cajasDiarias:{[suc+'|'+dia]:{turnoAbierto:true,turnoId:turno}}};
 const datos={motivoCancelacion23:'cliente',detalleCancelacion23:'No',respCancelacion23:'Encargada de prueba'};
 const mensajes=[],prompts=[],guardados=[];
 const ctxt={
  S, ROMO_SUCURSAL_QA:suc,fechaOperativaActual:()=>dia,ukiCierreConfirmadoPedido:()=>cerrado,
  ukiTimbreResponsableActual:()=>worker,esc:String,ukiRomoOperacionesEnCursoQA:()=>false,
  ukiErrorCancelarPedido:(id,error)=>mensajes.push(error),aviso:error=>mensajes.push(error),
  ukiRomoOperandoPedidoQA:false,datosSoloSucursal:()=>clone(S),moduloCancelacion:{prepararConciliacionCancelacionRomoQA},
  document:{getElementById:id=>({value:datos[id]})},
  window:{confirm:m=>{prompts.push(m);return true;},ukiRomoGuardadoHabilitadoQA:()=>write,
   ukiRomoSesionRemotaQA:{disponible:()=>true,estado:()=>({conflicto:false}),
    coincideEstadoOperativo:()=>true,estadoOperativoConfirmado:()=>clone(S)}},
  ukiRomoGuardarOperacionQA:async (...args)=>guardados.push(args)
 };
 runInNewContext(interfaz+'\n'+controlador,ctxt);
 return {view:()=>ctxt.ukiRomoCancelarPedidoHTMLQA(S.pedidos[0]),cancel:()=>ctxt.ukiRomoCambiarEstadoQA(23,'cancelar'),
  S,datos,mensajes,prompts,guardados};
}
test('El resumen adicional ya no antecede a Nuevo pedido; las vistas históricas quedan en Más filtros',()=>{
 const vista=take('function ukiRomoPedidosPendientesHTMLQA','// Fichas de Clientes del mismo panel Uki');
 assert.doesNotMatch(vista,/Pedidos de Romo<\/b>|nav\+ukiRomoSolicitudesHTMLQA/);
 assert.match(vista,/Más filtros[\s\S]*'\+nav\+'<\/details>/);
 for(const label of ['Pendientes anteriores','Historial','Todos','Volver al turno abierto'])assert.ok(vista.includes(label));
 assert.ok(vista.indexOf('ukiRomoCancelarPedidoHTMLQA(p)')>vista.indexOf('let acciones'));
});
test('En pedidos pagados la opción se ve pero no ofrece confirmar, cobrar ni devolver',async()=>{
 const f=setup({pedido:{...activo,pagado:true}});
 assert.match(f.view(),/❌ Cancelar pedido[\s\S]*Figura pagado/);
 assert.doesNotMatch(f.view(),/Confirmar cancelación del pedido/);
 await f.cancel();
 assert.equal(f.guardados.length,0);
 assert.equal(f.prompts.length,0);
});
test('Pedido sin pago del turno actual usa mismo formulario y no vuelve a pedir responsable identificado',async()=>{
 const f=setup();
 const ui=f.view();
 assert.match(ui,/❌ Cancelar pedido[\s\S]*¿Quién canceló\?[\s\S]*Motivo obligatorio[\s\S]*Confirmar cancelación del pedido/);
 assert.doesNotMatch(ui,/respCancelacion23/);
 f.datos.detalleCancelacion23='';
 await f.cancel();
 assert.equal(f.guardados.length,0);
 assert.match(f.mensajes.at(-1),/Escribe por qué/);
 f.datos.detalleCancelacion23='No';
 await f.cancel();
 const [[copia,,id]]=f.guardados;
 assert.equal(id,23);
 assert.equal(copia.pedidos[0].estado,'Cancelado');
 assert.equal(copia.pedidos[0].canceladoPor,'Agendadora de prueba');
 assert.deepEqual(copia.pedidos[1],f.S.pedidos[1]);
 assert.deepEqual(copia.cajasDiarias,f.S.cajasDiarias);
 assert.equal(f.S.pedidos[0].estado,'Pendiente');
});
test('Entregado sin pago deja el estado anterior en el historial; no modifica caja',async()=>{
 const f=setup({pedido:{...activo,estado:'Entregado'},worker:'Sin turno identificado'});
 assert.match(f.view(),/respCancelacion23/);
 await f.cancel();
 const [[copia]]=f.guardados;
 assert.match(f.prompts[0],/Antes figuraba entregado/);
 assert.equal(copia.pedidos[0].historialCambios.at(-1).anterior,'Entregado');
 assert.equal(copia.pedidos[0].canceladoPor,'Encargada de prueba');
 assert.deepEqual(copia.cajasDiarias,f.S.cajasDiarias);
 assert.equal(copia.pedidos[0].pagado,false);
});
test('Solo consulta, turnos anteriores y cobros parciales siguen bloqueados',async()=>{
 const casos=[{write:false},{cerrado:true},{pedido:{...activo,turnoClave:'anterior'}},
  {pedido:{...activo,ajusteCobroPendiente:{saldo:1000}}},{pedido:{...activo,pagosProductos:[{medio:'Efectivo',monto:1000}]}}];
 for(const caso of casos){
  const f=setup(caso);
  assert.match(f.view(),/❌ Cancelar pedido/);
  assert.doesNotMatch(f.view(),/Confirmar cancelación del pedido/);
  await f.cancel();
  assert.equal(f.guardados.length,0);
 }
});

