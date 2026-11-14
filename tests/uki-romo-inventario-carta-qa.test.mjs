import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 conciliarInventarioCartaRomoQA,consultarConciliacionInventarioCartaRomoQA
} from '../lib/romo-inventario-carta-qa.mjs';
import {emptyRomoInventory} from '../lib/romo-inventario-qa.mjs';
const STORE='romo:serena';
const owner={userId:'owner-safe',brand:'romo',role:'duenos',branches:['serena']};
const cat=()=>({storeId:STORE,revision:1,ingredients:[
 {sku:'romo:proteina-pollo',name:'Pollo',visible:true,available:true},
 {sku:'romo:proteina-kanicama',name:'Kanicama',visible:true,available:true},
 {sku:'romo:vegetal-palta',name:'Palta',visible:true,available:false}
]});
const item=(sku,name,extra={})=>({
 sku,name,kind:'ingrediente',stock_unit:'kg',stock_qty:1,
 min_stock_qty:0.5,available:true,archived:false,...extra
});
const inv=(items=[])=>({version:1,items,movimientos:[]});
test('sin inventario no se presupone disponibilidad ni se inventan vínculos',()=>{
 const actual=cat(),orig=structuredClone(actual);
 const result=conciliarInventarioCartaRomoQA(actual,emptyRomoInventory());
 assert.equal(result.soloLectura,true);
 assert.deepEqual([result.ingredientes,result.sinVinculo,result.coinciden,result.revisar],[3,3,0,0]);
 assert.equal(result.filas[0].sugerenciaSku,null);
 assert.equal(result.modificaCarta,false);
 assert.equal(result.modificaStock,false);
 assert.deepEqual(actual,orig);
});
test('SKU de carta y SKU de inventario son distintos; sugerencia por nombre NO es vínculo',()=>{
 const state=inv([item('inventario_pollo','Pollo'),item('inventario_palta','Pálta')]);
 const c=cat(),r=conciliarInventarioCartaRomoQA(c,state,{revisionInventario:2});
 assert.equal(r.sinVinculo,3);
 assert.equal(r.filas[0].sugerenciaSku,'inventario_pollo');
 assert.equal(r.filas[0].vinculado,false);
 assert.equal(r.filas[2].sugerenciaSku,'inventario_palta');
 assert.equal(r.inventarioRevision,2);
 assert.equal(c.ingredients[0].available,true);
 assert.equal(state.items[0].available,true);
});
test('vínculo explícito consulta disponibilidad sin cambiarla',()=>{
 const state=inv([
  item('inventario_pollo','Pollo',{carta_sku:'romo:proteina-pollo'}),
  item('inventario_kanicama','Kanicama',{carta_sku:'romo:proteina-kanicama',available:false}),
  item('inventario_palta','Palta',{carta_sku:'romo:vegetal-palta',available:false})
 ]);
 const before=structuredClone(state),r=conciliarInventarioCartaRomoQA(cat(),state);
 assert.deepEqual([r.coinciden,r.sinVinculo,r.revisar],[2,0,1]);
 assert.equal(r.filas[1].estado,'disponibilidad_diferente');
 assert.equal(r.filas[1].disponibleInventario,false);
 assert.equal(r.filas[1].disponibleCarta,true);
 assert.deepEqual(state,before);
});
test('stock en cero y archivo se informan sin convertir stock en desactivación comercial',()=>{
 const state=inv([
 item('inventario_pollo','Pollo',{carta_sku:'romo:proteina-pollo',stock_qty:0}),
 item('inventario_palta','Palta',{carta_sku:'romo:vegetal-palta',archived:true,available:false})
 ]);
 const r=conciliarInventarioCartaRomoQA(cat(),state);
 assert.equal(r.filas[0].estado,'sin_stock_revisar');
 assert.equal(r.filas[2].estado,'archivado');
 assert.equal(r.revisar,2);
 assert.equal(cat().ingredients[0].available,true);
});
test('dos artículos con un mismo vínculo se señalan como duplicados',()=>{
 const state=inv([
 item('inventario_pollo1','Pollo',{carta_sku:'romo:proteina-pollo'}),
 item('inventario_pollo2','Pollo',{carta_sku:'romo:proteina-pollo'})
 ]);
 const r=conciliarInventarioCartaRomoQA(cat(),state);
 assert.equal(r.filas[0].estado,'vinculo_duplicado');
 assert.equal(r.filas[0].vinculado,false);
 assert.equal(r.filas[0].sugerenciaSku,null);
});
test('no se muestran sugerencias ambiguas de dos artículos con igual nombre',()=>{
 const r=conciliarInventarioCartaRomoQA(cat(),inv([
 item('inventario_pollo1','Pollo'),
 item('inventario_pollo2','POLLO')
 ]));
 assert.equal(r.filas[0].sugerenciaSku,null);
});
test('código de enlace a otra marca o ingredientes duplicados se bloquean',()=>{
 assert.throws(()=>conciliarInventarioCartaRomoQA(cat(),inv([
  item('inventario_pollo','Pollo',{carta_sku:'uki:proteina-pollo'})
 ])),/enlace/);
 const c=cat();c.ingredients.push({...c.ingredients[0]});
 assert.throws(()=>conciliarInventarioCartaRomoQA(c,emptyRomoInventory()),/duplicados/);
 assert.throws(()=>conciliarInventarioCartaRomoQA({...cat(),storeId:'uki:serena'},emptyRomoInventory()));
});
test('la consulta a Neon requiere dueños Romo y solo lee sus dos tablas',async()=>{
 const calls=[],state=inv([item('inventario_pollo','Pollo')]);
 const db={async query(sql,args){
  calls.push({sql,args});assert.deepEqual(args,[STORE]);
  if(sql.includes('romo_inventario_v1'))return [{revision:2,contenido:state}];
  if(sql.includes('romo_catalogo_v1'))return [{contenido:cat()}];
  throw Error('Consulta no prevista');
 }};
 const output=await consultarConciliacionInventarioCartaRomoQA({db,identity:owner});
 assert.equal(output.sinVinculo,3);
 assert.equal(output.inventarioRevision,2);
 assert.equal(calls.length,2);
 assert(calls.every(x=>!/\bINSERT\b|\bUPDATE\b|\bDELETE\b|public\.uki_/i.test(x.sql)));
 calls.length=0;
 for(const outsider of [
  {...owner,brand:'uki'},
  {...owner,role:'agendador'},
  {...owner,role:'inventario'}
 ])await assert.rejects(consultarConciliacionInventarioCartaRomoQA({
  db,identity:outsider
 }));
 assert.equal(calls.length,0);
});
test('diagnóstico de inventario solo en vista preview, nunca producción ni venta pública',()=>{
 const route=readFileSync(new URL('../api/romo-inventario-qa.js',import.meta.url),'utf8');
 assert.match(route,/req\.query\?\.diagnostico==='carta'/);
 assert.match(route,/if\(mode!=='qa'\)return fail\(res,403/);
 assert.match(route,/consultarConciliacionInventarioCartaRomoQA\(\{db,identity\}\)/);
 assert.match(route,/ROMO_INVENTARIO_QA_ENABLED==='true'/);
 const publicApi=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(publicApi,/if\(config\.qaOnly\)return fail\(res,403/);
});
test('panel ofrece revisión de carta sin modificar ventas ni UIKit',()=>{
 const s=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const copy=readFileSync(new URL('../public/romo-qa/uki-sushi-local.html',import.meta.url),'utf8');
 assert.equal(copy,s);
 assert.match(s,/function romoInventarioConciliacionHTMLQA\(d\)/);
 assert.match(s,/async function romoInventarioConciliarCartaQA\(\)/);
 assert.match(s,/romoInventarioSolicitudQA\('GET',null,'carta'\)/);
 assert.match(s,/Revisar carta e inventario \(solo dueños\)/);
 assert.match(s,/NO cambia la carta, precios, existencias ni disponibilidad pública/);
 assert.match(s,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
});
