import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
function functionSource(name){
 const start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'Debe existir '+name);
 const end=source.indexOf('\n}',start);
 assert.ok(end>start,'Debe cerrarse '+name);
 return source.slice(start,end+2);
}
function setup(){
 const cli={_ukiClave:'tarjeta-ana',nombre:'Ana López',telefono:'+56 9 1111 2222',codigoCliente:'2222'};
 const otro={_ukiClave:'tarjeta-pablo',nombre:'Pablo Soto',telefono:'+56 9 5555 6666',codigoCliente:'6666'};
 const tarjeta1={hidden:false,querySelector:()=>({getAttribute:()=>cli._ukiClave})};
 const tarjeta2={hidden:false,querySelector:()=>({getAttribute:()=>otro._ukiClave})};
 const ctx={
  ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena',
  S:{suc:'Romo’s Sushi La Serena'},
  document:{querySelectorAll:selector=>{
    assert.equal(selector,'.romo-cliente-card');return [tarjeta1,tarjeta2];
  }},
  ukiTarjetasAgrupadas:()=>[cli,otro],
  ukiCodigoClienteVisible:p=>String(p.codigoCliente||''),
  ukiTelefonoNormalizado:t=>String(t||'').replace(/\D/g,''),
  pedidosHist:(nombre)=>nombre===cli.nombre?
   [{cliente:'Ana Pérez',codigoCliente:'4444',telefono:'+56 9 3333 4444'}]:[]
 };
 vm.createContext(ctx);
 for(const n of ['ukiTextoBusqueda','ukiBusquedaPorDatos',
   'ukiRomoClienteCoincideBusquedaQA','ukiRomoFiltrarClientesQA'])
  vm.runInContext(functionSource(n),ctx);
 return {ctx,cli,otro,tarjeta1,tarjeta2};
}

test('Cliente Romo: búsqueda actual por nombre, código y teléfono',()=>{
 const {ctx,cli}=setup();
 for(const valor of ['ana lopez','2222','11112222'])
  assert.equal(ctx.ukiRomoClienteCoincideBusquedaQA(cli,valor),true,valor);
});
test('Cliente Romo: conserva búsqueda por nombre, código y WhatsApp históricos',()=>{
 const {ctx,cli}=setup();
 for(const valor of ['perez','4444','33334444'])
  assert.equal(ctx.ukiRomoClienteCoincideBusquedaQA(cli,valor),true,valor);
 assert.equal(ctx.ukiRomoClienteCoincideBusquedaQA(cli,'cliente inexistente'),false);
});
test('Cliente Romo: búsqueda vacía y no contaminación entre tarjetas',()=>{
 const {ctx,cli,otro}=setup();
 assert.equal(ctx.ukiRomoClienteCoincideBusquedaQA(cli,'  '),true);
 assert.equal(ctx.ukiRomoClienteCoincideBusquedaQA(otro,'perez'),false);
});
test('Cliente Romo: filtro visual consulta historial sin tocar otras sucursales',()=>{
 const {ctx,tarjeta1,tarjeta2}=setup();
 ctx.ukiRomoFiltrarClientesQA('4444');
 assert.equal(tarjeta1.hidden,false);
 assert.equal(tarjeta2.hidden,true);
 ctx.S.suc='Uki La Serena';
 tarjeta1.hidden=true;tarjeta2.hidden=false;
 ctx.ukiRomoFiltrarClientesQA('4444');
 assert.equal(tarjeta1.hidden,true);
 assert.equal(tarjeta2.hidden,false);
});
test('La vista de Clientes usa la misma búsqueda; no se habilita escritura',()=>{
 assert.match(source,/const clientes=todos\.filter\(cli=>buscar\?\s*ukiRomoClienteCoincideBusquedaQA\(cli,buscar\)/);
 assert.match(source,/if\(window\.ukiRomoGuardadoHabilitadoQA\?\.\(\)!==true\)/);
 assert.match(source,/if\(S\.suc===ROMO_SUCURSAL_QA\)return ukiRomoTimbresPanelQA\(\)/);
});
