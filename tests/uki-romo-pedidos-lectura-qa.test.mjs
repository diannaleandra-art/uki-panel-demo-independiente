import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
test('Romo muestra una bandeja y sus pedidos ya confirmados en modo consulta',()=>{
 assert.match(s,/function vRomoPedidosConsultaQA\(\)/);
 assert.match(s,/p\.suc===ROMO_SUCURSAL_QA/);
 assert.match(s,/pedidos:\(\)=>S\.suc===ROMO_SUCURSAL_QA\?vRomoPedidosConsultaQA\(\):vPedidos\(\)/);
 assert.match(s,/La edición y cancelación siguen pendientes de guardado seguro/);
 assert.match(s,/async function ukiRomoEntregarPedidoQA\(id\)/);
 assert.match(s,/function ukiRomoAbrirTimbrePedidoQA\(id\)/);
 assert.match(s,/async function ukiRomoConfirmarTimbrePedidoQA\(id\)/);
 assert.match(s,/await ukiRomoControlPanelQA.confirmarTimbre\(/);
 assert.match(s,/ukiRomoTimbrePendienteQA=null/);
 assert.match(s,/function ukiRomoBandejaPanelHTML\(\)/);
});
test('Romo no ejecuta guardado de borradores UIKit al salir de un pedido',()=>{
 const start=s.indexOf('function ir(v){');
 const guard=s.indexOf("if(S.vista==='nuevo'&&v!=='nuevo'&&ukiCartaRemotaActiva)",start);
 const gate=s.indexOf('if(S.suc===ROMO_SUCURSAL_QA)',start);
 assert(start>=0&&gate>start&&guard>gate);
 assert.match(s.slice(gate,guard),/if\(S\.vista==='nuevo'&&v!=='nuevo'&&D\.cartaSolicitudRemotaId\)/);
 assert.match(s.slice(gate,guard),/nuevoDraft\(\)/);
 assert.match(s.slice(gate,guard),/S\.vista=v;render\(\)/);
 assert.match(s.slice(gate,guard),/return;/);
});
test('Uki mantiene sus vistas completas de pedidos, caja y clientes',()=>{
 assert.match(s,/function vPedidos\(\)/);
 assert.match(s,/function vCaja\(\)/);
 assert.match(s,/function vClientes\(\)/);
 assert.match(s,/ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
