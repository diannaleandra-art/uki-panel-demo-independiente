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
   .replace("await import('./rectificacion-pago-edicion-v2.mjs?v=2')",'loadedLib');
  const p=order(suc,{}),D={editando:72,items,modalidad:'Delivery',medio:'Efectivo',medioEnvio:'Efectivo',envio:2500,
   pagado:true,productosPagadosOtroLocal:false,rectificacionMotivo:'Se registró el medio por error',responsableEdicion:'Encargada'};
  const S={suc,pedidos:[p],vista:'nuevo'};
  const estado={style:{},focus(){},scrollIntoView(){}};
  let guardados=0;
  const c=vm.createContext({D,S,loadedLib:lib,fmt:String,esc:String,ukiLineasPago:medios,
   ukiCierreConfirmadoPedido:()=>true,ukiMontoEnvioOtroLocal:()=>0,ukiMontoProductosOtroLocal:()=>0,ukiDatosPago:()=>({}),
   document:{getElementById:()=>estado},render(){},
   datosSoloSucursal:()=>structuredClone(S),ukiRomoGuardarOperacionQA:async x=>{S.pedidos=x.pedidos;guardados++;},
   guardarEnLocalStorage:async()=>{guardados++;return true;},
   window:{ukiCancelacionNubeLista:()=>true,ukiRespaldarRectificacionDelivery:async()=>true,
    ukiAutorizarRectificacionPagoV2:async ({plan})=>({recibo:{id:'constancia',firma:'prueba',motivo:'Medio de pago incorrecto',en:'2026-11-25T17:00:00Z'}})}});
  vm.runInContext(code,c);
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
 }
});
