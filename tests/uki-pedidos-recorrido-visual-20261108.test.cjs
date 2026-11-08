'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const from=html.indexOf('function vNuevo()');
const until=html.indexOf('// Corrección histórica:',from);
assert.ok(from>0&&until>from,'el formulario existente debe mantenerse');
const code=html.slice(from,until);
function renderNuevo({modo='manual',modalidad='Retiro',pagado=false,carta=false}={}){
 const ctx={
  S:{suc:'Uki Regimiento Arica'},D:{texto:carta?'UKI SUSHI · Carta #751':'',fecha:'2026-11-08T18:00',cliente:'Cliente Prueba',telefono:'56912345678',codigoCarta:carta?'751':'',codigoCliente:'5678',qrSolicitudes:[],sucursalCarta:'',mesaReferencia:'',modalidad,envio:modalidad==='Delivery'?2000:0,medio:'Efectivo',medioEnvio:'Efectivo',pagado,items:[{nombre:'Promo',cant:1,precio:9000,det:''}],mixtoProductos:false,mixtoEnvio:false,pagosProductos:[],pagosEnvio:[],productosPagadosOtroLocal:false,montoProductosOtroLocal:'',envioPagadoOtroLocal:false,montoEnvioOtroLocal:'',localPagoExterno:'',propinaModo:'ninguna',propinaPersonalizada:'',medioPropina:'Efectivo',editando:null,...(carta?{cartaSolicitudRemotaId:'id-remoto'}:{})},
  modoNuevo:modo,ukiSolicitudWhatsAppActiva:null,fmt:n=>'$'+Number(n||0),esc:x=>String(x??''),getCliente:()=>null,ventasValidas:()=>0,
  ukiVistaBorradores:()=>'',ukiFolioBorrador:()=> 'Turno #01',esMensajeCartaUki:()=>carta,ukiCodigoWhatsApp:()=> '5678',
  ukiMontoPropina:()=>0,ukiPropinaUI:()=>'',ukiPagoUI:()=>'<div class="medio-de-pago">Efectivo</div>',
  ukiMontoProductosOtroLocal:()=>0,ukiMontoEnvioOtroLocal:()=>0,ukiMontoProductosLocal:(d,s)=>s,
  ukiWhatsAppGuardarSolicitudBoton:()=>'<span>Guardar solicitud existente</span>',
  vInicio:()=>''};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return ctx.vNuevo();
}
test('retiro, delivery y consumo siempre muestran la modalidad al revisar o crear',()=>{
 for(const modo of ['manual','whatsapp'])for(const modalidad of ['Retiro','Delivery','Consumo en local']){
  const out=renderNuevo({modo,modalidad,carta:modo==='whatsapp'});
  const i=out.indexOf('<h2>1 · Cliente y entrega</h2>');
  assert.ok(i>=0);
  const section=out.slice(i,out.indexOf('<h2>2 · Productos y total</h2>'));
  assert.match(section,/Tipo de entrega/);
  assert.match(section,/Retiro/);assert.match(section,/Delivery/);assert.match(section,/Consumo en local/);
  assert.equal((out.match(/Tipo de entrega/g)||[]).length,1,'sin repetición en pantalla');
 }
});
test('las opciones de pegado se pliegan, pero los controles esenciales quedan fuera',()=>{
 const out=renderNuevo({modo:'whatsapp',modalidad:'Delivery',carta:true});
 assert.match(out,/<details class="uki-modos-ingreso"/);
 const form=out.indexOf('<h2>1 · Cliente y entrega</h2>');
 assert.ok(out.indexOf('</details>')<form);
 assert.ok(out.indexOf('Tipo de entrega')>form);
 assert.match(out,/Revisar solicitud/);
});
test('el guardado sin pago conserva los controles y dice por cobrar',()=>{
 const no=renderNuevo({pagado:false});
 const yes=renderNuevo({pagado:true});
 assert.match(no,/Guardar pedido · por cobrar/);
 assert.match(no,/Cobro por confirmar en Uki/);
 assert.match(no,/Monto previsto en Uki/);
 assert.match(no,/Pago completo confirmado/);
 assert.match(yes,/Guardar pedido · pago confirmado/);
 assert.match(yes,/Cobro confirmado en Uki/);
 assert.match(yes,/Total recibido en Uki/);
 assert.match(yes,/onclick="ndGuardar\(\)"/);
});
test('el formulario utiliza el mismo botón de guardado y no crea otro flujo',()=>{
 assert.match(code,/onclick="ndGuardar\(\)"/);
 assert.match(code,/onchange="D\.pagado=this\.checked;render\(\)"/);
 assert.match(code,/ukiPagoUI\("productos",sub\)/);
});

test('Una solicitud ya recibida no invita a pegarla o registrarla nuevamente',()=>{
 const recibido=renderNuevo({modo:'whatsapp',modalidad:'Retiro',carta:true});
 const nuevo=renderNuevo({modo:'whatsapp',modalidad:'Retiro',carta:false});
 assert.match(recibido,/Ver mensaje original/);
 assert.doesNotMatch(recibido,/Procesar pedido pegado/);
 assert.doesNotMatch(recibido,/Guardar solicitud existente/);
 assert.doesNotMatch(recibido,/aria-label="Modo de ingresar pedido"/);
 assert.match(nuevo,/Procesar pedido pegado/);
 assert.match(nuevo,/Guardar solicitud existente/);
 assert.match(nuevo,/aria-label="Modo de ingresar pedido"/);
});
