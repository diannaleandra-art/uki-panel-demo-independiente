import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const endpoint=require('../api/romo-prueba-escritura-aislada-qa.js');
const {config,probe,SQL}=endpoint._internalQA;
const qaHost='ep-branch-test-pooler.c-9.us-east-2.aws.neon.tech';
const mainHost='ep-main-test-pooler.c-9.us-east-2.aws.neon.tech';
const env=()=>({
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_QA_PRUEBA_ESCRITURA_ENABLED:'true',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app',
 ROMO_QA_PRUEBA_DB_HOST:qaHost,
 ROMO_QA_PRUEBA_DB_URL:'postgresql://romos_app_service:fake@'+qaHost+'/romos_sushi',
 ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@'+mainHost+'/romos_sushi'
});
const owner=()=>({userId:'fake-owner-qa',brand:'romo',role:'duenos',branches:['serena']});
const payload={operationId:'romo-qa-autorizacion-20261117',expectedRevision:2};

test('Sin habilitación, en producción, con base principal o proyecto ajeno nunca activa',()=>{
 const e=env();
 assert.equal(config({...e,ROMO_QA_PRUEBA_ESCRITURA_ENABLED:undefined}),null);
 assert.equal(config({...e,VERCEL_ENV:'production'}),null);
 assert.equal(config({...e,VERCEL_GIT_COMMIT_REF:'main'}),null);
 assert.equal(config({...e,ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-panel'}),null);
 assert.equal(config({...e,ROMO_QA_PRUEBA_DB_URL:e.ROMO_PRIVATE_DATABASE_URL}),null);
 assert.equal(config({...e,ROMO_QA_PRUEBA_DB_HOST:mainHost,
  ROMO_QA_PRUEBA_DB_URL:e.ROMO_PRIVATE_DATABASE_URL}),null);
 assert.equal(config({...e,ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED:'true'}),null);
 assert.equal(config({...e,ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED:'true'}),null);
 assert.ok(config(e));
});
test('Sólo dueño de Romo puede hacer el registro único sin tocar pedidos',async()=>{
 let calls=0;
 const db={query:async(sql,args)=>{
  calls++;assert.equal(sql,SQL);
  assert.deepEqual(args.slice(0,3),['romo-qa-autorizacion-20261117','romo:serena',2]);
  assert.match(args[3],/^[a-f0-9]{64}$/);
  return [{operation_id:payload.operationId,observed_revision:2}];
 }};
 const ok=await probe({db,identity:owner(),body:payload});
 assert.equal(ok.ok,true);
 assert.equal(ok.pedidoCancelado,false);
 assert.equal(ok.pagosModificados,false);
 assert.equal(ok.cajaModificada,false);
 assert.equal(calls,1);
 assert.match(SQL,/INSERT INTO public\.romo_prueba_escritura_aislada_qa_v1/);
 assert.doesNotMatch(SQL,/\bUPDATE\b|\bDELETE\b/i);
});
test('Rechaza agendador, inventario, otro local y otros paquetes sin acceder a DB',async()=>{
 let calls=0;
 const db={query:async()=>{calls++;return []}};
 for(const ident of [
  {...owner(),role:'agendador'},{...owner(),role:'inventario'},
  {...owner(),brand:'uki'},{...owner(),branches:['arica']}
 ]){
  await assert.rejects(probe({db,identity:ident,body:payload}));
 }
 for(const bad of [{...payload,expectedRevision:3},{...payload,operationId:'otra'},
  {...payload,contenidos:{pedido:1}},{}]){
  await assert.rejects(probe({db,identity:owner(),body:bad}));
 }
 assert.equal(calls,0);
});
test('Un reintento no se confirma (0 filas) y no puede anunciar guardado',async()=>{
 await assert.rejects(probe({
  db:{query:async()=>[]},identity:owner(),body:payload
 }),e=>e.code==='REPLAY');
});
test('Migración QA sin permisos de editar/borrar; ruta no escribe estado real',()=>{
 const migration=readFileSync(new URL('../migrations/qa/romo_prueba_escritura_aislada_20261117.sql',import.meta.url),'utf8');
 assert.match(migration,/REVOKE UPDATE, DELETE/);
 assert.match(migration,/GRANT SELECT, INSERT/);
 assert.doesNotMatch(migration,/\bUPDATE\s+public\.romo_estado_operativo_v1/i);
 const code=readFileSync(new URL('../api/romo-prueba-escritura-aislada-qa.js',import.meta.url),'utf8');
 assert.match(code,/esOrigenAutorizadoRomoQA/);
 assert.match(code,/resolveRomoIdentity/);
 assert.match(code,/identity\.role!=='duenos'/);
});
