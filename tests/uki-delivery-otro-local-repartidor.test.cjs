'use strict';
// node --test tests/uki-delivery-otro-local-repartidor.test.cjs
// Datos ficticios; sin Firebase ni mutaciones reales.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const cierre=fs.readFileSync(path.join(__dirname,'..','firebase','uki-cierre-detallado.js'),'utf8');
const sec=(start,end)=>{
 const i=html.indexOf(start),j=html.indexOf(end,i);
 assert.ok(i>=0&&j>i,'No se encuentra sección '+start);
 return html.slice(i,j);
};
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const APPS=['Uber Eats','PedidosYa','Rappi'];
const fmt=x=>'$'+Number(x||0).toLocaleString('es-CL');
function fixture(){
 const suc='Uki Regimiento Arica';
 const mk=(id,sub,env,extra={})=>({
  id,suc,cliente:'Prueba '+id,modalidad:'Delivery',
  subtotal:sub,envio:env,total:sub+env,medio:'Transferencia',medioEnvio:'Efectivo',
  pagado:true,estado:'Pendiente',productos:[{cantidad:1,precioUnit:sub,nombre:'Promo',detalle:''}],
  ...extra
 });
 const previo=mk(50,16000,2500,{productosPagadosOtroLocal:true,montoProductosOtroLocal:18500,
   localPagoExterno:'Romo',pagado:false});
 const afuera=mk(51,20000,3000,{productosPagadosOtroLocal:true,montoProductosOtroLocal:20000,
   envioPagadoOtroLocal:true,localPagoExterno:'Romo'});
 const local=mk(52,10000,2000,{medio:'Débito',medioEnvio:'Efectivo'});
 const cancelado=mk(53,11000,2500,{estado:'Cancelado',pagado:false});
 const pendiente=mk(54,9000,1200,{pagado:false});
 const S={suc,pedidos:[previo,afuera,local,cancelado,pendiente],gastos:[],retiros:[],
   propinas:[],deliveriesManuales:[]};
 const caja={apps:{},base:0,pagoDelivery:0,pagoDeliveryMedio:'Efectivo',cajaChica:{inicial:0,gastos:[]}};
 const payment=sec('function ukiMontoProductosOtroLocal(p,sub){','function vCaja(){');
 const f=new Function('S','MEDIOS','APPS','cajaDelDia','delSucHoy','fmt','esc','render',
 payment+'\nreturn {ukiMontoProductosOtroLocal,ukiMontoEnvioOtroLocal,ukiErrorDistribucionPago,totales};')
 (S,MEDIOS,APPS,()=>caja,arr=>arr.filter(x=>x.suc===S.suc),fmt,String,()=>{});
 const bill=new Function('S','fmt','ukiMontoProductosOtroLocal','ukiMontoEnvioOtroLocal',
  sec('function ukiDetalleCuentaTexto(p){','function ukiDetalleCuentaVista(p){')+
  '\nreturn ukiDetalleCuentaTexto;')
 (S,fmt,f.ukiMontoProductosOtroLocal,f.ukiMontoEnvioOtroLocal);
 const history={};new Function('window',cierre)(history);
 return {S,caja,mk,previo,afuera,local,cancelado,pendiente,bill,history,...f};
}
test('Pedido #50: $16.000 productos + $2.500 reparto pagados fuera, sin negativo',()=>{
 const x=fixture(),before=JSON.stringify(x.previo);
 assert.equal(x.ukiMontoProductosOtroLocal(x.previo,16000),16000);
 assert.equal(x.ukiMontoEnvioOtroLocal(x.previo,2500,16000),2500);
 assert.equal(x.ukiErrorDistribucionPago(x.previo,16000,2500),'');
 const txt=x.bill(x.previo);
 assert.match(txt,/Productos cobrados en Romo: \$16\.000/);
 assert.match(txt,/Delivery cobrado en Romo: \$2\.500/);
 assert.match(txt,/SALDO POR PAGAR EN UKI: \$0/);
 assert.equal(JSON.stringify(x.previo),before);
});
test('El repartidor recibe crédito por delivery no cancelado aunque figure sin pago',()=>{
 const x=fixture(),t=x.totales();
 assert.equal(t.enviosPedidos,8700); // 2500 + 3000 + 2000 + 1200
 assert.equal(t.nDeliv,4);
 assert.equal(t.envios,8700);
 assert.equal(t.pendientesN,2);
});
test('Pedido pagado 100% en otro local no entra a la caja de Uki',()=>{
 const x=fixture(),t=x.totales();
 assert.equal(x.ukiErrorDistribucionPago(x.afuera,20000,3000),'');
 assert.equal(t.totalMedios,12000); // solo $10.000 productos y $2.000 delivery local
 assert.equal(t.ventaSinDelivery,10000);
 assert.equal(t.enviosCobradosUki,2000);
 assert.equal(t.enviosCobradosOtroLocal,3000);
 assert.equal(t.medios.Débito,10000);
 assert.equal(t.medios.Efectivo,2000);
});
test('Confirmar pago externo antiguo suma solo repartidor, sin ingresos ficticios',()=>{
 const x=fixture();x.previo.pagado=true;
 const t=x.totales();
 assert.equal(t.totalMedios,12000);
 assert.equal(t.enviosCobradosOtroLocal,5500);
 assert.equal(t.envios,8700);
});
test('Delivery manual mantiene ingreso de Uki y tarifa para repartidor',()=>{
 const x=fixture();
 x.S.deliveriesManuales.push({suc:x.S.suc,monto:1000,medio:'Efectivo'});
 const t=x.totales();
 assert.equal(t.totalMedios,13000);
 assert.equal(t.enviosCobradosUki,3000);
 assert.equal(t.ventaSinDelivery,10000);
 assert.equal(t.envios,9700);
});
test('El cierre conserva pago externo dividido entre productos y delivery',()=>{
 const x=fixture();x.previo.pagado=true;
 const snapshot=x.history.ukiDetalleCierre.capturar(x.S,x.caja,arr=>arr);
 const p=snapshot.pedidos.find(z=>z.id===50),q=snapshot.pedidos.find(z=>z.id===51);
 assert.equal(p.cobradoLocal,0);
 assert.equal(p.montoProductosOtroLocal,16000);
 assert.equal(p.montoEnvioOtroLocal,2500);
 assert.equal(q.cobradoLocal,0);
 assert.equal(q.montoEnvioOtroLocal,3000);
});
test('La pantalla ofrece el cobro externo del delivery y reporta importe para repartidor',()=>{
 assert.match(html,/El delivery fue pagado en otro local \(lo reparte Uki\)/);
 assert.match(html,/Deliveries registrados para repartidor/);
 assert.match(html,/De ellos, cobrados en otro local/);
 assert.match(html,/Total para repartidor \(base \+ deliveries\)/);
 assert.match(html,/deliverys? de Uki/i);
});
test('No se cuenta un pedido cancelado ni se acepta exceder el total de comida y envío',()=>{
 const x=fixture();
 x.previo.montoProductosOtroLocal=25000;
 assert.notEqual(x.ukiErrorDistribucionPago(x.previo,16000,2500),'');
 assert.ok(!x.totales().dels.some(p=>p.id===x.cancelado.id));
});
