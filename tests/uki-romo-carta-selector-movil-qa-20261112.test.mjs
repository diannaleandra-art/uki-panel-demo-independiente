import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {montarCartaRomoDesdeSelectorQA,ROMO_CARTA_SELECTOR_SOLO_QA}
 from '../firebase/uki-romo-carta-selector-qa.mjs';

const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const loader=readFileSync(new URL('../firebase/uki-romo-carta-selector-qa.mjs',import.meta.url),'utf8');
function dom(isRomo=true){
 const buttons=['precios','disponibilidad','inventario','reportes'].map(x=>
  '<button data-uki-tab="'+x+'" type="button"><strong>'+x+'</strong></button>').join('');
 const sample='<html><body class="'+(isRomo?'romo-qa':'')+'"><main id="app">'+
  '<section id="romoLaSerenaPreparacionQA"></section>'+
  '<section id="ukiInvTabs"><h2>Administrar Uki Sushi</h2><div>'+buttons+'</div></section>'+
  '<section id="ukiAdminViewHeader"><h2 id="ukiAdminCurrentTitle"></h2>'+
  '<p id="ukiAdminCurrentDescription"></p><button id="ukiAdminCambiar"></button></section>'+
  '<div id="ukiInvSucursalActiva"></div><div id="ukiInvSucursalActual"></div>'+
  '<section id="ukiPreciosPanel"><input id="ukiPriceSearch" placeholder="Pizza, gohan, 24 piezas…">'+
  '<details id="ukiPriceAddBox"><p class="muted">De momento admite pizzas en Regimiento Arica y entradas simples.</p><input id="ukiPriceNewName" placeholder="Ej. Pizza Cuatro Quesos">'+
  '<select id="ukiPriceNewKind"><option value="pizza">Pizza</option><option value="dish">Gohan</option></select>'+
  '<button id="ukiPriceCreate">Guardar</button></details><button id="ukiPriceReload">Actualizar</button>'+
  '<select id="ukiPromoType"><option value="pizza">Pizza</option><option value="sushi">Sushi</option></select>'+
  '<p id="ukiPriceMessage"></p><div id="ukiPromosListaResumen"></div></section>'+
  '<section id="ukiCartaDisponibilidad">Disponibilidad</section>'+
  '<div id="ukiInvSectionHead"></div><div id="invRoot"><button>Modificar inventario</button><p id="invStatus"></p></div>'+
  '<section id="invAdmin"></section><div id="invNewBox"></div><div id="ukiInvWorkerAccess"></div>'+
  '<div id="ukiMiniInventario"></div><div id="ukiReponerPanel"><p id="ukiReponerEstado"></p></div>'+
  '<div id="ukiHistorial"></div><div id="invReportsBox"></div></main></body></html>';
 return new JSDOM(sample,{url:'https://qa.local/'});
}

