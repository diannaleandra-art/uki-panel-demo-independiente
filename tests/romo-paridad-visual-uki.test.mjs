import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

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

test('Romo no bloquea un código de carta reservado por Uki y sí detecta el suyo',()=>{
 const start=html.indexOf('if(D.codigoCarta&&(S.pedidos||[]).some');
 assert.ok(start>0,'Falta el control de duplicados exclusivo de Romo');
 const end=html.indexOf('{',start);
 assert.ok(end>start,'El control de duplicados debe ser una condición completa');
 const predicate=html.slice(start+3,end-1);
 const comprobar=(pedidos,codigoCarta)=>new Script(predicate).runInNewContext({
  S:{pedidos},D:{codigoCarta},ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena'
 });
 assert.equal(comprobar([{suc:'Uki La Serena',codigoCarta:'RS-34'}],'RS-34'),false);
 assert.equal(comprobar([{suc:'Uki Regimiento Arica',codigoCarta:'RS-34'}],'RS-34'),false);
 assert.equal(comprobar([{suc:'Romo’s Sushi La Serena',codigoCarta:' RS-34 '}],'rs-34'),true);
 assert.equal(comprobar([], 'RS-34'),false);
});
test('El formulario de delivery Romo no pide comprobar valores en Uki',()=>{
 assert.match(html,/revisa el recorrido y valor calculados por la carta de Romo antes de aceptar/);
 assert.doesNotMatch(html,/revisa el recorrido y valor calculados por Uki antes de aceptar/);
});
