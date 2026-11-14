import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const api=require('../api/romo-panel-diagnostico-qa.js');
const src=readFileSync(new URL('../api/romo-panel-diagnostico-qa.js',import.meta.url),'utf8');
const qa={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'qa/integracion-panel-unico-romo-serena-20261112',
 ROMO_FIN_SYNC_QA_BRANCH:'qa/integracion-panel-unico-romo-serena-20261112',
 ROMO_FIN_OWNER_QA_ENABLED:'true',
 ROMO_CIERRES_QA_DATABASE_URL:'postgresql://qa:fake@ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech/romos_sushi'
};
test('diagnóstico solo admite branch y base Romo QA',()=>{
 const cfg=api._testing.config(qa);
 assert.ok(cfg&&cfg.origin.startsWith('https://uki-sushi-panel-'));
 for(const bad of [
  {VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},
  {ROMO_FIN_SYNC_QA_BRANCH:'main'}, {ROMO_FIN_OWNER_QA_ENABLED:'false'},
  {ROMO_CIERRES_QA_DATABASE_URL:'postgresql://qa:fake@ep-damp-sun-beofcvis.c-9.us-east-2.aws.neon.tech/romos_sushi'},
  {ROMO_CIERRES_QA_DATABASE_URL:'postgresql://qa:fake@ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech/neondb'}
 ])assert.equal(api._testing.config({...qa,...bad}),null);
});
test('sin origen autorizado se niega antes de consultar Neon',async()=>{
 const prior={};for(const k of Object.keys(qa)){prior[k]=process.env[k];process.env[k]=qa[k];}
 try{
  const headers={};
  const res={setHeader:(k,v)=>headers[k]=v,status(n){this.code=n;return this},
   json(p){this.body=p;return this},end(){return this}};
  await api({method:'GET',headers:{origin:'https://ejemplo.no-autorizado.com'}},res);
  assert.equal(res.code,403);assert.equal(res.body.ok,false);
  assert.equal(headers['Cache-Control'],'private, no-store, max-age=0');
 }finally{for(const k of Object.keys(qa))if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];}
});
test('Romo diagnostico GET con Google y rol dueños, sin escrituras',()=>{
 assert.match(src,/req.method!=='GET'/);
 assert.match(src,/resolveRomoIdentity/);
 assert.match(src,/identity.role!=='duenos'/);
 assert.match(src,/operacionesHabilitadas:false/);
 assert.doesNotMatch(src,/INSERT INTO|UPDATE public|DELETE FROM|RETURNING snapshot/);
 assert.doesNotMatch(src,/SELECT [^\n]*cliente|SELECT [^\n]*telefono/);
});
