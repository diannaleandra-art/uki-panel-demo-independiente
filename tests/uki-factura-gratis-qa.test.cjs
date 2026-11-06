'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const helper=pathToFileURL(path.join(__dirname,'..','firebase','uki-factura-lectura-qa.mjs')).href;
const visual=fs.readFileSync(path.join(__dirname,'..','firebase','uki-factura-interfaz-qa.mjs'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'..','firebase','uki-inventario-turno-qa.html'),'utf8');
test('facturas OCR: cantidades explícitas y nunca convertir un precio en gramos',async()=>{
 const {leerTextoFactura}=await import(helper);
 const items=[{name:'Pollo',sku:'ingredient:pollo',stock_unit:'kg'},
 {name:'Aceite de prueba',sku:'inv:aceite',stock_unit:'l'}];
 const rows=leerTextoFactura('RUT 11111111-1\nPOLLO 500 g\nACEITE DE PRUEBA 750 ml\nIVA 19%\nTOTAL $12.500',items);
 assert.equal(rows.length,2);
 assert.equal(rows[0].sku,'ingredient:pollo');
 assert.equal(rows[0].cantidad,'500');assert.equal(rows[0].unidad,'g');
 assert.equal(rows[1].sku,'inv:aceite');
 assert.equal(rows[1].cantidad,'750');assert.equal(rows[1].unidad,'ml');
 assert.ok(!rows.some(r=>r.nombre.includes('TOTAL')));
});
test('coincidencias aproximadas no guardan SKU automáticamente',async()=>{
 const {coincidencia,leerTextoFactura}=await import(helper);
 const catalog=[{name:'Pollo',sku:'ingrediente:pollo'}];
 assert.equal(coincidencia('Pechuga de pollo',catalog).sku,'');
 const rows=leerTextoFactura('Pechuga de pollo 500 gr',catalog);
 assert.equal(rows.length,1);
 assert.equal(rows[0].sku,'');assert.equal(rows[0].sugerencia,'Pollo');
});
test('cantidades estrictas y unidades disponibles en lectura',async()=>{
 const {numeroFactura,unidadFactura}=await import(helper);
 assert.equal(numeroFactura('1,125'),1.125);
 assert.equal(numeroFactura('0,125'),0.125);
 assert.ok(Number.isNaN(numeroFactura('12.000,50')));
 assert.equal(unidadFactura('Lt'),'l');assert.equal(unidadFactura('Gr'),'g');
 assert.equal(unidadFactura('CAJA'),'');
});
test('lector no puede registrar sin revisión y autorización de trabajador',()=>{
 assert.match(worker,/iniciarFacturaQA/);
 assert.match(worker,/codigo:codigo\(\)/);
 assert.match(visual,/factGuardar/);
 assert.match(visual,/pending\.some\(f=>!valido\(f\)\.ok\)/);
 assert.match(visual,/await post\('recibir'/);
 assert.doesNotMatch(visual,/FormData\(|fetch\(.+\/api\/ocr/);
 assert.match(visual,/worker\.recognize\(file\)/);
});
test('XML DTE sin cantidades inventadas',async()=>{
 const {leerDTE,filasDTE}=await import(helper);
 const node=(name,text='',children=[])=>({localName:name,textContent:text||children.map(c=>c.textContent).join(''),children});
 const child=(name,value)=>node(name,String(value));
 const detail=node('Detalle','',[child('NmbItem','Aceite'),child('QtyItem','750'),child('UnmdItem','ml')]);
 const encabezado=node('Encabezado','',[
  node('IdDoc','',[child('Folio',123),child('TipoDTE',33)]),
  node('Emisor','',[child('RUTEmisor','11111111-1'),child('RznSoc','Proveedor')])
 ]);
 const doc=node('Documento','',[encabezado,detail]);
 const xml={getElementsByTagName(name){
  if(name==='parsererror')return [];
  if(name==='*')return [doc,encabezado,detail];
  return [];
 }};
 const d=leerDTE('XML', {parseFromString(){return xml;}});
 assert.equal(d.folio,'123');assert.equal(d.detalle[0].unidad,'ml');
 const rows=filasDTE(d,[{name:'Aceite',sku:'item:aceite'}]);
 assert.equal(rows[0].sku,'item:aceite');assert.equal(rows[0].cantidad,'750');
});
