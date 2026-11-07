'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const remote=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
test('Ambos orígenes: primero motivo, luego rechazo y finalmente aceptar',()=>{
 const manual=html.slice(html.indexOf('function ukiWhatsAppFicha('),html.indexOf('function ukiWhatsAppSolicitudesUI('));
 const automático=remote.slice(remote.indexOf('function ukiCartaRemotaFicha('),remote.indexOf('function ukiCartaRemotaAbrir('));
 for(const snippet of [manual,automático]){
  const m=snippet.indexOf('<label class="uki-motivo-rechazo">Motivo del rechazo');
  const r=snippet.indexOf('<button class="sm uki-accion-rechazar"');
  const a=snippet.indexOf('<button class="sm ok uki-accion-aceptar"');
  assert.ok(m>=0&&r>m&&a>r);
  assert.match(snippet,/onchange="ukiMotivoRechazoCambio\(this\)"/);
  assert.match(snippet,/<button class="sm uki-accion-rechazar" type="button" disabled/);
  assert.match(snippet,/Selecciona un motivo/);
  assert.match(snippet,/Rechazar solicitud/);
 }
});
test('El rechazo solo se habilita después de elegir motivo',()=>{
 const fn=html.slice(html.indexOf('function ukiMotivoRechazoCambio('),html.indexOf('function ukiWhatsAppFicha('));
 assert.match(fn,/boton\.disabled=!sel\.value/);
 const context={};vm.createContext(context);
 const action=vm.runInContext('('+fn.replace(/^\s+|\s+$/g,'')+')',context);
 let disabled=true;
 const button={set disabled(v){disabled=v},get disabled(){return disabled}};
 const selection=v=>({value:v,closest:()=>({querySelector:()=>button})});
 action(selection(''));assert.equal(disabled,true);
 action(selection('Cliente canceló'));assert.equal(disabled,false);
 action(selection(''));assert.equal(disabled,true);
});
test('Diseño compacto y legible sin cambios de caja, pagos ni QR',()=>{
 assert.match(html,/\.uki-solicitud-acciones\{display:flex;flex-direction:column/);
 assert.match(html,/\.uki-solicitud-acciones button\.uki-accion-rechazar:disabled/);
 assert.match(html,/\.uki-solicitud-acciones \.uki-motivo-rechazo select:focus-visible/);
 for(const needle of ['ukiQRPermitirCobroDefinitivo','ukiErrorDistribucionPago','ukiCajaAcumulada','ukiMesasUI()','ukiCartaRemotasActualizar','ukiWhatsAppMarcarAceptada'])assert.ok(html.includes(needle),needle);
 assert.match(remote,/ukiCartaApiCambio\(id,'rechazada',motivo\)/);
});
test('El Javascript completo compila',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  new vm.Script(m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2]);
 }
 new vm.Script(remote);
});
