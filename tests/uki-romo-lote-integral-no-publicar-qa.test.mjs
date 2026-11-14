import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const panel=file('firebase/uki-sushi-local.html');
const caja=panel.slice(panel.indexOf('function vRomoCajaConsultaQA(){'),
 panel.indexOf('/* Romo utiliza el MISMO selector'));
test('Romo muestra abrir turno antes del resumen de caja, sin pedir al iPhone desplazarse hasta el final',()=>{
 assert.match(caja,/return romoFormularioCierreQA\(\)\+'<section class="card"><h2>Caja · Romo La Serena/);
 assert.match(caja,/Sin turno abierto confirmado/);
 assert.match(caja,/solicitudes pendientes todavía no son ventas/);
 assert.doesNotMatch(caja,/todavía no.*realizar precierre o cierre definitivo/i);
});
test('un único panel conserva las dos sucursales originales Uki y Romo aparte',()=>{
 assert.match(panel,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(panel,/const ROMO_SUCURSAL_QA="Romo’s Sushi La Serena"/);
 assert.match(panel,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
 assert.match(panel,/Balmaceda 1612, La Serena/);
});
test('las ocho áreas están en el código QA, pero el comercio no se considera validado solo por existir',()=>{
 const modules=[
  ['acceso','lib/romo-identidad-servidor-qa.mjs','resolveRomoIdentity'],
  ['pedidos','firebase/uki-romo-guardado-atomico-qa.mjs','guardarSolicitud'],
  ['caja','firebase/uki-romo-movimientos-atomicos-qa.mjs','crearGuardadoCajaRomoQA'],
  ['timbres','firebase/uki-romo-timbres-atomicos-qa.mjs','confirmar'],
  ['cierres','firebase/uki-romo-turnos-atomicos-qa.mjs','crearGuardadoTurnosRomoQA'],
  ['inventario','lib/romo-inventario-qa.mjs','inventario'],
  ['dueños','lib/romo-finanzas-sync-qa.mjs','Romo'],
  ['carta','lib/romo-solicitudes-carta-qa.mjs','romo:serena']
 ];
 for(const [area,path,indicador] of modules){
  const source=file(path);assert.ok(source.includes(indicador),area+' falta en QA');
 }
 const prep=file('lib/romo-preparacion-integral-qa.mjs');
 assert.match(prep,/listoParaPublicar:false,listoParaVentas:false/);
 assert.match(prep,/Falta prueba integral con dos teléfonos reales/);
 assert.match(prep,/Falta autorización final de los dueños/);
});
test('ningún pedido público ni cierre de finanzas se activa mediante esta preparación',()=>{
 assert.match(file('firebase/uki-romo-operativo-qa.mjs'),/ROMO_OPERATIVO_CLIENTE_HABILITADO_QA=false/);
 assert.match(file('firebase/uki-romo-turnos-atomicos-qa.mjs'),/ROMO_TURNOS_GUARDADO_HABILITADO_QA=false/);
 assert.match(file('api/romo-solicitudes-carta-qa.js'),/if\(config\.qaOnly\)return fail\(res,403/);
 assert.match(file('api/romo-estado-operativo-qa.js'),/ROMO_OPERATIVO_QA_ENABLED==='true'/);
 assert.match(file('lib/romo-preparacion-integral-qa.mjs'),/ROMO_DIAGNOSTICO_HABILITADO_QA=false/);
});
