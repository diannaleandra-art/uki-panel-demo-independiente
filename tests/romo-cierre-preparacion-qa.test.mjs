import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {condiciones}=require('../api/romo-cierre-preparacion-qa.js')._internalQA;
const origin='https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app';
const host='romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app';
const env={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_PANEL_ALLOWED_ORIGIN:origin,
 ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:test-only@ep-qa-romo.neon.tech/romos_sushi',
 ROMO_PRIVATE_DATABASE_HOST:'ep-qa-romo.neon.tech',
 ROMO_CIERRE_QA_ENABLED:'false'
};
test('Sin habilitación el cierre sigue bloqueado aunque DB QA esté correctamente aislada',()=>{
 const result=condiciones(env,host);
 assert.equal(result.configuracionSegura,true);
 assert.equal(result.habilitado,false);
 assert.equal(result.disponible,false);
 assert.equal(result.storeId,'romo:serena');
 assert.deepEqual(Object.keys(result).sort(),['configuracionSegura','disponible','habilitado','modo','ok','storeId'].sort());
});
test('Sólo bandera QA explícita más DB aislada y rol de servicio hacen disponible el cierre',()=>{
 const result=condiciones({...env,ROMO_CIERRE_QA_ENABLED:'true'},host);
 assert.equal(result.disponible,true);
 assert.equal(result.habilitado,true);
});
test('No admite main, producción, origen Uki, otro host o proyecto compartido',()=>{
 assert.equal(condiciones({...env,VERCEL_ENV:'production'},host),null);
 assert.equal(condiciones({...env,VERCEL_GIT_COMMIT_REF:'main'},host),null);
 assert.equal(condiciones({...env,ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-inventario'},host),null);
 assert.equal(condiciones(env,'otro-preview.vercel.app'),null);
 assert.equal(condiciones({...env,ROMO_PANEL_ALLOWED_ORIGIN:'https://uki-sushi-inventario.vercel.app'},'uki-sushi-inventario.vercel.app'),null);
});
test('No habilita cierre con usuario distinto a servicio, base o host mal asociado',()=>{
 assert.equal(condiciones({...env,ROMO_PRIVATE_DATABASE_URL:env.ROMO_PRIVATE_DATABASE_URL.replace('romos_app_service','neondb_owner')},host).configuracionSegura,false);
 assert.equal(condiciones({...env,ROMO_PRIVATE_DATABASE_URL:env.ROMO_PRIVATE_DATABASE_URL.replace('/romos_sushi','/neondb')},host).configuracionSegura,false);
 assert.equal(condiciones({...env,ROMO_PRIVATE_DATABASE_HOST:'ep-otra-rama.neon.tech'},host).configuracionSegura,false);
 assert.equal(condiciones({...env,ROMO_PRIVATE_DATABASE_URL:''},host).configuracionSegura,false);
});
test('La precomprobación no escribe ni lee pedidos, ni devuelve datos sensibles',()=>{
 const s=readFileSync(new URL('../api/romo-cierre-preparacion-qa.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\.query\(|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bfetch\(/);
 const r=condiciones(env,host);
 assert.equal(JSON.stringify(r).includes('test-only'),false);
 assert.equal(JSON.stringify(r).includes('neon.tech'),false);
 assert.equal(JSON.stringify(r).includes(origin),false);
});
