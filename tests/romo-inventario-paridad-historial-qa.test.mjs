import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import {consultarRomoInventarioHistoricoQA as consulta} from '../public/romo-panel-qa/romo-inventario-historial-qa.mjs';
const require=createRequire(import.meta.url);
const exportUki=require('../public/romo-panel-qa/uki-inventario-exportar.js');
const exportRomo=require('../public/romo-panel-qa/romo-inventario-exportar.js');

const base=Date.parse('2026-11-18T18:00:00.000Z');
const pollo=(qty)=>({sku:'pollo-01',name:'Pollo',kind:'ingrediente',
 stock_unit:'kg',stock_qty:qty,min_stock_qty:4,available:true,archived:false});
const palta={sku:'palta-01',name:'Palta',kind:'ingrediente',
 stock_unit:'kg',stock_qty:5,min_stock_qty:7,available:true,archived:false};
const move=(tipo,sku,ms,antes,despues)=>({tipo,sku,actor:'inv_trabajador',
 fechaMs:ms,antes,despues});
const revision=(ms,worker_name,contados,entradas)=>({
 tipo:'revision',sku:'r_revision',actor:'inv_trabajador',fechaMs:ms,
 worker_name,resumen:{contados,entradas}
});
const source=()=>({ok:true,storeId:'romo:serena',revision:7,
 contenido:{version:1,items:[pollo(4),palta],movimientos:[
  move('alta','pollo-01',base,null,pollo(1)),
  move('conteo','pollo-01',base+1e3,pollo(1),pollo(2)),
  revision(base+2e3,'Ana Trabajadora',1,0),
  move('entrada','pollo-01',base+3e3,pollo(2),pollo(3)),
  move('alta','palta-01',base+4e3,null,palta),
  revision(base+5e3,'Luis Encargado',2,1),
  move('entrada','pollo-01',base+6e3,pollo(3),pollo(4))
 ]}});
test('Solo se permite el almacén autenticado Romo; nunca se lee Uki',()=>{
 assert.throws(()=>consulta({...source(),storeId:'uki:serena'},{action:'articulos'}),/solo admite/);
 assert.throws(()=>consulta(source(),{action:'otro'}),/no autorizada/);
});
test('Inventario actual y filtros por trabajador/fecha son de Romo',()=>{
 const cur=consulta(source(),{action:'articulos'});
 assert.equal(cur.branch,'romo');
 assert.equal(cur.items[0].stock_qty,4);
 const hist=consulta(source(),{action:'historial',payload:{offset:0}});
 assert.equal(hist.total,2);
 assert.equal(hist.revisiones[0].worker_name,'Luis Encargado');
 assert.equal(consulta(source(),{action:'historial',payload:{trabajador:'ana'}}).total,1);
 assert.equal(consulta(source(),{action:'historial',payload:{desde:'2026-11-19'}}).total,0);
});
test('Históricos reconstruidos NO usan el stock actual para días anteriores',()=>{
 const hist=consulta(source(),{action:'historial'}).revisiones;
 const r2=consulta(source(),{action:'revision',payload:{id:hist[0].id}}).revision;
 assert.equal(r2.items.find(x=>x.sku==='pollo-01').stock_qty,3);
 assert.equal(r2.items.find(x=>x.sku==='palta-01').stock_qty,5);
 const r1=consulta(source(),{action:'revision',payload:{id:hist[1].id}}).revision;
 assert.equal(r1.items.length,1);
 assert.equal(r1.items[0].stock_qty,2);
 assert.equal(r1.items[0].received_qty,null);
});
test('Bloquea reconstrucción si falta una operación anterior para garantizar precisión',()=>{
 const s=source();
 delete s.contenido.movimientos[6].antes;
 const id=consulta(s,{action:'historial'}).revisiones[1].id;
 assert.throws(()=>consulta(s,{action:'revision',payload:{id}}),/no conserva existencias anteriores/);
});
test('Reportes de Romo usan marca Romo, los de Uki conservan Uki',()=>{
 const rep={branch:'romo',worker_name:'Operador',created_at:new Date(base).toISOString(),
  items:[pollo(2)]};
 assert.match(exportUki.mensaje(rep),/ROMO.S SUSHI/);
 assert.match(exportUki.nombreArchivo(rep,'pdf'),/^romo-inventario-/);
 assert.match(Buffer.from(exportUki.pdf(rep)).toString('latin1'),/ROMO.S SUSHI/);
 assert.match(exportRomo.mensaje(rep),/ROMO.S SUSHI/);
 const uki={...rep,branch:'serena'};
 assert.match(exportUki.mensaje(uki),/UKI SUSHI/);
 assert.match(exportUki.nombreArchivo(uki,'pdf'),/^uki-inventario-/);
});
test('La pantalla de inventario del trabajador carga exportador válido',()=>{
 const worker=readFileSync(new URL('../public/romo-panel-qa/romo-inventario-trabajador.html',import.meta.url),'utf8');
 assert.match(worker,/<script src="\.\/romo-inventario-exportar\.js"><\/script>/);
 const js=worker.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new Script(js));
 const exporter=readFileSync(new URL('../public/romo-panel-qa/romo-inventario-exportar.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(exporter));
});
test('La consulta de reportes del panel no vuelve a Firebase Uki para Romo',()=>{
 const code=readFileSync(new URL('../public/romo-panel-qa/uki-inventario-historial-admin.js',import.meta.url),'utf8');
 assert.match(code,/fetch\('\/api\/romo-inventario-qa'/);
 assert.match(code,/method:'GET',credentials:'same-origin'/);
 assert.match(code,/consultarRomoInventarioHistoricoQA/);
 assert.match(code,/if\(b==='romo'\)/);
});
test('El servidor registra el nombre del trabajador solo en revisión autorizada',()=>{
 const api=readFileSync(new URL('../api/romo-pin-inventario-qa.js',import.meta.url),'utf8');
 const lib=readFileSync(new URL('../lib/romo-inventario-qa.mjs',import.meta.url),'utf8');
 assert.match(api,/worker_name:name/);
 assert.match(lib,/worker_name:workerName\|\|undefined/);
 assert.match(api,/workerAuthorized\(db,body.codigo,fp\)/);
});
