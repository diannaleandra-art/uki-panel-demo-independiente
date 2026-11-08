'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const remota=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
const pos=html.indexOf('function ukiRegistroMismoOrigen(');
const end=html.indexOf('// Cruce preventivo:',pos);
assert.ok(pos>0&&end>pos,'Debe existir función de comparación por origen');
function contexto(){
 const c={S:{suc:'Uki Regimiento Arica'},fechaTurnoRegistro:(p)=>p.op,
  fechaOperativaActual:()=> '2026-11-07'};
 vm.createContext(c);
 vm.runInContext(html.slice(pos,end),c);
 return c;
}
const base={suc:'Uki Regimiento Arica',cartaSolicitudRemotaId:'uuid-1',
 codigoCarta:'735',telefono:'56911112222',textoOriginal:'UKI SUSHI - Pedido 735 - Pollo',op:'2026-11-07'};
test('mismo UUID: duplicado verdadero, aun si difiere folio',()=>{
 const c=contexto();
 assert.equal(c.ukiRegistroMismoOrigen(base,{cartaSolicitudRemotaId:'uuid-1',codigoCarta:'999'}),true);
 assert.equal(c.ukiRegistroMismoOrigen(base,{cartaSolicitudRemotaId:'uuid-2',codigoCarta:'735'}),false);
});
test('folios cortos iguales de día distinto o teléfono distinto no bloquean',()=>{
 const c=contexto();
 const p={...base,cartaSolicitudRemotaId:''};
 assert.equal(c.ukiRegistroMismoOrigen({...p,op:'2026-11-06'},
  {codigoCarta:'735',telefono:p.telefono,texto:p.textoOriginal}),false);
 assert.equal(c.ukiRegistroMismoOrigen(p,
  {codigoCarta:'735',telefono:'56977778888',texto:p.textoOriginal}),false);
 assert.equal(c.ukiRegistroMismoOrigen(p,
  {codigoCarta:'735',telefono:p.telefono,texto:p.textoOriginal}),true);
});
test('dos sucursales no cruzan identificaciones',()=>{
 const c=contexto();
 assert.equal(c.ukiRegistroMismoOrigen({...base,suc:'Uki La Serena'},
  {cartaSolicitudRemotaId:'uuid-1'}),false);
});
test('la reserva central es anterior a cualquier venta local',()=>{
 const r=html.indexOf('await ukiCartaReservarRegistro('),s=html.indexOf('S.pedidos.push(nuevoPedido)');
 assert.ok(r>0&&s>r);
 assert.match(html,/cartaReservaToken:String\(D\.cartaReservaToken\|\|""\)/);
 assert.match(html,/if\(ukiCartaReservaEnCurso\)return/);
 assert.match(html,/Sincroniza Firebase antes de registrar/);
});
test('la confirmación de Neon lleva token y número de pedido guardado',()=>{
 assert.match(remota,/const extra=p\?\.cartaReservaToken\?\{claimToken:p\.cartaReservaToken,pedidoId:String\(p\.id\)\}/);
 assert.match(remota,/await ukiCartaApiCambio\(r\.id,'aceptada','',extra\)/);
 assert.match(remota,/const yaGuardado=\(S\.pedidos\|\|\[\]\)\.find\(p=>ukiRegistroMismoOrigen/);
});
test('preservar pago mixto, cierres y detalle sin nuevo formulario',()=>{
 for(const x of ['ukiErrorDistribucionPago','ukiDatosPago(D,sub)','ukiCajaAcumulada',
  'ukiWhatsAppFicha','ukiSincronizarPropinaPedido','ukiQRPermitirCobroDefinitivo',
  'ukiCartaApiCambio']){
  assert.ok(html.includes(x)||remota.includes(x),x);
 }
});

test('doble clic y cambio de formulario durante reserva no generan dos ventas',()=>{
 assert.match(html,/if\(ukiGuardadoSolicitudEnCurso\)return/);
 assert.match(html,/ukiGuardadoSolicitudEnCurso=true/);
 assert.match(html,/finally\{ukiGuardadoSolicitudEnCurso=false;\}/);
 assert.match(html,/firmaAntesReserva!==JSON\.stringify\(\{sucursal:S\.suc,datos:D\}\)/);
 const guard=html.indexOf('if((S.pedidos||[]).some(p=>p.suc===S.suc&&String(p.cartaSolicitudRemotaId||');
 const add=html.indexOf('S.pedidos.push(nuevoPedido)');
 assert.ok(guard>0&&add>guard);
});

test('solicitudes aceptadas sin vínculo se señalan sin crear ventas',()=>{
 assert.match(remota,/function ukiCartaAceptadasSinVinculo\(\)/);
 assert.match(remota,/r\.estado==='aceptada'&&!ukiCartaPedidoAceptadoEnCaja\(r\)/);
 assert.match(html,/const aceptadasPendientesDeConciliar=/);
 assert.match(html,/Revisar \$\{aceptadasPendientesDeConciliar\.length\}/); 
});

test('revisión visual solo alerta sobre aceptados sin pedido vinculado, jamás sobre rechazados',()=>{
 const context={
  S:{suc:'Uki Regimiento Arica',pedidos:[
   {suc:'Uki Regimiento Arica',id:15,estado:'Pendiente',cartaSolicitudRemotaId:'uuid-aceptada-1'},
   {suc:'Uki La Serena',id:16,estado:'Pendiente',cartaSolicitudRemotaId:'uuid-aceptada-2'}
  ]},
  ukiCartaRemotasSucursal:()=>[
   {id:'uuid-aceptada-1',estado:'aceptada'},
   {id:'uuid-aceptada-2',estado:'aceptada'},
   {id:'uuid-rechazada',estado:'rechazada'},
   {id:'uuid-pendiente',estado:'pendiente'}
  ]
 };
 vm.createContext(context);
 const from=remota.indexOf('function ukiCartaPedidoAceptadoEnCaja(');
 const until=remota.indexOf('let ukiCartaConfirmando=',from);
 assert.ok(from>0&&until>from);
 vm.runInContext(remota.slice(from,until),context);
 assert.equal(context.ukiCartaAceptadasSinVinculo().length,1);
 assert.equal(context.ukiCartaAceptadasSinVinculo()[0].id,'uuid-aceptada-2');
 assert.match(html,/sin vínculo visible en esta copia de caja/);
 assert.match(html,/No las ingreses otra vez ni las marques pagadas/);
});
