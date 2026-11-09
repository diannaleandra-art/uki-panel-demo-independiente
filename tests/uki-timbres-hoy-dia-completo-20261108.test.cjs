'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const a=html.indexOf('function ukiFechaCalendarioChile(');
const b=html.indexOf('let filtroFechaTimbres=',a);
assert.ok(a>0&&b>a);
const ctx={S:{suc:'Uki Regimiento Arica',pedidos:[]},
  fechaRegistroMs:p=>Number(p.registradoEn)||0};
vm.createContext(ctx);
vm.runInContext(html.slice(a,b),ctx);
const dia=(fecha)=>ctx.ukiFechaCalendarioChile(fecha);
test('Timbres: todas las horas del 8 de noviembre, antes y después de cerrar caja',()=>{
 assert.equal(dia('2026-11-08T00:01:00-03:00'),'2026-11-08');
 assert.equal(dia('2026-11-08T10:36:00-03:00'),'2026-11-08');
 assert.equal(dia('2026-11-08T23:59:00-03:00'),'2026-11-08');
 assert.equal(dia('2026-11-09T00:01:00-03:00'),'2026-11-09');
});
test('Se usa la fecha REAL del timbre, sin reasignar al día operativo del cierre',()=>{
 ctx.S.pedidos=[{suc:'Uki Regimiento Arica',id:244,registradoEn:Date.parse('2026-11-08T12:00:00-03:00')}];
 assert.equal(ctx.ukiFechaTimbreCalendario({pedidoId:244,fecha:'2026-11-08T21:30:00-03:00'}),'2026-11-08');
 assert.equal(ctx.ukiFechaTimbreCalendario({pedidoId:244,fecha:'2026-11-09T00:15:00-03:00'}),'2026-11-09');
 assert.equal(ctx.ukiFechaTimbreCalendario({pedidoId:244}),'2026-11-08');
});
test('El panel conserva los cierres intactos: cambios de visualización solo Timbres',()=>{
 const s=html.slice(html.indexOf('function vClientes(){'),html.indexOf('function compartirImagenTimbres(',html.indexOf('function vClientes(){')));
 assert.match(s,/const fecha=filtroFechaTimbres\|\|ukiFechaCalendarioChile\(Date\.now\(\)\)/);
 assert.match(s,/ukiFechaTimbreCalendario\(m\)===fecha/);
 assert.match(s,/const movimientosDelDia=lista\.flatMap/);
 assert.match(s,/m\.tipo==='venta'/);
 assert.match(s,/Timbres de hoy/);
 assert.match(s,/Timbres ganados el/);
 assert.match(s,/timbres ganados en esta fecha/i);
 assert.doesNotMatch(s,/S\.cierres\s*=/);
 assert.doesNotMatch(s,/S\.pedidos\.push/);
});
test('Los timbres repetidos de un mismo cliente se cuentan por movimiento',()=>{
 const registros=[
 {tipo:'venta',fecha:'2026-11-08T08:00:00-03:00'},
 {tipo:'venta',fecha:'2026-11-08T21:00:00-03:00'},
 {tipo:'venta',fecha:'2026-11-07T23:50:00-03:00'},
 {tipo:'canje6',fecha:'2026-11-08T20:00:00-03:00'}
 ];
 const ventas=registros.filter(m=>m.tipo==='venta'&&ctx.ukiFechaTimbreCalendario(m)==='2026-11-08');
 assert.equal(ventas.length,2);
});
test('JS principal del panel mantiene sintaxis válida',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const main=scripts.find(x=>x.includes('function vClientes(){'));
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
});
