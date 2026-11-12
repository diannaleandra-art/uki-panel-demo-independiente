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
 // El ensayo no envía nada a Firebase, Neon, WhatsApp ni al inventario Uki.
 await page.route('**/*', route=>{
  const url=route.request().url();
  return url.startsWith(ROOT+'/')?route.continue():route.abort();
 });
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
 await page.goto(ROOT+'/firebase/uki-sushi-local.html',{waitUntil:'domcontentloaded'});
 // Abre la vista sólo visualmente, sin afirmar haber autenticado a un usuario.
 // Esta manipulación de fixtures ocurre dentro del navegador de CI aislado.
 await page.evaluate(()=>{
  S.pinSuc=null;
  S.suc=null;
  S.romoSeleccionadoQA=true;
  S.romoIngresadoQA=true;
  ukiRomoVistaCartaSeleccionadaQA=true;
  render();
 });
 await page.waitForFunction(
  ()=>!!document.getElementById('romoCartaQAContenido')&&
    document.getElementById('romoCartaQAContenido').innerHTML.includes('Categorías'),
  {timeout:12000}
 );
 const layout=await page.evaluate(()=>{
  const host=document.getElementById('ukiPreciosPanel');
  const area=document.getElementById('romoCartaQAContenido');
  const buttons=[...document.querySelectorAll('.romo-selector-carta-qa button')];
  return {
   width:innerWidth,docWidth:document.documentElement.scrollWidth,
   host:!!host,area:!!area,buttons:buttons.map(x=>({text:x.textContent.trim(),
    width:Math.round(x.getBoundingClientRect().width),
    height:Math.round(x.getBoundingClientRect().height)})),
   categories:area?.textContent.includes('Categorías'),
   products:area?.textContent.includes('Productos'),
   promos:area?.textContent.includes('Promociones'),
   ingredients:area?.textContent.includes('Ingredientes'),
   containsDemoData:/Postre Romo QA|Cliente de prueba/.test(area?.textContent||''),
   onlyQa:/Vista privada de pruebas|No guarda ni publica/.test(document.body.textContent),
   showingLoading:host?.textContent.includes('Preparando vista de solo lectura de Romo'),
   liveOrderButton:!!document.querySelector('.romo-qa #ukiPreciosPanel button[type=submit]')
  };
 });
 assert.equal(layout.host,true);
 assert.equal(layout.area,true);
 assert.equal(layout.categories,true);
 assert.equal(layout.products,true);
 assert.equal(layout.promos,true);
 assert.equal(layout.ingredients,true);
 assert.equal(layout.containsDemoData,false);
 assert.equal(layout.liveOrderButton,false);
 assert.equal(layout.showingLoading,false,'El aviso provisional debe retirarse al aparecer la carta');
 assert.equal(layout.buttons.length,2);
 assert.ok(layout.buttons.every(x=>x.height>=43),'Botones accesibles en móvil');
 assert.ok(layout.docWidth<=layout.width+2,'Sin scroll horizontal en iPhone');
 await mkdir('qa-artifacts',{recursive:true});
 await page.screenshot({path:'qa-artifacts/romo-carta-iphone-390.png',fullPage:true});
 // Regresar y comprobar que Romo no dejó su vista dentro de Uki.
 await page.evaluate(()=>{
  ukiVolverAlSelectorLocales();
  pedirPin('Uki La Serena');
 });
 const restored=await page.evaluate(()=>({
  romoVisible:!!document.getElementById('romoCartaQAContenido'),
  pin:S.pinSuc,
  unlocked:S.romoIngresadoQA,
  romoSelected:S.romoSeleccionadoQA
 }));
 assert.equal(restored.pin,'Uki La Serena');
 assert.equal(restored.romoVisible,false);
 assert.equal(restored.unlocked,false);
 assert.equal(restored.romoSelected,false);
 console.log(JSON.stringify({result:'MOBILE_QA_OK',layout,restored,criticalErrors:errors.filter(x=>/SyntaxError|ReferenceError.*ukiRomo/i.test(x))}));
}finally{await browser.close()}
