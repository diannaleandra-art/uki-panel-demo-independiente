'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../api/romo-seguimiento-personal-qa.js');
const source=fs.readFileSync(path.join(__dirname,'../api/romo-seguimiento-personal-qa.js'),'utf8');
test('no se abre bandeja fuera de preview o sin permiso personal',()=>{
 assert.equal(api._testing.configured({VERCEL_ENV:'production'}),null);
 assert.equal(api._testing.configured({VERCEL_ENV:'preview',ROMO_SEGUIMIENTO_PERSONAL_QA_ENABLED:'false'}),null);
 assert.match(source,/resolveRomoIdentity/);
 assert.match(source,/\['duenos','agendador'\]\.includes\(person\.role\)/);
});
test('confirmación de banco requiere importe exacto y responsable Google',()=>{
 assert.match(source,/req\.body\.verificadoEnBanco!==true/);
 assert.match(source,/view\.montoTransferencia!==req\.body\.montoRecibido/);
 assert.match(source,/person\.userId/);
 assert.match(source,/No se registró un cobro en caja/);
});
test('respuestas privadas sólo sobre pedido aceptado y cifradas',()=>{
 assert.match(source,/s\.estado='aceptada'/);
 assert.match(source,/CHAT\.seal/);
 assert.match(source,/store_id='romo:serena'/);
});
