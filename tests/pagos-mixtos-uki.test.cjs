'use strict';
// Sin Firebase, sin ventas reales. Ejecutar: node --test tests/pagos-mixtos-uki.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const from=html.indexOf('// Pago mixto por componente');
const to=html.indexOf('\nfunction vCaja(){',from);
assert.ok(from>=0&&to>from,'El formulario y las funciones deben existir');
const script=html.slice(from,to);
const medios=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const apps=['Uber Eats','PedidosYa','Rappi'];
function mock(){
 const state={suc:'Uki Regimiento Arica',pedidos:[],gastos:[],retiros:[],propinas:[],deliveriesManuales:[]};
 const D={medio:'Transferencia',medioEnvio:'Efectivo',mixtoProductos:false,mixtoEnvio:false,pagosProductos:[],pagosEnvio:[],productosPagadosOtroLocal:false,localPagoExterno:''};
 const caja={base:18000,pagoDelivery:0,pagoDeliveryMedio:'Efectivo',apps:{}};
 const funcs=new Function('S','D','MEDIOS','APPS','cajaDelDia','delSucHoy','fmt','esc','render',
 script+'\nreturn {ukiLineasPago,ukiErrorDistribucionPago,ukiDatosPago,ukiPagoUI,ukiDetallePago,totales};')
 (state,D,medios,apps,()=>caja,a=>a.filter(x=>x.suc===state.suc),
 n=>'$'+Number(n||0).toLocaleString('es-CL'),s=>String(s||'').replace(/</g,'&lt;'),()=>{});
 function order(more={}){
  return {suc:'Uki Regimiento Arica',pagado:true,esPremio:false,
    estado:'Entregado',modalidad:'Delivery',subtotal:20000,envio:3000,total:23000,
    medio:'Transferencia',medioEnvio:'Efectivo',...more};
 }
 return {state,D,funcs,order};
}
test('Pedido antiguo conserva total por medios como antes',()=>{
 const x=mock();x.state.pedidos=[x.order()];
 const t=x.funcs.totales();
 assert.equal(t.totalMedios,23000);
 assert.equal(t.medios.Transferencia,20000);
 assert.equal(t.medios.Efectivo,3000);
});
test('Pago mixto en comida y delivery no duplica ninguna venta',()=>{
 const x=mock();x.state.pedidos=[x.order({
   pagosProductos:[{medio:'Efectivo',monto:10000},{medio:'Transferencia',monto:10000}],
   pagosEnvio:[{medio:'Efectivo',monto:1000},{medio:'Débito',monto:2000}]
 })];
 const t=x.funcs.totales();
 assert.equal(t.totalMedios,23000);
 assert.equal(t.medios.Efectivo,11000);
 assert.equal(t.medios.Transferencia,10000);
 assert.equal(t.medios['Débito'],2000);
});
test('Comida cobrada en otro local: Uki suma solamente su delivery',()=>{
 const x=mock();x.state.pedidos=[x.order({
   productosPagadosOtroLocal:true,localPagoExterno:'Romo Sushi',
   pagosProductos:[]
 })];
 const t=x.funcs.totales();
 assert.equal(t.totalMedios,3000);
 assert.equal(t.productosPagadosOtroLocal,20000);
 assert.equal(t.medios.Transferencia,0);
 assert.equal(t.medios.Efectivo,3000);
 assert.match(x.funcs.ukiDetallePago(x.state.pedidos[0],'productos'),/Romo Sushi/);
});
test('Venta sin pago completo no entra en caja',()=>{
 const x=mock();x.state.pedidos=[x.order({pagado:false})];
 assert.equal(x.funcs.totales().totalMedios,0);
});
test('Rechaza pago mixto cuyos montos no suman el total',()=>{
 const x=mock(),p=x.order({
  pagosProductos:[{medio:'Efectivo',monto:10000},{medio:'Transferencia',monto:5000}]
 });
 assert.match(x.funcs.ukiErrorDistribucionPago(p,20000,3000),/sumar/);
});
test('Rechaza referencia externa vacía y no mezcla sucursales',()=>{
 const x=mock();
 const p=x.order({productosPagadosOtroLocal:true,localPagoExterno:''});
 assert.match(x.funcs.ukiErrorDistribucionPago(p,20000,3000),/Indica/);
 x.state.pedidos=[x.order()];
 x.state.suc='Uki La Serena';
 assert.equal(x.funcs.totales().totalMedios,0);
});
test('El formulario expone medios mixtos sin cambiar la caja',()=>{
 const x=mock();
 assert.match(x.funcs.ukiPagoUI('productos',20000),/Dividir entre varios medios/);
 assert.match(html,/Productos pagados en otro local/);
 assert.match(html,/function ukiErrorDistribucionPago/);
});
test('El cierre original mantiene sin cambios fecha operativa y corte',()=>{
 const source=html.slice(html.indexOf('function fechaOperativaActual(){'),html.indexOf('\nfunction cajaDelDia(){'));
 assert.ok(!source.includes('pagosProductos'));
 assert.ok(!source.includes('productosPagadosOtroLocal'));
 const sourceClose=html.slice(html.indexOf('function cerrar(){'),html.indexOf('\nfunction descargarTextoArchivo('));
 assert.ok(!sourceClose.includes('productosPagadosOtroLocal'));
});


