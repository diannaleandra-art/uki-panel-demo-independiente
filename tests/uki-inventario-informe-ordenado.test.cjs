'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const reports=require('../firebase/uki-inventario-exportar.js');
const inventory=require('../api/inventario-turno-live.js');
const report={branch:'arica',created_at:'2026-11-11T12:00:00Z',worker_name:'Persona de prueba',
 summary:{entradas_periodo:'Desde revisión anterior'},items:[
  {sku:'inv:1',name:'Pollo',kind:'inventory',stock_qty:2,received_qty:3,min_stock_qty:5,stock_unit:'kg'},
  {sku:'inv:2',name:'Aceite',kind:'inventory',stock_qty:0,received_qty:0,min_stock_qty:0,stock_unit:'l'},
  {sku:'inv:3',name:'Arroz',kind:'inventory',stock_qty:20,min_stock_qty:10,stock_unit:'kg'}
 ]};
test('informe muestra qué hay, llegó, falta y pide, sin mezclar unidades',()=>{
 const items=reports.filas(report);
 assert.equal(items[0].name,'Pollo');
 assert.equal(items[0].received,3);
 assert.equal(items[0].toBuy,3);
 assert.equal(items[1].status,'Bien');
 assert.equal(items[1].received,null);
 assert.equal(items[2].status,'Sin mínimo');
 const sheet=reports.tabla(report);
 assert.deepEqual(sheet[0].slice(7,14),['Lo que hay','Lo que llegó','Unidad','Mínimo','Lo que falta','Qué pedir','Estado']);
 assert.equal(sheet[1][7],2);assert.equal(sheet[1][8],3);assert.equal(sheet[1][12],3);
});
test('reportes antiguos sin registro de entradas no muestran un cero falso',()=>{
 const value=reports.filas({items:[{name:'Test',stock_qty:5,min_stock_qty:1,stock_unit:'kg'}]});
 assert.equal(value[0].received,null);
 assert.equal(reports.tabla({...report,items:[{name:'Test',stock_qty:5,min_stock_qty:1,stock_unit:'kg'}]})[1][8],'');
});
test('CSV abre en Excel y no ejecuta fórmulas de nombres',()=>{
 const csv=reports.csv({...report,items:[{name:'=IMPORTDATA(1)',stock_qty:1,received_qty:0,min_stock_qty:2,stock_unit:'un'}]});
 assert.ok(csv.startsWith('\uFEFFsep=;'));
 assert.match(csv,/'=IMPORTDATA\(1\)/);
});
test('PDF multi página con estructura y grupos de reposición',()=>{
 const many={...report,items:Array.from({length:80},(_,i)=>({
  name:'Articulo '+i,kind:'inventory',stock_qty:i,received_qty:i%3,
  min_stock_qty:20,stock_unit:'un'}))};
 const bytes=reports.pdf(many),text=Buffer.from(bytes).toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4'));
 assert.match(text,/\/Count [2-9]/);
 assert.match(text,/PARA REPONER/);
 assert.match(text,/EXISTENCIAS SUFICIENTES/);
 assert.match(text,/startxref\n\d+\n%%EOF/);
});
test('trabajadores y administración conservan conteos, entradas, permisos y descargas',()=>{
 for(const p of ['public/index.html','firebase/uki-inventario-turno.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  assert.match(html,/api\('finalizar'/);
  assert.match(html,/save\(item,'contar'/);
  assert.match(html,/save\(item,'recibir'/);
  assert.match(html,/id="descargarPDF"/);
  assert.match(html,/id="descargarExcel"/);
  assert.match(html,/reporteFinal/);
  assert.match(html,/id="codigo"/);
 }
 const admin=fs.readFileSync(path.join(__dirname,'../firebase/uki-inventario-historial-admin.js'),'utf8');
 assert.match(admin,/ukiDetalleExcel/);assert.match(admin,/ukiDetallePDF/);
 assert.match(admin,/ukiInvWorkerAccess/);
});
test('entradas verificadas vienen de los movimientos del servidor sin confundir conteos',async()=>{
 const sql={query:async(text,args)=>{
  assert.equal(args[0],'arica');
  if(text.startsWith('SELECT created_at'))return [{created_at:'2026-11-11T10:00:00Z'}];
  if(text.includes('SUM(cantidad_base)'))return [{sku:'ingredient:pollo',recibida:'3.5'}];
  if(text.includes('SUM(quantity)'))return [{sku:'inv:otro',recibida:'2'}];
  throw Error('Consulta inesperada');
 }};
 const result=await inventory._testing.entradasDesdeUltimaRevision(sql,'arica');
 assert.equal(result.periodo,'Desde revisión anterior');
 assert.equal(result.bySku.get('ingredient:pollo'),3.5);
 assert.equal(result.bySku.get('inv:otro'),2);
});