test('una sola entrada de sucursal, con mismo menú principal y mismo ingreso Uki',()=>{
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/const ROMO_SUCURSAL_QA="Romo’s Sushi La Serena"/);
 assert.match(html,/SUCURSALES_PANEL_QA=Object\.freeze\(LOCALES_PANEL_QA\.map\(local=>local\.nombre\)\)/);
 assert.match(html,/await ukiValidarClaveUkiParaRomoQA\(pass\)/);
 assert.match(html,/ÚNICO motor de navegación/);
 assert.match(html,/VISTAS\.map\(\(\[k,l,icon\]\)=>/);
 assert.match(html,/window\.ukiInventarioPanelHTML\?\.\(\)/);
 assert.doesNotMatch(html,/Romo Regimiento Arica/);
});
test('en Romo, administración usa la misma plantilla de Uki sin montar sus APIs',()=>{
 assert.equal(ROMO_CARTA_SELECTOR_SOLO_QA,true);
 assert.match(html,/if\(S\.suc===ROMO_SUCURSAL_QA&&S\.vista==='inventario'\)/);
 assert.match(loader,/No se monta window\.ukiInventarioMontar/);
 assert.doesNotMatch(loader.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''),/fetch\(|neon\(|localStorage|indexedDB/);
 assert.match(html,/Mismas funciones de Uki/);
 assert.doesNotMatch(html,/function vRomoQA\(\)/);
});
test('al abrir Romo quedan sus productos, clientes y caja bloqueados, sin nombres de Uki',()=>{
 const d=dom(),document=d.window.document;
 const result=montarCartaRomoDesdeSelectorQA({document,qaOnly:true,
  selectorValido:true,ingresoLocalVerificado:true});
 assert.equal(result.montado,true);
 assert.equal(result.soloLectura,true);
 assert.equal(result.storeId,'romo:serena');
 assert.deepEqual(result.tabs,['precios','disponibilidad','inventario','reportes']);
 assert.match(document.getElementById('ukiInvTabs').textContent,/Administrar Romo’s Sushi/);
 assert.match(document.getElementById('ukiInvSucursalActiva').textContent,/Romo’s Sushi La Serena/);
 assert.equal(document.getElementById('ukiPriceCreate').disabled,true);
 assert.equal(document.getElementById('ukiPriceReload').disabled,true);
 assert.equal(document.getElementById('ukiPriceSearch').disabled,true);
 assert.equal(document.getElementById('ukiPriceNewKind').querySelector('option[value=pizza]'),null);
 assert.equal(document.getElementById('ukiPromoType').querySelector('option[value=pizza]'),null);
 assert.match(document.getElementById('ukiPriceMessage').textContent,/Catálogo Romo todavía no conectado/);
 d.window.close();
});
test('mismos cuatro controles administrativos cambian de área, pero no disparan operaciones',()=>{
 const d=dom(),document=d.window.document,events=[];
 d.window.fetch=()=>{events.push('fetch');throw Error('Red prohibida')};
 montarCartaRomoDesdeSelectorQA({document,qaOnly:true,selectorValido:true,ingresoLocalVerificado:true});
 const selector=sel=>document.querySelector('[data-uki-tab="'+sel+'"]');
 selector('inventario').click();
 assert.equal(document.getElementById('invRoot').style.display,'');
 assert.equal(document.getElementById('ukiPreciosPanel').style.display,'none');
 selector('reportes').click();
 assert.equal(document.getElementById('ukiReponerPanel').style.display,'');
 assert.equal(document.getElementById('invRoot').style.display,'none');
 selector('precios').click();
 assert.equal(document.getElementById('ukiPreciosPanel').style.display,'');
 assert.equal(selector('precios').getAttribute('aria-pressed'),'true');
 assert.equal(document.getElementById('ukiPriceCreate').disabled,true);
 assert.deepEqual(events,[]);
 d.window.close();
});
test('Romo jamás monta plantilla en una sucursal Uki ni sin ingreso QA',()=>{
 for(const [active,entered] of [[false,true],[true,false],[true,true]]){
  const d=dom(active);
  const r=montarCartaRomoDesdeSelectorQA({document:d.window.document,qaOnly:true,
   selectorValido:active,ingresoLocalVerificado:entered});
  assert.equal(r.montado,active&&entered);
  d.window.close();
 }
});
test('el panel mantiene la tipografía original y sólo cambia el color del local Romo',()=>{
 assert.match(html,/name="viewport" content="width=device-width/);
 assert.match(html,/body\.romo-qa #romoLaSerenaPreparacionQA\{background:#fff!important;color:#171717!important/);
 assert.match(html,/const VISTAS=\[\["inicio","Inicio","⌂"\],\["pedidos","Pedidos","▤"\]/);
 assert.match(html,/\$\("app"\)\.innerHTML=msg\+romoAviso\+f\(\)/);
 assert.match(html,/function ukiRomoIrQA\(v\)/);
});
