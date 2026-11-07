'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const module=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
test('La página carga las solicitudes desde un módulo, sin duplicar el formulario existente',()=>{
 assert.match(html,/<script src="\.\/uki-carta-remotas-panel\.js" defer><\/script>/);
 assert.match(html,/ukiCartaRemotasActualizar\(\)/);
 assert.match(html,/visiblesRemotas\.map\(r=>ukiCartaRemotaFicha\(r\)\)/);
 assert.match(html,/ukiCartaRemotaActiva\)\{ukiCartaRemotaActiva=null/);
 assert.match(html,/cartaSolicitudRemotaId:String\(D.cartaSolicitudRemotaId\|\|""\)/);
 assert.match(html,/ukiWhatsAppMarcarAceptada\(nuevoPedido\)/);
 assert.match(html,/const UKI_MESAS_PANEL_ACTIVADO=true/);
});
test('La página mantiene caja, pagos mixtos y QR',()=>{
 for(const required of ['ukiDatosPago(D,sub)','ukiErrorDistribucionPago','ukiCajaAcumulada','ukiMesasUI()','ukiQRPermitirCobroDefinitivo','guardarEnLocalStorage','window.ukiCancelacionNubeLista'])assert.ok(html.includes(required),required);
});
test('Javascript del panel compilable',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  const js=m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2];
  new vm.Script(js);
 }
 new vm.Script(module);
});
test('La solicitud sigue separada de caja hasta aceptación y sincronización',()=>{
 assert.match(module,/if\(!window\.ukiCancelacionNubeLista\?\.\(\)\)/);
 assert.match(module,/cartaSolicitudRemotaId=id/);
 assert.match(module,/estado==='pendiente'/);
 assert.match(module,/ukiCartaApiCambio\(r.id,'aceptada'\)/);
 assert.match(module,/r\.estado==='pendiente'/);
});
