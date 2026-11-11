'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Blob}=require('node:buffer');
const {TextEncoder}=require('node:util');
const source=fs.readFileSync(path.join(__dirname,'../public/mi-administracion-informes.js'),'utf8')
 .replace(/^export /gm,'');
const scope={Blob,TextEncoder,Uint8Array,Number,String,Array,Object,Set,Map,Date,JSON,Math,RegExp,Error,Intl,encodeURIComponent};
vm.runInNewContext(source+'\nthis.reports={construirInforme,generarXLSX,generarPDF};',scope);
const {construirInforme,generarXLSX,generarPDF}=scope.reports;
function data(){
 return {desde:'2026-11-01',hasta:'2026-11-11',
 movimientos:[
  {id:'v1',tipo:'venta',estado:'registrado',fecha:'2026-11-10',monto:100000,
   referencia:'uki|arica|turno',medios:{Efectivo:100000},negocio:'Uki',sucursal:'Arica'},
  {id:'m1',tipo:'gasto',estado:'pagado',fecha:'2026-11-10',monto:20000,
   categoria:'Sueldos y personal',negocio:'Uki',sucursal:'Arica'},
  {id:'m2',tipo:'compra',estado:'pagado',fecha:'2026-11-10',monto:33000,
   categoria:'Equipamiento e inversiones',negocio:'Uki',sucursal:'Arica'},
  {id:'m3',tipo:'retiro',estado:'pagado',fecha:'2026-11-10',monto:10000,
   negocio:'Uki',sucursal:'Arica'},
  {id:'m4',tipo:'ingreso_extra',estado:'registrado',fecha:'2026-11-10',monto:5000,
   negocio:'Uki',sucursal:'Arica'}
 ],
 facturas:[
  {id:'f1',tipo:'compra',estado:'pagado',fecha:'2026-11-09',monto:40000,total_factura:80000,
   categoria:'Mercadería',negocio:'Uki',sucursal:'Arica',proveedor:'Proveedora Ñ'},
  {id:'f1',tipo:'compra',estado:'pagado',fecha:'2026-11-09',monto:40000,total_factura:80000,
   categoria:'Mercadería',negocio:'Uki',sucursal:'Serena',proveedor:'Proveedora Ñ'}
 ],
 cierres:[
  {branch:'arica',turno_ref:'uki|arica|turno',fecha:'2026-11-10',venta_total:100000},
  {branch:'serena',turno_ref:'uki|serena|turno',fecha:'2026-11-10',venta_total:200000,
   gastos_cierre:15000,delivery_por_pagar:5000,medios:{Transferencia:200000}}
 ],
 pendientes:[{tipo:'gasto',estado:'pendiente',fecha:'2026-10-01',monto:12000,
  proveedor:'Telefonía',negocio:'Uki',sucursal:'Serena'}]};
}
test('concilia ventas manuales y cierres sin duplicarlas',()=>{
 const r=construirInforme(data());
 assert.equal(r.totales.ventas,300000);
 assert.equal(r.totales.coincidencias,1);
 assert.equal(r.totales.ventasCierres,200000);
 assert.equal(r.totales.cierres,1);
});
test('reparte facturas sin duplicar el importe y separa inversiones',()=>{
 const r=construirInforme(data());
 assert.equal(r.totales.gastosPagados,100000);
 assert.equal(r.totales.gastosCierre,20000);
 assert.equal(r.totales.inversiones,33000);
 assert.equal(r.totales.retiros,10000);
 assert.equal(r.totales.ingresosExtra,5000);
 assert.equal(r.totales.pendiente,12000);
 assert.equal(r.totales.resultado,180000);
 assert.equal(r.hojas.find(x=>x.nombre==='Compras').filas.length,2);
});
test('XLSX es un paquete Office real con hojas y textos UTF-8',async()=>{
 const r=construirInforme(data()),b=Buffer.from(await generarXLSX(r).arrayBuffer());
 assert.equal(b.toString('ascii',0,2),'PK');
 const end=b.lastIndexOf(Buffer.from('PK\x05\x06','binary'));
 assert.ok(end>100);
 const entries=b.readUInt16LE(end+10);
 assert.ok(entries>=12);
 assert.ok(b.includes(Buffer.from('Proveedora Ñ','utf8')));
 assert.ok(b.includes(Buffer.from('xl/workbook.xml')));
});
test('PDF se genera como documento completo, no como captura de pantalla',async()=>{
 const r=construirInforme(data()),b=Buffer.from(await generarPDF(r).arrayBuffer());
 assert.equal(b.toString('latin1',0,8),'%PDF-1.4');
 assert.ok(b.toString('latin1').includes('/Type /Page'));
 assert.ok(b.toString('latin1').includes('xref'));
 assert.ok(b.toString('latin1').includes('%%EOF'));
});
test('rechaza respuestas incompletas y nunca las exporta silenciosamente',()=>{
 assert.throws(()=>construirInforme({movimientos:[],facturas:[],cierres:[]}),/datos del informe/);
});
