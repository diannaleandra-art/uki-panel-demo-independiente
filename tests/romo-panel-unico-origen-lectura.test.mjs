import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {
 origenUnificadoLecturaRomoQA,resolverOrigenLecturaUnificadaRomoQA
}=require('../lib/romo-origen-seguro-qa.cjs');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const romo='https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app';
const uki='https://uki-sushi-inventario-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app';
const env={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN:uki
};
const req=(method,origin,preflight)=>({
 method,headers:{origin,...(preflight?{'access-control-request-method':preflight}:{})}
});

test('solamente un Preview fijo de Uki puede ser origen adicional de lectura',()=>{
 assert.equal(origenUnificadoLecturaRomoQA(env),uki);
 for(const cambio of [
  {VERCEL_ENV:'production'},
  {VERCEL_GIT_COMMIT_REF:'main'},
  {ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-inventario'},
  {ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN:'https://evil.example.com'},
  {ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN:'https://uki-sushi-inventario.vercel.app'},
  {ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN:uki+'/'}
 ])assert.equal(origenUnificadoLecturaRomoQA({...env,...cambio}),null);
});
test('lectura compartida acepta GET y preflight GET, nunca escrituras',()=>{
 assert.equal(resolverOrigenLecturaUnificadaRomoQA(req('GET',uki),romo,uki)?.compartido,true);
 assert.equal(resolverOrigenLecturaUnificadaRomoQA(req('OPTIONS',uki,'GET'),romo,uki)?.compartido,true);
 for(const [method,preflight] of [['POST',''],['PATCH',''],['DELETE',''],
   ['OPTIONS','POST'],['OPTIONS','PATCH'],['OPTIONS','']]){
  assert.equal(resolverOrigenLecturaUnificadaRomoQA(req(method,uki,preflight),romo,uki),null);
 }
 assert.equal(resolverOrigenLecturaUnificadaRomoQA(req('GET',uki),romo,null),null);
 assert.equal(resolverOrigenLecturaUnificadaRomoQA(req('GET','https://evil.example.com'),romo,uki),null);
 assert.equal(resolverOrigenLecturaUnificadaRomoQA(req('GET',romo),romo,uki)?.compartido,false);
});
test('todas las API del bloque consultable verifican origen compartido y restringen métodos',()=>{
 for(const archivo of [
  '../api/romo-estado-cifrado-panel-qa.js',
  '../api/romo-inventario-qa.js',
  '../api/romo-solicitudes-carta-qa.js',
  '../api/romo-carta-ediciones-seguras-qa.js'
 ]){
  const codigo=read(archivo);
  assert.match(codigo,/origenUnificadoLecturaRomoQA\(env\)/,archivo);
  assert.match(codigo,/resolverOrigenLecturaUnificadaRomoQA\(req,/,archivo);
  assert.match(codigo,/compartido\?'GET,OPTIONS'/,archivo);
  assert.match(codigo,/ROMO_/);
 }
 const pedido=read('../api/romo-solicitudes-carta-qa.js');
 assert.match(pedido,/ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED/);
 const cifrado=read('../api/romo-estado-cifrado-panel-qa.js');
 assert.match(cifrado,/ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED/);
 assert.match(cifrado,/ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED/);
 const catalogo=read('../api/romo-carta-ediciones-seguras-qa.js');
 assert.match(catalogo,/if\(method==='POST'&&!conf\.write\)/);
});
test('panel unico enruta GET al backend aislado y nunca anade permisos de escritura',()=>{
 const html=read('../firebase/uki-sushi-local.html');
 const from=html.indexOf('function ukiRomoRutaLecturaPanelUnicoQA(');
 const to=html.indexOf('async function ukiConsultarRomoPanelUnicoQA(){',from);
 assert.ok(from>0&&to>from);
 const ruta=html.slice(from,to);
 assert.match(ruta,/uki-sushi-inventario-git-qa-romos-panel-v816-/);
 assert.match(ruta,/romos-sushi-panel-git-qa-romos-panel-v816-/);
 assert.match(ruta,/ROMO_BACKEND_LECTURA_QA\+ruta/);
 assert.match(ruta,/function ukiRomoCredencialesLecturaPanelUnicoQA\(url\)/);
 assert.match(ruta,/\?'omit':'same-origin'/);
 const operacion=read('../firebase/uki-romo-operativo-qa.mjs');
 assert.match(operacion,/const ROMO_OPERATIVO_ENDPOINT_QA='';/);
});
