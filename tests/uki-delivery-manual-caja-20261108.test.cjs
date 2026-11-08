'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const detail=fs.readFileSync('firebase/uki-cierre-detallado.js','utf8');
const start=html.indexOf('function ukiPagoDeliveryDesglose(caja){');
const saveEnd=html.indexOf('function addPropina(){',start);
const totalStart=html.indexOf('function totales(){');
const totalEnd=html.indexOf('function vCaja(){',totalStart);
assert.ok(start>=0&&saveEnd>start&&totalStart>saveEnd&&totalEnd>totalStart);

function build(cajaOverride={}){
 const caja={apps:{},base:18000,pagoDelivery:0,pagoDeliveryMedio:'Efectivo',...cajaOverride};
 const S={
  suc:'Uki Regimiento Arica',
  pedidos:[{suc:'Uki Regimiento Arica',id:1,modalidad:'Delivery',pagado:true,estado:'Pendiente',
   subtotal:10000,envio:1500,total:11500,medio:'Efectivo',medioEnvio:'Efectivo'}],
  deliveriesManuales:[
   {suc:'Uki Regimiento Arica',monto:1250,medio:'Efectivo',cliente:'Romo interlocal'},
   {suc:'Uki Regimiento Arica',monto:1350,medio:'Transferencia',cliente:'Palta al bosque'}
  ],gastos:[],retiros:[],propinas:[]
 };
 const ui={};
 const context={S,MEDIOS:['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'],
  APPS:['Uber Eats','PedidosYa','Rappi'],cajaDelDia:()=>caja,delSucHoy:arr=>arr,
  ukiLineasPago:(p,t,m)=>m>0?[{medio:t==='envio'?p.medioEnvio:p.medio,monto:m}]:[],
  ukiMontoProductosOtroLocal:()=>0,ukiMontoEnvioOtroLocal:()=>0,
  $:key=>ui[key],fmt:n=>'$'+n,aviso:t=>context.lastAviso=t,render:()=>{},
 };
 vm.createContext(context);
 vm.runInContext(html.slice(start,saveEnd)+'\n'+html.slice(totalStart,totalEnd),context);
 return {context,caja,S,ui,totals:()=>context.totales()};
}
test('Sin pagos: 2 deliverys manuales no ingresan como efectivo ni como ventas',()=>{
 const t=build().totals();
 assert.equal(t.medios.Efectivo,11500);
 assert.equal(t.totalMedios,11500);
 assert.equal(t.efectivoCaja,11500);
 assert.equal(t.enviosCobradosUki,1500);
 assert.equal(t.ventaSinDelivery,10000);
 assert.equal(t.enviosManuales,2600);
 assert.equal(t.envios,4100);
 assert.equal(t.pagoDelivery,0);
 assert.equal(t.final,11500);
});
test('Los medios de pago de deliverys manuales no cambian ningún ingreso',()=>{
 const x=build(),before=x.totals();
 x.S.deliveriesManuales[0].medio='Transferencia';
 x.S.deliveriesManuales[1].medio='Efectivo';
 const after=x.totals();
 assert.equal(after.totalMedios,before.totalMedios);
 assert.equal(after.efectivoCaja,before.efectivoCaja);
 assert.equal(after.enviosManuales,before.enviosManuales);
});
test('Saldo anterior transferido: se descuenta del total final pero no del efectivo',()=>{
 const x=build({pagoDelivery:1200,pagoDeliveryMedio:'Mixto',pagoDeliveryDia:500,pagoDeliveryAnterior:700,
  pagoDeliveryMedioDia:'Efectivo',pagoDeliveryMedioAnterior:'Transferencia',
  pagoDeliveryConceptoAnterior:'Saldo del día anterior'});
 const t=x.totals();
 assert.equal(t.pagoDelivery,1200);
 assert.equal(t.pagoDeliveryDia,500);
 assert.equal(t.pagoDeliveryAnterior,700);
 assert.equal(t.efectivoCaja,11000);
 assert.equal(t.final,10300);
});
test('Dos pagos en efectivo salen de caja exactamente una vez',()=>{
 const t=build({pagoDelivery:1200,pagoDeliveryDia:500,pagoDeliveryAnterior:700,
  pagoDeliveryMedioDia:'Efectivo',pagoDeliveryMedioAnterior:'Efectivo'}).totals();
 assert.equal(t.efectivoCaja,10300);
 assert.equal(t.final,10300);
});
test('Pago histórico de repartidor conserva el comportamiento anterior al nuevo formulario',()=>{
 const t=build({pagoDelivery:900,pagoDeliveryMedio:'Efectivo'}).totals();
 assert.equal(t.pagoDeliveryDia,900);
 assert.equal(t.pagoDeliveryAnterior,0);
 assert.equal(t.efectivoCaja,10600);
});
test('Pago antiguo por transferencia no descuenta efectivo',()=>{
 const t=build({pagoDelivery:900,pagoDeliveryMedio:'Transferencia'}).totals();
 assert.equal(t.pagoDelivery,900);
 assert.equal(t.efectivoCaja,11500);
 assert.equal(t.final,10600);
});
test('Guardar pago de hoy y saldo anterior exige concepto y reemplaza en vez de sumar',()=>{
 const x=build();
 x.ui.pdDia={value:'500'};x.ui.pdAnterior={value:'700'};
 x.ui.pdDiaMed={value:'Efectivo'};x.ui.pdAnteriorMed={value:'Transferencia'};
 x.ui.pdConceptoAnterior={value:''};
 x.context.savePD();assert.equal(x.caja.pagoDelivery,0);
 x.ui.pdConceptoAnterior.value='Saldo viernes';
 x.context.savePD();
 assert.equal(x.caja.pagoDelivery,1200);
 assert.equal(x.caja.pagoDeliveryDia,500);
 assert.equal(x.caja.pagoDeliveryAnterior,700);
 assert.equal(x.caja.pagoDeliveryMedio,'Mixto');
 assert.equal(x.totals().efectivoCaja,11000);
 x.context.savePD();assert.equal(x.caja.pagoDelivery,1200,'doble clic no vuelve a descontar');
 x.ui.pdDia.value='0';x.ui.pdAnterior.value='0';
 x.context.savePD();assert.equal(x.caja.pagoDelivery,0,'se pueden corregir pagos mal registrados');
});
test('Desglose y cierre ofrecen ambos conceptos y no reescriben cierres antiguos',()=>{
 for(const key of ['id="pdDia"','id="pdAnterior"','id="pdConceptoAnterior"',
  'pagoDeliveryAnterior:t.pagoDeliveryAnterior','pagoDeliveryDia:t.pagoDeliveryDia',
  'caja.pagoDeliveryAnterior=0','Los deliverys manuales no son ingresos']){
  assert.ok(html.includes(key),key);
 }
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(detail,ctx);
 const {capturar,filas}=ctx.window.ukiDetalleCierre;
 const sample=build({pagoDelivery:1200,pagoDeliveryDia:500,pagoDeliveryAnterior:700,
  pagoDeliveryMedioDia:'Efectivo',pagoDeliveryMedioAnterior:'Transferencia',
  pagoDeliveryConceptoAnterior:'Saldo 7 noviembre'});
 const snap=capturar(sample.S,sample.caja,arr=>arr);
 assert.equal(snap.repartidor.dia,500);
 assert.equal(snap.repartidor.anterior,700);
 const rows=filas({detalle:snap}).filter(r=>r[0]==='Pago repartidor');
 assert.equal(rows.length,2);
 assert.equal(rows.reduce((n,r)=>n+r[4],0),1200);
 assert.ok(rows.some(r=>r[3]==='Abono saldo anterior'&&r[6]==='Saldo 7 noviembre'));
 const oldRows=filas({detalle:{version:1,pedidos:[],repartidor:{monto:900,medio:'Efectivo'}}})
  .filter(r=>r[0]==='Pago repartidor');
 assert.equal(oldRows.length,1);
 assert.equal(oldRows[0][4],900);
});
test('Scripts HTML y detalle sin errores de sintaxis',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  new vm.Script(m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2]);
 }
 new vm.Script(detail);
});
