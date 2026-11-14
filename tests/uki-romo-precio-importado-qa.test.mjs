import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararBorradorRomoDesdeSolicitudQA as preparar}
 from '../firebase/uki-romo-recepcion-formulario-qa.mjs';
const id='123e4567-e89b-42d3-a456-426614174001';
const header=['*ROMO’S SUSHI*','N.º de pedido: QA-ROMO-001',
 'Sucursal: Romo’s Sushi La Serena','*COCINA*'];
const footer=['*ENTREGA*','Delivery','Delivery: $2.000','*PAGO*'];
function row(productos,subtotal=7000,total=9000){
 return {id,branch:'serena',estado:'pendiente',codigo_pedido:'QA-ROMO-001',
 cliente:'PRUEBA INTERNA NO CLIENTE',telefono:'',
 mensaje:[...header,...productos,...footer,'Total productos: $'+subtotal,
 'Pago: Efectivo'].join('\n'),total_indicado:total};
}
const sushi=['*− 1 × 24 piezas*','Roll 1: Pollo / Palta / Panko','Salsa: soya'];
test('solo producto explícito: recupera precio y armado sin alterar total',()=>{
 const d=preparar(row(sushi));
 assert.equal(d.items.length,1);
 assert.equal(d.items[0].precio,7000);
 assert.equal(d.items[0].cant,1);
 assert.match(d.items[0].det,/Palta \/ Panko/);
 assert.match(d.items[0].det,/Salsa: soya/);
 assert.equal(d.romoTotalIndicadoQA,9000);
 assert.equal(d.pagado,false);
});
test('dos productos nunca reciben precio repartido por conjetura',()=>{
 const d=preparar(row([...sushi,'*− 1 × 24 piezas*','Salsa: teriyaki']));
 assert.deepEqual(d.items.map(i=>i.precio),[0,0]);
});
test('subtotal inconsistente con total Neon permanece sin precio',()=>{
 assert.equal(preparar(row(sushi,7000,11000)).items[0].precio,0);
});
test('precio por cantidad: debe ser entero exacto',()=>{
 const q=['*− 2 × 24 piezas*','Salsa: soya'];
 assert.equal(preparar(row(q,7001,9001)).items[0].precio,0);
 assert.equal(preparar(row(q,7000,9000)).items[0].precio,3500);
});
test('Romo puede corregir precio importado sin duplicar producto y Uki conserva textos',()=>{
 const s=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(s,/function romoAjustarPrecioImportadoQA\(index,valor\)/);
 assert.match(s,/item\.precio=monto;render\(\)/);
 assert.match(s,/Precio unitario confirmado de/);
 assert.match(s,/onchange="romoAjustarPrecioImportadoQA/);
 assert.match(s,/const nombreLocalCobro=S\.suc===ROMO_SUCURSAL_QA\?"Romo":"Uki"/);
 assert.match(s,/Pago del delivery recibido en \$\{nombreLocalCobro\}/);
 const publicado=readFileSync(new URL('../public/romo-qa/uki-sushi-local.html',import.meta.url));
 assert.deepEqual(publicado,readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url)));
});
test('la carta pública de Romo permanece bloqueada',()=>{
 const api=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(api,/if\(config\.qaOnly\)return fail\(res,403/);
});
