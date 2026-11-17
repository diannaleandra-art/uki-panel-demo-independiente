import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {validarSobreCifradoRomoQA} from '../lib/romo-estado-cifrado-persistencia-qa.mjs';
import {prepararConciliacionCancelacionRomoQA} from '../public/romo-panel-qa/uki-romo-conciliacion-cancelacion-qa.mjs';

const require=createRequire(import.meta.url);
const {config,SQL,guardarQA}=require('../api/romo-cancelacion-cifrada-solo-qa.js')._internalQA;
const SUC='Romo’s Sushi La Serena';
const dbqa='ep-wild-hat-bezucf4v-pooler.c-9.us-east-2.aws.neon.tech';
const dbmain='ep-damp-sun-beofcvis-pooler.c-9.us-east-2.aws.neon.tech';
const env=()=>({
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_QA_CANCELACION_CIFRADA_ENABLED:'true',
 ROMO_QA_PRUEBA_DB_HOST:dbqa,
 ROMO_QA_PRUEBA_DB_URL:'postgresql://romos_app_service:fake@'+dbqa+'/romos_sushi',
 ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@'+dbmain+'/romos_sushi',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app'
});
const snapshot=()=>({
 formato:'uki-v813-browser',version:1,sucursal:SUC,
 salt:'YWFhYWFhYWFhYWFhYWFhYQ==',
 iv:'YmJiYmJiYmJiYmJi',
 cifrado:'Y2NjY2NjY2NjY2NjY2NjY2NjY2M='
});
const body=()=>({
 expectedRevision:2,pedidoId:1,categoria:'local',
 motivo:'Pedido de prueba sin preparar, entregar ni cobrar',snapshot:snapshot()
});
const owner=()=>({brand:'romo',role:'duenos',userId:'dueno-QA-1',branches:['serena']});
const estado=()=>({
 suc:SUC,base:0,pedidos:[
  {suc:SUC,id:1,estado:'Pendiente',pagado:false,total:1000,
   turnoClave:'2026-11-14@1794676606187',historialCambios:[]},
  {suc:SUC,id:2,estado:'Entregado',pagado:true,total:6000,historialCambios:[]}
 ],gastos:[],retiros:[],propinas:[],cierres:[],apps:{},
 cajaChica:{inicial:0,gastos:[]},cajasDiarias:{},clientes:{},
 deliveriesManuales:[],incidencias:[],nextId:3,nextIncidenciaId:1
});

test('Flag, rama, entorno, proyecto y host Neon principal estrictamente vetados',()=>{
 const e=env();
 assert.ok(config(e));
 for(const patch of [
  {ROMO_QA_CANCELACION_CIFRADA_ENABLED:'false'},
  {VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},
  {ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-panel'},
  {ROMO_QA_PRUEBA_DB_URL:e.ROMO_PRIVATE_DATABASE_URL},
  {ROMO_QA_PRUEBA_DB_HOST:dbmain,ROMO_QA_PRUEBA_DB_URL:e.ROMO_PRIVATE_DATABASE_URL},
  {ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED:'true'},
  {ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED:'true'},
  {ROMO_CANCELACION_UNICA_QA_ENABLED:'true'}
 ])assert.equal(config({...e,...patch}),null);
});
test('Sólo dueños con paquete exacto y AES-GCM Romo válido pueden solicitar un ensayo',async()=>{
 assert.doesNotThrow(()=>validarSobreCifradoRomoQA(snapshot()));
 for(const bad of [
  {...body(),pedidoId:2},{...body(),expectedRevision:3},
  {...body(),categoria:'cliente'},{...body(),motivo:'a'},
  {...body(),extra:'de más'},{...body(),snapshot:{...snapshot(),sucursal:'Uki La Serena'}}
 ]){
  let calls=0;
  await assert.rejects(guardarQA({
   db:{query:async()=>{calls++;return []}},identity:owner(),body:bad
  }));
  assert.equal(calls,0);
 }
});
test('Un único SQL de actualización CAS y auditoría con huella previa fija',async()=>{
 let calls=0;
 const db={query:async(sql,params)=>{
  calls++;assert.equal(sql,SQL);
  assert.equal(params[0],'romo:serena');
  assert.equal(params[1],2);
  assert.equal(params[2],'2ecee5d9256b2fa5b93e77864cbdea51');
  assert.equal(params[5],1);
  assert.equal(params[7],'local');
  assert.match(params[6],/^[a-f0-9]{64}$/);
  assert.match(params[8],/^[a-f0-9]{64}$/);
  assert.ok(JSON.parse(params[3]).cifrado);
  return [{revision_nueva:3,nuevo_md5:'a'.repeat(32)}];
 }};
 const result=await guardarQA({db,identity:owner(),body:body()});
 assert.equal(calls,1);
 assert.equal(result.revision,3);
 assert.equal(result.semanticaVerificadaEnServidor,false);
 assert.equal(result.revisionPrincipalModificada,false);
 assert.match(SQL,/md5\(snapshot::text\)=\$3/);
 assert.match(SQL,/FOR UPDATE/);
 assert.match(SQL,/INSERT INTO public\.romo_cancelacion_sobre_piloto_qa_v1/);
 assert.match(SQL,/RETURNING revision_nueva,nuevo_md5/);
 assert.match(SQL,/NOT EXISTS/);
 assert.doesNotMatch(SQL,/ON CONFLICT DO NOTHING/);
});
test('Cuenta de agendador/inventario/Uki y reintento no confirman',async()=>{
 let calls=0;const db={query:async()=>{calls++;return []}};
 for(const candidate of [
  {...owner(),role:'agendador'},
  {...owner(),role:'inventario'},
  {...owner(),brand:'uki'},
  {...owner(),branches:['arica']}
 ])await assert.rejects(guardarQA({db,identity:candidate,body:body()}));
 assert.equal(calls,0);
 await assert.rejects(guardarQA({db,identity:owner(),body:body()}),
  error=>error.code==='REPLAY');
 assert.equal(calls,1);
});
test('El cliente prepara solo cancelación del pedido #1 sin caja ni otras ventas',()=>{
 const original=estado();
 const antes=JSON.stringify(original);
 const datos={pedidoId:1,categoria:'local',motivo:'Pedido de prueba sin cobro',
  responsable:'Responsable QA',registradoEn:1794950600000};
 const p=prepararConciliacionCancelacionRomoQA(original,datos);
 assert.equal(JSON.stringify(original),antes);
 assert.equal(p.estadoPropuesto.pedidos[0].estado,'Cancelado');
 assert.deepEqual(p.estadoPropuesto.pedidos[1],original.pedidos[1]);
 assert.deepEqual(p.estadoPropuesto.cajaChica,original.cajaChica);
 assert.equal(p.resumen.guardadoEnNeon,false);
 assert.equal(p.resumen.modificacionCaja,false);
});
test('Botón sólo en Inicio de Romo, requiere clave local y relectura de auditoría',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/romo-cancelacion-cifrada-solo-qa.js',import.meta.url),'utf8');
 assert.match(html,/S\.suc===ROMO_SUCURSAL_QA&&S\.vista==='inicio'/);
 assert.match(html,/Probar cancelación solo en copia QA/);
 assert.match(html,/abrirLocal\(JSON\.stringify\(anteriorQA\.snapshot\)/);
 assert.match(html,/cifrarLocal\(preparado\.estadoPropuesto/);
 assert.match(html,/despuesQA\.auditoriaConfirmada!==true/);
 assert.match(api,/esOrigenAutorizadoRomoQA/);
 assert.match(api,/resolveRomoIdentity/);
 assert.match(api,/auditoriaConfirmada/);
});
