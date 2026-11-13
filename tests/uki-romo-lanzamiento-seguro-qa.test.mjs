import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Romo continúa protegido hasta aprobación de publicación',()=>{
 const panel=get('firebase/uki-sushi-local.html');
 const api=get('api/romo-estado-operativo-qa.js');
 const cliente=get('firebase/uki-romo-operativo-qa.mjs');
 const cierre=get('firebase/uki-romo-cierre-definitivo-qa.mjs');
 for(const flag of ['ROMO_PANEL_INTEGRACION_HABILITADA_QA','ROMO_PANEL_MOVIMIENTOS_HABILITADOS_QA','ROMO_PANEL_CIERRE_HABILITADO_QA'])
  assert(panel.includes('const '+flag+'=false'),flag);
 assert(cliente.includes('ROMO_OPERATIVO_CLIENTE_HABILITADO_QA=false'));
 assert(cierre.includes('ROMO_CIERRE_DEFINITIVO_HABILITADO_QA=false'));
 assert(api.includes("ROMO_CIERRE_DEFINITIVO_LIVE_ENABLED!=='true'"));
 assert(api.includes("ROMO_OPERATIVO_LIVE_ENABLED!=='true'"));
});
test('se conserva cierre Uki, sin añadir Romo a sus sucursales productivas',()=>{
 const panel=get('firebase/uki-sushi-local.html');
 assert(panel.includes('const SUCURSALES=["Uki Regimiento Arica","Uki La Serena"]'));
 assert(panel.includes('async function cerrar()'));
});