test('El historial detallado conserva valor total y efectivo real, sin duplicar cobro externo',()=>{
 const pathCierre=path.join(__dirname,'..','firebase','uki-cierre-detallado.js');
 const code=fs.readFileSync(pathCierre,'utf8');
 const w={};
 new Function('window',code)(w);
 const suc='Uki Regimiento Arica';
 const pedidos=[{
  id:1,suc,pagado:true,estado:'Entregado',modalidad:'Delivery',subtotal:20000,
  envio:3000,total:23000,medio:'Transferencia',medioEnvio:'Efectivo',
  productosPagadosOtroLocal:true,localPagoExterno:'Uki La Serena',productos:[]
 },{
  id:2,suc,pagado:true,estado:'Entregado',modalidad:'Delivery',subtotal:20000,
  envio:3000,total:23000,medio:'Transferencia',medioEnvio:'Efectivo',
  pagosProductos:[{medio:'Transferencia',monto:10000},{medio:'Débito',monto:10000}],
  pagosEnvio:[{medio:'Efectivo',monto:1000},{medio:'Débito',monto:2000}],productos:[]
 }];
 const state={suc,pedidos,gastos:[],retiros:[],propinas:[],deliveriesManuales:[]};
 const caja={cajaChica:{inicial:20000,gastos:[]},apps:{},base:18000,pagoDelivery:0,pagoDeliveryMedio:'Efectivo'};
 const snapshot=w.ukiDetalleCierre.capturar(state,caja,a=>a);
 assert.deepEqual(snapshot.pedidos.map(x=>x.cobradoLocal),[3000,23000]);
 const csv=w.ukiDetalleCierre.csv({detalle:snapshot},x=>String(x));
 assert.match(csv,/Productos \$20000 pagados en Uki La Serena/);
 assert.match(csv,/Delivery: Efectivo \$1000 \+ Débito \$2000/);
});
test('Pedido pagado en otro local no genera segundo timbre en la cocina',()=>{
 assert.match(html,/if\(D\.cliente && D\.pagado && !D\.productosPagadosOtroLocal\)/);
 assert.match(html,/if\(!p\.esPremio && D\.cliente && D\.pagado && !D\.productosPagadosOtroLocal\)/);
 assert.match(html,/if\(p\.cliente && !p\.productosPagadosOtroLocal\)/);
});


