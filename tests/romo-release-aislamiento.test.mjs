import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const preview={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'release/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-release-test.vercel.app'
};

test('preview de Romo sólo funciona en el panel aislado',()=>{
 assert.equal(entornoPanelRomoAutorizado(preview),true);
 assert.equal(entornoPanelRomoAutorizado({...preview,VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816'}),true);
 assert.equal(entornoPanelRomoAutorizado({...preview,ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-inventario'}),false);
 assert.equal(entornoPanelRomoAutorizado({...preview,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(entornoPanelRomoAutorizado({...preview,ROMO_PANEL_ALLOWED_ORIGIN:'https://uki-sushi-inventario.vercel.app'}),false);
});

test('producción bloqueada hasta autorización en proyecto Romo',()=>{
 const prod={...preview,VERCEL_ENV:'production'};
 assert.equal(entornoPanelRomoAutorizado(prod),false);
 assert.equal(entornoPanelRomoAutorizado({...prod,ROMO_PANEL_PRODUCTION_ENABLED:'true'}),true);
 assert.equal(entornoPanelRomoAutorizado({...prod,ROMO_PANEL_PRODUCTION_ENABLED:'true',VERCEL_GIT_COMMIT_REF:'main'}),false);
});

test('carta y precios aparece en inventario, no duplicada en promos',()=>{
 const html=read('../public/romo-panel-qa/index.html');
 const admin=read('../public/romo-panel-qa/uki-carta-precios-admin.js');
 const editor=read('../public/romo-panel-qa/romo-carta-editor-seguro-qa.js');
 assert.doesNotMatch(html,/id="romoCartaEditorSeguroQA"/);
 assert.match(html,/uki-carta-precios-admin\.js/);
 assert.match(admin,/window\.romoMontarCartaEditorSeguroQA/);
 assert.match(admin,/container\.style\.display='none'/);
 assert.match(admin,/Carta y precios de Romo no pueden guardar cambios en Uki/);
 assert.match(editor,/autorizado=await request\('GET'\)/);
 assert.match(editor,/container\.style\.removeProperty\('display'\)/);
});

test('la rama de entrega no despliega automáticamente',()=>{
 const config=JSON.parse(read('../vercel.json'));
 assert.equal(config.git?.deploymentEnabled?.['release/romos-panel-v816'],false);
 assert.equal(config.git?.deploymentEnabled?.['qa/romos-panel-v816'],false);
});

test('diagnóstico de Neon sólo acepta cuenta de servicio y rama QA de Romo',()=>{
 const api=require('../api/romo-conexion-lectura-qa.js');
 const config=api._internalQA.config;
 const env={
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
  ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app',
  ROMO_PRIVATE_DATABASE_HOST:'ep-wild-hat-bezucf4v.c-9.us-east-2.aws.neon.tech',
  ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:dummy@ep-wild-hat-bezucf4v.c-9.us-east-2.aws.neon.tech/romos_sushi',
  ROMO_CONEXION_LECTURA_QA_ENABLED:'true'
 };
 assert.equal(typeof config(env)?.db,'string');
 assert.equal(config({...env,ROMO_PRIVATE_DATABASE_URL:env.ROMO_PRIVATE_DATABASE_URL.replace('romos_app_service','romos_sushi_owner')}),null);
 assert.equal(config({...env,ROMO_PRIVATE_DATABASE_URL:env.ROMO_PRIVATE_DATABASE_URL.replace('/romos_sushi','/neondb')}),null);
 assert.equal(config({...env,VERCEL_GIT_COMMIT_REF:'main'}),null);
 assert.equal(config({...env,ROMO_CONEXION_LECTURA_QA_ENABLED:'false'}),null);
});


test('API privadas de Romo preservan sesión Vercel en Preview sin eliminar Google',()=>{
 const files=[
  '../public/romo-panel-qa/uki-romo-clave-remota-qa.mjs',
  '../public/romo-panel-qa/uki-romo-conexion-lectura-qa.mjs',
  '../public/romo-panel-qa/uki-romo-operativo-qa.mjs',
  '../public/romo-panel-qa/uki-romo-catalogo-qa.mjs',
  '../public/romo-panel-qa/uki-romo-recepcion-formulario-qa.mjs',
  '../public/romo-panel-qa/uki-romo-vinculo-duenos-qa.mjs',
  '../public/romo-panel-qa/index.html'
 ];
 for(const file of files){
  const source=read(file);
  assert.match(source,/credentials:\s*['"]same-origin['"]/);
  assert.doesNotMatch(source,/credentials:\s*['"]omit['"]/);
  assert.match(source,/Authorization:\s*['"]Bearer /);
 }
});


test('Romo QA mantiene autenticación en banner, catálogo e inventario sin abrir ventas',()=>{
 const files=[
  '../public/romo-panel-qa/romo-banner-admin.js',
  '../public/romo-panel-qa/romo-carta-editor-seguro-qa.js',
  '../public/romo-panel-qa/romo-inventario-trabajador.html'
 ];
 for(const path of files){
  const src=read(path);
  assert.match(src,/credentials:\s*['"]same-origin['"]/);
  assert.doesNotMatch(src,/credentials:\s*['"]omit['"]/);
 }
 const inv=read('../public/romo-panel-qa/uki-inventario-admin-embebido.js');
 assert.match(inv,/fetch\('\/api\/romo-inventario-qa',\{\s*method:isRead\?'GET':'POST',credentials:'same-origin'/);
 assert.match(inv,/fetch\('\/api\/romo-pin-inventario-qa',\{method:'POST',credentials:'same-origin'/);
 // La API heredada de Uki permanece separada; no se cambia su autenticación.
 assert.match(inv,/fetch\(API,\{method:'POST',mode:'cors',credentials:'omit'/);
 const tabs=read('../public/romo-panel-qa/uki-carta-precios-admin.js');
 assert.match(tabs,/inventario:\[[^\]]*'romoInvWorkerAccess'/);
 assert.match(tabs,/const ids=\[[\s\S]*?'romoInvWorkerAccess'/);
 assert.match(tabs,/Carta y precios de Romo aún no disponible/);
 const api=read('../api/romo-estado-cifrado-panel-qa.js');
 assert.match(api,/ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED/);
 assert.match(api,/ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED/);
});
