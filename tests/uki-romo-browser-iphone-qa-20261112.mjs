import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const ROOT='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let page;
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,
  isMobile:true,hasTouch:true,locale:'es-CL'
 });
 page=await context.newPage();
 // Nunca consultar Firebase, Neon, apps externas o WhatsApp durante la prueba.
 await page.route('**/*',route=>{
  const url=route.request().url();
  return url.startsWith(ROOT+'/')?route.continue():route.abort();
 });
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
 await page.goto(ROOT+'/firebase/uki-sushi-local.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.ukiInventarioPanelHTML==='function');
 // Fixture QA en navegador aislado, NO login de cliente real.
 await page.evaluate(()=>{
  S.pinSuc=null;S.suc=ROMO_SUCURSAL_QA;
  S.romoSeleccionadoQA=true;S.romoIngresadoQA=true;
  S.vista='inventario';
  document.body.classList.add('uki-operativo-bloqueado');
  render();
 });
 await page.waitForFunction(()=>document.querySelector('#ukiInvTabs h2')?.textContent.includes('Administrar Romo’s Sushi'));
 const layout=await page.evaluate(()=>{
  const host=document.getElementById('ukiInvTabs');
  const area=document.getElementById('ukiPreciosPanel');
  const buttons=[...document.querySelectorAll('[data-uki-tab]')];
  const mainNav=[...document.querySelectorAll('#nav button')];
  return {
   width:innerWidth,docWidth:document.documentElement.scrollWidth,
   host:!!host,area:!!area,
   menuTitles:buttons.map(x=>x.textContent.trim()),
   mainNav:mainNav.map(x=>x.getAttribute('aria-label')),
   buttons:buttons.map(x=>({height:Math.round(x.getBoundingClientRect().height),
    width:Math.round(x.getBoundingClientRect().width)})),
   catalogBlocked:!!document.querySelector('#ukiPriceCreate:disabled'),
   inputBlocked:!!document.querySelector('#ukiPriceSearch:disabled'),
   photosBlocked:!!document.querySelector('#ukiPromoPhoto:disabled'),
   noPizza:!document.querySelector('#ukiPromoType option[value="pizza"]'),
   noFalseData:document.getElementById('ukiPriceMessage')?.textContent.includes('todavía no conectado'),
   onlyQa:document.body.textContent.includes('no registres operaciones aquí')
  };
 });
 assert.equal(layout.host,true);
 assert.equal(layout.area,true);
 assert.equal(layout.menuTitles.length,4);
 assert.equal(layout.mainNav.length,5);
 assert.ok(layout.menuTitles.some(x=>x.includes('Carta y precios')));
 assert.ok(layout.menuTitles.some(x=>x.includes('Disponible / Agotado')));
 assert.ok(layout.menuTitles.some(x=>x.includes('Inventario')));
 assert.ok(layout.menuTitles.some(x=>x.includes('Revisiones y compras')));
 for(const key of ['catalogBlocked','inputBlocked','photosBlocked','noPizza','noFalseData','onlyQa'])
  assert.equal(layout[key],true,key);
 assert.ok(layout.buttons.every(x=>x.height>=44),'Áreas legibles en iPhone');
 assert.ok(layout.docWidth<=layout.width+2,'Sin scroll horizontal en iPhone');
 // Navegación del MISMO editor Uki, sin conectar sus acciones comerciales.
 await page.locator('[data-uki-tab="inventario"]').click();
 assert.notEqual(await page.locator('#invRoot').evaluate(x=>x.style.display),'none');
 assert.equal(await page.locator('#ukiPreciosPanel').evaluate(x=>x.style.display),'none');
 await page.locator('[data-uki-tab="precios"]').click();
 assert.notEqual(await page.locator('#ukiPreciosPanel').evaluate(x=>x.style.display),'none');
 assert.equal(await page.locator('#ukiPriceCreate').isDisabled(),true);
 await mkdir('qa-artifacts',{recursive:true});
 await page.screenshot({path:'qa-artifacts/romo-carta-iphone-390.png',fullPage:true});
 // Las cinco vistas son las originales Uki, y la nube de Romo aún bloqueada.
 for(const [tab,vista] of [['Inicio','inicio'],['Pedidos','pedidos'],['Nuevo','nuevo'],['Timbres','clientes'],['Caja','caja']]){
  await page.locator('#nav button[aria-label="'+tab+'"]').click();
  const state=await page.evaluate(()=>({
   storeId:ukiStoreIdActivoPanelQA(),suc:S.suc,vista:S.vista,
   blocked:document.body.classList.contains('uki-operativo-bloqueado'),
   appDisabled:getComputedStyle(document.getElementById('app')).pointerEvents==='none',
   navEnabled:getComputedStyle(document.getElementById('nav')).pointerEvents!=='none',
   content:document.getElementById('app').textContent.trim().length
  }));
  assert.equal(state.storeId,'romo:serena');
  assert.equal(state.suc,'Romo’s Sushi La Serena');
  assert.equal(state.vista,vista);
  assert.equal(state.blocked,true);
  assert.equal(state.appDisabled,true);
  assert.equal(state.navEnabled,true);
  assert.ok(state.content>100,'Vista original '+tab+' sin simulación');
 }
 // Regresar y comprobar que Romo no deja vista ni operaciones en Uki.
 await page.evaluate(()=>{
  await salirSuc();
  pedirPin('Uki La Serena');
 });
 const restored=await page.evaluate(()=>({
  romoVisible:!!document.getElementById('ukiInvTabs'),
  pin:S.pinSuc,unlocked:S.romoIngresadoQA,
  romoSelected:S.romoSeleccionadoQA
 }));
 assert.equal(restored.pin,'Uki La Serena');
 assert.equal(restored.romoVisible,false);
 assert.equal(restored.unlocked,false);
 assert.equal(restored.romoSelected,false);
 console.log(JSON.stringify({result:'MOBILE_UKI_TEMPLATE_ROMO_QA_OK',layout,restored,
  criticalErrors:errors.filter(x=>/SyntaxError|ReferenceError.*ukiRomo/i.test(x))}));
}finally{await browser.close()}
