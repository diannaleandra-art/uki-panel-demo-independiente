'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const cut=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'No se encontró '+start);
 return html.slice(a,b);
};
test('El inventario de productos se confirma en pantalla sin crear venta ni cobro',()=>{
 const code=cut('function ukiProductoManualUI(){','function ukiCatalogoManualUI(){');
 const state={ultimoAgregado:null},one={nombre:'36 piezas clásicas',cant:1,precio:11800,skuCarta:'classic:36'},D={items:[one]};
 let rendered=0,scrolled=0;
 const ctx={ukiCatalogoManual:state,D,S:{vista:'nuevo'},render:()=>rendered++,
 requestAnimationFrame:fn=>fn(),
 document:{getElementById:id=>({scrollIntoView:()=>{if(id==='ukiResumenProductosPedido')scrolled++}})},
 esc:x=>String(x),fmt:n=>'$'+n};
 const api=vm.runInNewContext(code+'\n({ukiProductoManualUI,ukiProductoAgregadoMensaje,ukiConfirmarProductoAgregado})',ctx);
 assert.match(api.ukiProductoManualUI(),/Agregar producto manual/);
 assert.match(api.ukiProductoManualUI(),/id="pNom"/);
 assert.match(api.ukiProductoManualUI(),/id="pPre"/);
 assert.match(api.ukiProductoManualUI(),/id="pCant"/);
 api.ukiConfirmarProductoAgregado(one);
 assert.equal(rendered,1);assert.equal(scrolled,1);
 assert.match(api.ukiProductoAgregadoMensaje(),/Agregado al pedido/);
 assert.match(api.ukiProductoAgregadoMensaje(),/36 piezas clásicas/);
 assert.match(api.ukiProductoAgregadoMensaje(),/todavía no se ha guardado ni cobrado/);
 D.items=[];assert.equal(api.ukiProductoAgregadoMensaje(),'');
});
test('Formulario manual aparece encima de carta y confirmación arriba del listado',()=>{
 assert.match(html,/ukiResumenPiezasSeleccionManual\(\)\+ukiProductoManualUI\(\)\+ukiCatalogoManualUI\(\)/);
 assert.match(html,/id="ukiResumenProductosPedido"/);
 assert.match(html,/ukiProductoAgregadoMensaje\(\)/);
 assert.match(html,/ukiCatalogoManual\.seleccion=-1;ukiConfirmarProductoAgregado/);
 assert.match(html,/function addItem\(\)/);
 assert.match(html,/ukiConfirmarProductoAgregado\(D\.items\[D\.items\.length-1\]\)/);
 assert.match(html,/ultimoAgregado=null/);
});
test('El código principal conserva sintaxis válida',()=>{
 const main=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!m[1].includes('src=')).map(m=>m[2])
  .find(s=>s.includes('function ukiProductoManualUI(){'));
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
});