test('Un tercio de la comida cobrado en otro local y resto en Uki más delivery',()=>{
 const x=mock();
 x.state.pedidos=[x.order({
  productosPagadosOtroLocal:true,montoProductosOtroLocal:8000,localPagoExterno:'Local vecino',
  medio:'Transferencia',medioEnvio:'Efectivo'
 })];
 const t=x.funcs.totales();
 assert.equal(t.productosPagadosOtroLocal,8000);
 assert.equal(t.medios.Transferencia,12000);
 assert.equal(t.medios.Efectivo,3000);
 assert.equal(t.totalMedios,15000);
 assert.equal(x.funcs.ukiErrorDistribucionPago(x.state.pedidos[0],20000,3000),'');
 assert.match(x.funcs.ukiDetallePago(x.state.pedidos[0],'productos'),/Local vecino/);
});
test('Pago parcial del otro local con el saldo Uki distribuido en efectivo y débito',()=>{
 const x=mock(),p=x.order({
  productosPagadosOtroLocal:true,montoProductosOtroLocal:15000,localPagoExterno:'Otro local',
  pagosProductos:[{medio:'Efectivo',monto:2000},{medio:'Débito',monto:3000}]
 });
 x.state.pedidos=[p];
 const t=x.funcs.totales();
 assert.equal(x.funcs.ukiErrorDistribucionPago(p,20000,3000),'');
 assert.equal(t.totalMedios,8000);
 assert.equal(t.medios.Efectivo,5000);
 assert.equal(t.medios.Débito,3000);
 assert.equal(t.medios.Transferencia,0);
 assert.equal(t.productosPagadosOtroLocal,15000);
});
test('Rechaza pago externo por más del subtotal y sumas incorrectas del saldo local',()=>{
 const x=mock();
 const p=x.order({productosPagadosOtroLocal:true,montoProductosOtroLocal:21000,localPagoExterno:'Otro'});
 assert.match(x.funcs.ukiErrorDistribucionPago(p,20000,3000),/no superar/);
 p.montoProductosOtroLocal=0;
 assert.match(x.funcs.ukiErrorDistribucionPago(p,20000,3000),/mayor a cero/);
 p.montoProductosOtroLocal=12000;
 p.pagosProductos=[{medio:'Efectivo',monto:3000},{medio:'Débito',monto:3000}];
 assert.match(x.funcs.ukiErrorDistribucionPago(p,20000,3000),/sumar/);
});
test('El cierre histórico conserva monto parcial ajeno y local realmente cobrado',()=>{
 const pth=path.join(__dirname,'..','firebase','uki-cierre-detallado.js');
 const code=fs.readFileSync(pth,'utf8'),w={};
 new Function('window',code)(w);
 const suc='Uki Regimiento Arica';
 const orders=[{id:8,suc,pagado:true,estado:'Entregado',modalidad:'Delivery',subtotal:20000,envio:3000,total:23000,
    medio:'Débito',medioEnvio:'Efectivo',productosPagadosOtroLocal:true,
    montoProductosOtroLocal:15000,localPagoExterno:'Otra sucursal',productos:[]}];
 const state={suc,pedidos:orders,gastos:[],retiros:[],propinas:[],deliveriesManuales:[]};
 const caja={base:18000,apps:{},pagoDelivery:0,pagoDeliveryMedio:'Efectivo',cajaChica:{inicial:0,gastos:[]}};
 const snapshot=w.ukiDetalleCierre.capturar(state,caja,a=>a);
 assert.equal(snapshot.pedidos[0].cobradoLocal,8000);
 assert.equal(snapshot.pedidos[0].montoProductosOtroLocal,15000);
 assert.match(w.ukiDetalleCierre.csv({detalle:snapshot},String),/Productos \$15000 pagados en Otra sucursal/);
});
test('Categorías visibles: pagados, por cobrar, cancelados, pendientes, entregados, errores',()=>{
 const first=html.indexOf('// Categorías visuales:');
 const last=html.indexOf('function vPedidos(){',first);
 assert.ok(first>=0&&last>first);
 const w=new Function('render',html.slice(first,last)+'\nreturn {ukiCoincideCategoriaPedido,UKI_CATEGORIAS_PEDIDOS}')( ()=>{} );
 const cats=w.UKI_CATEGORIAS_PEDIDOS.map(x=>x[0]);
 assert.deepEqual(cats,['todos','sin-pago','pagados','pendientes','entregados','cancelados','errores']);
 const err=new Set([3]);
 const orders=[
  {id:1,estado:'Pendiente',pagado:false},
  {id:2,estado:'Entregado',pagado:true},
  {id:3,estado:'Pendiente',pagado:true},
  {id:4,estado:'Cancelado',pagado:false}
 ];
 const matched=cat=>orders.filter(p=>w.ukiCoincideCategoriaPedido(p,cat,err)).map(x=>x.id);
 assert.deepEqual(matched('pagados'),[2,3]);
 assert.deepEqual(matched('sin-pago'),[1]);
 assert.deepEqual(matched('cancelados'),[4]);
 assert.deepEqual(matched('pendientes'),[1,3]);
 assert.deepEqual(matched('entregados'),[2]);
 assert.deepEqual(matched('errores'),[3]);
 assert.match(html,/const visibles=todos\.filter/);
});
test('Pagos ajenos no generan un segundo timbre y no alteran cierre diario original',()=>{
 assert.match(html,/D\.cliente && D\.pagado && !D\.productosPagadosOtroLocal/);
 assert.match(html,/function ukiMontoProductosOtroLocal/);
 assert.match(html,/function ukiCambiarCategoriaPedidos/);
});
