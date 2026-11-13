'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
test('el script clásico completo del panel compila tras añadir integración Romo',()=>{
 const blocks=[...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
 const scripts=blocks.map(x=>x[1]);
 const principal=scripts.find(x=>x.includes('async function ndGuardar(){'));
 assert(principal,'No se encontró el script operativo existente');
 assert.doesNotThrow(()=>new vm.Script(principal,{filename:'uki-sushi-local.html:panel'}));
 assert.match(principal,/ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
 assert.match(principal,/return ukiRomoGuardarPedidoQA\(\)/);
});
test('el script del panel Google conserva autenticación Firebase y la separa de Romo',()=>{
 assert.match(html,/window\.ukiInventarioToken=async\(\)=>auth\.currentUser\?auth\.currentUser\.getIdToken\(\):null/);
 assert.match(html,/window\.ukiQAGet=\(\)=>SUCURSALES\.includes\(S\.suc\)/);
 assert.match(html,/if\(!SUCURSALES\.includes\(S\.suc\)\)return Promise\.resolve\(true\)/);
});
