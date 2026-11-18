import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
function fn(name){
 const start=html.indexOf('function '+name+'(');
 assert.ok(start>=0,'Falta '+name);
 const end=html.indexOf('\n}',start);
 assert.ok(end>start);
 return html.slice(start,end+2);
}
function scenario(){
 const cards=[
  {hidden:false,getAttribute:()=> '104 02 Camila Pérez +56 9 1234 5678 CARTA-24 5678 Delivery'},
  {hidden:false,getAttribute:()=> '105 03 Arturo Ruiz +56 9 8765 4321 CARTA-25 4321 Retiro'}
 ];
 const ctx={
  S:{suc:'Romo’s Sushi La Serena'},
  ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena',
  document:{querySelectorAll:selector=>{
    assert.equal(selector,'.romo-pedido-card,.romo-solicitud-card');
    return cards;
  }}
 };
 vm.createContext(ctx);
 for(const name of ['ukiTextoBusqueda','ukiBusquedaPorDatos',
  'ukiRomoFiltrarPedidosVisiblesQA'])vm.runInContext(fn(name),ctx);
 return {ctx,cards};
}
test('Pedidos Romo: combina nombre y últimos cuatro de WhatsApp como Uki',()=>{
 const {ctx,cards}=scenario();
 ctx.ukiRomoFiltrarPedidosVisiblesQA('Camila 5678');
 assert.equal(cards[0].hidden,false);
 assert.equal(cards[1].hidden,true);
});
test('Pedidos Romo: búsqueda por código, folio y número de turno',()=>{
 const {ctx,cards}=scenario();
 for(const termino of ['CARTA-24','104','02']){
  ctx.ukiRomoFiltrarPedidosVisiblesQA(termino);
  assert.equal(cards[0].hidden,false,termino);
  assert.equal(cards[1].hidden,true,termino);
 }
});
test('Pedidos Romo: búsquedas sin resultado y vacío restauran la lista',()=>{
 const {ctx,cards}=scenario();
 ctx.ukiRomoFiltrarPedidosVisiblesQA('NoExiste');
 assert.equal(cards[0].hidden,true);
 assert.equal(cards[1].hidden,true);
 ctx.ukiRomoFiltrarPedidosVisiblesQA('');
 assert.equal(cards[0].hidden,false);
 assert.equal(cards[1].hidden,false);
});
test('Pedidos Romo: otra sucursal jamás cambia su búsqueda',()=>{
 const {ctx,cards}=scenario();
 ctx.S.suc='Uki La Serena';
 ctx.ukiRomoBusquedaPedidosQA='sin cambios';
 ctx.ukiRomoFiltrarPedidosVisiblesQA('Camila');
 assert.equal(ctx.ukiRomoBusquedaPedidosQA,'sin cambios');
 assert.equal(cards.every(card=>!card.hidden),true);
});
test('Pedidos Romo: los índices no omiten el código ni número de turno',()=>{
 assert.match(html,/const buscar=\[codigo,nombre,telefono,codigoCliente,detalle\]\.join\(' '\)/);
 assert.match(html,/esc\(\[p\.id,p\.numeroTurno,p\.cliente,p\.telefono,p\.codigoCarta,p\.codigoCliente,ukiCodigoClienteVisible\(p\)/);
 assert.match(html,/if\(window\.ukiRomoGuardadoHabilitadoQA\?\.\(\)!==true\)/);
});
