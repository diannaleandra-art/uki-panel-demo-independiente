'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const remote=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
test('Compactas, rechazo y motivo primero y aceptar abajo',()=>{
 assert.match(html,/\.uki-solicitud-acciones\{display:grid/);
 assert.match(html,/\.uki-urgentes-carta\{padding:9px!important/);
 const a=remote.slice(remote.indexOf('function ukiCartaRemotaFicha('),remote.indexOf('function ukiCartaRemotaAbrir('));
 assert.ok(a.indexOf('ukiCartaRemotaRechazar(')<a.indexOf('ukiCartaRemotaAbrir('));
 assert.match(a,/uki-accion-rechazar/);
 assert.match(a,/uki-motivo-rechazo/);
 assert.match(a,/uki-accion-aceptar/);
 const m=html.slice(html.indexOf('function ukiWhatsAppFicha('),html.indexOf('function ukiWhatsAppSolicitudesUI('));
 assert.ok(m.indexOf('ukiWhatsAppRechazar(')<m.indexOf('ukiWhatsAppAceptarYRevisar('));
});
test('No tocar caja, QR ni respaldo',()=>{
 for(const key of ['ukiMesasUI()','ukiQRPermitirCobroDefinitivo','ukiDatosPago(D,sub)','ukiErrorDistribucionPago','ukiCajaAcumulada','ukiCartaRemotasActualizar()'])assert.ok(html.includes(key),key);
});
test('JS válido',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  new vm.Script(m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2]);
 }
 new vm.Script(remote);
});
