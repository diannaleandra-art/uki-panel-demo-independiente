const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../firebase/uki-sushi-local.html'),'utf8');
const code=html.slice(html.indexOf('let ukiBaseRectificacionEdicion=null;'),html.indexOf('function ukiCorreccionesTurnoUI('));
const save=html.slice(html.indexOf('async function ndGuardar(){'),html.indexOf('let ukiCierreComprobandoSolicitudes=false;'));
const pedido={id:72,suc:'Uki La Serena',estado:'Entregado',pagado:true,modalidad:'Delivery',
 cartaSolicitudRemotaId:'cf31f358-349c-4b52-ae1e-85900d086c35',subtotal:12000,envio:2500,
 total:14500,medio:'Edenred',medioEnvio:'Transferencia',productos:[{nombre:'Roll'}]};
const recibo='a21b4e8f-e4b3-4863-9617-a2f934a36848';
async function escenario(){
 const helpers=await import('../firebase/uki-rectificar-transferencia-v1.mjs');
 const p=structuredClone(pedido),D={editando:72,modalidad:'Delivery',medio:'Edenred',medioEnvio:'Efectivo',
  envio:2500,cliente:'Cliente',rectificacionMotivo:'Verifiqué el medio por error',responsableEdicion:'Encargada',
  rectificacionConfirmada:true};
 const status={style:{},focus(){},scrollIntoView(){}}, boton={disabled:false};
 const S={suc:p.suc,vista:'nuevo',pedidos:[p],cierres:[]};
 let online=true;
 const calls=[];
 const ctx=vm.createContext({
  S,D,helpers,ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,
  esc:s=>String(s).replace(/</g,'&lt;'),fmt:n=>'$'+n,
  ukiSeguimientoHayTransferenciaQA:p=>p?.medio==='Transferencia'||p?.medioEnvio==='Transferencia',
  ukiCierreConfirmadoPedido:()=>false,
  document:{getElementById:id=>id==='ukiGuardarPedido'?boton:status},
  aviso(){throw Error('No debe salir de la edición');},render(){},
  guardarEnLocalStorage:async()=>{calls.push('local');return true;},
  window:{ukiCancelacionNubeLista:()=>true,ukiRegistrarRectificacionDelivery:async datos=>{
   calls.push('autorización');
   assert.equal(datos.pedidoInterno,'72');
   assert.equal(datos.montoDelivery,2500);
   assert.match(datos.motivo,/Encargada/);
   return {...datos,ok:true,orderId:datos.id,monto:datos.montoDelivery,constanciaId:recibo,en:'2026-11-26T00:00:00Z'};
  },ukiRespaldarRectificacionDelivery:async()=>{calls.push('nube');return online;}}
 });
 vm.runInContext(code.replace("await import('./uki-rectificar-transferencia-v1.mjs')",'helpers')+save+
  '\nukiBaseRectificacionEdicion={draft:D,firma:ukiFirmaOtrosCambiosRectificacion(D)};',ctx);
 return {ctx,p,D,S,calls,boton,status,online:v=>online=v};
}
test('Editar muestra la autorización al cambiar solo el medio de pago del delivery a efectivo',async()=>{
 const {ctx,p,D}=await escenario();
 assert.equal(ctx.ukiRectificacionDeliveryUI(p),'');
 assert.match(ctx.ukiRectificacionDeliveryEdicionUI(p,{...D,medioEnvio:'Transferencia'}),/Elige <b>Efectivo/);
 assert.match(ctx.ukiRectificacionDeliveryEdicionUI(p,D),/Autorizar corrección del delivery/);
 assert.match(ctx.ukiRectificacionDeliveryEdicionUI(p,{...D,rectificacionMotivo:'</textarea>'}),/&lt;\/textarea>/);
 assert.equal(ctx.ukiRectificacionDeliveryEdicionUI(p,{...D,mixtoEnvio:true}),'');
 assert.doesNotMatch(ctx.ukiRectificacionDeliveryEdicionUI({...p,suc:"Romo La Serena"},D),/Autorizar/);
 assert.match(html,/ukiPagoUI\("envio",envio\)[^\n]+\n\s*\$\{ukiRectificacionDeliveryEdicionUI\(pedidoEdicion,D\)\}/);
 assert.doesNotMatch(html,/Revisar rectificación/);
});
test('Guardar cambios exige confirmación y conserva productos, estado, imputación de Edenred y total',async()=>{
 const {ctx,p,D,S,calls,status,boton}=await escenario();
 D.rectificacionConfirmada=false;
 await ctx.ndGuardar();
 assert.match(status.textContent,/Confirma que no entró la transferencia/);
 assert.deepEqual(calls,[]);
 assert.equal(S.pedidos[0],p);
 D.rectificacionConfirmada=true;
 await ctx.ndGuardar();
 assert.deepEqual(calls,['autorización','local','nube']);
 assert.deepEqual(JSON.parse(JSON.stringify(S.pedidos[0])),{...p,medioEnvio:'Efectivo',
  rectificacionTransferenciaDeliveryV1:{id:recibo,motivo:'Responsable: Encargada. Verifiqué el medio por error',
   en:'2026-11-26T00:00:00Z',monto:2500}});
 assert.equal(S.vista,'nuevo');
 assert.equal(boton.disabled,false);
 assert.match(status.textContent,/guardado.*en efectivo/);
});
test('La corrección no aplica un cambio de monto y un reintento de nube no pide doble autorización',async()=>{
 const {ctx,p,D,S,calls,status,online}=await escenario();
 D.envio=3000;
 await ctx.ndGuardar();
 assert.match(status.textContent,/deja el valor del delivery en/);
 assert.deepEqual(calls,[]);
 assert.equal(S.pedidos[0],p);
 D.envio=2500;
 D.cliente='Cambio que debe continuar en edición';
 online(false);
 await ctx.ndGuardar();
 assert.match(status.textContent,/Todavía no se confirmó/);
 assert.equal(D.rectificacionNubePendiente,true);
 online(true);
 await ctx.ndGuardar();
 assert.deepEqual(calls,['autorización','local','nube','nube']);
 assert.equal(D.rectificacionNubePendiente,false);
 assert.equal(D.cliente,'Cambio que debe continuar en edición');
 assert.match(status.textContent,/Los demás cambios siguen en el formulario/);
});
