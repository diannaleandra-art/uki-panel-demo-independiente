'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const dir=path.resolve(__dirname,'../firebase');
const preview=fs.readFileSync(path.join(dir,'mi-administracion-vista-previa-duenos.html'),'utf8');
const production=fs.readFileSync(path.join(dir,'mi-administracion.html'),'utf8');
test('Vista previa separada de la administración existente, sin exponer registros',()=>{
 assert.match(preview,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 assert.match(preview,/Vista previa privada · No modifica tu panel actual/);
 assert.doesNotMatch(production,/id="ukiGoTodasVentas"/);
 assert.match(preview,/id="ukiGoTodasVentas"/);
 assert.match(preview,/data-uki-branch="Uki La Serena"/);
 assert.match(preview,/data-uki-branch="Uki Regimiento Arica"/);
 assert.match(preview,/id="ukiOwnerConsultar"/);
 assert.match(preview,/id="ukiOwnerClave" type="password"/);
 assert.match(preview,/id="ukiOwnerBuscarVenta"/);
 assert.match(preview,/id="ukiOwnerEstadoVenta"/);
 assert.match(preview,/id="ukiOwnerMedioVenta"/);
});
test('Sin permisos de escritura de la nube operativa; no persiste la clave',()=>{
 assert.match(preview,/const bloquearEscriturasUki=\(\)=>\{throw Error\(/);
 assert.match(preview,/writeBatch:bloquearEscriturasUki,runTransaction:bloquearEscriturasUki/);
 assert.doesNotMatch(preview,/lecturaUki\.guardar\(/);
 assert.match(preview,/if\(!auth\.currentUser\|\|!session\)/);
 assert.match(preview,/const \{revision,estado\}=await lecturaUki\.cargar\(suc,clave\)/);
 assert.match(preview,/\$\('ukiOwnerClave'\)\.value='';/);
 assert.match(preview,/if\(!user\)\{\s*\/\/ Evitar conservar pedidos descifrados en pantalla/);
 assert.doesNotMatch(preview,/localStorage\.setItem\(\s*['"]ukiOwner/);
 assert.doesNotMatch(preview,/sessionStorage\.setItem\(/);
});
test('JavaScript embebido tiene sintaxis de módulo válida',()=>{
 const scripts=[...preview.matchAll(/<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:scripts[0][1],encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});
test('Conserva acciones originales del panel de dueños en vista previa',()=>{
 for(const id of ['m-ventas','m-gastos','m-resultado','m-pendientes','saveSale','saveExpense','saveDoc','google','pin','enter','exit'])
  assert.match(preview,new RegExp('id="'+id+'"'));
 for(const tab of ['ventas','gastos','facturas','negocios'])
  assert.match(preview,new RegExp('data-go="'+tab+'"'));
 assert.match(preview,/mi-administracion-compras\.js\?v=general-v5/);
});
test('Calcula ventas y cierres ficticios sin duplicar ni cruzar sucursales',async()=>{
 const {extraerVentasUki,resumenVentasUki}=await import(pathToFileURL(path.join(dir,'uki-duenos-ventas-qa.mjs')).href);
 const {extraerCierresUki,resumirCierresUki}=await import(pathToFileURL(path.join(dir,'uki-duenos-resumen-cierres.mjs')).href);
 const arica='Uki Regimiento Arica',serena='Uki La Serena';
 const p={id:1,suc:arica,fechaISO:'2026-11-08T23:55:00',registradoEn:1794192900000,
    subtotal:20000,envio:0,total:20000,estado:'Entregado',pagado:true,medio:'Efectivo'};
 const ventas=extraerVentasUki(arica,{suc:arica,pedidos:[p,p]});
 assert.equal(ventas.length,1);
 assert.equal(resumenVentasUki([...ventas,...ventas]).cobradoLocal,20000);
 const cierre={suc:arica,fechaOperativa:'2026-11-08',fechaMs:1794196200000,venta:20000,medios:{Efectivo:20000}};
 const a=extraerCierresUki(arica,{suc:arica,cierres:[cierre,cierre]});
 const b=extraerCierresUki(serena,{suc:serena,cierres:[{...cierre,suc:serena,venta:5000,medios:{Efectivo:5000}}]});
 assert.equal(a.length,1);assert.equal(b.length,1);
 assert.equal(resumirCierresUki([a,a,b]).total.venta,25000);
});
