'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const panel=fs.readFileSync(path.resolve(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('los dos locales Uki conservan exactamente sus identificadores operativos',()=>{
 assert.match(panel,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(panel,/const ukiMesaBranch=\(\)=>S\.suc===SUCURSALES\[0\]\?'arica':S\.suc===SUCURSALES\[1\]\?'serena':''/);
 assert.match(panel,/uki_operativo_v1_cifrado_/);
 assert.match(panel,/uki-panel-f4909/);
});
test('tercera entrada Romo es única y exclusivamente Balmaceda 1612',()=>{
 assert.match(panel,/Romo’s Sushi La Serena · Balmaceda 1612/);
 assert.match(panel,/function ukiAbrirRomoLaSerena\(\)/);
 assert.match(panel,/else if\(desdeEnlace==="romo-serena"\)S\.romoSeleccionadoQA=true/);
 assert.doesNotMatch(panel,/Romo Regimiento Arica/);
 assert.doesNotMatch(panel,/const SUCURSALES=\[[^\]]*Romo/);
});
test('Romo no registra pedidos o caja usando almacenamiento ni nube Uki',()=>{
 assert.match(panel,/if\(S\.suc\|\|S\.pinSuc\)return;/);
 assert.match(panel,/if\(!SUCURSALES\.includes\(s\)\)return;/);
 assert.match(panel,/body\.romo-qa #ukiNubeSeccion/);
 assert.match(panel,/pedidos, caja, inventario y cierres de Romo todavía no están habilitados/);
 assert.match(panel,/En preparación/);
});
test('código principal del panel sigue siendo sintácticamente válido',()=>{
 assert.ok(main && main.length>100000);
 assert.doesNotThrow(()=>new vm.Script(main,{filename:'uki-sushi-local-main.js'}));
});
