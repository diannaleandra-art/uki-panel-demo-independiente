import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {romoOperativoConfig} from '../lib/romo-estado-operativo-qa.mjs';
import {romoSolicitudesConfig} from '../lib/romo-solicitudes-carta-qa.mjs';
const branch='qa/integracion-panel-unico-romo-serena-20261112';
const qa={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch,ROMO_FIN_SYNC_QA_BRANCH:branch,
 ROMO_OPERATIVO_QA_ENABLED:'true',ROMO_SOLICITUDES_QA_ENABLED:'true',
 ROMO_CIERRES_QA_DATABASE_URL:'postgresql://qa:fake@ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech/romos_sushi',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://uki-sushi-panel-git-qa-integracion-pa-261e5e-diannaleandra-7046.vercel.app',
 ROMO_CARTA_ALLOWED_ORIGIN:'https://uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046.vercel.app',
 ROMO_SOLICITUDES_RATE_SALT:'qa-only-test-fixture-long-salt-123456'
};
test('Neon de Romo acepta SOLO preview exacto y origen privado del panel',()=>{
 const c=romoOperativoConfig(qa);
 assert.equal(c?.storeId,'romo:serena');
 assert.equal(c?.qaOnly,true);
 assert.equal(c?.origin,qa.ROMO_PANEL_ALLOWED_ORIGIN);
 assert.equal(romoSolicitudesConfig(qa)?.qaOnly,true);
 for(const changed of [
  {VERCEL_ENV:'production'},
  {VERCEL_GIT_COMMIT_REF:'main'},
  {ROMO_FIN_SYNC_QA_BRANCH:'main'},
  {ROMO_OPERATIVO_QA_ENABLED:'false'},
  {ROMO_CIERRES_QA_DATABASE_URL:'postgresql://qa:fake@ep-damp-sun-beofcvis.c-9.us-east-2.aws.neon.tech/romos_sushi'},
  {ROMO_PANEL_ALLOWED_ORIGIN:'https://uki-sushi-inventario.vercel.app'},
  {ROMO_CIERRES_QA_DATABASE_URL:'postgresql://qa:fake@ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech/neondb'}
 ])assert.equal(romoOperativoConfig({...qa,...changed}),null);
 assert.equal(romoSolicitudesConfig({...qa,ROMO_SOLICITUDES_QA_ENABLED:'false'}),null);
});
test('carta Romo continúa sin poder enviar pedidos al endpoint QA',()=>{
 const api=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(api,/if\(config\.qaOnly\)return fail\(res,403,/);
 assert.match(api,/Pedidos públicos de Romo desactivados en QA/);
 const stateApi=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
 assert.match(stateApi,/ROMO_OPERATIVO_QA_ENABLED/);
 assert.match(stateApi,/ROMO_CIERRE_QA_ENABLED/);
 assert.match(stateApi,/ROMO_CIERRE_RECIBO_QA_ENABLED/);
});
test('panel QA nunca usa localStorage, Firebase o caja de Uki para Romo',()=>{
 const src=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(src,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(src,/if\(!SUCURSALES.includes\(S\.suc\)\)return Promise.resolve\(true\)/);
 assert.match(src,/const UKI_OPERACION_HABILITADA=location\.hostname==='diannaleandra-art\.github\.io'/);
 assert.match(src,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=location\.hostname==='uki-sushi-panel-git-qa-integracion-pa-261e5e-diannaleandra-7046\.vercel\.app'/);
 assert.match(src,/La clave Uki no puede/);
});
