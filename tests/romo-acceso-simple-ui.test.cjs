'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/index.html'),'utf8');
const start=page.indexOf(' if(S.pinSuc){\n const esRomo=S.pinSuc===ROMO_SUCURSAL_QA;');
const end=page.indexOf('\n  if(!S.suc){return',start);
const block=page.slice(start,end);
test('Romo muestra una pantalla de acceso corta y una sola tarjeta',()=>{
 assert.ok(start>=0&&end>start);
 assert.match(block,/id="romoAccesoSimpleQA"/);
 assert.match(block,/Ingresar al panel/);
 assert.match(block,/Romo’s Sushi · La Serena/);
 assert.match(block,/1\. Iniciar sesión con Google/);
 assert.match(block,/2\. Contraseña de acceso/);
 assert.match(block,/Entrar al panel/);
 assert.doesNotMatch(block,/No uses «Cargar nube»/);
});
test('Conserva el mismo acceso Google y contraseña sin inventar PIN',()=>{
 assert.match(block,/getElementById\(\\'ukiLoginQA\\'\)/);
 assert.match(block,/id="romoGoogleEstadoQA"/);
 assert.match(block,/id="ukiAccesoClave"/);
 assert.match(block,/onclick="entrarSuc\(\)"/);
 assert.doesNotMatch(block,/PIN de 6|PIN de seis/);
});
test('Herramientas técnicas están plegadas sin eliminar sus botones ni abrir ventas',()=>{
 assert.match(block,/<details id="romoHerramientasAdminQA"/);
 assert.doesNotMatch(block,/<details id="romoHerramientasAdminQA"[^>]*\sopen/);
 for(const f of ['ukiRomoRevisarAccesoSoloLecturaQA()','ukiRomoAbrirVistaPreliminarQA()','ukiRomoCrearEstadoInicialVacioQA()','ukiRomoFormularioVinculacionQA()'])assert.ok(block.includes(f),f);
 assert.match(block,/Solo dueños/);
});
test('Solo modifica ingreso Romo, no el menú operacional ni las otras sucursales',()=>{
 assert.match(block,/const esRomo=S.pinSuc===ROMO_SUCURSAL_QA/);
 assert.match(block,/existe=esRomo\|\|!!localStorage\.getItem/);
 assert.match(page,/function vInicioTrabajador\(\)/);
 assert.match(page,/function entrarSuc\(/);
 assert.match(page,/function guardarEnLocalStorage\(/);
});
