'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const panel=fs.readFileSync(path.resolve(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

test('Uki Regimiento y Uki Serena conservan identificadores y rutas originales',()=>{
 assert.match(main,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(main,/const claveLocal=s=>UKI_LOCAL_PREFIX\+\(SUCURSALES\.indexOf\(s\)===0\?"regimiento":SUCURSALES\.indexOf\(s\)===1\?"la-serena":"desconocida"\)/);
 assert.match(main,/const ukiMesaBranch=\(\)=>S\.suc===SUCURSALES\[0\]\?'arica':S\.suc===SUCURSALES\[1\]\?'serena':''/);
});
test('los tres locales usan un solo selector y UNA función de apertura',()=>{
 assert.match(main,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
 assert.match(main,/SUCURSALES_PANEL_QA\.map\(s=>/);
 assert.match(main,/if\(!SUCURSALES_PANEL_QA\.includes\(s\)\)return;/);
 assert.match(main,/function pedirPin\(s\)/);
 assert.match(main,/async function entrarSuc\(\)/);
 assert.match(main,/onclick="entrarSuc\(\)"/);
 assert.doesNotMatch(main,/function ukiAbrirRomoLaSerena\(|function ukiEntrarRomoQA\(/);
 assert.doesNotMatch(main,/Romo Regimiento Arica/);
});
test('Romo se selecciona sin crear otra contraseña y sin abrir pedidos hasta tener nube propia',()=>{
 assert.match(main,/const esRomo=S\.pinSuc===ROMO_SUCURSAL_QA/);
 assert.match(main,/const existe=esRomo\|\|!!localStorage\.getItem\(claveLocal\(S\.pinSuc\)\)/);
 assert.match(main,/if\(esRomo\)\{[\s\S]*?await ukiValidarClaveUkiParaRomoQA\(pass\)/);
 assert.match(main,/await entrarDatosSucursal\(s,pass\);S\.vista="inicio"/);
 assert.match(main,/Vista informativa de Romo · sin sesión ni acceso a pedidos reales/);
 assert.match(main,/Ver avance de Romo \(solo lectura\)/);
 assert.match(main,/S\.romoIngresadoQA=false/);
 assert.match(main,/const ROMO_SERENA_QA=Object\.freeze\(\{brand:'romo',branch:'serena'/);
 assert.match(main,/Balmaceda 1612, La Serena/);
 assert.match(panel,/body\.romo-qa #ukiNubeSeccion/);
});
test('la navegación directa Romo usa el mismo formulario que Uki',()=>{
 assert.match(main,/else if\(desdeEnlace==="romo-serena"\)S\.pinSuc=ROMO_SUCURSAL_QA/);
 assert.match(main,/else if\(desdeEnlace==="la-serena"\)S\.pinSuc="Uki La Serena"/);
});
test('código principal del panel conserva sintaxis',()=>{
 assert.ok(main.length>100000);
 assert.doesNotThrow(()=>new vm.Script(main));
});
