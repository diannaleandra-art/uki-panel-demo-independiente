'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const exporter=require('../firebase/uki-inventario-exportar.js');
const report={branch:'arica',created_at:'2026-11-11T16:00:00Z',worker_name:'Trabajador QA',items:[
 {name:'Aceite',stock_qty:0,min_stock_qty:5,stock_unit:'l'},
 {name:'Ajo',stock_qty:0.5,min_stock_qty:1,stock_unit:'kg'},
 {name:'Arroz',stock_qty:20,min_stock_qty:10,stock_unit:'kg'},
 {name:'Palta',stock_qty:1,min_stock_qty:0,stock_unit:'kg'}
]};
test('WhatsApp de compras contiene únicamente faltantes con cantidades y sucursal',()=>{
 const mensaje=exporter.mensajeCompras(report);
 assert.match(mensaje,/LISTA PARA COMPRAR/);
 assert.match(mensaje,/Sucursal: Regimiento Arica/);
 assert.match(mensaje,/Aceite.*PEDIR 5 l/);
 assert.match(mensaje,/Ajo.*PEDIR 0.5 kg/);
 assert.doesNotMatch(mensaje,/Arroz|Palta/);
 assert.doesNotMatch(mensaje,/LO QUE LLEGÓ|INVENTARIO ORDENADO/);
 assert.ok(mensaje.indexOf('Aceite')<mensaje.indexOf('Ajo'));
});
test('Mensaje de compras no corta una lista de 56 productos',()=>{
 const long={...report,items:Array.from({length:56},(_,i)=>({
  name:'Insumo '+String(i+1).padStart(2,'0'),stock_qty:0,min_stock_qty:1,stock_unit:'un'
 }))};
 const mensaje=exporter.mensajeCompras(long);
 assert.match(mensaje,/Productos que se deben pedir: 56/);
 assert.match(mensaje,/Insumo 56/);
 assert.match(mensaje,/Insumo 01/);
 assert.equal(mensaje.split(' — PEDIR ').length-1,56);
});
test('Sin faltantes confirma compra no necesaria, sin inventar cantidades',()=>{
 const clean={...report,items:report.items.filter(x=>x.name==='Arroz'||x.name==='Palta')};
 const mensaje=exporter.mensajeCompras(clean);
 assert.match(mensaje,/No hay productos para pedir/);
 assert.doesNotMatch(mensaje,/PEDIR \d/);
});
test('Exportador PDF conserva reporte completo y opción de compartir archivo independiente',()=>{
 assert.equal(typeof exporter.compartirPDF,'function');
 const out=Buffer.from(exporter.pdf(report)).toString('latin1');
 assert.ok(out.startsWith('%PDF-1.4'));
 assert.match(out,/Aceite/);
 const source=fs.readFileSync('firebase/uki-inventario-exportar.js','utf8');
 assert.match(source,/navigator\.share\(\{files:\[file\],title:/);
 assert.doesNotMatch(source,/navigator\.share\(\{files:\[file\],title:'Uki Sushi · Inventario PDF',text/);
 assert.equal(source,fs.readFileSync('public/uki-inventario-exportar.js','utf8'));
});
test('Trabajador elige separadamente compartir PDF y enviar lista en WhatsApp tras guardar',()=>{
 for(const path of ['firebase/uki-inventario-turno.html','public/index.html']){
  const html=fs.readFileSync(path,'utf8');
  assert.match(html,/id="compartirPDFWhatsApp"/);
  assert.match(html,/id="enviarComprasTexto"/);
  assert.match(html,/id="descargarPDF"/);
  assert.match(html,/id="descargarExcel"/);
  assert.match(html,/mensajeCompras\(reporteFinal\)/);
  assert.match(html,/compartirPDF\(reporteFinal\)/);
  assert.match(html,/const result=await api\('finalizar'/);
  const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source,'módulo de trabajador presente');
  assert.doesNotThrow(()=>new vm.Script(source.replace(/^import .*$/gm,'')));
  const save=source.slice(source.indexOf(" $('enviar').onclick=async()=>"));
  assert.doesNotMatch(save,/navigator\.share\(\{title:/);
  assert.doesNotMatch(save,/window\.open\('https:\/\/wa\.me/);
 }
});
