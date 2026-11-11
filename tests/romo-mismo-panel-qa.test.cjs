'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

test('panel conserva sólo dos sucursales operativas Uki y añade Romo al selector QA',()=>{
 assert.match(main,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(main,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
 assert.match(main,/SUCURSALES_PANEL_QA\.map\(s=>/);
 assert.match(main,/Balmaceda 1612, La Serena/);
});
test('Romo reutiliza un solo formulario y el acceso Uki sin crear contraseña Romo',()=>{
 assert.match(main,/function pedirPin\(s\)/);
 assert.match(main,/async function entrarSuc\(\)/);
 assert.match(main,/const esRomo=s===ROMO_SUCURSAL_QA/);
 assert.match(main,/const nueva=!esRomo&&localStorage\.getItem\(claveLocal\(s\)\)===null/);
 assert.match(main,/await ukiValidarClaveUkiParaRomoQA\(pass\)/);
 assert.match(main,/const disponibles=SUCURSALES\.filter\(s=>localStorage\.getItem\(claveLocal\(s\)\)!==null\)/);
});
test('Romo no escribe datos operativos; muestra sólo aviso hasta que exista acceso real',()=>{
 assert.match(main,/No registres operaciones aquí/);
 assert.match(main,/if\(S\.suc\)return/);
 assert.match(main,/const f=\(S\.romoSeleccionadoQA&&!S\.suc\)\?vInicio/);
 assert.match(main,/S\.pinSuc=null;S\.romoSeleccionadoQA=true;S\.romoIngresadoQA=true;S\.vista="inicio"/);
 assert.doesNotMatch(main,/S\.suc=ROMO_SUCURSAL_QA/);
});
test('se preserva código actual del panel y su sintaxis',()=>{
 assert.ok(main.length>300000);
 assert.match(html,/uki-factura-inventario-admin-panel\.js\?v=uki-facturas-error-version-v2-20261111/);
 assert.doesNotThrow(()=>new vm.Script(main));
});
