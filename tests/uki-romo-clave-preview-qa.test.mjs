import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
test('Romo en QA no solicita contraseña que no puede verificar',()=>{
 const section=code.slice(code.indexOf('function vInicio(){'),code.indexOf('function vPedidos(){'));
 assert.match(section,/if\(esRomo&&!ROMO_PANEL_INTEGRACION_HABILITADA_QA\)/);
 assert.match(section,/la verificación remota sigue desactivada/);
 assert.match(section,/Ver avance de Romo \(solo lectura\)/);
 assert.match(section,/No cambies tu clave/);
 assert.match(code,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
test('la vista de Romo no autentica ni entra a la caja real',()=>{
 const from=code.indexOf('function ukiRomoVerPreparacionQA(){'),to=code.indexOf('/* Romo usa el mismo selector',from);
 const block=code.slice(from,to);
 assert.match(block,/S\.romoIngresadoQA=false/);
 assert.match(block,/S\.pinSuc=null/);
 assert.match(block,/S\.vista='inicio'/);
 assert.doesNotMatch(block,/localStorage|cifrarLocal|crearPuenteRomoOperativo|ukiRomoControlPanelQA/);
 assert.match(code,/Vista informativa de Romo · sin sesión ni acceso a pedidos reales/);
});
test('las sucursales Uki y su acceso operativo no se modifican',()=>{
 assert.match(code,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(code,/async function entrarDatosSucursal\(s,password\)/);
 assert.match(code,/const UKI_OPERACION_HABILITADA=location\.hostname==='diannaleandra-art\.github\.io'/);
});
