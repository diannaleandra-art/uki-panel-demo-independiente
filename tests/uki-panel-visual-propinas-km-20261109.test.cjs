'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const slice=(a,b)=>{
 const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'Segmento no disponible: '+a);
 return html.slice(start,end);
};
const sChile=t=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date(t));
test('Cada fecha calendario tiene una frase diferente sin modificar la jornada operativa',()=>{
 const ctx={ukiFechaCalendarioChile:sChile};
 vm.createContext(ctx);
 vm.runInContext(slice('function ukiFraseDiaria(','function ukiFechaHoraInicio('),ctx);
 const a=ctx.ukiFraseDiaria('2026-11-09'),b=ctx.ukiFraseDiaria('2026-11-10');
 assert.ok(a.length>12);assert.notEqual(a,b);
 assert.equal(ctx.ukiFraseDiaria('2026-11-09'),a);
 const home=slice('function vInicio(){','// Datos temporales de cierre:');
 assert.match(home,/id="ukiFechaHoraInicio"/);
 assert.match(home,/id="ukiFraseDiariaInicio"/);
 assert.doesNotMatch(home,/🕒 Información del turno/);
 assert.match(html,/function ukiSaltarPanel\(ubicacion\)/);
 assert.match(html,/id="ukiCajaIrA"/);
 assert.match(html,/id="ukiMovimientoIrA"/);
});
test('Kilómetros reales: admite coma decimal y texto explícito, sin calcular precio',()=>{
 const ctx={D:{modalidad:"Delivery",kmRecorrido:"4,5",texto:""}};
 vm.createContext(ctx);
 vm.runInContext(slice('function ukiKmRecorridoPedido(','function vNuevo(){'),ctx);
 assert.equal(ctx.ukiKmRecorridoBorrador(),4.5);
 assert.equal(ctx.ukiKmRecorridoPedido({modalidad:"Delivery",kmRecorrido:0}),null);
 assert.equal(ctx.ukiKmRecorridoPedido({modalidad:"Delivery",textoOriginal:"Distancia: 3,2 km"}),3.2);
 assert.equal(ctx.ukiKmRecorridoPedido({modalidad:"Retiro",textoOriginal:"Distancia: 3,2 km"}),null);
 assert.equal(ctx.ukiKmRecorridoPedido({modalidad:"Delivery",textoOriginal:"Repartir en calle 5 KM"}),null);
 assert.equal(ctx.ukiKmTexto({modalidad:"Delivery",envio:2500}),"Km sin registrar");
 const body=slice('function vPedidos(){','function ukiCobrosRealesMedios(');
 assert.match(body,/Kilómetros del recorrido/);
 assert.match(body,/Propina voluntaria/);
 assert.match(html,/kmRecorrido,medio:D\.medio/);
 assert.match(html,/p\.kmRecorrido=kmRecorrido/);
});
test('Tarjeta de pedido muestra propina manual sin sumar dos veces la registrada desde el pedido',()=>{
 const ctx={S:{propinas:[{suc:"Uki Regimiento Arica",pedidoId:244,origen:"manual",monto:2200},
   {suc:"Uki Regimiento Arica",pedidoId:245,origen:"pedido",monto:1000}]}};
 vm.createContext(ctx);
 vm.runInContext(slice('function ukiPropinaVisiblePedido(p){','function ukiKmTexto(p){'),ctx);
 assert.equal(ctx.ukiPropinaVisiblePedido({suc:"Uki Regimiento Arica",id:244,propina:0}),2200);
 assert.equal(ctx.ukiPropinaVisiblePedido({suc:"Uki Regimiento Arica",id:245,propina:1000}),1000);
 assert.equal(ctx.ukiPropinaVisiblePedido({suc:"Uki La Serena",id:244,propina:0}),0);
 assert.equal(ctx.ukiPropinaVisiblePedido({suc:"Uki Regimiento Arica",id:244,propina:1500}),3700);
 assert.match(html,/Propina voluntaria",fmt\(ukiPropinaVisiblePedido\(p\)\)/);
});
test('Propina manual: exige concepto y pedido pagado, impide duplicación',()=>{
 const inputs={prMon:{value:"1500"},prMed:{value:"Efectivo"},prPed:{value:"244"},prCon:{value:"Servicio adicional"}};
 const avisos=[],ctx={
  S:{suc:"Uki Regimiento Arica",pedidos:[{suc:"Uki Regimiento Arica",id:244,pagado:true,estado:"Pendiente",subtotal:12000,propina:0}],propinas:[]},
  $:id=>inputs[id],MEDIOS:["Efectivo","Transferencia","Uber Eats"],APPS:["Uber Eats"],
  fmt:n=>'$'+n,ukiCierreConfirmadoPedido:()=>null,
  ukiReferenciaConCarta:p=>'Pedido #'+p.id,ukiTimbreResponsableActual:()=>'Agendador QA',
  aviso:x=>avisos.push(x),render:()=>{},window:{confirm:()=>true}
 };
 vm.createContext(ctx);
 vm.runInContext(slice('function addPropina(){','function quitarPropina('),ctx);
 ctx.addPropina();assert.equal(ctx.S.propinas.length,1);
 assert.equal(ctx.S.propinas[0].pedidoId,244);
 assert.equal(ctx.S.propinas[0].concepto,'Servicio adicional');
 assert.equal(ctx.S.propinas[0].origen,'manual');
 ctx.addPropina();assert.equal(ctx.S.propinas.length,1,'no se duplica el mismo pedido');
 inputs.prPed.value="999";ctx.addPropina();assert.equal(ctx.S.propinas.length,1);
 inputs.prPed.value="244";ctx.S.propinas=[];inputs.prCon.value="";
 ctx.addPropina();assert.equal(ctx.S.propinas.length,0,'concepto obligatorio');
 ctx.S.pedidos[0].pagado=false;inputs.prCon.value="Adicional";ctx.addPropina();
 assert.equal(ctx.S.propinas.length,0,'sin pago no se asocia');
 ctx.S.pedidos[0].pagado=true;
 ctx.S.pedidos.push({...ctx.S.pedidos[0],id:500,codigoCarta:"244"});
 inputs.prPed.value="244";ctx.addPropina();
 assert.equal(ctx.S.propinas.length,0,'un código de carta nunca debe confundirse con otro ID interno');
 inputs.prPed.value="Interno 244";ctx.addPropina();
 assert.equal(ctx.S.propinas.length,1,'el agendador identifica cuál de los dos pedidos es');
});
test('Reportes de propinas por calendario, sucursal y medio: no duplicar con cierres',()=>{
 const ctx={S:{suc:"Uki Regimiento Arica",propinas:[
  {suc:"Uki Regimiento Arica",monto:1500,medio:"Efectivo",origen:"manual",registradoEn:Date.parse("2026-11-09T10:00:00-03:00")},
  {suc:"Uki Regimiento Arica",monto:2000,medio:"Transferencia",origen:"pedido",registradoEn:Date.parse("2026-11-09T20:00:00-03:00")},
  {suc:"Uki Regimiento Arica",monto:3000,medio:"Efectivo",origen:"pedido",registradoEn:Date.parse("2026-12-01T10:00:00-03:00")},
  {suc:"Uki La Serena",monto:9000,medio:"Efectivo",origen:"manual",registradoEn:Date.parse("2026-11-09T15:00:00-03:00")}
 ],pedidos:[],cierres:[]},
 ukiFechaCalendarioChile:sChile,MEDIOS:["Efectivo","Transferencia"],APPS:[],
 render:()=>{},fmt:n=>'$'+n,esc:String,row:()=>'',ukiReferenciaConCarta:()=>''};
 vm.createContext(ctx);
 vm.runInContext(slice('let reportePropinasPeriodo=','function vReportes(){'),ctx);
 ctx.ukiSeleccionarFechaPropinas("2026-11-09");
 let r=ctx.ukiReportePropinasDatos();assert.equal(r.total,3500);assert.equal(r.registros.length,2);
 ctx.ukiSeleccionarPeriodoPropinas("semana");
 r=ctx.ukiReportePropinasDatos();assert.equal(r.desde,"2026-11-09");assert.equal(r.hasta,"2026-11-15");
 assert.equal(r.total,3500);
 ctx.ukiSeleccionarPeriodoPropinas("mes");
 r=ctx.ukiReportePropinasDatos();assert.equal(r.desde,"2026-11-01");assert.equal(r.hasta,"2026-11-30");
 assert.equal(r.total,3500);assert.equal(r.medios.length,2);
 assert.match(html,/cierresOriginales\.map\(ukiCierreInformeVigente\)/);
 assert.match(html,/uk[iI]AccionesHistorial\(original\)/);
});
test('Evita duplicar la propina manual al editar el pedido ya pagado',()=>{
 const src=slice('function ndGuardar(){','function cerrar(){');
 assert.match(src,/if\(D\.editando&&propina>0&&\(S\.propinas\|\|\[\]\)\.some/);
 assert.match(src,/x\.origen==="manual"/);
 assert.match(src,/Este pedido ya tiene una propina manual registrada/);
});
test('Seleccionar día, semana o mes no cierra visualmente los reportes de propinas',()=>{
 const src=slice('let reportePropinasPeriodo=','function vReportes(){');
 assert.match(src,/reportePropinasAbierto=true;render\(\)/);
 assert.match(src,/ontoggle="reportePropinasAbierto=this\.open"/);
 assert.match(src,/reportePropinasAbierto\?'open':''/);
});
test('Página principal conserva sintaxis válida, QR/caja no se modifican desde la navegación',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const main=scripts.find(x=>x.includes('function vPedidos(){')&&x.includes('function vNuevo(){'));
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
 assert.match(html,/function ukiSaltarPanel\(ubicacion\)/);
 assert.match(html,/uki-filtros-pedidos/);
 assert.match(html,/uki-carta-estado-compacto/);
});
