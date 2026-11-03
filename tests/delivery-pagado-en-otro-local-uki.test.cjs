'use strict';
// Pruebas aisladas: node --test tests/delivery-pagado-en-otro-local-uki.test.cjs
// No usa Firebase, cuentas reales, teléfono ni datos personales.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const history=fs.readFileSync(path.join(__dirname,'..','firebase','uki-cierre-detallado.js'),'utf8');
const section=(a,b)=>{
 const i=html.indexOf(a),j=html.indexOf(b,i);
 assert.ok(i>=0&&j>i,'Fragmento no encontrado: '+a);return html.slice(i,j);
};
const med=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'],apps=['Uber Eats','PedidosYa','Rappi'];
const suc='Uki Regimiento Arica';
const mk=(id,sub,env,props={})=>({id,suc,cliente:'Persona ficticia',modalidad:'Delivery',subtotal:sub,envio:env,
 total:sub+env,medio:'Transferencia',medioEnvio:'Efectivo',pagado:true,estado:'Pendiente',
 productos:[{cantidad:1,precioUnit:sub,nombre:'Producto ficticio',detalle:''}],...props});
function ctx(pedidos){
 const S={suc,pedidos,propinas:[],gastos:[],retiros:[],deliveriesManuales:[]};
 const caja={base:0,pagoDelivery:0,pagoDeliveryMedio:'Efectivo',apps:{},cajaChica:{inicial:0,gastos:[]}};
 const fmt=n=>'$'+Number(n||0).toLocaleString('es-CL');
 const code=section('function ukiMontoProductosOtroLocal(p,sub){','\nfunction vCaja(){');
 const x=new Function('S','MEDIOS','APPS','cajaDelDia','delSucHoy','fmt','esc','render',
  code+'\nreturn {ukiMontoProductosOtroLocal,ukiMontoEnvioOtroLocal,ukiErrorDistribucionPago,ukiDatosPago,ukiLineasPago,totales};')
 (S,med,apps,()=>caja,items=>items.filter(p=>p.suc===S.suc),fmt,String,()=>{});
 return {S,caja,fmt,...x};
}
test('Pedido antiguo #50: pago completo de $18.500 en Romo, delivery $2.500 para repartidor',()=>{
 const p=mk(50,16000,2500,{productosPagadosOtroLocal:true,montoProductosOtroLocal:18500,
  localPagoExterno:'Romo',pagado:false});
 const x=ctx([p]),t=x.totales();
 assert.equal(x.ukiMontoProductosOtroLocal(p,16000),16000);
 assert.equal(x.ukiMontoEnvioOtroLocal(p,2500,16000),2500);
 assert.equal(x.ukiErrorDistribucionPago(p,16000,2500),'');
 assert.equal(t.totalMedios,0);
 assert.equal(t.enviosPedidos,2500);
 assert.equal(t.enviosCobradosUki,0);
 assert.equal(t.enviosCobradosOtroLocal,2500);
 assert.equal(t.nDeliv,1);
 p.pagado=true;assert.equal(x.totales().totalMedios,0);
});
test('Nuevo pedido: comida y envío cobrado en otro local no entra a caja Uki',()=>{
 const p=mk(1,16000,2500,{productosPagadosOtroLocal:true,montoProductosOtroLocal:16000,
  envioPagadoOtroLocal:true,localPagoExterno:'Romo'});
 const x=ctx([p]),t=x.totales();
 assert.equal(x.ukiErrorDistribucionPago(p,16000,2500),'');
 assert.equal(t.totalMedios,0);assert.equal(t.envios,2500);
 assert.equal(t.ventaSinDelivery,0);assert.equal(t.enviosCobradosOtroLocal,2500);
});
test('Pago parcial: Romo cobra $14.000 de comida y $3.000 delivery; Uki cobra $6.000 de comida',()=>{
 const p=mk(2,20000,3000,{productosPagadosOtroLocal:true,montoProductosOtroLocal:14000,
  envioPagadoOtroLocal:true,localPagoExterno:'Romo',medio:'Débito'});
 const x=ctx([p]),t=x.totales();
 assert.equal(x.ukiErrorDistribucionPago(p,20000,3000),'');
 assert.equal(t.medios.Débito,6000);assert.equal(t.totalMedios,6000);
 assert.equal(t.enviosCobradosOtroLocal,3000);assert.equal(t.envios,3000);
 assert.equal(t.ventaSinDelivery,6000);
});
test('Solo envío externo: conserva local de pago, comida local y delivery para repartidor',()=>{
 const p=mk(3,10000,2000,{envioPagadoOtroLocal:true,localPagoExterno:'Romo',medio:'Efectivo'});
 const x=ctx([p]),t=x.totales();
 const saved=x.ukiDatosPago({modalidad:'Delivery',productosPagadosOtroLocal:false,
  envioPagadoOtroLocal:true,localPagoExterno:'Romo',mixtoProductos:false,mixtoEnvio:false},10000);
 assert.equal(saved.localPagoExterno,'Romo');
 assert.equal(saved.envioPagadoOtroLocal,true);
 assert.equal(t.totalMedios,10000);assert.equal(t.envios,2000);
 assert.equal(t.enviosCobradosUki,0);assert.equal(t.enviosCobradosOtroLocal,2000);
});
test('No sumar pedidos cancelados; sí registrar los activos sin pago para la liquidación',()=>{
 const x=ctx([mk(4,10000,3000,{pagado:false}),
  mk(5,10000,2500,{pagado:false,estado:'Cancelado'})]);
 const t=x.totales();
 assert.equal(t.envios,3000);assert.equal(t.nDeliv,1);
 assert.equal(t.totalMedios,0);assert.equal(t.enviosCobradosUki,0);
});
test('Conserva cobro local y delivery manual sin duplicar ingresos',()=>{
 const x=ctx([mk(6,10000,2000,{medio:'Débito'})]);
 x.S.deliveriesManuales.push({suc,monto:800,medio:'Efectivo'});
 const t=x.totales();
 assert.equal(t.totalMedios,12800);assert.equal(t.ventaSinDelivery,10000);
 assert.equal(t.envios,2800);assert.equal(t.enviosCobradosUki,2800);
});
test('El historial detallado conserva cobro externo del pedido antiguo sin transferirlo a caja',()=>{
 const p=mk(50,16000,2500,{pagado:true,productosPagadosOtroLocal:true,
  montoProductosOtroLocal:18500,localPagoExterno:'Romo'});
 const w={};new Function('window',history)(w);
 const d=w.ukiDetalleCierre.capturar({suc,pedidos:[p],gastos:[],retiros:[],
   propinas:[],deliveriesManuales:[]},{base:0,pagoDelivery:0,apps:{},cajaChica:{inicial:0,gastos:[]}},arr=>arr);
 assert.equal(d.pedidos[0].cobradoLocal,0);
 assert.equal(d.pedidos[0].montoProductosOtroLocal,16000);
 assert.equal(d.pedidos[0].montoEnvioOtroLocal,2500);
 assert.equal(d.pedidos[0].envioPagadoOtroLocal,true);
});
test('Detalle para WhatsApp e impresión separa comida, delivery y pago externo',()=>{
 const p=mk(50,16000,2500,{productosPagadosOtroLocal:true,montoProductosOtroLocal:18500,
  localPagoExterno:'Romo',pagado:false});
 const x=ctx([p]);
 const fn=new Function('S','fmt','ukiMontoProductosOtroLocal','ukiMontoEnvioOtroLocal',
  section('function ukiDetalleCuentaTexto(p){','function ukiDetalleCuentaVista(p){')+'\nreturn ukiDetalleCuentaTexto;')
 (x.S,x.fmt,x.ukiMontoProductosOtroLocal,x.ukiMontoEnvioOtroLocal);
 const bill=fn(p);
 assert.match(bill,/Productos cobrados en Romo: \$16\.000/);
 assert.match(bill,/Delivery cobrado en Romo: \$2\.500/);
 assert.match(bill,/SALDO POR PAGAR EN UKI: \$0/);
});
test('La pantalla distingue el monto registrado para repartidor del recibido en caja',()=>{
 assert.match(html,/El delivery también fue pagado en otro local/);
 assert.match(html,/Deliverys registrados para repartidor/);
 assert.match(html,/Verifica cuáles fueron entregados antes de pagar al repartidor/);
 assert.match(html,/Delivery cobrado en Uki/);
 assert.match(html,/Delivery cobrado en otro local/);
});
