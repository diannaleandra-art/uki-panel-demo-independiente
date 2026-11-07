'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const admin=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
test('Editor de ingredientes dentro del panel existente',()=>{
 const original=html.indexOf('<script src="./uki-carta-precios-admin.js"');
 const inserted=html.indexOf('<script src="./uki-armado-ingredientes-admin.js"');
 assert.ok(original>=0&&inserted>original);
 assert.match(admin,/Administrar ingredientes del armado/);
 assert.match(admin,/syncCategory\(box\)/);
 assert.match(admin,/data-uki-ingredient="surcharge"/);
 assert.match(admin,/Disponible para elegir/);
 assert.match(admin,/Inicia sesión|Accede como administradora con Google/);
});
test('Panel conserva cajas, cuentas, QR y pagos mixtos',()=>{
 const remotas=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
 for(const name of ['ukiMesasUI()','ukiErrorDistribucionPago','ukiCajaAcumulada','ukiQRPermitirCobroDefinitivo','ukiCartaRemotasActualizar','ukiWhatsAppRechazar']){

  assert.ok(html.includes(name),name);
 }
 assert.ok(remotas.includes('ukiCartaRemotaAbrir'), 'bandeja automática de carta sigue presente');
});
test('Scripts de producción y nuevo módulo no tienen errores sintácticos',()=>{
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  new vm.Script(m[1].includes('module')?m[2].replace(/^\s*import[^\n]*$/gm,''):m[2]);
 }
 new vm.Script(admin);
});

test('Inventario del trabajador es visible sin duplicar accesos ni exponer caja',()=>{
 const inv=fs.readFileSync('firebase/uki-inventario-admin-embebido.js','utf8');
 const old=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
 const role=fs.readFileSync('api/inventario-turno-live.js','utf8');
 assert.equal((inv.match(/id="ukiInvWorkerAccess"/g)||[]).length,1,'Un solo acceso a inventario del trabajador');
 assert.equal((inv.match(/id="invBranch"/g)||[]).length,1,'Conservar sucursal única del panel');
 assert.match(inv,/Abrir acceso del trabajador/);
 assert.match(inv,/Administración: cuenta Google autorizada del panel/);
 assert.match(inv,/El trabajador cuenta y recibe mercadería con su código/);
 assert.match(old,/reportes:\['ukiReponerPanel','ukiHistorial'\]/);
 assert.ok(role.includes("if(!await pin.autorizar"),'PIN del trabajador obligatorio');
 assert.ok(!inv.includes('api/cierre')&&!role.includes("action==='cierre'"),'No dar cierre al trabajador');
});
