import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {validarIntentoCancelacionUnicaRomoQA,guardarCancelacionUnicaRomoQA,
 _sqlCancelacionUnicaQA} from '../lib/romo-cancelacion-una-vez-qa.mjs';

const require=createRequire(import.meta.url);
const {config}=require('../api/romo-cancelacion-una-vez-qa.js')._internalQA;
const prueba=()=>({
 pedidoId:1,expectedRevision:2,turnoRef:'2026-11-14@1794676606187',
 motivo:'Pedido de prueba no cobrado',responsable:'Operador QA',
 snapshot:{formato:'uki-v813-browser',version:1,
  sucursal:'Romo’s Sushi La Serena',
  salt:'YWFhYWFhYWFhYWFhYWFhYQ==',iv:'YmJiYmJiYmJiYmJi',
  cifrado:'Y2NjY2NjY2NjY2NjY2NjY2NjY2M='}
});
const dueno={userId:'owner-QA-1',brand:'romo',role:'duenos',branches:['serena']};

test('Rechaza otro pedido, turno, revisión e información extra',()=>{
 for(const patch of [{pedidoId:2},{expectedRevision:3},
  {turnoRef:'falso'},{extra:'dato'}]){
  assert.throws(()=>validarIntentoCancelacionUnicaRomoQA({...prueba(),...patch}));
 }
});
test('Sólo acepta formato cifrado Romo, sin contraseña ni datos de Uki',()=>{
 assert.throws(()=>validarIntentoCancelacionUnicaRomoQA({...prueba(),
  snapshot:{...prueba().snapshot,sucursal:'Uki La Serena'}}));
 assert.throws(()=>validarIntentoCancelacionUnicaRomoQA({...prueba(),
  snapshot:{...prueba().snapshot,contraseña:'prohibida'}}));
 const info=validarIntentoCancelacionUnicaRomoQA(prueba());
 assert.equal(info.pedidoId,1);
 assert.equal(info.expectedRevision,2);
 assert.match(info.sha,/^[a-f0-9]{64}$/);
 assert.match(info.motivoHash,/^[a-f0-9]{64}$/);
});
test('Dueños: una confirmación de CAS y auditoría en sentencia única simulada',async()=>{
 const sent=[];
 const db={query:async(sql,args)=>{sent.push({sql,args});return [{revision_neon:3}]}};
 const resultado=await guardarCancelacionUnicaRomoQA({db,identity:dueno,datos:prueba()});
 assert.equal(resultado.ok,true);
 assert.equal(resultado.revision,3);
 assert.equal(resultado.registrado,true);
 assert.equal(sent.length,1);
 assert.equal(sent[0].sql,_sqlCancelacionUnicaQA);
 assert.match(sent[0].sql,/WITH guardado AS \(/);
 assert.match(sent[0].sql,/INSERT INTO public\.romo_cancelacion_pedido_qa_v1/);
 assert.equal(sent[0].args[0],'romo:serena');
 assert.equal(sent[0].args[1],2);
 assert.equal(sent[0].args[2],1);
});
test('Reintento sin nueva revisión no confirma y no inventa una cancelación',async()=>{
 let consultas=0;
 const db={query:async()=>{consultas++;return []}};
 await assert.rejects(guardarCancelacionUnicaRomoQA({db,identity:dueno,datos:prueba()}),
  /No se confirmó una única revisión/);
 assert.equal(consultas,1);
});
test('Agendador/inventario/identidad forjada nunca alcanzan Neon',async()=>{
 let consultas=0;
 const db={query:async()=>{consultas++;return [{revision_neon:3}]}};
 for(const role of ['agendador','inventario']){
  await assert.rejects(guardarCancelacionUnicaRomoQA({
   db,identity:{...dueno,role},datos:prueba()}));
 }
 await assert.rejects(guardarCancelacionUnicaRomoQA({
  db,identity:{...dueno,brand:'uki'},datos:prueba()}));
 assert.equal(consultas,0);
});
test('Endpoint de piloto deshabilitado salvo Preview aislada explícita',()=>{
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

test('El endpoint sólo permite preflight del origen y método autorizados',()=>{
 const api=readFileSync(new URL('../api/romo-cancelacion-una-vez-qa.js',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../migrations/qa/romo_cancelacion_unica_20261117.sql',import.meta.url),'utf8');
 assert.match(api,/req\.method==='OPTIONS'/);
 assert.match(api,/access-control-request-method/);
 assert.match(api,/!==\s*'POST'/);
 assert.match(api,/Piloto único Romo no habilitado/);
 assert.match(migration,/REVOKE UPDATE,DELETE/);
 assert.match(migration,/GRANT SELECT,INSERT/);
});
