'use strict';
// Pruebas aisladas sin Firebase ni datos reales. Ejecutar: node --test tests/propinas-pedidos-uki.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const history=fs.readFileSync(path.join(__dirname,'..','firebase','uki-cierre-detallado.js'),'utf8');
const section=(a,b)=>{
 const i=html.indexOf(a),j=html.indexOf(b,i);
 assert.ok(i>=0&&j>i,'No se encontró '+a);
 return html.slice(i,j);
};
const opts=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const apps=['Uber Eats','PedidosYa','Rappi'];
function mock(){
 const S={suc:'Uki Regimiento Arica',pedidos:[],propinas:[]};
 const D={propinaModo:'diez',propinaPersonalizada:'',medioPropina:'Efectivo'};
 const code=section('function ukiMontoPropina(p,subtotal){','function ukiCuentaLocal(p){');
 const functions=new Function('S','D','MEDIOS','APPS','fmt','esc','render','ahora',
  code+'\nreturn {ukiMontoPropina,ukiPropinaConfigurada,ukiSincronizarPropinaPedido,ukiPropinaUI};')
 (S,D,opts,apps,n=>'$'+Number(n).toLocaleString('es-CL'),s=>String(s),()=>{},()=>'2026-11-02T17:00');
 return {S,D,...functions};
}
const sample=()=>({suc:'Uki Regimiento Arica',id:1,subtotal:20000,envio:0,propina:2000,
 propinaModo:'diez',medioPropina:'Efectivo',pagado:false,estado:'Pendiente',
 cliente:'Ana',modalidad:'Consumo en local',productos:[{nombre:'Promo',cantidad:1,precioUnit:20000,detalle:''}]});
test('10% sobre productos, no incluye delivery; puede elegir cero',()=>{
 const {ukiMontoPropina}=mock();
 assert.equal(ukiMontoPropina({propinaModo:'diez'},20000),2000);
 assert.equal(ukiMontoPropina({propinaModo:'ninguna'},20000),0);
 assert.equal(ukiMontoPropina({propinaModo:'otro',propinaPersonalizada:'1500'},20000),1500);
 assert.equal(ukiMontoPropina({propinaModo:'diez'},12345),1235);
});
test('La propina es voluntaria y el formulario ofrece 0%, 10% y otro monto',()=>{
 const x=mock(),ui=x.ukiPropinaUI(20000);
 assert.match(ui,/Sin propina/);
 assert.match(ui,/10%/);
 assert.match(ui,/Otro monto/);
 assert.match(ui,/2\.000/);
 assert.match(html,/\$\{ukiPropinaUI\(sub\)\}/);
 assert.match(html,/Consumo en local/);
 assert.match(html,/Retiro/);
 assert.match(html,/Delivery/);
 assert.equal(x.ukiPropinaConfigurada({propinaModo:'otro',propinaPersonalizada:'-1'},20000),false);
});
test('Cuenta abierta no registra propina hasta que el pedido esté pagado',()=>{
 const x=mock(),p=sample();
 x.ukiSincronizarPropinaPedido(p);
 assert.equal(x.S.propinas.length,0);
 p.pagado=true;x.ukiSincronizarPropinaPedido(p);
 assert.equal(x.S.propinas.length,1);
 assert.equal(x.S.propinas[0].monto,2000);
 assert.equal(x.S.propinas[0].pedidoId,1);
});
test('No duplica la propina al guardar varias veces; permite corregirla',()=>{
 const x=mock(),p=sample();p.pagado=true;
 x.ukiSincronizarPropinaPedido(p);x.ukiSincronizarPropinaPedido(p);
 assert.equal(x.S.propinas.length,1);
 p.propina=1500;p.medioPropina='Débito';x.ukiSincronizarPropinaPedido(p);
 assert.equal(x.S.propinas.length,1);
 assert.equal(x.S.propinas[0].monto,1500);
 assert.equal(x.S.propinas[0].medio,'Débito');
});
test('Quitar estado de pagado elimina propina asociada; no elimina manual',()=>{
 const x=mock(),p=sample();p.pagado=true;
 x.S.propinas.push({suc:p.suc,id:100,monto:500,medio:'Efectivo'});
 x.ukiSincronizarPropinaPedido(p);assert.equal(x.S.propinas.length,2);
 p.pagado=false;x.ukiSincronizarPropinaPedido(p);
 assert.equal(x.S.propinas.length,1);
 assert.equal(x.S.propinas[0].id,100);
});
test('El recibo suma propina y la distingue de los productos',()=>{
 assert.match(html,/const tip=Number\(p\.propina\)\|\|0/);
 assert.match(html,/Propina opcional:/);
 assert.match(html,/TOTAL: "\+fmt\(total\)/);
 assert.match(html,/row\("Propina opcional"/);
});
test('El cierre guarda importe, medio de propina y referencia al pedido',()=>{
 const w={};new Function('window',history)(w);
 const p=sample();p.pagado=true;p.total=22000;
 const x=mock();x.ukiSincronizarPropinaPedido(p);
 const S={suc:p.suc,pedidos:[p],propinas:x.S.propinas,gastos:[],retiros:[],deliveriesManuales:[]};
 const box={base:0,apps:{},pagoDelivery:0,cajaChica:{inicial:0,gastos:[]}};
 const frozen=w.ukiDetalleCierre.capturar(S,box,arr=>arr);
 assert.equal(frozen.pedidos[0].propina,2000);
 assert.equal(frozen.pedidos[0].medioPropina,'Efectivo');
 assert.equal(frozen.propinas[0].pedidoId,1);
 assert.equal(frozen.propinas[0].monto,2000);
 assert.match(w.ukiDetalleCierre.csv({detalle:frozen},String),/Propina voluntaria aparte/);
});
