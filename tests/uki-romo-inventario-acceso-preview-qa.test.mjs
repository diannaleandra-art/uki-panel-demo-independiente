import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const api=require('../api/romo-inventario-qa.js');
const config=api._testing.inventarioModoRomo;
const branch='qa/integracion-panel-unico-romo-serena-20261112';
const qa={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch,
 ROMO_FIN_SYNC_QA_BRANCH:branch,ROMO_OPERATIVO_QA_ENABLED:'true',
 ROMO_INVENTARIO_QA_ENABLED:'true'};
test('inventario QA solo permite preview con rama exacta y autorización explícita',()=>{
 assert.equal(config(qa),'qa');
 for(const change of [
  {VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},
  {ROMO_FIN_SYNC_QA_BRANCH:'main'},
  {ROMO_OPERATIVO_QA_ENABLED:'false'},
  {ROMO_INVENTARIO_QA_ENABLED:'false'},
  {ROMO_INVENTARIO_QA_ENABLED:undefined}
 ])assert.equal(config({...qa,...change}),null);
});
test('la autorización de producción exige ambas banderas live independientes',()=>{
 const prod={VERCEL_ENV:'production',ROMO_OPERATIVO_LIVE_ENABLED:'true',
  ROMO_INVENTARIO_LIVE_ENABLED:'true'};
 assert.equal(config(prod),'production');
 assert.equal(config({...prod,ROMO_INVENTARIO_LIVE_ENABLED:'false'}),null);
 assert.equal(config({...prod,ROMO_OPERATIVO_LIVE_ENABLED:'false'}),null);
 assert.equal(config({...qa,VERCEL_ENV:'production'}),null);
});
test('sin banderas explícitas la ruta responde 503 antes de abrir bases',async()=>{
 const vars=['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','ROMO_FIN_SYNC_QA_BRANCH',
  'ROMO_OPERATIVO_QA_ENABLED','ROMO_INVENTARIO_QA_ENABLED',
  'ROMO_OPERATIVO_LIVE_ENABLED','ROMO_INVENTARIO_LIVE_ENABLED'];
 const previous=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
 for(const k of vars)delete process.env[k];
 let status=0,headers={};
 const res={setHeader(k,v){headers[k]=v},status(n){status=n;return this},json(v){return v}};
 try{
  const result=await api({method:'GET',headers:{}},res);
  assert.equal(status,503);
  assert.equal(result.ok,false);
  assert.match(headers['Cache-Control'],/no-store/);
 }finally{
  for(const k of vars)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];
 }
});
test('inventario QA nunca consulta tablas de Uki ni el host productivo',()=>{
 const src=readFileSync(new URL('../api/romo-inventario-qa.js',import.meta.url),'utf8');
 assert.match(src,/romoOperativoConfig\(env\)/);
 assert.match(src,/cfg\.qaOnly!==\(mode==='qa'\)/);
 assert.match(src,/ROMO_INVENTARIO_QA_ENABLED/);
 assert.doesNotMatch(src,/public\.uki_|uki_inventario/);
});
