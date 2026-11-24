'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../lib/romo-seguimiento-transferencia-v1.cjs');
const base=path.join(__dirname,'..');
test('Romo: el pago se persiste desde la cotización validada, no desde texto del cliente',()=>{
 const src=fs.readFileSync(path.join(base,'lib/romo-solicitudes-carta-qa.mjs'),'utf8');
 assert.match(src,/medioPago:data\.cotizacion\.payment/);
 assert.match(src,/modalidad:data\.cotizacion\.mode/);
});
test('Romo: el identificador interno no sale en la respuesta al cliente',()=>{
 const src=fs.readFileSync(path.join(base,'api/romo-solicitudes-carta-qa.js'),'utf8');
 assert.match(src,/\{trackingId,\.\.\.publicResult\}=result/);
 assert.match(src,/ROMO_SEGUIMIENTO_QA_ENABLED/);
});
test('Romo: enlace privado firmado, manipulación invalida identidad',()=>{
 const id='621bd292-2153-4160-9e85-375978e10352';
 const key='4ba72a9f6f8c47a1bdd021e91aa2d382';
 const secret='qa-20261124-only-strong-secret-123456789';
 const token=core.issueToken(id,key,secret);
 assert.deepEqual(core.readToken(token,secret),{id,key});
 assert.equal(core.readToken(token.slice(0,-1)+'q',secret),null);
});
test('Romo: no se confirma una transferencia sólo con aviso del cliente',()=>{
 const src=fs.readFileSync(path.join(base,'api/romo-seguimiento-cliente-qa.js'),'utf8');
 assert.match(src,/avisar_transferencia/);
 assert.match(src,/b\.sucursal==='romo:serena'/);
 assert.match(src,/datosBancariosVerificados/);
 assert.doesNotMatch(src,/SET estado_pago='confirmada'/);
});
