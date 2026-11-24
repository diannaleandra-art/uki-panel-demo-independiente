'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p=require('node:path');
const code=fs.readFileSync(p.join(__dirname,'../public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs'),'utf8');
const server=fs.readFileSync(p.join(__dirname,'../lib/seguimiento-finalizacion-atomica-qa.cjs'),'utf8');
test('agendadora comprueba banco y confirma con un solo botón, sin digitar montos',()=>{
 assert.match(code,/Confirmar: vi '\+pesos\(p\.montoTransferencia\)\+' abonados/);
 assert.match(code,/montoRecibido:p\.montoTransferencia,verificadoEnBanco:true/);
 assert.doesNotMatch(code,/amount\.type='number'|checked\.type='checkbox'/);
 assert.match(code,/if\(data\.puedeConfirmar&&p\.estadoPago!=='confirmada'/);
});
test('el servidor nunca acepta sólo Ya transferí como pago confirmado',()=>{
 assert.match(server,/t\.estado_pago='confirmada'/);
 assert.match(server,/t\.monto_transferencia=\$6/);
 assert.match(server,/t\.confirmada_en IS NOT NULL/);
 assert.match(server,/t\.abono_verificado_en IS NOT NULL/);
 assert.match(server,/AND b\.verified/);
 assert.match(server,/EXCLUDED\.estado='entregado'/);
 assert.match(server,/source_order/);
});
test('monto y sucursal se comprueban en el mismo guardado atómico',()=>{
 assert.match(server,/s\.total_indicado=\$4::integer AND s\.datos=\$5::jsonb/);
 assert.match(server,/s\.branch=\$3/);
 assert.match(server,/prior\.store_id=\$2/);
 assert.match(server,/AND prior\.monto_transferencia=\$6/);
 assert.match(server,/ON CONFLICT \(solicitud_id\) DO UPDATE/);
});
