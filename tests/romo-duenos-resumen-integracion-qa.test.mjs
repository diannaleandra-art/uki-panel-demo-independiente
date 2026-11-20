import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/mi-administracion-duenos.html',import.meta.url),'utf8');
const modulo=readFileSync(new URL('../public/uki-duenos-romo-cierres-conciliados-qa.mjs',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/romo-cierres-duenos-consulta-qa.js',import.meta.url),'utf8');

test('Mi Administración enlaza cierres Romo a totales solo luego de verificación Google+PIN',()=>{
 assert.match(html,/import \{conciliarCierresRomoResumenQA\} from/);
 assert.match(html,/lecturaAutorizada:romoCierresConsultaValidaQA&&Boolean\(session\)&&Boolean\(auth\.currentUser\)/);
 assert.match(html,/movimientosCompletos:movimientosFinancierosCargadosQA&&transactions\.length<250/);
 assert.match(html,/movimientosFinancierosCargadosQA=true/);
 assert.match(html,/movimientosFinancierosCargadosQA=false/);
 assert.match(html,/cierresConfirmadosRomoQA=rows;romoCierresConsultaValidaQA=true/);
 assert.match(html,/cierresConfirmadosRomoQA=\[\];romoCierresConsultaValidaQA=false/);
 assert.match(html,/items:\[\.\.\.vistaUki\.items,\.\.\.romoVista\.items\]/);
 assert.match(html,/mostrarVentasFinancieras\(\)/);
 assert.match(api,/owner\.role!=='duenos'/);
 assert.match(api,/x-fin-session/);
 assert.match(api,/incluidoEnContabilidad:false/);
});
test('Romo aparece en su negocio, no en la caja o la venta de Uki',()=>{
 assert.match(html,/const romo=x\.marca==='romo'/);
 assert.match(html,/k=romo\?'romo-serena'/);
 assert.match(html,/romo\?'Romo’s Sushi · La Serena'/);
 assert.match(modulo,/source_key/); // validación local de la clave de cierre
 assert.match(modulo,/STORE='romo:serena'/);
 assert.doesNotMatch(modulo,/\bfetch\s*\(/);
});
test('Delivery por pagar queda separado del gasto de caja, no se resta como pago realizado',()=>{
 assert.match(modulo,/delivery:0,deliveryPorPagar:c\.delivery_por_pagar/);
 assert.match(html,/Repartidores Romo por pagar/);
 assert.match(html,/item\.marca==='romo'\?item\.deliveryPorPagar:item\.delivery/);
 assert.match(html,/cierresSumables/);
});
test('No se importa a Neon finanzas ni se modifica el ingreso Uki desde la vista privada',()=>{
 assert.doesNotMatch(modulo,/INSERT INTO|UPDATE public\.fin_movimientos|DELETE FROM/);
 assert.match(html,/NO generan asiento contable/);
 assert.match(html,/ROMO_CIERRES_PRIVADOS_URL/);
});
