'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../public/uki-archivo-mensual-core.js');
const backend=require('../api/mi-archivo-mensual-live.js')._testing;
const ubicacion='Uki Regimiento Arica';
function estado(){
 const obj={suc:ubicacion,clientes:{
  'cliente-1':{nombre:'Ejemplo',telefono:'56912345678',codigoCliente:'A1',movimientos:[
   {fechaISO:'2026-11-24T12:00:00',tipo:'venta',monto:2500}
  ]}
 }};
 for(const nombre of core.SECCIONES)obj[nombre]=[];
 obj.pedidos=[{suc:ubicacion,id:'orden-1',fechaISO:'2026-11-24T12:00:00',
  pagado:true,total:2500,telefono:'56912345678',cliente:'Ejemplo',
  detalle:'N'.repeat(500)},
  {suc:ubicacion,id:'orden-diciembre',fechaISO:'2026-12-01T12:00:00',
   pagado:true,total:1000,telefono:'56912345678'}];
 obj.cierres=[{suc:ubicacion,fechaOperativa:'2026-11-30',venta:2500}];
 return obj;
}
test('noviembre no puede archivarse antes del 5 de diciembre en Chile',()=>{
 const original=estado();
 assert.throws(()=>core.generar(original,'2026-11',new Date('2026-12-04T17:00:00Z')),
  /2026-12-05/);
 assert.equal(original.pedidos.length,2);
});
test('archivo conserva solo el mes, clientes, timbres y detalle original sin mutar',()=>{
 const original=estado(),archivo=core.generar(original,'2026-11',new Date('2026-12-06T15:00:00Z'));
 assert.equal(archivo.registros.pedidos.length,1);
 assert.equal(archivo.registros.cierres.length,1);
 assert.equal(archivo.clientes.length,1);
 assert.equal(archivo.resumen.timbres,1);
 assert.equal(archivo.resumen.totalVentas,2500);
 assert.equal(archivo.registros.pedidos[0].detalle.length,500);
 assert.equal(original.pedidos.length,2);
 assert.equal(archivo.sucursal,'uki:arica');
});
test('servidor valida periodo, cantidad y no habilita la función sin bandera',()=>{
 const a=core.generar(estado(),'2026-11',new Date('2026-12-06T15:00:00Z'));
 assert.equal(backend.verify(a,a.sucursal,'2026-11',backend.dates('2026-11')),4);
 assert.equal(backend.dates('2026-11').habilitado,'2026-12-05');
 assert.equal(backend.config({VERCEL_ENV:'production',UKI_FIN_PRIVATE_ENABLED:'true'}),null);
 assert.throws(()=>backend.verify({...a,resumen:{...a.resumen,pedidos:999}},
  a.sucursal,'2026-11',backend.dates('2026-11')),/Conteos/);
});
test('PDF no corta silenciosamente el detalle de más de 320 caracteres',async()=>{
 const archivo=core.generar(estado(),'2026-11',new Date('2026-12-06T15:00:00Z'));
 const pdf=core.pdf(archivo);
 const text=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4'));
 assert.ok((text.match(/N{20,}/g)||[]).reduce((acc,x)=>acc+x.length,0)>320);
});
test('panel exige recuperación completa y genera Excel XLSX, sin limpieza automática',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/uki-archivo-mensual-panel.js'),'utf8');
 assert.match(js,/desempaquetar\(/);
 assert.match(js,/\.xlsx'/);
 assert.match(js,/sinFecha\.length/);
 assert.doesNotMatch(js,/DELETE FROM/i);
});
