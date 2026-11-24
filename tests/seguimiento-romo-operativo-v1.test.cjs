'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ENV=require('../lib/seguimiento-qa-entorno-v1.cjs');
const config={
 VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'release/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',ROMO_PANEL_PRODUCTION_ENABLED:'true',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel.vercel.app',
 ROMO_SOLICITUDES_LECTURA_QA_ENABLED:'true',ROMO_SEGUIMIENTO_OPERATIVO_ENABLED:'true',
 ROMO_PRIVATE_DATABASE_HOST:'ep-example-romo.neon.tech',
 ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@ep-example-romo.neon.tech/romos_sushi',
 ROMO_SEGUIMIENTO_TOKEN_SECRET_HEX:'a'.repeat(64),
 ROMO_SEGUIMIENTO_CHAT_SECRET_HEX:'b'.repeat(64)
};
test('Romo sólo puede usar la conexión operativa de su release autorizado',()=>{
 const found=ENV.config(config);
 assert.ok(found?.live);
 assert.deepEqual(Object.keys(found.urls),['romo:serena']);
 assert.equal(ENV.makeDb(found,'uki:serena'),null);
 for(const env of [{...config,ROMO_SEGUIMIENTO_OPERATIVO_ENABLED:'false'},
  {...config,VERCEL_GIT_COMMIT_REF:'main'},
  {...config,ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@ep-example-romo.neon.tech/neondb'},
  {...config,SEGUIMIENTO_ROMO_QA_DATABASE_URL:config.ROMO_PRIVATE_DATABASE_URL},
  {...config,UKI_MESAS_LIVE_DATABASE_URL:config.ROMO_PRIVATE_DATABASE_URL}])
  assert.equal(ENV.config(env),null);
});
test('el origen válido queda limitado al panel autorizado',()=>{
 const found=ENV.config(config);
 assert.equal(ENV.validOrigin({headers:{host:'romos-sushi-panel.vercel.app',origin:config.ROMO_PANEL_ALLOWED_ORIGIN}},found),true);
 assert.equal(ENV.validOrigin({headers:{host:'uki-sushi-panel.vercel.app'}},found),false);
 assert.equal(ENV.validOrigin({headers:{host:'romos-sushi-panel.vercel.app',origin:'https://otro.example'}},found),false);
});
