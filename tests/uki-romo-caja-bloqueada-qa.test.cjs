'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
test('Romo no usa guardado de caja local del panel Uki hasta confirmar Neon',()=>{
 const start=src.indexOf('async function ndGuardar(){');
 const pos=src.indexOf('const nuevoPedido=',start);
 assert(start>=0&&pos>start);
 const segmento=src.slice(start,pos);
 assert.match(segmento,/if\(S\.suc===ROMO_SUCURSAL_QA\)/);
 const guardPos=segmento.indexOf('if(S.suc===ROMO_SUCURSAL_QA)');
 const reservaPos=segmento.indexOf('ukiCartaReservarRegistro(');
 assert(guardPos>=0&&reservaPos>guardPos);
 assert.match(segmento,/No se registró venta ni se modificó la caja/);
});
test('las dos sucursales originales conservan su selección',()=>{
 assert.match(src,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(src,/const ROMO_SUCURSAL_QA="Romo’s Sushi La Serena"/);
 assert.match(src,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
});
