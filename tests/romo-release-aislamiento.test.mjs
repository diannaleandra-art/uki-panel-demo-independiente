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
