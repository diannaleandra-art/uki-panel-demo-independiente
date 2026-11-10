'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const modules=import(pathToFileURL(path.resolve(__dirname,'../firebase/uki-duenos-ventas-qa.mjs')).href);
const A='Uki Regimiento Arica',S='Uki La Serena';
const order=(extra={})=>({
 id:21,suc:A,registradoEn:Date.parse('2026-11-09T02:11:00-03:00'),
 fechaISO:'2026-11-09T02:11:00',pagado:true,estado:'Entregado',modalidad:'Delivery',
 subtotal:23500,envio:3500,total:27000,medio:'Efectivo',medioEnvio:'Transferencia',
 productos:[{nombre:'Sushi 24',cantidad:2,precioUnit:10000}],
 cliente:'Dato privado',telefono:'56911222333',codigoCarta:'UKI55',...extra
});
test('Lista pedidos pagados y pendientes sin duplicar, respetando sucursal y datos privados',async()=>{
 const {extraerVentasUki}=await modules;
 const o=order(),pending=order({id:22,pagado:false});
 const rows=extraerVentasUki(A,{suc:A,pedidos:[o,o,pending,order({id:34,suc:S})]});
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.numero===22).estado,'pendiente');
 assert.equal(rows.find(x=>x.numero===21).estado,'pagada');
 assert.ok(!JSON.stringify(rows).includes('56911222333'));
 assert.ok(!JSON.stringify(rows).includes('Dato privado'));
 assert.deepEqual(rows.map(x=>x.sucursal),[A,A]);
});
test('Pagos mixtos y cruces entre locales: sólo suma cobros que recibió Uki',async()=>{
 const {extraerVentasUki,resumenVentasUki}=await modules;
 const p=order({pagosProductos:[{medio:'Efectivo',monto:3500}],
  productosPagadosOtroLocal:true,montoProductosOtroLocal:20000,
  envioPagadoOtroLocal:true,montoEnvioOtroLocal:3500});
 const [v]=extraerVentasUki(A,{suc:A,pedidos:[p]});
 assert.equal(v.total,27000);
 assert.equal(v.cobradoLocal,3500);
 assert.equal(v.cobradoOtroLocal,23500);
 assert.deepEqual(v.medios,{Efectivo:3500});
 assert.equal(resumenVentasUki([v,v]).cobradoLocal,3500);
});
test('Sin cruces: Nuez o producto libre no afecta clasificación, pagos mixtos conservan total',async()=>{
 const {extraerVentasUki}=await modules;
 const p=order({id:31,productosPagadosOtroLocal:false,pagosProductos:[
  {medio:'Efectivo',monto:10000},{medio:'Débito',monto:13500}],pagosEnvio:[
  {medio:'Transferencia',monto:3500}]});
 const [v]=extraerVentasUki(A,{suc:A,pedidos:[p]});
 assert.equal(v.cobradoLocal,27000);
 assert.deepEqual(v.medios,{Efectivo:10000,Débito:13500,Transferencia:3500});
});
test('Cancelados, canjes y pendientes no cuentan como ventas pagadas',async()=>{
 const {extraerVentasUki,resumenVentasUki}=await modules;
 const pedidos=[
  order({id:1,estado:'Cancelado',pagado:true}),
  order({id:2,pagado:false}),
  order({id:3,esPremio:true,total:0,subtotal:0,envio:0}),
  order({id:4,ajusteCobroPendiente:{estado:'pendiente',recibido:{Efectivo:28000},saldo:1000}})
 ];
 const rows=extraerVentasUki(A,{suc:A,pedidos});
 const out=resumenVentasUki(rows);
 assert.equal(out.pagadas,0);
 assert.equal(out.canceladas,1);
 assert.equal(out.pendientes,1);
 assert.equal(out.revision,1);
 assert.equal(out.cobradoLocal,0,'Diferencias por conciliar no entran en ventas pagadas');
});
test('Agrupa pedidos por fecha operativa del cierre aunque se haya cerrado pasada medianoche',async()=>{
 const {extraerVentasUki}=await modules;
 const pedido=order();
 const cerrado={suc:A,fechaMs:Date.parse('2026-11-09T03:00:00-03:00'),inicioTurnoMs:Date.parse('2026-11-08T20:00:00-03:00'),fechaOperativa:'2026-11-08'};
 const state={suc:A,pedidos:[pedido],cierres:[cerrado]};
 assert.equal(extraerVentasUki(A,state,{desde:'2026-11-08',hasta:'2026-11-08'}).length,1);
 assert.equal(extraerVentasUki(A,state,{desde:'2026-11-09',hasta:'2026-11-09'}).length,0);
});
test('Filtra todas las ventas por código, medio, estado, fecha y sucursal',async()=>{
 const {extraerVentasUki,filtrarVentasUki}=await modules;
 const a=extraerVentasUki(A,{suc:A,pedidos:[order()]});
 const s=extraerVentasUki(S,{suc:S,pedidos:[order({suc:S,id:42,codigoCarta:'SER99',medio:'Débito'})]});
 const all=[...a,...s];
 assert.equal(filtrarVentasUki(all,{buscar:'uki55'}).length,1);
 assert.equal(filtrarVentasUki(all,{buscar:'42'}).length,1);
 assert.equal(filtrarVentasUki(all,{medio:'Débito'}).length,1);
 assert.equal(filtrarVentasUki(all,{sucursal:S}).length,1);
 assert.equal(filtrarVentasUki(all,{estado:'pendiente'}).length,0);
 assert.equal(filtrarVentasUki(all,{desde:'2026-11-10'}).length,0);
});
test('La nueva sección es de lectura, no toca caja, conserva acceso Google y PIN, sin exponer claves',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../firebase/mi-administracion.html'),'utf8');
 const module=fs.readFileSync(path.resolve(__dirname,'../firebase/uki-duenos-ventas-qa.mjs'),'utf8');
 assert.match(html,/id="ukiGoTodasVentas"/);
 assert.match(html,/id="ukiOwnerBuscarVenta"/);
 assert.match(html,/id="ukiOwnerEstadoVenta"/);
 assert.match(html,/id="ukiOwnerMedioVenta"/);
 assert.match(html,/if\(!auth\.currentUser\|\|!session\)/);
 assert.match(html,/lecturaUki\.cargar\(suc,clave\)/);
 assert.match(html,/extraerVentasUki\(suc,estado\)/);
 assert.match(module,/No escribe|no escribe/i);
 assert.doesNotMatch(html,/lecturaUki\.guardar\(/);
 assert.doesNotMatch(html,/sessionStorage\.setItem\(/);
});

test('Diseño del inicio destaca sucursales, resumen registrado y todas las ventas sin duplicar funciones',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../firebase/mi-administracion.html'),'utf8');
 const home=html.slice(html.indexOf('<section class="view" id="v-resumen">'),html.indexOf('<section class="view" id="v-ventas"'));
 assert.ok(home.indexOf('class="owner-branches"')>0);
 assert.ok(home.indexOf('owner-finance-card')>home.indexOf('owner-branches'));
 assert.ok(home.indexOf('id="ukiGoTodasVentas"')>home.indexOf('owner-finance-card'));
 assert.ok(home.indexOf('id="homeActions"')>home.indexOf('id="ukiGoTodasVentas"'));
 for(const id of ['m-ventas','m-gastos','m-resultado','m-pendientes',
   'ukiOwnerBranch','ukiOwnerClave','ukiOwnerConsultar','ukiOwnerListaVentas',
   'ukiOwnerResultados','ukiOwnerEstadoArica','ukiOwnerEstadoSerena'])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,
   id+' debe estar una sola vez');
 for(const tab of ['ventas','gastos','facturas','negocios'])
  assert.match(html,new RegExp('data-go="'+tab+'"'),'Conservar acceso '+tab);
 assert.match(html,/bloquearEscriturasUki/,'La lectura de caja sigue sin permisos de escritura');
 assert.match(html,/Este resumen muestra únicamente los movimientos registrados en Mi Administración/,
  'Distinguir el balance manual del operativo de Uki');
 assert.match(html,/data-uki-branch="Uki Regimiento Arica"/);
 assert.match(html,/data-uki-branch="Uki La Serena"/);
 assert.match(html,/scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/);
});
