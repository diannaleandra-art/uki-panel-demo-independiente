const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const medios=(p,t,m)=>m===0?[]:(p[t==='envio'?'pagosEnvio':'pagosProductos']||[]).length?
 p[t==='envio'?'pagosEnvio':'pagosProductos']:[{medio:p[t==='envio'?'medioEnvio':'medio'],monto:m}];
const items=[{nombre:'Roll',cant:1,precio:12000}];
const order=(suc,campos)=>({id:72,suc,estado:'Entregado',pagado:true,modalidad:'Delivery',envio:2500,
 medio:'Transferencia',medioEnvio:'Efectivo',subtotal:12000,total:14500,productos:[{nombre:'Roll'}],...campos});
test('Edita desde el mismo pago de Uki y Romo, y captura la autorización antes del guardado original',async()=>{
 const lib=await import('../public/romo-panel-qa/rectificacion-pago-edicion-v2.mjs');
 for(const [panel,suc] of [['../public/romo-panel-qa/index.html','Romo’s Sushi La Serena']]){
  const html=fs.readFileSync(__dirname+'/'+panel,'utf8');
  const code=html.slice(html.indexOf('let ukiBaseRectificacionEdicion=null'),html.indexOf('function ukiCorreccionesTurnoUI('))
   .replace("await import('./rectificacion-pago-edicion-v2.mjs?v=reparto-rescate-v4')",'loadedLib');
  const p=order(suc,{}),D={editando:72,items,modalidad:'Delivery',medio:'Efectivo',medioEnvio:'Efectivo',envio:2500,
   pagado:true,productosPagadosOtroLocal:false,rectificacionMotivo:'Se registró el medio por error',responsableEdicion:'Encargada'};
  const S={suc,pedidos:[p],vista:'nuevo'};
  const estado={style:{},focus(){},scrollIntoView(){}};
  let guardados=0,planes=[];
  const c=vm.createContext({D,S,loadedLib:lib,fmt:String,esc:String,ukiLineasPago:medios,
   ukiCierreConfirmadoPedido:()=>true,ukiMontoEnvioOtroLocal:()=>0,ukiMontoProductosOtroLocal:()=>0,ukiDatosPago:()=>({}),
   document:{getElementById:()=>estado},render(){},
   datosSoloSucursal:()=>structuredClone(S),ukiRomoGuardarOperacionQA:async x=>{S.pedidos=x.pedidos;guardados++;},
   guardarEnLocalStorage:async()=>{guardados++;return true;},
   window:{ukiCancelacionNubeLista:()=>true,ukiRespaldarRectificacionDelivery:async()=>true,
    ukiAutorizarRectificacionPagoV2:async ({plan})=>(planes.push(plan),{recibo:{id:'constancia',firma:'prueba',motivo:'Medio de pago incorrecto',en:'2026-11-25T17:00:00Z'}})}});
  const desdeGuardar=html.indexOf('async function ndGuardar(){');
  const hastaGuardar=html.slice(desdeGuardar+1).search(/\n(?:async )?function /)+desdeGuardar+1;
  const desdeBandera=html.indexOf('function ukiSeguimientoHayTransferenciaQA(');
  const hastaBandera=html.indexOf('function seguimientoPropinaTransferenciaQA(',desdeBandera);
  Object.assign(c,{ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,ROMO_SUCURSAL_QA:suc,
    ukiRomoOperacionesEnCursoQA:()=>false,ukiSeguimientoImportesCajaQA:()=>null,
    aviso:mensaje=>{throw Error('No se esperaba el bloqueo de edición normal: '+mensaje);}});
  vm.runInContext(code+'\n'+html.slice(desdeGuardar,hastaGuardar)+'\n'+html.slice(desdeBandera,hastaBandera),c);
  assert.match(html,/onclick="ukiMostrarCorreccionPago\(\)"/);
  assert.match(c.ukiRectificacionPagoEdicionUI(p,{...D,medio:'Transferencia'}),/Corregir transferencia.*Productos 12000/);
  assert.match(c.ukiRectificacionPagoEdicionUI({...p,medio:'Edenred',medioEnvio:'Transferencia'},{...D,medio:'Edenred',medioEnvio:'Transferencia'}),/Corregir transferencia.*Delivery 2500/);
  const pedido72={...p,subtotal:8000,total:10500,medio:'Edenred',medioEnvio:'Transferencia'};
  const borrador72={...D,medio:'Edenred',medioEnvio:'Efectivo'};
  const autorizado=c.ukiRectificacionPagoEdicionUI(pedido72,borrador72);
  assert.match(autorizado,/Autorizar corrección de transferencia.*Pago guardado.*Delivery: Transferencia 2500/);
  assert.match(autorizado,/selección aún no está guardada/);
  const guardadoEfectivo=c.ukiRectificacionPagoEdicionUI({...pedido72,medioEnvio:'Efectivo'},borrador72);
  assert.match(guardadoEfectivo,/Pago guardado.*Delivery: Efectivo 2500/);
  assert.match(guardadoEfectivo,/No hay una transferencia guardada/);
  assert.doesNotMatch(guardadoEfectivo,/Autorizar corrección de transferencia/);
  assert.match(html,/ukiRectificacionPagoEdicionUI\(pedidoEdicion,D\)/);
  assert.match(html,/ukiPideRectificacionPago\((?:originalQR|pedidoRectificacion),D\)/);
  assert.match(c.ukiRectificacionPagoEdicionUI(p,D),/Autorizar corrección de transferencia/);
  await c.ukiRectificarPagoEnEdicion(p,D);
  assert.equal(guardados,0);
  D.rectificacionConfirmada=true;D.rectificacionFirmaReparto=c.ukiFirmaRepartoRectificacion(D);
  await c.ukiRectificarPagoEnEdicion(p,D);
  assert.equal(S.pedidos[0].medio,'Efectivo',estado.textContent);
  assert.equal(guardados,1);assert.match(estado.textContent,/cierre anterior no cambió/);
  assert.equal(S.pedidos[0].total,14500);
  const repartoCero={...pedido72,medioEnvio:'Edenred',
   pagosEnvio:[{medio:'Edenred',monto:0},{medio:'Transferencia',monto:0}]};
  const formularioCero={...borrador72,items:[{nombre:'Roll',cant:1,precio:8000}],mixtoEnvio:false,pagosEnvio:[],
   rectificacionMotivo:'Delivery recibido en efectivo, sin abono bancario.', rectificacionConfirmada:false};
  S.pedidos=[repartoCero]; c.D=formularioCero;
  const pantallaCero=c.ukiRectificacionPagoEdicionUI(repartoCero,formularioCero);
  assert.match(pantallaCero,/Autorizar corrección de transferencia.*Delivery: reparto sin importes/);
  assert.equal(c.ukiPagoTransferenciaMonto(repartoCero),0,'No imputa la línea incompleta a caja.');
  assert.equal(c.ukiPideRectificacionPago(repartoCero,formularioCero),true);
  await c.ukiRectificarPagoEnEdicion(repartoCero,formularioCero);
  assert.equal(guardados,1);
  assert.equal(planes.length,1);
  formularioCero.rectificacionConfirmada=true;
  formularioCero.rectificacionFirmaReparto=c.ukiFirmaRepartoRectificacion(formularioCero);
  await c.ukiRectificarPagoEnEdicion(repartoCero,formularioCero);
  assert.equal(planes.length,2);
  assert.equal(guardados,2);
  const reparado=S.pedidos[0],plan=planes[1];
  assert.equal(plan.montoAnterior,2500);
  assert.equal(plan.montoRestante,0);
  assert.equal(plan.montoOtroLocal,0);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.repartoAntes)),
   [[{medio:'edenred',monto:8000}],[{medio:'transferencia',monto:2500}]]);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.repartoDespues)),
   [[{medio:'edenred',monto:8000}],[{medio:'efectivo',monto:2500}]]);
  assert.equal(reparado.total,10500);
  assert.equal(reparado.medio,'Edenred');
  assert.equal(reparado.medioEnvio,'Efectivo');
  assert.equal(reparado.pagosEnvio.length,0);
  assert.equal(repartoCero.pagosEnvio[1].monto,0,'No cambia el reparto anterior en memoria.');
  // Caso que no cubría el arreglo anterior: el registro está pendiente,
  // aunque en el formulario se haya marcado Pago completo confirmado.
  const pendiente={...repartoCero,pagado:false,estado:'Pendiente'};
  const nuevoFormulario={...formularioCero,rectificacionConfirmada:true,
   rectificacionMotivo:'Delivery recibido en efectivo, sin abono bancario.',
   rectificacionMensaje:'',rectificacionError:false,rectificacionNubePendiente:false};
  S.pedidos=[pendiente];c.D=nuevoFormulario;
  nuevoFormulario.rectificacionFirmaReparto=c.ukiFirmaRepartoRectificacion(nuevoFormulario);
  assert.match(c.ukiRectificacionPagoEdicionUI(pendiente,nuevoFormulario),/Autorizar corrección de transferencia/);
  await c.ndGuardar();
  assert.equal(guardados,3,estado.textContent);
  assert.equal(S.pedidos[0].medioEnvio,'Efectivo');
  assert.equal(S.pedidos[0].pagado,false,'Primero guarda solo los medios, sin declarar un abono nuevo.');
  assert.match(estado.textContent,/pendiente de pago/);
  // Variante antigua donde la marca existe en el pedido, no en la línea a $0.
  const incompletoAntiguo={...pendiente,pagoDeclarado:'transferencia',
    pagosEnvio:[{medio:'Edenred',monto:0},{medio:'Efectivo',monto:0}]};
  assert.equal(c.ukiPideRectificacionPago(incompletoAntiguo,nuevoFormulario),true);
  assert.deepEqual(JSON.parse(JSON.stringify(c.ukiPagoAnteriorRectificacion(incompletoAntiguo,'envio',2500))),
    [{medio:'Transferencia',monto:2500}]);
  const repartosAmbiguos={...incompletoAntiguo,pagosProductos:[{medio:'Edenred',monto:0}]};
  assert.equal(c.ukiPideRectificacionPago(repartosAmbiguos,nuevoFormulario),false,'No atribuye una marca global a dos repartos vacíos.');
  const parteValida={...repartoCero,pagosEnvio:[{medio:'Edenred',monto:2000},{medio:'Transferencia',monto:0}]};
  assert.equal(c.ukiPideRectificacionPago(parteValida,formularioCero),false,'No reconstruye un pago con importe positivo.');
  const sinMarca={...repartoCero,pagosEnvio:[{medio:'Edenred',monto:0},{medio:'Efectivo',monto:0}]};
  assert.equal(c.ukiPideRectificacionPago(sinMarca,formularioCero),false,'No atribuye una transferencia inexistente.');

 }
});
