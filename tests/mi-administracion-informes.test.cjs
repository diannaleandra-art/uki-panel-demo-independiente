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

test('marca diferencias entre el cierre y una venta manual sin duplicarla',()=>{
 const entrada=data();entrada.cierres[0].venta_total=115000;
 const r=construirInforme(entrada);
 assert.equal(r.totales.conflictos,1);
 assert.equal(r.totales.coincidencias,0);
 assert.equal(r.totales.ventas,300000);
 assert.match(r.mensaje,/requieren conciliaci[oó]n/);
 assert.ok(r.hojas.find(x=>x.nombre==='Ventas').filas.some(row=>String(row[3]).includes('Monto distinto')));
});
const apiSource=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
const actionCode=apiSource.slice(
 apiSource.indexOf("if(action==='exportar_informes'){"),
 apiSource.indexOf("if(action==='listar_movimientos'){")
);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const exportAction=new AsyncFunction('action','body','sql','belongs','validDate','uuid','fail','ok','res',actionCode);
const fakeId='a6e422a1-4614-4115-9aa5-cae03485e6b1';
async function probarAcceso(nombre,razon='todos'){
 const consulta=[];
 const sql={query:async(q)=>{
  consulta.push(q);
  if(q.startsWith('SELECT nombre FROM public.fin_negocios'))return [{nombre}];
  return [];
 }};
 const body={desde:'2026-11-01',hasta:'2026-11-11',negocio_id:fakeId,razon_social_id:razon};
 const r=await exportAction('exportar_informes',body,sql,async()=>{},
  x=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x),{test:()=>true},
  (_res,code,msg)=>({ok:false,code,msg}),(_res,data)=>({ok:true,...data}),{});
 return {consulta,r};
}
test('incluye cierres Uki para negocio Uki y evita mezclar cierres con Romo',async()=>{
 const uki=await probarAcceso('Uki Sushi');
 const romo=await probarAcceso("Romo's Sushi");
 assert.equal(uki.r.ok,true);
 assert.equal(romo.r.ok,true);
 assert.ok(uki.consulta.some(x=>x.includes('fin_uki_cierres_live_v1')));
 assert.ok(!romo.consulta.some(x=>x.includes('fin_uki_cierres_live_v1')));
});
test('no atribuye cierres antiguos sin razón social a una empresa filtrada',async()=>{
 const reporte=await probarAcceso('Uki Sushi','sin_clasificar');
 assert.equal(reporte.r.ok,true);
 assert.ok(!reporte.consulta.some(x=>x.includes('fin_uki_cierres_live_v1')));
});
