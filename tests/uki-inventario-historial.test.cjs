'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const exportar=require('../firebase/uki-inventario-exportar.js');
const inv=require('../api/inventario-turno-live.js')._testing;
const report={
 branch:'arica',worker_name:'María Soto',created_at:'2026-11-07T01:45:00.000Z',
 items:[
  {name:'Pollo',kind:'ingredient',stock_qty:2.5,min_stock_qty:3,stock_unit:'kg'},
  {name:'Aceite',kind:'inventory',stock_qty:2,min_stock_qty:1,stock_unit:'l'},
  {name:'Sin mínimo',kind:'inventory',stock_qty:7,min_stock_qty:0,stock_unit:'un'}
 ]
};
test('día, fecha y hora de Chile; el inventario guardado la noche anterior no se mueve de día',()=>{
 const f=exportar.fechaChile(report.created_at);
 assert.equal(f.fecha,'06/11/2026');
 assert.match(f.dia,/viernes/i);
 assert.equal(f.hora,'22:45');
 assert.match(inv.fechaHoraChile(report.created_at),/viernes/i);
 assert.equal(inv.validDate('2026-11-06'),true);
 for(const invalid of ['2026-11-35','2026-02-30','06-11-2026','','mañana'])assert.equal(inv.validDate(invalid),false);
});
test('Excel compatible CSV incluye día, fecha, hora, responsables y cantidades; protege fórmulas',()=>{
 const value=exportar.csv(report);
 assert.ok(value.startsWith('\uFEFFsep=;\r\n'));
 assert.match(value,/Fecha";"Día";"Hora";"Sucursal";"Responsable";"Artículo"/);
 assert.match(value,/06\/11\/2026";"viernes";"22:45"/);
 assert.match(value,/María Soto/);
 assert.match(value,/Pollo/);
 assert.match(value,/2\.5/);
 assert.match(value,/Reponer/);
 assert.match(exportar.csv({...report,items:[{...report.items[0],name:'=FORMULA(1)'}]}),/'=FORMULA/);
 assert.match(exportar.nombreArchivo(report,'csv'),/uki-inventario-regimiento-arica-2026-11-06-22-45.csv/);
});
test('PDF genera estructura PDF válida, incluye fecha y crea varias páginas sin cortar registros',()=>{
 const many={...report,items:Array.from({length:100},(_,i)=>({
  name:'Artículo '+String(i).padStart(3,'0'),kind:'inventory',stock_qty:i,min_stock_qty:5,stock_unit:'un'
 }))};
 const bytes=exportar.pdf(many);
 const text=Buffer.from(bytes).toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4\n'));
 assert.match(text,/\/Type \/Catalog/);
 assert.match(text,/\/Type \/Pages/);
 assert.match(text,/\/Count 3/);
 assert.match(text,/viernes 06\/11\/2026 \| 22:45 h Chile/);
 assert.match(text,/Art.culo 099/);
 const at=Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
 assert.ok(Number.isSafeInteger(at)&&text.slice(at,at+4)==='xref');
 assert.equal(bytes.length,text.length);
});
test('WhatsApp incluye fecha completa, hora, sucursal y resumen de reposición',()=>{
 const msg=exportar.mensaje(report);
 assert.match(msg,/Regimiento Arica/);
 assert.match(msg,/viernes, 06\/11\/2026/);
 assert.match(msg,/22:45 h/);
 assert.match(msg,/María Soto/);
 assert.match(msg,/Pollo/);
});
test('listas de trabajador y administración compactas, historial protegido con Google',()=>{
 const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 for(const file of ['public/index.html','firebase/uki-inventario-turno.html']){
  const s=src(file);
  assert.match(s,/Pendientes de contar/);
  assert.match(s,/visible\.slice\(0,visibleLimit\)/);
  assert.match(s,/mostrarMas/);
  assert.match(s,/fecha/);
 }
 const ui=src('firebase/uki-inventario-historial-admin.js');
 assert.match(ui,/Historial de inventarios/);
 assert.match(ui,/Excel \(\.csv\)/);
 assert.match(ui,/WhatsApp/);
 assert.match(ui,/ukiHistoriaDesde/);
 assert.match(ui,/ukiDetalleFiltro/);
 const api=src('api/inventario-turno-live.js');
 assert.match(api,/action==='historial'/);
 assert.match(api,/action==='revision'/);
 assert.match(api,/if\(!uid\)return fail\(res,403/);
 assert.match(api,/America\/Santiago/);
 const panel=src('firebase/uki-sushi-local.html');
 assert.match(panel,/uki-inventario-exportar\.js/);
 assert.match(panel,/uki-inventario-historial-admin\.js/);
});
