'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const mod=import(pathToFileURL(path.resolve(__dirname,'../firebase/uki-duenos-resumen-cierres.mjs')).href);
const ARICA='Uki Regimiento Arica',SERENA='Uki La Serena';
const cierre=(suc,fecha,fechaMs,venta=16000)=>({
 suc,fechaOperativa:fecha,fechaMs,fechaISO:fecha+'T23:55:00',venta,
 pedidos:2,gastos:1000,delivery:2500,propinas:600,retiros:300,
 medios:{Efectivo:10000,Transferencia:6000},
 detalle:{pedidos:[{cliente:'NO REVELAR',telefono:'56911111111'}]}
});
test('Solo se muestran cierres definitivos, sin datos de clientes ni pedidos detallados',async()=>{
 const {extraerCierresUki}=await mod;
 const estado={suc:ARICA,pedidos:[{cliente:'DATO PRIVADO'}],clientes:{},cierres:[
  cierre(ARICA,'2026-11-08',1000),
  {...cierre(ARICA,'2026-11-08',1000),venta:99999},
  cierre(SERENA,'2026-11-09',2000),
  cierre(ARICA,'2026-11-09',3000)
 ]};
 const datos=extraerCierresUki(ARICA,estado);
 assert.equal(datos.length,2,'No se duplican cierres ni cruzan sucursales');
 assert.equal(datos.find(x=>x.id===ARICA+'|1000').venta,16000);
 assert.equal(datos[0].fecha,'2026-11-09');
 assert.equal(datos[0].gastosCierre,1000);
 assert.equal(datos[0].deliveryPorPagar,2500);
 assert.ok(!JSON.stringify(datos).includes('NO REVELAR'));
 assert.ok(!JSON.stringify(datos).includes('DATO PRIVADO'));
 assert.ok(!JSON.stringify(datos).includes('56911111111'));
 assert.ok(!datos[0].cliente&&!datos[0].detalle);
});
test('Respeta jornada operativa incluso si el cierre se hizo después de medianoche',async()=>{
 const {extraerCierresUki}=await mod;
 const state={suc:ARICA,cierres:[{...cierre(ARICA,'2026-11-08',4500),fechaISO:'2026-11-09T01:15:00'}]};
 assert.equal(extraerCierresUki(ARICA,state,{desde:'2026-11-08',hasta:'2026-11-08'}).length,1);
 assert.equal(extraerCierresUki(ARICA,state,{desde:'2026-11-09',hasta:'2026-11-09'}).length,0);
});
test('Calcula totales exactos sin confundir delivery por pagar con venta',async()=>{
 const {extraerCierresUki,resumirCierresUki}=await mod;
 const a=extraerCierresUki(ARICA,{suc:ARICA,cierres:[cierre(ARICA,'2026-11-08',3000)]});
 const b=extraerCierresUki(SERENA,{suc:SERENA,cierres:[cierre(SERENA,'2026-11-08',4000,10000)]});
 const report=resumirCierresUki([a,a,b]);
 assert.equal(report.cantidad,2,'Las lecturas repetidas de una sucursal no duplican');
 assert.equal(report.total.venta,26000);
 assert.equal(report.total.deliveryPorPagar,5000);
 assert.equal(report.total.propinas,1200);
 assert.equal(report.total.gastosCierre,2000);
 assert.equal(report.porSucursal[ARICA].venta,16000);
 assert.equal(report.porSucursal[SERENA].venta,10000);
 assert.equal(report.medios.Efectivo,20000);
});
test('Un cierre de Arica no puede leerse usando el respaldo de La Serena',async()=>{
 const {extraerCierresUki}=await mod;
 assert.throws(()=>extraerCierresUki(ARICA,{suc:SERENA,cierres:[cierre(ARICA,'2026-11-08',1)]}),/incorrecto/);
 assert.throws(()=>extraerCierresUki(ARICA,{suc:ARICA,cierres:[]},{desde:'2026-11-09',hasta:'2026-11-08'}),/fechas/);
});
test('La pantalla de dueños únicamente lee y jamás guarda datos operativos o importa ventas',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../firebase/mi-administracion.html'),'utf8');
 const lector=html.slice(html.indexOf('const bloquearEscriturasUki='),html.indexOf("const AM=["));
 assert.match(lector,/writeBatch:bloquearEscriturasUki,runTransaction:bloquearEscriturasUki/);
 assert.match(lector,/crearSnapshotsUki/);
 assert.match(html,/const \{revision,estado\}=await lecturaUki\.cargar\(suc,clave\)/);
 assert.match(html,/renderCierresDuenos\(resumirCierresUki\(\[lista\]\),revision\)/);
 assert.match(html,/No se importó ninguna venta/);
 assert.ok(!/lecturaUki\.guardar\(/.test(html));
 assert.ok(!/localStorage\.setItem\(['"]ukiOwnerClave/.test(html));
 assert.match(html,/if\(!auth\.currentUser\|\|!session\)/,'Requiere Google y PIN de dueños');
});

test('El JavaScript de la pantalla privada es válido en modo módulo',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../firebase/mi-administracion.html'),'utf8');
 const scripts=[...html.matchAll(/<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1,'El módulo privado debe ser único');
 const {spawnSync}=require('node:child_process');
 const parsed=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:scripts[0][1],encoding:'utf8'
 });
 assert.equal(parsed.status,0,parsed.stderr||'Sintaxis del panel válida');
});
