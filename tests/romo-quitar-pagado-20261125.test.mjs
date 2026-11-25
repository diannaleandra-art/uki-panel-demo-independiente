import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {prepararQuitarPagadoRomoQA,aclararPagoDesmarcadoRomoQA} from '../public/romo-panel-qa/uki-romo-quitar-pagado-qa.mjs';
import {prepararConciliacionCancelacionRomoQA} from '../public/romo-panel-qa/uki-romo-conciliacion-cancelacion-qa.mjs';
import {prepararCobroPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs';

const suc='Romo’s Sushi La Serena',dia='2026-11-25',stamp=Date.parse(dia+'T13:00:00-03:00'),turno=dia+'@'+(stamp-60000);
const solicitud='00000000-0000-4000-8000-000000000001';
const datos={pedidoId:33,responsable:'Personal de prueba',registradoEn:stamp};
const timbre='2026-11-25T13:00:00Z';
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture({linked=true}={}){
 const p={id:33,suc,pagado:true,estado:'Entregado',numeroTurno:1,turnoClave:turno,cliente:'Cliente simulado',
  telefono:'56900000001',codigoCarta:'R33',modalidad:'Delivery',subtotal:10000,envio:1500,total:11500,
  medio:'Efectivo',medioEnvio:'Débito',pagosProductos:[{medio:'Efectivo',monto:5000},{medio:'Débito',monto:5000}],
  pagosEnvio:[],propina:0,timbreEnviadoEn:timbre,cobroConfirmadoEn:timbre,cobroConfirmadoPor:'Persona',
  entregadoEn:timbre,entregadoPor:'Persona',productos:[{nombre:'Clásico',cantidad:1,precioUnit:10000}],
  ...(linked?{cartaSolicitudRemotaId:solicitud}:{})};
 return {suc,fechaOperativa:dia,nextId:35,pedidos:[p,{...p,id:34,pagado:false,estado:'Pendiente'}],
  cajasDiarias:{[suc+'|'+dia]:{turnoId:turno,turnoAbierto:true,baseConfirmada:true}},cierres:[],
  propinas:[{suc,pedidoId:34,monto:2000}],clientes:{a:{telefono:p.telefono,nombre:p.cliente,
   pedidos:2,gastado:17500,movimientos:[{tipo:'venta',pedidoId:33,fecha:timbre},{tipo:'venta',pedidoId:30,fecha:timbre}]}}};
}
const cajaFisica=p=>p.ajusteCobroPendiente?.recibido||(p.pagado?{Efectivo:5000,Débito:6500}:{});
test('Quitar Pagado conserva caja física por medio, folio, solicitud y envío del timbre',()=>{
 const s=fixture(),antes=clone(s),p=s.pedidos[0];
 assert.deepEqual(prepararQuitarPagadoRomoQA(s,datos),{pedidoId:33,saldo:11500});
 assert.equal(p.pagado,false);assert.equal(p.estado,'Pendiente');assert.equal(p.entregadoEn,undefined);
 assert.equal(p.timbreEnviadoEn,timbre);assert.equal(p.cartaSolicitudRemotaId,solicitud);
 assert.deepEqual(cajaFisica(p),cajaFisica(antes.pedidos[0]));
 assert.equal(p.historialCambios[0].anterior.estado,'Entregado');
 assert.equal(p.historialCambios[0].anterior.timbreCompra.pedidoId,33);
 assert.deepEqual(s.clientes.a.movimientos,[antes.clientes.a.movimientos[1]]);
 assert.equal(s.clientes.a.gastado,7500);
 assert.deepEqual(s.pedidos[1],antes.pedidos[1]);assert.deepEqual(s.propinas,antes.propinas);
 assert.deepEqual(s.cajasDiarias,antes.cajasDiarias);assert.equal(s.nextId,35);
 assert.throws(()=>prepararQuitarPagadoRomoQA(s,datos),/ya no figura pagado/);
 assert.throws(()=>prepararCobroPendienteRomoQA(s,{...datos,confirmoRecepcion:true}),/Aclara el cobro anterior/);
});
test('Romo no desmarca pagos de banco, apps, QR, propina vinculada, otro local o turno cerrado',()=>{
 for(const cambiar of [
  s=>{s.pedidos[0].medio='Transferencia';},
  s=>{s.pedidos[0].pagosProductos[0].medio='Transferencia';},
  s=>{s.pedidos[0].medio='Uber Eats';},
  s=>{s.pedidos[0].transferenciaManualQA={verificada:true};},
  s=>{s.pedidos[0].qrSolicitudes=[solicitud];},
  s=>{s.propinas.push({suc,pedidoId:'33',monto:200});},
  s=>{s.pedidos[0].productosPagadosOtroLocal=true;},
  s=>{s.cierres.push({suc,turnoClave:turno});},
  s=>{s.fechaOperativa='2026-11-26';}
 ]){
  const s=fixture();cambiar(s);const antes=clone(s);
  assert.throws(()=>prepararQuitarPagadoRomoQA(s,datos));
  assert.deepEqual(s,antes);
 }
});
test('Cancelar exige confirmar el destino del cobro; registra correctamente nunca recibido o ya devuelto',()=>{
 for(const decisionCobro of ['no_recibido','devuelto']){
  const s=fixture();
  prepararQuitarPagadoRomoQA(s,datos);
  const antes=clone(s);
  const argumentos={...datos,motivo:'Pedido desistido',categoria:'cliente',decisionCobro};
  assert.throws(()=>prepararConciliacionCancelacionRomoQA(s,argumentos),/Aclara/);
  assert.throws(()=>prepararConciliacionCancelacionRomoQA(s,{...argumentos,decisionCobro:'pendiente',confirmaCobro:true}),/Aclara/);
  assert.deepEqual(s,antes);
  const r=prepararConciliacionCancelacionRomoQA(s,{...argumentos,confirmaCobro:true});
  const p=r.estadoPropuesto.pedidos[0];
  assert.equal(p.estado,'Cancelado');assert.equal(p.ajusteCobroPendiente,null);
  const ev=p.historialCambios.at(-1);
  assert.equal(ev.aclaracion.accion,decisionCobro==='no_recibido'?'pago_erroneo_no_cobrado':'devolucion_cancelacion_confirmada');
  assert.equal(ev.aclaracion.importe,11500);
  assert.equal(p.cartaSolicitudRemotaId,solicitud);
  assert.deepEqual(r.estadoPropuesto.cajasDiarias,antes.cajasDiarias);
  assert.equal(r.resumen.devolucion,false);
  assert.deepEqual(s,antes);
 }
});
test('Se puede aclarar un registro erróneo, dejar el mismo pedido activo y recibir el pago real sin otro timbre enviado',()=>{
 const s=fixture({linked:false}),p=s.pedidos[0];
 prepararQuitarPagadoRomoQA(s,datos);
 assert.throws(()=>aclararPagoDesmarcadoRomoQA(s,{...datos,decision:'no_recibido'}),/Aclara/);
 aclararPagoDesmarcadoRomoQA(s,{...datos,decision:'no_recibido',confirmado:true});
 assert.equal(p.pagado,false);assert.equal(p.estado,'Pendiente');assert.equal(p.ajusteCobroPendiente,null);
 prepararCobroPendienteRomoQA(s,{...datos,confirmoRecepcion:true,medioProductos:'Efectivo',medioEnvio:'Débito'});
 assert.equal(s.pedidos.length,2);assert.equal(p.pagado,true);assert.equal(s.clientes.a.movimientos.filter(m=>m.pedidoId===33).length,1);
 assert.equal(p.timbreEnviadoEn,timbre);
});
const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
test('Botón de Romo guarda en una revisión, usando el mismo formulario y negándose a perder cambios a otros datos',async()=>{
 const s=fixture(),guardados=[],avisos=[];
 const ctx={S:{...s,vista:'nuevo'},D:{editando:33,pagado:false,cliente:'Cliente simulado',responsableEdicion:'Personal de prueba'},
  ROMO_SUCURSAL_QA:suc,ukiRomoGuardandoManualQA:false,
  window:{ukiRomoSesionRemotaQA:{disponible:()=>true,estado:()=>({revision:17})}},
  modulo:{prepararQuitarPagadoRomoQA},ukiRomoOperacionesEnCursoQA:()=>false,fechaOperativaActual:()=>dia,
  ukiCierreConfirmadoPedido:()=>false,datosSoloSucursal:()=>clone(s),
  aviso:m=>avisos.push(m),nuevoDraft:()=>{},ukiRomoGuardarOperacionQA:async(...args)=>guardados.push(args)};
 const source=take('function ukiRomoFirmaSoloQuitarPagoQA','// En edición se conserva la identidad')
  .replace("await import('./uki-romo-quitar-pagado-qa.mjs')",'modulo');
 runInNewContext(source,ctx);
 ctx.D.romoFirmaAntesQuitarPagoQA=ctx.ukiRomoFirmaSoloQuitarPagoQA(ctx.D);
 ctx.D.cliente='Otro';
 await ctx.ukiRomoGuardarEdicionUnicaQA();
 assert.equal(guardados.length,0);
 assert.match(avisos.at(-1),/conserva los demás datos/);
 ctx.D.cliente='Cliente simulado';
 await ctx.ukiRomoGuardarEdicionUnicaQA();
 assert.equal(guardados.length,1);
 assert.equal(guardados[0][0].pedidos[0].pagado,false);
 assert.equal(guardados[0][4],'quitar_pagado');
 assert.equal(s.pedidos[0].pagado,true);
});


test('Pedido de carta proyecta el nuevo estado al seguimiento tras el guardado, también en una sesión nueva',async()=>{
 const s=fixture(),p=s.pedidos[0];prepararQuitarPagadoRomoQA(s,datos);
 const src=readFileSync(new URL('../public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs',import.meta.url),'utf8');
 const called=[];
 const ctx={window:{UKI_SEGUIMIENTO_ESTADO_GUARDADO_AUTORIZADO:true,UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED:true},
  store:()=> 'romo:serena',inReview:()=>false,NAMES:{[suc]:'romo:serena'},UUID:/^[a-f0-9-]{36}$/,
  seguimientoDistribucionRealQA:p=>({pagos:[{medio:'efectivo',monto:p.total}],totalValidado:p.total}),
  doAction:async(...args)=>{called.push(args);return {ok:true}},notice:null};
 runInNewContext(src.slice(src.indexOf('const estadosPublicados=new Map();'),src.indexOf('function line(title,body)')),ctx);
 await ctx.window.ukiQAPublishSavedState({pedidos:[p],revision:18});assert.equal(called.length,0);
 await ctx.window.ukiQAPublishSavedState({pedidos:[p],revision:18,pendienteExplicito:true});
 assert.equal(called.length,1);assert.deepEqual(called[0].slice(0,2),['publicar_estado_guardado',solicitud]);
 assert.equal(called[0][2].estado,'Pendiente');assert.equal(called[0][2].pagado,false);
});

