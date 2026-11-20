import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {entornoGestionRomoAutorizado,escrituraGestionRomoAutorizada}=
 require('../lib/romo-entorno-gestion.cjs');

const origin='https://romos-sushi-panel-diannaleandra-7046.vercel.app';
const base={
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_PANEL_ALLOWED_ORIGIN:origin
};
const prod={...base,VERCEL_ENV:'production',
 VERCEL_GIT_COMMIT_REF:'release/romos-panel-v816',
 ROMO_PANEL_PRODUCTION_ENABLED:'true'};
const preview={...base,VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816'};

test('QA autorizado anteriormente se conserva, sin escritura automática',()=>{
 assert.equal(entornoGestionRomoAutorizado(preview),true);
 assert.equal(escrituraGestionRomoAutorizada(preview),false);
 assert.equal(escrituraGestionRomoAutorizada({
  ...preview,ROMO_CARTA_ADMIN_ESCRITURA_QA_ENABLED:'true'
 }),true);
});

test('Producción permanece cerrada aunque el panel general esté habilitado',()=>{
 assert.equal(entornoGestionRomoAutorizado(prod),false);
 assert.equal(escrituraGestionRomoAutorizada(prod),false);
 assert.equal(entornoGestionRomoAutorizado({
  ...prod,ROMO_ADMIN_PRODUCTION_ENABLED:'false'
 }),false);
 assert.equal(entornoGestionRomoAutorizado({
  ...prod,ROMO_ADMIN_PRODUCTION_ENABLED:'true'
 }),true);
});

test('Producción de Romo requiere ramas, dominio y proyecto exclusivos',()=>{
 const allowed={...prod,ROMO_ADMIN_PRODUCTION_ENABLED:'true'};
 for(const bad of [
  {...allowed,VERCEL_GIT_COMMIT_REF:'main'},
  {...allowed,VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816'},
  {...allowed,VERCEL_ENV:'preview'},
  {...allowed,ROMO_PANEL_PRODUCTION_ENABLED:'false'},
  {...allowed,ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-inventario'},
  {...allowed,ROMO_PANEL_ALLOWED_ORIGIN:'https://uki-sushi-inventario.vercel.app'},
  {...allowed,ROMO_PANEL_ALLOWED_ORIGIN:'http://romos-sushi-panel.vercel.app'}
 ])assert.equal(entornoGestionRomoAutorizado(bad),false);
});

test('Escritura de producción exige su propia tercera bandera',()=>{
 const p={...prod,ROMO_ADMIN_PRODUCTION_ENABLED:'true'};
 assert.equal(escrituraGestionRomoAutorizada(p),false);
 assert.equal(escrituraGestionRomoAutorizada({
  ...p,ROMO_CARTA_ADMIN_ESCRITURA_QA_ENABLED:'true'
 }),false);
 assert.equal(escrituraGestionRomoAutorizada({
  ...p,ROMO_ADMIN_PRODUCTION_WRITE_ENABLED:'true'
 }),true);
});

test('Los tres módulos administrativos usan el mismo guardia de entorno',()=>{
 for(const filename of [
  'romo-carta-administracion-qa.js',
  'romo-carta-fotos-qa.js',
  'romo-carta-vista-previa-admin-qa.js'
 ]){
  const src=readFileSync(new URL('../api/'+filename,import.meta.url),'utf8');
  assert.match(src,/entornoGestionRomoAutorizado\(process\.env\)/);
  assert.match(src,/resolveRomoIdentity/);
 }
 for(const filename of ['romo-carta-administracion-qa.js','romo-carta-fotos-qa.js']){
  const src=readFileSync(new URL('../api/'+filename,import.meta.url),'utf8');
  assert.match(src,/escrituraGestionRomoAutorizada\(process\.env\)/);
 }
});
