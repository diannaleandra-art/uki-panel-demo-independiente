import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {montarCartaRomoDesdeSelectorQA,ROMO_CARTA_SELECTOR_SOLO_QA}
 from '../firebase/uki-romo-carta-selector-qa.mjs';

const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const loader=readFileSync(new URL('../firebase/uki-romo-carta-selector-qa.mjs',import.meta.url),'utf8');
const view=readFileSync(new URL('../firebase/romo-carta-qa/romo-carta-vista-embebida-qa.mjs',import.meta.url),'utf8');
function dom(isRomo=true){
 const host={id:'ukiPreciosPanel',children:[],append(node){this.children.push(node)},
 contains(node){return this.children.includes(node)}};
 const root={id:'romoLaSerenaPreparacionQA'};
 const document={
  body:{classList:{contains:k=>isRomo&&k==='romo-qa'}},
  getElementById(id){
   if(id==='ukiPreciosPanel')return host;
   if(id==='romoLaSerenaPreparacionQA')return root;
   return host.children.find(x=>x.id===id)||null;
  },
  createElement(name){return {nodeName:name,id:'',innerHTML:'',hidden:false}}
 };
 return {document,host};
}
test('se conserva el mismo selector de 2 Uki y solo Romo Balmaceda',()=>{
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/const ROMO_SUCURSAL_QA="Romo’s Sushi La Serena"/);
 assert.match(html,/SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
 assert.doesNotMatch(html,/Romo Regimiento Arica/);
 assert.match(html,/Balmaceda 1612/);
});
test('Carta y precios se abre desde el ingreso Romo existente sin otro login',()=>{
 assert.match(html,/function ukiRomoAbrirCartaQA\(\)/);
 assert.match(html,/function ukiRomoRegresarInicioQA\(\)/);
 assert.match(html,/onclick="ukiRomoAbrirCartaQA\(\)">Carta y precios/);
 assert.match(html,/id="ukiPreciosPanel" class="romo-qa-precios"/);
 assert.match(html,/S\.romoIngresadoQA\?[\s\S]*?Carta y precios/);
 assert.match(html,/await ukiValidarClaveUkiParaRomoQA\(pass\)/);
 assert.match(html,/window\.ukiRomoCartaQAMontar\?\.\(\)/);
 assert.match(html,/ukiRomoVistaCartaSeleccionadaQA=false;\s*S\.romoSeleccionadoQA=false;/);
 assert.match(html,/ukiRomoVistaCartaSeleccionadaQA=false;\s*S\.pinSuc=null;S\.romoSeleccionadoQA=true;/);
});
test('no se conecta Neon ni se alteran pedidos, precios o caja a través del selector QA',()=>{
 assert.equal(ROMO_CARTA_SELECTOR_SOLO_QA,true);
 assert.match(html,/src="\.\/uki-romo-carta-selector-qa\.mjs"/);
 assert.match(loader,/snapshot:null/);
 const code=loader.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
 assert.doesNotMatch(code,/fetch\(|\.query\(|localStorage|neon\(|indexedDB|uki-carta-precios-live/);
 assert.match(loader,/storeId:STORE/);
 assert.match(view,/No se han creado productos ni promociones ficticios/);
 assert.match(html,/Aún no están conectados los pedidos, caja, inventario y cierres independientes de Romo/);
});
test('vista de Romo entra solo con prueba local confirmada y sólo en la sucursal Romo',()=>{
 const {document,host}=dom();
 assert.deepEqual(montarCartaRomoDesdeSelectorQA({document,qaOnly:true,
  selectorValido:true,ingresoLocalVerificado:false}).montado,false);
 assert.equal(host.children.length,0);
 const r=montarCartaRomoDesdeSelectorQA({document,qaOnly:true,
  selectorValido:true,ingresoLocalVerificado:true});
 assert.equal(r.montado,true);assert.equal(r.soloLectura,true);
 assert.equal(host.children.length,1);
 assert.match(host.children[0].innerHTML,/Carta y precios · Romo’s Sushi La Serena/);
 assert.match(host.children[0].innerHTML,/Categorías/);
 assert.match(host.children[0].innerHTML,/Productos/);
 assert.match(host.children[0].innerHTML,/Promociones/);
 assert.match(host.children[0].innerHTML,/Ingredientes/);
 assert.doesNotMatch(host.children[0].innerHTML,/Guardar|Publicar|Enviar pedido|Pagar ahora/);
});
test('ni marca distinta ni vista fuera de Romo montan categorías, aunque existiera el módulo',()=>{
 const {document,host}=dom(false);
 const r=montarCartaRomoDesdeSelectorQA({document,qaOnly:true,
  selectorValido:true,ingresoLocalVerificado:true});
 assert.equal(r.montado,false);assert.equal(host.children.length,0);
 const d=dom(true);const x=montarCartaRomoDesdeSelectorQA({document:d.document,
  qaOnly:false,selectorValido:true,ingresoLocalVerificado:true});
 assert.equal(x.montado,false);assert.equal(d.host.children.length,0);
});
test('vista móvil mantiene letras oscuras, botones visibles y las áreas Uki intocables',()=>{
 assert.match(html,/name="viewport" content="width=device-width/);
 assert.match(html,/body\.romo-qa #romoLaSerenaPreparacionQA\{background:#fff!important;color:#171717!important/);
 assert.match(html,/min-height:44px/);
 assert.match(html,/aria-pressed/);
 assert.match(html,/background:#a8212a!important;color:#fff!important/);
 assert.match(loader,/No crea segundo panel/);
 assert.match(html,/function ukiVolverAlSelectorLocales\(\)/);
});
