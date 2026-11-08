'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const remote=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
const start=html.indexOf('function ukiSolicitudAutomaticaYaRecibida(');
const end=html.indexOf('function ukiWhatsAppSolicitudDuplicada(',start);
assert.ok(start>=0&&end>start);
function createContext(){
 const context={
  S:{suc:'Uki Regimiento Arica',solicitudesWhatsApp:[],pedidos:[]},
  ukiCartaRemotasSucursal:()=>[
   {id:'auto-one',branch:'arica',estado:'pendiente',codigo_pedido:'246',mensaje:'UKI SUSHI - Pedido 246 / Cliente'},
   {id:'auto-other',branch:'arica',estado:'rechazada',codigo_pedido:'250',mensaje:'No realizar'}
  ]
 };
 vm.createContext(context);
 vm.runInContext(html.slice(start,end),context);
 return context;
}
test('Pegar WhatsApp: rechaza si el folio ya está en la bandeja automática',()=>{
 const x=createContext();
 assert.match(x.ukiSolicitudAutomaticaYaRecibida({codigoCarta:'246',texto:'UKI SUSHI - Pedido 246 / Cliente'}),/ya está en Pedidos/);
 assert.equal(x.ukiSolicitudAutomaticaYaRecibida({codigoCarta:'246'}),''); // Folio solo no basta.
 assert.equal(x.ukiSolicitudAutomaticaYaRecibida({codigoCarta:'999'}),'');
 assert.equal(x.ukiSolicitudAutomaticaYaRecibida({codigoCarta:'250'}),'');
 assert.equal(x.ukiSolicitudAutomaticaYaRecibida({codigoCarta:'246'},'auto-one'),'');
});
test('Si falta código, comparar texto exacto ayuda a detectar pegados dobles',()=>{
 const x=createContext();
 assert.match(x.ukiSolicitudAutomaticaYaRecibida({texto:'UKI SUSHI - Pedido 246 / Cliente'}),/ya está en Pedidos/);
 assert.equal(x.ukiSolicitudAutomaticaYaRecibida({texto:'Pedido distinto del cliente'}),'');
});
test('Comprobar una solicitud manual pendiente antes de aceptar la automática',()=>{
 const x=createContext();
 x.S.solicitudesWhatsApp.push({id:'paste-one',suc:x.S.suc,estado:'pendiente',codigoCarta:'246'});
 assert.match(x.ukiSolicitudPegadaYaRecibida({codigoCarta:'246'}),/solicitud pegada/);
 assert.equal(x.ukiSolicitudPegadaYaRecibida({codigoCarta:'246'},'paste-one'),'');
});
test('Los dos caminos comprueban duplicados antes de guardar o aceptar',()=>{
 assert.match(html,/ukiWhatsAppSolicitudDuplicada\(datos\)\|\|ukiSolicitudAutomaticaYaRecibida\(datos\)/);
 assert.match(html,/ukiSolicitudAutomaticaYaRecibida\(D,String\(D\.cartaSolicitudRemotaId\|\|''\)\)/);
 assert.match(html,/ukiSolicitudPegadaYaRecibida\(D,String\(ukiSolicitudWhatsAppActiva\|\|''\)\)/);
 assert.match(remote,/const yaGuardado=\(S\.pedidos\|\|\[\]\)\.find/);
 assert.match(remote,/const pegada=ukiSolicitudPegadaYaRecibida\(\{codigoCarta:folio\}\)/);
});
test('Mantener formularios de pagos mixtos, QR, cierres y timbres',()=>{
 for(const name of ['ukiErrorDistribucionPago','ukiDatosPago(D,sub)','ukiCajaAcumulada','ukiMesasUI()','ukiQRPermitirCobroDefinitivo','ukiCartaRemotasActualizar()','ukiWhatsAppMarcarAceptada']){
  assert.ok(html.includes(name),name);
 }
});
test('Javascripts sin errores sintácticos',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  new vm.Script(m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2]);
 }
 new vm.Script(remote);
});
