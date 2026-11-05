'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const leer=n=>fs.readFileSync(path.join(__dirname,'..','firebase',n),'utf8');
const panel=leer('uki-sushi-local.html');
const origen=leer('uki-cierre-detallado.js');
function doc(){
 const c={window:{}};
 vm.runInNewContext(origen,c,{timeout:2500});
 return c.window.ukiDetalleCierre;
}
const pedido=(p={})=>({
 id:11,suc:'Uki Regimiento Arica',cliente:'Ana',codigoCarta:'ABC',telefono:'56912345678',
 fechaISO:'2026-11-05T00:15:00-03:00',pagado:true,estado:'Pendiente',esPremio:false,
 modalidad:'Consumo en local',total:10000,subtotal:10000,envio:0,
 medio:'Efectivo',pagosProductos:[{medio:'Efectivo',monto:6000},{medio:'Transferencia',monto:4000}],
 productos:[{nombre:'Gohan',cantidad:1,precioUnit:10000}],...p
});
const caja={apps:{'Uber Eats':1500},base:18000,pagoDelivery:0,pagoDeliveryMedio:'Efectivo',cajaChica:{inicial:20000,gastos:[]}};
function snapshot(orders,env=caja){
 const s={suc:'Uki Regimiento Arica',pedidos:orders,gastos:[],retiros:[],propinas:[],
  deliveriesManuales:[{monto:2000,medio:'Transferencia',cliente:'Pepe',id:999,fechaISO:'2026-11-05'}]};
 return doc().capturar(s,env,a=>a||[]);
}
const sum=it=>(it||[]).reduce((n,x)=>n+x.monto,0);
test('Historial congela pago mixto: cada importe en su medio y no duplica el pedido',()=>{
 const api=doc(),p=pedido(),d=snapshot([p]);
 const c={detalle:d,medios:{Efectivo:6000,Transferencia:6000,'Uber Eats':1500}};
 const groups=api.agruparPagosHistoricos(c);
 assert.equal(sum(groups.get('Efectivo')),6000);
 assert.equal(sum(groups.get('Transferencia')),6000);
 assert.equal(sum(groups.get('Uber Eats')),1500);
 assert.equal([...groups.values()].flat().length,4);
 assert.match(api.renderAuditoriaPagos(c,n=>'$'+n,x=>String(x)),/Coincide con los totales/);
});
test('Excluye efectivo cobrado en otro local y no computa cancelados ni premios',()=>{
 const api=doc();
 const outside=pedido({id:12,productosPagadosOtroLocal:true,montoProductosOtroLocal:10000,
  localPagoExterno:'Romo',pagosProductos:[],medio:'Efectivo'});
 const cancelled=pedido({id:13,estado:'Cancelado',pagosProductos:[]});
 const gift=pedido({id:14,esPremio:true,total:0,subtotal:0,pagosProductos:[]});
 const c={detalle:snapshot([outside,cancelled,gift]),medios:{Transferencia:2000,'Uber Eats':1500}};
 const groups=api.agruparPagosHistoricos(c);
 assert.equal(sum(groups.get('Efectivo')),0);
 assert.equal(sum(groups.get('Transferencia')),2000);
 assert.equal(sum(groups.get('Uber Eats')),1500);
});
test('El cierre conserva el estado manual, la apertura de WhatsApp y último código del cliente',()=>{
 const api=doc();
 const p=pedido({timbreEnviadoEn:'2026-11-05T02:13:00.000Z',timbreEnviadoPor:'Sara',
  timbreWhatsAppAbiertoEn:'2026-11-05T02:12:00.000Z',
  timbreEventos:[{tipo:'whatsapp_abierto',fecha:'2026-11-05T02:12:00.000Z',responsable:'Sara'}]});
 const d=snapshot([p]);
 assert.equal(d.pedidos[0].codigoClienteUltimos4,'5678');
 assert.equal(d.pedidos[0].timbreEnviadoPor,'Sara');
 assert.equal(d.pedidos[0].timbreEventos[0].tipo,'whatsapp_abierto');
 const markup=api.renderAuditoriaTimbres({detalle:d},n=>'$'+n,x=>String(x));
 assert.match(markup,/1 generados · 1 marcados enviados/);
 assert.match(markup,/Ana/);
 assert.match(markup,/Sara/);
 assert.match(markup,/Abrir WhatsApp NO es prueba/);
});
test('WhatsApp abierto no equivale a timbre enviado y se cuenta como pendiente',()=>{
 const api=doc();
 const p=pedido({timbreWhatsAppAbiertoEn:'2026-11-05T02:12:00.000Z'});
 const markup=api.renderAuditoriaTimbres({detalle:snapshot([p])},n=>'$'+n,x=>String(x));
 assert.match(markup,/1 generados · 0 marcados enviados/);
 assert.match(markup,/WhatsApp abierto, sin envío confirmado/);
 assert.match(markup,/Timbres sin confirmación de envío/);
});
test('El panel registra automáticamente apertura WhatsApp pero nunca marca envío automáticamente',()=>{
 const f=panel.slice(panel.indexOf('function avisarTimbres('),panel.indexOf('function canjear12('));
 assert.match(f,/ukiAnotarEventoTimbre\(pedido,"whatsapp_abierto"\)/);
 assert.match(f,/pedido.timbreWhatsAppAbiertoEn=abierto.fecha/);
 assert.match(f,/window.open\("https:\/\/wa.me\//);
 assert.doesNotMatch(f,/timbreEnviadoEn\s*=/);
});
test('La confirmación manual crea un evento y registra responsable de turno',()=>{
 const f=panel.slice(panel.indexOf('function ukiMarcarTimbreEnviado('),panel.indexOf('function ukiTimbrePedidoUI('));
 assert.match(f,/ukiAnotarEventoTimbre\(p,"declarado_enviado"\)/);
 assert.match(f,/p.timbreEnviadoPor=confirmado.responsable/);
 assert.match(f,/ukiAnotarEventoTimbre\(p,"confirmacion_retirada"\)/);
 assert.match(panel,/Sin turno identificado/);
});
test('Caja y cierre incluyen desglose por medio y timbres sin alterar los totales',()=>{
 const v=panel.slice(panel.indexOf('function vCajaResumen(){'),panel.indexOf('function vMovimientos(){'));
 const c=panel.slice(panel.indexOf('function vCierre(){'),panel.indexOf('// Fechas independientes:',panel.indexOf('function vCierre(){')));
 for(const x of [v,c]){
  assert.match(x,/ukiAuditoriaPagosUI\(\)/);
  assert.match(x,/ukiAuditoriaTimbresUI\(\)/);
 }
 const func=panel.slice(panel.indexOf('function ukiDesglosePagosPorMedio(){'),panel.indexOf('function vCajaResumen(){'));
 assert.doesNotMatch(func,/\.push\(\{suc:|S\.pedidos\.push|S\.gastos\.push|S\.cierres\.push/);
 assert.match(func,/ukiLineasPago\(p,"productos",subtotal\)/);
 assert.match(func,/ukiLineasPago\(p,"envio",envio\)/);
 assert.match(func,/coincide&&suma===montoEsperado/);
});
