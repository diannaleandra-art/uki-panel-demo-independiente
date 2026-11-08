'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const a=html.indexOf('function ukiCobrosRealesMedios(');
const b=html.indexOf('function ukiQREsCorreccionDePagoExistente(',a);
assert.ok(a>0&&b>a);
const MEDIA=['Efectivo','Transferencia','Débito','Crédito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
function fixture(){
 const c={MEDIOS:MEDIA,APPS:['Uber Eats','PedidosYa','Rappi'],ahora:()=>'2026-11-08T21:00:00',
  ukiLineasPago:(p,tipo,monto)=>monto>0?[{medio:tipo==='productos'?p.medio:p.medioEnvio||'Efectivo',monto}]:[],
  ukiMontoProductosOtroLocal:()=>0,ukiMontoEnvioOtroLocal:()=>0,
  ukiPagoDeliveryDesglose:()=>({dia:0,anterior:0,medioDia:'Efectivo',medioAnterior:'Efectivo',conceptoAnterior:'',efectivo:0,total:0}),
  cajaDelDia:()=>({base:0,apps:{}}),delSucHoy:p=>p,fmt:n=>'$'+n,
  S:{pedidos:[],gastos:[],retiros:[],propinas:[],deliveriesManuales:[]}};
 vm.createContext(c);
 vm.runInContext(html.slice(a,b),c);
 const start=html.indexOf('function totales(){'),end=html.indexOf('\nfunction vCaja(){',start);
 assert.ok(start>0&&end>start);
 vm.runInContext(html.slice(start,end),c);
 const old={id:244,suc:'Uki Regimiento Arica',estado:'Pendiente',pagado:true,
  subtotal:18000,total:18000,medio:'Efectivo',medioEnvio:'Efectivo',modalidad:'Retiro',envio:0};
 c.S.pedidos=[old];return {c,old};
}
test('Un pedido de 18 mil corregido a 15 mil queda con 3000 por devolver y caja intacta',()=>{
 const {c,old}=fixture(),nuevo={...old,subtotal:15000,total:15000};
 nuevo.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(old,nuevo,false);
 c.S.pedidos=[nuevo];const t=c.totales();
 assert.equal(nuevo.ajusteCobroPendiente.saldo,3000);
 assert.equal(t.medios.Efectivo,18000);
 assert.equal(t.totalMedios,18000);
 assert.equal(t.ventaCorregida,15000);
 assert.equal(t.correccionesPendientes,1);
});
test('Cuando realmente devuelven 3000, la caja reconoce 15000 y no descuenta dos veces',()=>{
 const {c,old}=fixture(),nuevo={...old,subtotal:15000,total:15000};
 nuevo.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(old,nuevo,true);
 c.S.pedidos=[nuevo];const t=c.totales();
 assert.equal(nuevo.ajusteCobroPendiente,null);
 assert.equal(t.medios.Efectivo,15000);
 assert.equal(t.correccionesPendientes,0);
});
test('Un precio que aumenta sin cobrar aún no inventa ingresos',()=>{
 const {c,old}=fixture(),nuevo={...old,subtotal:21000,total:21000};
 nuevo.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(old,nuevo,false);
 c.S.pedidos=[nuevo];const t=c.totales();
 assert.equal(t.medios.Efectivo,18000);
 assert.equal(t.ventaCorregida,21000);
 assert.equal(nuevo.ajusteCobroPendiente.saldo,-3000);
});
test('Corregir dos veces sin devolver mantiene siempre la caja original',()=>{
 const {c,old}=fixture(),a={...old,subtotal:15000,total:15000};
 a.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(old,a,false);
 const b={...a,subtotal:14000,total:14000};
 b.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(a,b,false);
 c.S.pedidos=[b];const t=c.totales();
 assert.equal(t.totalMedios,18000);
 assert.equal(t.ventaCorregida,14000);
 assert.equal(b.ajusteCobroPendiente.saldo,4000);
});
test('Cambiar forma de pago corrige el medio sin generar otro pedido ni doble cobro',()=>{
 const {c,old}=fixture(),nuevo={...old,medio:'Transferencia'};
 nuevo.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(old,nuevo,true);
 c.S.pedidos=[nuevo];const t=c.totales();
 assert.equal(t.medios.Transferencia,18000);
 assert.equal(t.medios.Efectivo,0);
});
test('Si se desmarca pagado sin devolución, el cobro original sigue visible como pendiente',()=>{
 const {c,old}=fixture(),nuevo={...old,pagado:false};
 nuevo.ajusteCobroPendiente=c.ukiPrepararAjusteCobro(old,nuevo,false);
 c.S.pedidos=[nuevo];const t=c.totales();
 assert.equal(t.medios.Efectivo,18000);
 assert.equal(t.correccionesPendientes,1);
});
test('Solo registrar responsable en toda edición y conservar el cierre disponible',()=>{
 assert.match(html,/¿Quién editó este pedido\?/);
 assert.match(html,/ukiTimbreResponsableActual\(\)/);
 assert.match(html,/p\.correccionesTurno\.push/);
 assert.match(html,/if\(!esDelPeriodo\(snapshot\)\)/);
 assert.doesNotMatch(html,/Responsable y motivo de la corrección del pedido/);
 assert.doesNotMatch(html,/if\(t\.correccionesPendientes\)\{/);
 assert.match(html,/ukiCierreConfirmadoPedido\(p\)/);
});

test('Editar solo nombre y WhatsApp no genera una autorización financiera innecesaria',()=>{
 const {c,old}=fixture();
 const copy={...old,cliente:'Nuevo cliente',telefono:'56988881234',pagosProductos:[],pagosEnvio:[],medioEnvio:'Efectivo'};
 assert.equal(c.ukiPagoModificado(old,copy),false);
});
test('Cambiar precio, productos o forma de pago sí exige explicación',()=>{
 const {c,old}=fixture();
 const producto={nombre:'Rollo',cantidad:1,precioUnit:18000,detalle:''};
 const original={...old,productos:[producto]};
 assert.equal(c.ukiPagoModificado(original,{...original,total:15000}),true);
 assert.equal(c.ukiPagoModificado(original,{...original,productos:[{...producto,precioUnit:15000}]}),true);
 assert.equal(c.ukiPagoModificado(original,{...original,medio:'Transferencia'}),true);
});
