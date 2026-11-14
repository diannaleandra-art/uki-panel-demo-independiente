import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararBorradorRomoDesdeSolicitudQA} from '../firebase/uki-romo-recepcion-formulario-qa.mjs';
const panel=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const pedido=readFileSync(new URL('../firebase/uki-romo-pedido-formato-qa.mjs',import.meta.url),'utf8');
const msg=[
 '*ROMO’S SUSHI*','N.º de pedido: QA-ROMO-001',
 'Sucursal: Romo’s Sushi La Serena','*COCINA*','*− 1 × 24 piezas*',
 'Pollo, palta, panko','*ENTREGA*','Delivery','Delivery: $2000',
 'Pago: Efectivo'
].join('\n');
test('borrador de Romo conserva la fecha local de Chile (no UTC)',()=>{
 const prev=process.env.TZ;
 try{
  process.env.TZ='America/Santiago';
  const row={id:'686d8928-445a-4c5a-acef-014a96b1d4f1',
   estado:'pendiente',branch:'serena',codigo_pedido:'QA-ROMO-001',
   mensaje:msg,total_indicado:9000,cliente:'PRUEBA INTERNA NO CLIENTE',telefono:''};
  const before=Date.now();
  const draft=prepararBorradorRomoDesdeSolicitudQA(row);
  const after=Date.now();
  const local=new Date(draft.fecha).getTime();
  assert.ok(local>=before-60000&&local<=after+60000,
   'Fecha de borrador no corresponde a la hora local');
  assert.equal(draft.telefono,'');
  assert.equal(draft.pagado,false);
  assert.equal(draft.envio,2000);
  assert.equal(draft.codigoCarta,'QA-ROMO-001');
 }finally{
  if(prev===undefined)delete process.env.TZ;else process.env.TZ=prev;
 }
});
test('pantalla marca QA-ROMO-001 sin timbre ni WhatsApp',()=>{
 assert.match(panel,/const romoPedidoDemoQA=S\.suc===ROMO_SUCURSAL_QA/);
 assert.match(panel,/D\.codigoCarta==='QA-ROMO-001'/);
 assert.match(panel,/PRUEBA INTERNA · Sin cliente real ni timbre/);
 assert.match(panel,/romoPedidoDemoQA\?"Prueba interna · sin timbre"/);
 assert.match(pedido,/if\(!p\.pagado\|\|p\.productosPagadosOtroLocal\|\|tel\.length<8\)return/);
});
