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
 assert.equal(backend.verify(a,a.sucursal,'2026-11',backend.dates('2026-11')),3);
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
test('XLSX conserva ficha original de cada pedido y clientes de noviembre',()=>{
 const a=core.generar(estado(),'2026-11',new Date('2026-12-06T15:00:00Z'));
 const hojas=core.hojasExcel(a);
 assert.equal(hojas.find(h=>h.nombre==='Pedidos').filas.length,1);
 assert.equal(hojas.find(h=>h.nombre==='Clientes').filas.length,1);
 assert.equal(hojas.find(h=>h.nombre==='Timbres').filas.length,1);
 const bruto=hojas.find(h=>h.nombre==='Pedidos').filas[0].at(-1);
 assert.equal(JSON.parse(bruto).detalle.length,500);
});
test('el servidor bloquea meses con registros sin fecha verificable',()=>{
 const a=core.generar(estado(),'2026-11',new Date('2026-12-06T15:00:00Z'));
 a.sinFecha.pedidos=1;
 assert.throws(()=>backend.verify(a,a.sucursal,'2026-11',backend.dates('2026-11')),/sin fecha/);
});

test('panel Uki incorpora acceso mensual sin tocar Caja ni los cobros',()=>{
 const panel=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
 const bridge=fs.readFileSync(path.join(__dirname,'../firebase/uki-archivo-mensual-panel.js'),'utf8');
 const coreUki=fs.readFileSync(path.join(__dirname,'../firebase/uki-archivo-mensual-core.js'),'utf8');
 const coreComun=fs.readFileSync(path.join(__dirname,'../public/uki-archivo-mensual-core.js'),'utf8');
 assert.equal(coreUki,coreComun,'La versión del motor mensual debe ser idéntica');
 assert.match(panel,/id="ukiArchivoMensualRoot"/);
 assert.match(panel,/src="\.\/uki-archivo-mensual-core\.js\?/);
 assert.match(panel,/src="\.\/uki-archivo-mensual-panel\.js\?/);
 assert.match(bridge,/window\.ukiCancelacionNubeLista\?\.\(\)!==true/);
 assert.match(bridge,/verificarNube\(contexto\.suc\)/);
 assert.match(bridge,/action:'consultar'/);
 assert.match(bridge,/desempaquetar\(/);
 assert.match(bridge,/\.xlsx'/);
 assert.match(bridge,/import\('\.\/uki-archivo-xlsx\.mjs'\)/);
 assert.doesNotMatch(bridge,/\bDELETE\s+FROM\b/i);
 assert.doesNotMatch(bridge,/\blocalStorage\.(clear|removeItem)\b/);
});

test('el XLSX usado por el panel Uki es un ZIP de Excel con los datos originales',async()=>{
 const original=estado(),documento=core.generar(original,'2026-11',new Date('2026-12-06T15:00:00Z'));
 const {generarXLSX}=await import('../firebase/uki-archivo-xlsx.mjs');
 const libro=generarXLSX({hojas:core.hojasExcel(documento)});
 const buffer=Buffer.from(await libro.arrayBuffer());
 assert.equal(buffer.subarray(0,2).toString('latin1'),'PK');
 assert.ok(buffer.includes(Buffer.from('xl/workbook.xml')));
 assert.ok(buffer.includes(Buffer.from('Detalle completo')));
 assert.ok(buffer.includes(Buffer.from('Ejemplo')));
 assert.equal(libro.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
test('el archivo respeta el aislamiento entre los tres locales',()=>{
 for(const [nombre,codigo] of Object.entries(core.SUCURSALES)){
  const datos=estado();
  datos.suc=nombre;
  datos.pedidos=datos.pedidos.map(x=>({...x,suc:nombre}));
  datos.cierres=datos.cierres.map(x=>({...x,suc:nombre}));
  const ajeno=core.SUCURSALES[Object.keys(core.SUCURSALES).find(x=>x!==nombre)];
  datos.pedidos.push({id:'fuera',suc:ajeno,fechaISO:'2026-11-12T14:20:00',total:9999,pagado:true});
  const archivo=core.generar(datos,'2026-11',new Date('2026-12-06T15:00:00Z'));
  assert.equal(archivo.sucursal,codigo);
  assert.equal(archivo.registros.pedidos.length,1);
  assert.equal(archivo.resumen.totalVentas,2500);
 }
});
