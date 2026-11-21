'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../public/romo-panel-qa/uki-archivo-mensual-core.js');
const agenda=require('../public/romo-panel-qa/uki-archivo-agenda.js');
const fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'../public/romo-panel-qa/uki-archivo-mensual-panel.js'),'utf8');
const suc='uki:arica',hash='a'.repeat(64);
const pendientes=(hoy,archivos=[],sucursal=suc)=>agenda.pendientes({hoy,archivos,sucursal,periodo:core.periodo});
test('Día 5 de Chile: únicamente meses completos desde noviembre de 2026',()=>{
 assert.deepEqual(pendientes('2026-12-04'),[]);
 assert.deepEqual(pendientes('2026-12-05'),['2026-11']);
 assert.deepEqual(pendientes('2027-01-04'),['2026-11']);
 assert.deepEqual(pendientes('2027-01-05'),['2026-11','2026-12']);
});
test('Sin duplicados y por sucursal; atraso recuperado',()=>{
 const a=[{sucursal:suc,mes:'2026-11',sha256:hash},{sucursal:'uki:serena',mes:'2026-12',sha256:hash}];
 assert.deepEqual(pendientes('2027-02-05',a),['2026-12','2027-01']);
 assert.deepEqual(pendientes('2027-01-05',a,'uki:serena'),['2026-11']);
 assert.throws(()=>pendientes('2027-02-30'));
});
test('Sin bypass ni eliminación, sesión de dueño vigente, verificación previa',()=>{
 assert.match(src,/action:'ingresar_pin'/);
 assert.match(src,/if\(automatico&&\(!finSession\|\|Date.now\(\)>=finSessionHasta/);
 assert.match(src,/action:'verificar',sucursal,mes:m/);
 assert.match(src,/if\(!await guardarMes\(\)\)\{lotesRevisados\.add\(clave\);return;/);
 assert.doesNotMatch(src,/localStorage|sessionStorage|action:'eliminar'|action:'purga'/);
 assert.match(src,/No se eliminó información/);
});
