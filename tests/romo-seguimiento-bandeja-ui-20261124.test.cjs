'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=require('node:path').join(__dirname,'..');
const html=fs.readFileSync(require('node:path').join(base,'public/romo-panel-qa/index.html'),'utf8');
const js=fs.readFileSync(require('node:path').join(base,'public/romo-panel-qa/romo-seguimiento-personal-qa.mjs'),'utf8');
test('el panel mantiene la bandeja discreta en la misma página',()=>{
 assert.ok(html.includes('id="romo-seguimiento-bandeja-qa" hidden'));
 assert.ok(html.includes('romo-seguimiento-personal-qa.mjs'));
 assert.ok(js.includes("window.ukiQAGet?.()?.suc===STORE"));
});
test('bandeja exige token Google y sólo abre al pulsarla',()=>{
 assert.ok(js.includes('window.ukiMesasTokenConfirmar'));
 assert.ok(js.includes("details.addEventListener('toggle'"));
 assert.ok(js.includes("if(details.open){opened=true;loadList();}"));
});
test('confirmar transferencia requiere monto y revisión humana',()=>{
 assert.ok(js.includes("n!==p.montoTransferencia"));
 assert.ok(js.includes("!check.checked"));
 assert.ok(js.includes("verificadoEnBanco:true"));
});
