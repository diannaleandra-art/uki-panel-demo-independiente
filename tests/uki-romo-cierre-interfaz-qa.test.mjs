import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const panel=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
test('apertura y cierre definitivo solo en Caja Romo, desactivados',()=>{
 assert.match(panel,/const ROMO_PANEL_CIERRE_HABILITADO_QA=location\.hostname===/);
 assert.match(panel,/function romoFormularioCierreQA\(\)/);
 assert.match(panel,/return tabs\+romoFormularioCierreQA\(\)\+'<section class="card"><h2>Caja · Romo La Serena/);
 for(const id of ['romoAbrirResponsable','romoAbrirBase','romoCerrarResponsable',
 'romoCerrarContado','romoCerrarObs','romoCerrarDiferencia','romoCerrarPendientes',
 'romoCerrarDefinitivo','romoCerrarConfirmar']){
  // Los checkbox usan nombres específicos de aceptación.
  if(id==='romoCerrarDiferencia'||id==='romoCerrarPendientes')continue;
  assert(panel.includes('id="'+id+'"'),id);
 }
 assert.match(panel,/romoCerrarAceptarDiferencia/);
 assert.match(panel,/romoCerrarAceptarPendientes/);
});
test('la revisión no escribe: usa una copia del estado y firma los datos',()=>{
 assert.match(panel,/function romoRevisarCierreQA\(\)/);
 assert.match(panel,/JSON\.parse\(JSON\.stringify\(datosSoloSucursal\(\)\)\)/);
 assert.match(panel,/prepararCierreDefinitivoRomoQA\(copia,datos\)/);
 assert.match(panel,/romoCierreRevisadoQA=\{firma,datos,resumen\}/);
 assert.match(panel,/Cambió la caja o el formulario/);
});
test('confirmación exige checkbox, doble revisión y autorización activa',()=>{
 assert.match(panel,/if\(!ROMO_PANEL_INTEGRACION_HABILITADA_QA\|\|!ROMO_PANEL_CIERRE_HABILITADO_QA/);
 assert.match(panel,/id="romoCerrarDefinitivo"/);
 assert.match(panel,/if\(!confirm\('¿CONFIRMAS EL CIERRE DEFINITIVO/);
 assert.match(panel,/uk(i|i)RomoControlPanelQA\.ejecutarTurno\(\{tipo:'cierre',datos:p\.datos\}\)/);
 assert.match(panel,/CIERRE NO CONFIRMADO EN PANTALLA/);
});
test('la ruta Uki de cierre original queda preservada y bloquea Romo',()=>{
 assert.match(panel,/async function cerrar\(\)/);
 assert.match(panel,/if\(S\.suc===ROMO_SUCURSAL_QA\)\{\s*aviso\('Romo aún no tiene caja operativa/);
 assert.match(panel,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=location\.hostname===/);
});

test('apertura Romo deja distinguir base de efectivo y caja chica inicial',()=>{
 assert.match(panel,/id="romoAbrirCajaChica"/);
 assert.match(panel,/cajaChicaInicial=Number\(\$\('romoAbrirCajaChica'\)\?\.value\)/);
 assert.match(panel,/base,cajaChicaInicial,responsable/);
});
