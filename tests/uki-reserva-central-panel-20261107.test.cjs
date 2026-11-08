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
