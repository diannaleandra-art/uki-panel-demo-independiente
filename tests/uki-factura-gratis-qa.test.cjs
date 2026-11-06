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
 assert.match(visual,/await post\('factura-recibir'/);
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


test('factura chilena con empaque 12 KG: sugiere 12 kilos, pero exige confirmación',async()=>{
 const {leerTextoFactura}=await import(helper);
 const rows=leerTextoFactura('PECHUGA DE POLLO S/HUESO S/PIEL 12 KG 1 Un 45.983 — 45.983',
 [{name:'Pollo',sku:'ingredient:pollo',stock_unit:'kg'}]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].cantidad,'12');
 assert.equal(rows[0].unidad,'kg');
 assert.equal(rows[0].sku,'');
 assert.match(rows[0].nota,/Verifica cuánta mercadería llegó/);
 assert.equal(rows[0].sugerencia,'Pollo');
 assert.match(rows[0].nota,/Sugerencia por presentación: 1 Un × 12 KG = 12 kg/);
});
test('una foto de la vista del PDF no puede crear entradas por accidente',async()=>{
 const {leerTextoFactura}=await import(helper);
 const rows=leerTextoFactura('12:37 N\n78885.pdf - X\nCerrar',[
 {name:'Pollo',sku:'ingredient:pollo'}]);
 assert.equal(rows.length,0);
 assert.match(visual,/Subir archivo/);
});


test('PDF de proveedor con 11 artículos, dos páginas duplicadas, cantidades distintas de precios',async()=>{
 const {leerTextoFactura}=await import(helper);
 const lines=[
  'QUESO GAUDA MOLFINO BARRA X KG 3.44 Un 5.546 19.079',
  'TENEDOR PLASTICO 1000 UND (CJ) 0.1 Un 9.580 958',
  'PECHUGA DE POLLO S/HUESO S/PIEL 12 KG 1 Un 45.983 45.983',
  'CHAMPIÑONES LAM. PREMIUM 2840 GR EL BUHO (UND) 1 Un 4.034 4.034',
  'SALSA DE SOYA BIDON 5LT MAXIFOODS 1 Un 4.454 4.454',
  'PALILLOS DE SUSHI REDONDOS 100 UND 2 Un 1.092 2.185',
  'PANKO AMARILLO X 1 KG (UND) 5 Un 2.269 11.345',
  'ARROZ TUCAPEL FOOD SERVICE NACIONAL G2 (5X2 KG) 2 Un 12.597 25.193',
  'NORI GOLD YAKI 100 HOJAS 1 Un 8.395 8.395',
  'POCILLO C/TAPA 1.5 OZ (100 unds) 3 Un 1.748 5.244',
  'QUESO CREMA TOSHIKO BARRAS DE 1,36KG 3 Un 7.479 22.437'
 ];
 const rows=leerTextoFactura(lines.concat(lines).join('\n'),[]);
 assert.equal(rows.length,11,'la segunda página cedible no debe duplicar las entradas');
 const buscar=(texto)=>rows.find(x=>x.nombre.includes(texto));
 assert.equal(buscar('GAUDA').cantidad,'3.44');
 assert.equal(buscar('GAUDA').unidad,'kg');
 assert.equal(buscar('TENEDOR').cantidad,'100');
 assert.equal(buscar('POLLO').cantidad,'12');
 assert.equal(buscar('SOYA').cantidad,'5');
 assert.equal(buscar('PANKO').cantidad,'5');
 assert.equal(buscar('ARROZ').cantidad,'20');
 assert.equal(buscar('POCILLO').cantidad,'300');
 assert.equal(buscar('QUESO CREMA').cantidad,'4.08');
 assert.equal(buscar('POLLO').cantidadFactura,'1');
 assert.equal(buscar('POLLO').unidadFacturada,'un');
 assert.equal(buscar('POLLO').precioTotal,'45.983');
 assert.ok(rows.every(x=>x.requiereConfirmacion));
});
test('PDF: encabezado folio, proveedor, sucursal observada y RUT con puntos',async()=>{
 const {leerCabeceraFacturaPDF}=await import(helper);
 const h=leerCabeceraFacturaPDF(
  'COMERCIALIZADORA EJEMPLO SPA\nR.U.T: 77.111.222-3\nN° 12345\nOBSERVACIÓN: REGIMIENTO');
 assert.equal(h.proveedor,'COMERCIALIZADORA EJEMPLO SPA');
 assert.equal(h.folio,'12345');
 assert.equal(h.rut,'77.111.222-3');
 assert.equal(h.sucursalSugerida,'arica');
});
test('interfaz exige selección de líneas, presenta importes como informativos y bloquea sucursal contradictoria',()=>{
 assert.match(visual,/checked:false,saved:false/);
 assert.match(visual,/Sugerido para inventario/);
 assert.match(visual,/meta\.sucursalSugerida!==getBranch\(\)/);
});

