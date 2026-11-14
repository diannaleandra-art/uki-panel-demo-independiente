import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
test('Romo usa pestaña Inventario del mismo panel, sin la API de Uki',()=>{
 assert.match(s,/function vRomoInventarioQA\(\)/);
 assert.match(s,/inventario:\(\)=>S\.suc===ROMO_SUCURSAL_QA\?vRomoInventarioQA\(\):window\.ukiInventarioPanelHTML/);
 assert.match(s,/const ROMO_INVENTARIO_ENDPOINT_QA='https:\/\/uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046\.vercel\.app\/api\/romo-inventario-qa'/);
 assert.match(s,/if\(!ROMO_PANEL_INTEGRACION_HABILITADA_QA\|\|!ROMO_INVENTARIO_PANEL_HABILITADO_QA\)/);
 assert.match(s,/const ROMO_INVENTARIO_PANEL_HABILITADO_QA=false/);
});
test('comprobación Google, revisión CAS y estado confirmado antes de mostrar',()=>{
 assert.match(s,/window\.ukiInventarioToken\?\.\(\)/);
 assert.match(s,/expectedRevision:v\.revision,action,args/);
 assert.match(s,/await romoInventarioSolicitudQA\('POST'/);
 assert.match(s,/await romoInventarioCargarQA\(\)/);
 assert.match(s,/romoInventarioVistaQA=\{loaded:false,revision:null/);
});
test('Uki mantiene exactamente su inventario y accesos productivos',()=>{
 assert.match(s,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(s,/window\.ukiInventarioPanelHTML\?\.\(\)/);
 assert.match(s,/function ir\(v\)/);
});

test('el inventario QA nunca usa el dominio de producción y exige la vista Romo',()=>{
 const start=s.indexOf('async function romoInventarioSolicitudQA(');
 const end=s.indexOf('async function romoInventarioCargarQA()',start);
 const body=s.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(body,/ROMO_PANEL_INTEGRACION_HABILITADA_QA/);
 assert.match(body,/location\.hostname!==ROMO_PANEL_DIAG_HOST_QA/);
 assert.match(body,/ROMO_INVENTARIO_ENDPOINT_QA/);
 assert.doesNotMatch(body,/https:\/\/uki-sushi-inventario\.vercel\.app/);
 assert.match(s,/Romo · Neon: lectura confirmada · revisión/);
 assert.match(s,/ventas públicas desactivadas/);
});
