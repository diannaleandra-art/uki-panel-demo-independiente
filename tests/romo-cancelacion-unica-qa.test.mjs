import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {validarIntentoCancelacionUnicaRomoQA,guardarCancelacionUnicaRomoQA,
 _sqlCancelacionUnicaQA} from '../lib/romo-cancelacion-una-vez-qa.mjs';

const require=createRequire(import.meta.url);
const {config}=require('../api/romo-cancelacion-una-vez-qa.js')._internalQA;
const prueba=()=>({
 pedidoId:1,expectedRevision:2,categoria:'local',
 motivo:'Pedido de prueba sin cobro',responsable:'Local QA'
});
const dueno={userId:'owner-QA-1',brand:'romo',role:'duenos',branches:['serena']};

test('Sólo pedido #1 revisión 2, datos mínimos sin sobre cifrado',()=>{
 for(const patch of [{pedidoId:2},{expectedRevision:3},{turnoRef:'inventado'},
  {snapshot:{cifrado:'intento'}},{categoria:'otro'},{motivo:'a'}]){
  assert.throws(()=>validarIntentoCancelacionUnicaRomoQA({...prueba(),...patch}));
 }
});
test('Acepta cliente o local; el servidor calcula hashes, no copia motivo',()=>{
 for(const categoria of ['local','cliente']){
  const p=validarIntentoCancelacionUnicaRomoQA({...prueba(),categoria});
  assert.equal(p.pedidoId,1);
  assert.equal(p.revision,2);
  assert.equal(p.categoria,categoria);
  assert.match(p.motivoHash,/^[a-f0-9]{64}$/);
  assert.match(p.responsableHash,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(p).includes('Pedido de prueba'));
 }
});
test('Dueños: INSERT de intención; nunca actualiza snapshot, caja ni pedidos',async()=>{
 const consultas=[];
 const db={query:async(sql,args)=>{consultas.push({sql,args});
  return [{pedido_id:1,revision_observada:2}]}};
 const result=await guardarCancelacionUnicaRomoQA({db,identity:dueno,datos:prueba()});
 assert.equal(result.ok,true);
 assert.equal(result.registro,'intencion_cancelacion_qa');
 assert.equal(result.revisionEstado,2);
 assert.equal(result.cancelado,false);
 assert.equal(result.reconciliacionPendiente,true);
 assert.equal(consultas.length,1);
 assert.equal(consultas[0].sql,_sqlCancelacionUnicaQA);
 assert.match(_sqlCancelacionUnicaQA,/INSERT INTO public\.romo_cancelacion_intencion_qa_v1/);
 assert.doesNotMatch(_sqlCancelacionUnicaQA,/\bUPDATE\b|\bDELETE\b/i);
 assert.match(_sqlCancelacionUnicaQA,/ON CONFLICT \(store_id,pedido_id\) DO NOTHING/);
 assert.equal(consultas[0].args[0],'romo:serena');
 assert.equal(consultas[0].args[1],1);
 assert.equal(consultas[0].args[2],2);
 assert.ok(consultas[0].args.every(x=>typeof x!=='object'));
});
test('Reintento o revisión diferente: 0 filas, no se confirma intención',async()=>{
 let calls=0;const db={query:async()=>{calls++;return []}};
 await assert.rejects(guardarCancelacionUnicaRomoQA({db,identity:dueno,datos:prueba()}),
  /duplicada, revisión modificada/);
 assert.equal(calls,1);
});
test('Agendador, inventario y cuenta de Uki no pueden registrar',async()=>{
 let queries=0;const db={query:async()=>{queries++;return []}};
 for(const role of ['agendador','inventario']){
  await assert.rejects(guardarCancelacionUnicaRomoQA({
   db,identity:{...dueno,role},datos:prueba()}));
 }
 await assert.rejects(guardarCancelacionUnicaRomoQA({
  db,identity:{...dueno,brand:'uki'},datos:prueba()}));
 assert.equal(queries,0);
});
test('Piloto apagado salvo QA aislada; no habilita escritura general',()=>{
 const env={
  VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
  ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
  ROMO_ESTADO_CIFRADO_QA_ENABLED:'true',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app',
  ROMO_PRIVATE_DATABASE_HOST:'ep-test.neon.tech',
  ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@ep-test.neon.tech/romos_sushi'
 };
 assert.equal(config(env),null);
 assert.ok(config({...env,ROMO_CANCELACION_UNICA_QA_ENABLED:'true'}));
 assert.equal(config({...env,ROMO_CANCELACION_UNICA_QA_ENABLED:'true',
  ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED:'true'}),null);
 assert.equal(config({...env,ROMO_CANCELACION_UNICA_QA_ENABLED:'true',
  ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED:'true'}),null);
 assert.equal(config({...env,ROMO_CANCELACION_UNICA_QA_ENABLED:'true',
  VERCEL_ENV:'production'}),null);
});
test('Mismo origen y auditoría append-only, sin guardado comercial',()=>{
 const api=readFileSync(new URL('../api/romo-cancelacion-una-vez-qa.js',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../migrations/qa/romo_intencion_cancelacion_20261117.sql',import.meta.url),'utf8');
 assert.match(api,/req\.method==='OPTIONS'/);
 assert.match(api,/access-control-request-method/);
 assert.match(api,/Piloto único Romo no habilitado/);
 assert.match(api,/No se confirmó la intención de cancelación QA/);
 assert.match(migration,/REVOKE UPDATE,DELETE/);
 assert.match(migration,/GRANT SELECT,INSERT/);
 assert.doesNotMatch(migration,/UPDATE public\.romo_estado_operativo_v1/);
});
