const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const medios=(p,t,m)=>m===0?[]:(p[t==='envio'?'pagosEnvio':'pagosProductos']||[]).length?
 p[t==='envio'?'pagosEnvio':'pagosProductos']:[{medio:p[t==='envio'?'medioEnvio':'medio'],monto:m}];
const items=[{nombre:'Roll',cant:1,precio:12000}];
const order=(suc,campos)=>({id:72,suc,estado:'Entregado',pagado:true,modalidad:'Delivery',envio:2500,
 medio:'Transferencia',medioEnvio:'Efectivo',subtotal:12000,total:14500,productos:[{nombre:'Roll'}],...campos});
test('Edita desde el mismo pago de Uki y Romo, y captura la autorización antes del guardado original',async()=>{
 const lib=await import('../firebase/rectificacion-pago-edicion-v2.mjs');
 for(const [panel,suc] of [['../firebase/uki-sushi-local.html','Uki La Serena']]){
  const html=fs.readFileSync(__dirname+'/'+panel,'utf8');
  const code=html.slice(html.indexOf('let ukiBaseRectificacionEdicion=null'),html.indexOf('function ukiCorreccionesTurnoUI('))
   .replace("await import('./rectificacion-pago-edicion-v2.mjs?v=reparto-cero-v3')",'loadedLib');
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
  vm.runInContext(code,c);
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
  const {verificarGuardadoUki}=await import('../firebase/uki-seguimiento-guardado-nube-v1.mjs');
  const args={anterior:{suc,pedidos:[repartoCero]},nuevo:{suc,pedidos:[reparado]},sucursal:suc,
   importes:()=>null,hayTransferencia:o=>o.pagosEnvio.some(x=>x.medio==='Transferencia'),
   leerLineasPago:medios,leerLineasPagoAnterior:c.ukiPagoAnteriorRectificacion,manualValido:()=>false,
   consultar:()=>{throw Error('No debe usar la consulta de guardado normal');}};
  await assert.rejects(()=>verificarGuardadoUki({...args,verificarRectificacion:async()=>false}),/No se confirmó la corrección/);
  assert.deepEqual(await verificarGuardadoUki({...args,verificarRectificacion:async p=>{
   assert.equal(p.plan.montoAnterior,2500);
   assert.equal(p.plan.repartoDespues[1][0].medio,'efectivo');
   return true;
  }}),{ok:true,checked:1});
  const cerrado={...repartoCero,pagado:false};
  assert.equal(c.ukiPideRectificacionPago(cerrado,formularioCero),false);
  const parteValida={...repartoCero,pagosEnvio:[{medio:'Edenred',monto:2000},{medio:'Transferencia',monto:0}]};
  assert.equal(c.ukiPideRectificacionPago(parteValida,formularioCero),false,'No reconstruye un pago con importe positivo.');
  const sinMarca={...repartoCero,pagosEnvio:[{medio:'Edenred',monto:0},{medio:'Efectivo',monto:0}]};
  assert.equal(c.ukiPideRectificacionPago(sinMarca,formularioCero),false,'No atribuye una transferencia inexistente.');

 }
});
