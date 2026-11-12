import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {montarSolicitudesRomoEnPedidosQA,consultarSolicitudesPendientesRomoQA}
 from '../firebase/uki-romo-solicitudes-panel-qa.mjs';
function dom(isRomo){
 return new JSDOM('<body class="'+(isRomo?'romo-qa':'')+'"><main id="app">'+
  '<section id="romoLaSerenaPreparacionQA"></section></main></body>');
}
test('misma vista Pedidos, sin controlar caja ni aceptar solicitudes',()=>{
 const d=dom(true),document=d.window.document;
 assert.equal(montarSolicitudesRomoEnPedidosQA({
  document,storeId:'romo:serena',sessionVerified:true,qaOnly:true}),true);
 const box=document.getElementById('romoSolicitudesEnPanelQA');
 assert.ok(box);
 assert.equal(box.querySelector('button').disabled,true);
 assert.match(box.textContent,/no son ventas ni timbres/);
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(html,/S\.vista==='pedidos'\)\s*window\.ukiRomoSolicitudesMontarQA/);
 assert.match(html,/window\.ukiRomoPedidosQAContexto/);
 d.window.close();
});
test('no se abre bandeja desde una sucursal Uki',()=>{
 const d=dom(false),document=d.window.document;
 assert.equal(montarSolicitudesRomoEnPedidosQA({
  document,storeId:'uki:arica',sessionVerified:true,qaOnly:true}),false);
 assert.equal(document.getElementById('romoSolicitudesEnPanelQA'),null);
 d.window.close();
});
test('sin activación no se envía token Google ni se hace solicitud HTTP',async()=>{
 let token=0,fetch=0;
 await assert.rejects(consultarSolicitudesPendientesRomoQA({
  getToken:async()=>{token++;return 'x'.repeat(60)},
  fetchFn:async()=>{fetch++;throw Error('No se esperaba red')}
 }),/aún no está activada/);
 assert.equal(token,0);assert.equal(fetch,0);
});
