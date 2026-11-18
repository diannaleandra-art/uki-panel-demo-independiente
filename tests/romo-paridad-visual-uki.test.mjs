import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');

test('Romo utiliza el mismo formulario de cobro de Uki, sin esconderlo en CSS',()=>{
 assert.match(html,/<div class="card" id="ukiPagoPedidoSoloUki">/);
 assert.doesNotMatch(html,/body\.romo-operativo-preparacion\s+#ukiPagoPedidoSoloUki\s*\{\s*display\s*:\s*none\s*!important/i);
 assert.match(html,/body\.romo-operativo-preparacion\s+#ukiPagoPedidoSoloUki\s*\{\s*display\s*:\s*block\s*!important/i);
 assert.match(html,/<b>Pago completo confirmado<\/b>/);
 assert.match(html,/Dividir entre varios medios/);
 assert.match(html,/ukiPropinaUI\(sub\)/);
 assert.match(html,/Pago de productos recibido en/);
 assert.match(html,/ukiMontoProductosOtroLocal/);
});
test('El mismo formulario permite guardar pago completo en un solo paso mediante Neon Romo',()=>{
 assert.match(html,/D\.pagado\s*\?\s*[`'"]/);
 assert.match(html,/prepararCobroPendienteRomoQA\(clone,/);
 assert.match(html,/confirmoPago:pagoConfirmadoAhora/);
 assert.match(html,/ukiValidarTimbreAntesGuardar\(D,/);
 assert.match(html,/S\.suc===ROMO_SUCURSAL_QA/);
});
test('Conserva acceso a la caja propia y el código de su sesión Romo',()=>{
 assert.match(html,/if\(S\.suc===ROMO_SUCURSAL_QA\)return ukiRomoCajaPestanasQA\(\)/);
 assert.match(html,/window\.ukiRomoSesionRemotaQA/);
});
