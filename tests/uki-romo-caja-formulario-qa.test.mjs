import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const control=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
test('formulario de movimientos Romo dentro de Caja, cerrado por defecto',()=>{
 assert.match(html,/ROMO_PANEL_MOVIMIENTOS_HABILITADOS_QA=false/);
 assert.match(html,/function ukiRomoFormularioMovimientosQA\(\)/);
 assert.match(html,/ukiRomoFormularioMovimientosQA\(\)\+romoFormularioCierreQA\(\);/);
 assert.match(html,/function ukiRomoGuardarMovimientoDesdeCajaQA\(\)/);
 assert.match(html,/guardarMovimiento\(\{tipo,datos\}\)/);
});
test('no registra sin doble autorización, identidad y sucursal Romo',()=>{
 assert.match(html,/if\(!ROMO_PANEL_INTEGRACION_HABILITADA_QA\|\|/);
 assert.match(html,/!ROMO_PANEL_MOVIMIENTOS_HABILITADOS_QA\|\|/);
 assert.match(html,/S\.suc!==ROMO_SUCURSAL_QA\|\|!ukiRomoControlPanelQA\?\.disponible\(\)/);
 assert.match(html,/if\(ukiRomoMovimientoGuardandoQA\)return/);
 assert.match(html,/Revisa Neon, caja e historial antes de repetir/);
});
test('control reutiliza API cifrada con revisión CAS y no usa caja de Uki',()=>{
 assert.match(control,/async guardarMovimiento\(\{tipo,datos\}=\{\}\)/);
 assert.match(control,/crearGuardadoCajaRomoQA/);
 assert.match(control,/servidor:estadoRemoto/);
 assert.match(control,/revision=next/);
 assert.match(html,/ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
 assert.match(html,/uk(i|i)RomoControlPanelQA\.guardarMovimiento/);
});
