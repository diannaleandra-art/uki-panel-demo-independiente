'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const ingredient=require('../api/uki-ingredientes-armado-live.js')._test;
const photos=require('../api/uki-carta-fotos-live.js')._test;
const db=require('../lib/uki-inventario-db-live.cjs');
const REF='integracion/uki-promociones-ingredientes-seguros-qa-20261109';
const QA_URL='https://uki-sushi-panel-demo-qa-diannaleandra-7046.vercel.app';
const QA_HOST=[...db.QA_HOSTS][0],LIVE_HOST=[...db.LIVE_HOSTS][0];
const env={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:REF,VERCEL_URL:QA_URL.slice(8),
 UKI_INVENTARIO_QA_ENABLED:'true',
 UKI_INVENTARIO_QA_DATABASE_URL:'postgresql://qa-user:qa-dummy@'+QA_HOST+'/qa',
 UKI_INVENTARIO_LIVE_DATABASE_URL:'postgresql://live-user:live-dummy@'+LIVE_HOST+'/neondb',
 UKI_PROMOS_VISIBILIDAD_ENABLED:'true'
};
test('Solo el commit preview aislado puede habilitar vegetales y fotos (si hay credenciales QA)',()=>{
 assert.equal(ingredient.enabled(env),true);
 assert.equal(photos.enabled(env),true);
 assert.equal(ingredient.allow(QA_URL,env),true);
 assert.equal(photos.sameQAOrigin(QA_URL,env),true);
 assert.equal(photos.originAllowed(QA_URL,env),true);
 assert.equal(db.url(env).includes(QA_HOST),true);
});
test('Un origen de Vercel diferente no puede editar ni consultar el preview privado',()=>{
 const attacker='https://uki-sushi-panel-otro-diannaleandra-7046.vercel.app';
 assert.equal(ingredient.allow(attacker,env),false);
 assert.equal(photos.sameQAOrigin(attacker,env),false);
 assert.equal(photos.originAllowed(attacker,env),false);
});
test('Sin bandera QA, o en otra rama, no se abre acceso de preview',()=>{
 for(const override of [
  {UKI_INVENTARIO_QA_ENABLED:'false'},
  {VERCEL_GIT_COMMIT_REF:'main'},
  {VERCEL_GIT_COMMIT_REF:'feature/random'},
  {VERCEL_ENV:'development'},
  {VERCEL_ENV:'production',UKI_INGREDIENTES_ARMADO_ENABLED:'false'}
 ]){
  const e={...env,...override};
  assert.equal(ingredient.enabled(e),false);
  assert.equal(photos.enabled(e),false);
  assert.equal(photos.sameQAOrigin(QA_URL,e),false);
 }
});
test('Preview rechaza host Neon de producción incluso si tiene URL disponible',()=>{
 const wrong={...env,UKI_INVENTARIO_QA_DATABASE_URL:'postgresql://qa-user:qa-dummy@'+LIVE_HOST+'/neondb'};
 assert.equal(db.url(wrong),null);
 assert.equal(db.url({...env,UKI_INVENTARIO_QA_DATABASE_URL:''}),null);
 assert.equal(db.url({...env,UKI_INVENTARIO_QA_ENABLED:'false'}),null);
});
test('Las fotografías y vegetales de QA siguen exigiendo autenticación Google para guardar',()=>{
 const photo=fs.readFileSync('api/uki-carta-fotos-live.js','utf8');
 const veg=fs.readFileSync('api/uki-ingredientes-armado-live.js','utf8');
 assert.match(photo,/const uid=await authorize\(req,env\)\.catch\(\(\)=>null\);if\(!uid\)return fail\(res,403/);
 assert.match(veg,/const uid=await userFromToken\(req,e\)\.catch\(\(\)=>null\)/);
 assert.match(photo,/if\(origin!=='https:\/\/diannaleandra-art\.github\.io'&&!sameQAOrigin\(origin,env\)\)/);
 assert.match(veg,/if\(origin!=='https:\/\/diannaleandra-art\.github\.io'&&!\(qa\(e\)&&QA_PANEL\.test\(origin\)\)&&!sameQAOrigin\(origin,e\)\)/);
});
