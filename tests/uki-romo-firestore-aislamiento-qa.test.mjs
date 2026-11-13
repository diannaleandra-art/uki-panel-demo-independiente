import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
test('ni Firebase ni localStorage de Uki incluyen a Romo',()=>{
 assert.match(s,/window\.ukiQAGet=\(\)=>SUCURSALES\.includes\(S\.suc\)/);
 assert.match(s,/if\(!SUCURSALES\.includes\(S\.suc\)\)return Promise\.resolve\(true\)/);
 assert.match(s,/if\(!SUCURSALES\.includes\(S\.suc\)\|\|!validarEstadoSucursal\(data,S\.suc\)\)/);
 assert.match(s,/Abre una sucursal Uki, no Romo, para utilizar Firebase/);
});
test('se mantiene el conjunto original de sucursales y Romo solo en selector QA',()=>{
 assert.match(s,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(s,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
 assert.match(s,/ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