test('revision de factura sin advertencias duplicadas, con busqueda por nombre y seleccion explicita',()=>{
 assert.equal((visual.match(/if\(f\.nota\)make\(/g)||[]).length,1);
 assert.match(visual,/Buscar por nombre/);
 assert.match(visual,/puedes prepararlo desde la misma factura arriba/);
 assert.match(visual,/buscar\.oninput=\(\)=>\{opciones\(\);preview\(\);\}/);
 assert.match(visual,/★ Sugerido:/);
 assert.match(visual,/opcionesRecepcionFactura\(getItems\(\),buscar\.value,f\.sugerencia\)/);
 assert.match(visual,/else \{select\.value='';f\.sku='';\}/);
 assert.match(visual,/checked:false,saved:false/);
});

test('sugerido primero + busqueda, sin confundir platos con ingredientes',async()=>{
 const {opcionesRecepcionFactura}=await import(helper);
 const productos=[
  {name:'4 korokes',kind:'product',sku:'menu:korokes'},
  {name:'Queso',kind:'ingredient',sku:'ingredient:queso'},
  {name:'Queso crema',kind:'inventory',sku:'inv:queso-crema'},
  {name:'Pollo',kind:'ingredient',sku:'ingredient:pollo'},
  {name:'Aceite',kind:'inventory',sku:'inv:aceite'}
 ];
 const full=opcionesRecepcionFactura(productos,'','Queso');
 assert.equal(full[0].name,'Queso');
 assert.equal(full[0].sugerido,true);
 assert.ok(!full.some(x=>x.name==='4 korokes'));
 assert.equal(full.filter(x=>x.name==='Queso').length,1);
 const search=opcionesRecepcionFactura(productos,'pollo','Queso');
 assert.deepEqual(search.map(x=>x.name),['Queso','Pollo']);
 const accent=opcionesRecepcionFactura(productos,'QUEso CREma','Queso');
 assert.deepEqual(accent.map(x=>x.name),['Queso','Queso crema']);
 assert.equal(opcionesRecepcionFactura(productos,'xyz','').length,0);
});

test('factura: registro se consulta en base QA antes del primer movimiento',()=>{
 assert.match(visual,/post\('factura-consultar',value\)/);
 assert.match(visual,/rut_emisor:el\('factRut'\)/);
 assert.match(visual,/folio:el\('factFolio'\)/);
 assert.match(visual,/Número de entrega/);
 assert.match(visual,/cantidad_total:numeroFactura\(row\.totalCantidad\)/);
 assert.match(visual,/entrega:Number\(row\.entrega\)/);
 assert.match(visual,/request_id:row\.solicitud/);
 assert.match(visual,/if\(pending\.some\(f=>!valido\(f\)\.ok\)\)/);
 assert.match(visual,/checked:false,saved:false/);
 assert.doesNotMatch(visual,/sessionStorage/);
});
test('entrada parcial y duplicados: no se suma sin validación y la caja nunca se modifica',()=>{
 assert.match(visual,/previo\+base<=limite/);
 assert.match(visual,/entregaRepetida/);
 assert.match(visual,/respuesta\.duplicada/);
 assert.match(visual,/No se pudo consultar si la factura ya está registrada/);
 assert.match(visual,/No se pudo consultar si la factura ya está registrada/);
 assert.doesNotMatch(visual,/\/api\/pagos|\/api\/caja/);
});

test('se proponen nombres cortos editables, sin asignar inventario automáticamente',async()=>{
 const {nombrePropuestoFactura}=await import(helper);
 assert.equal(nombrePropuestoFactura('QUESO GAUDA MOLFINO BARRA X KG'),'Queso gauda');
 assert.equal(nombrePropuestoFactura('PECHUGA DE POLLO S/HUESO S/PIEL 12 KG'),'Pollo');
 assert.equal(nombrePropuestoFactura('PANKO AMARILLO X 1 KG'),'Panko amarillo');
 assert.equal(nombrePropuestoFactura('ARROZ TUCAPEL 5X2 KG'),'Arroz');
});
test('preparación de varios artículos: aprobación explícita sin cantidades ni carta',()=>{
 assert.match(visual,/Preparar artículos nuevos de la factura/);
 assert.match(visual,/factAltasGuardar'\)\.onclick=async/);
 assert.match(visual,/post\('factura-preparar-articulos'/);
 assert.match(visual,/nuevaUnidad:f\.unidad\|\|''/);
 assert.match(visual,/prepararNuevo:false/);
 assert.match(visual,/stock 0 y mínimo 0/);
 assert.match(visual,/onItemsCreated\(disponibles\)/);
 assert.match(visual,/Ninguna mercadería se ha sumado/);
 assert.match(worker,/onItemsCreated:created=>/);
});
test('punto de compra al alcanzar el mínimo, no con mínimo no configurado',()=>{
 assert.match(worker,/Number\(x\.stock_qty\)<=Number\(x\.min_stock_qty\)/);
 assert.match(worker,/if\(min>0&&qty<=min\)/);
});
