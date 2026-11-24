'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/index.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs'),'utf8');
test('el pedido ofrece abrir mensajes y transferencia en el mismo panel',()=>{
 assert.match(index,/💬 Mensajes y transferencia/);
 assert.match(index,/window\.ukiQAOpenOrderTracking/);
 assert.match(index,/cartaSolicitudRemotaId/);
 assert.match(index,/\^\[0-9a-f\]\{8\}/);
 assert.match(ui,/window\.ukiQAOpenOrderTracking=async function/);
 assert.match(ui,/dialog\.open=true/);
 assert.match(ui,/await loadDetail\(id\)/);
 assert.match(ui,/root\.scrollIntoView/);
});
test('el acceso directo exige la misma sucursal y usa el token de sesión actual',()=>{
 assert.match(ui,/if\(!root\|\|!dialog\|\|!detail\|\|!store\(\)\)return false/);
 assert.match(ui,/const store=\(\)=>NAMES\[window\.ukiQAGet/);
 assert.match(ui,/window\.ukiMesasTokenConfirmar/);
 assert.match(ui,/Authorization:'Bearer '\+token/);
 assert.doesNotMatch(ui,/signInWithPopup|requestOTP|loginSeparate/);
});
