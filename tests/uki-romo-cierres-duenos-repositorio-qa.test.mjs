import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizarResumenCierreRomoQA} from '../lib/romo-cierre-constancia-qa.mjs';
import {prepararRegistroCierreRomoDuenosQA,guardarCierreRomoDuenosQA,
 RomoCierreDuplicadoDiferenteQA,ROMO_CIERRES_DUENOS_WRITER_ENABLED_QA}
 from '../lib/romo-cierres-duenos-repositorio-qa.mjs';
const inicio=1794574800000,fin=inicio+3600000,day='2026-11-13';
const turno=day+'@'+inicio;
const identity={userId:'owner-unit',brand:'romo',role:'duenos',branches:['serena']};
const sample=()=>({
 origen:'romo',store_id:'romo:serena',sucursal:'serena',
 estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',
 fecha_operativa:day,turno_ref:turno,fuente_unica:'romo:serena|'+turno,
 fecha_cierre_ms:fin,revision_neon:3,venta_total:9000,pedidos:1,
 medios:{Efectivo:9000},gastos_cierre:600,delivery_por_pagar:2000,
 propinas:100,retiros:0,caja_chica_inicial:20000,caja_chica_gastos:250,
 efectivo_contado:9000,diferencia_efectivo:0,
 cliente:'PERSONA SENSIBLE',telefono:'+56900000000'
});
function romoReceipts(){
 const source=normalizarResumenCierreRomoQA({
  ...sample(),estado:'pendiente_confirmacion_neon'
 },turno);
 return {async query(sql,values){
  assert.match(sql,/public\.romo_cierres_constancia_v1/);
  assert.equal(values[1],source.fuente_unica);
  return [{store_id:'romo:serena',source_key:source.fuente_unica,
   turno_ref:turno,revision_neon:3,resumen:source}];
 }};
}
function mock(){
 const rows=new Map(),calls=[];
 return {calls,rows,async query(q,a){
  calls.push({q,a});
  assert.match(q,/fin_romo_cierres_live_v1/);
  if(q.startsWith('INSERT')){
   if(rows.has(a[1]))return [];
   rows.set(a[1],{
    store_id:a[0],source_key:a[1],turno_ref:a[2],
    fecha_operativa:a[3],fecha_cierre_ms:a[4],
    revision_neon:a[5],venta_total:a[6],pedidos:a[7],
    medios:JSON.parse(a[8]),gastos_cierre:a[9],
    delivery_por_pagar:a[10],propinas:a[11],retiros:a[12],
    caja_chica_inicial:a[13],caja_chica_gastos:a[14],
    efectivo_contado:a[15],diferencia_efectivo:a[16]});
   return [{source_key:a[1]}];
  }
  if(q.startsWith('SELECT'))return rows.has(a[0])?[rows.get(a[0])]:[];
  throw Error('Unexpected SQL');
 }};
}
test('cierre real Romo solo se prepara con recibo Neon y sin datos privados',()=>{
 assert.equal(ROMO_CIERRES_DUENOS_WRITER_ENABLED_QA,false);
 const p=prepararRegistroCierreRomoDuenosQA(sample());
 assert.equal(p.source_key,'romo:serena|'+turno);
 assert.equal(p.venta_total,9000);
 assert.equal(p.delivery_por_pagar,2000);
 assert.equal(p.caja_chica_gastos,250);
 assert.doesNotMatch(JSON.stringify(p),/PERSONA SENSIBLE|56900000000/);
});
test('no se atribuye a Uki ni se suma delivery como venta',()=>{
 for(const a of [
  {origen:'uki'},{store_id:'uki:serena'},
  {estado:'pendiente_confirmacion_neon'},
  {fuente_unica:'uki|serena|'+inicio},
  {fecha_operativa:'2026-11-12'},
  {revision_neon:0},
  {medios:{Efectivo:11000}},
  {caja_chica_gastos:-100}
 ])assert.throws(()=>prepararRegistroCierreRomoDuenosQA({...sample(),...a}));
});
test('dos cargas del mismo turno son idempotentes, sin duplicación de venta',async()=>{
 const db=mock();const config={db,dbRomo:romoReceipts(),identity,
  privateOwnerSessionVerified:true,resumen:sample()};
 const a=await guardarCierreRomoDuenosQA(config);
 const b=await guardarCierreRomoDuenosQA(config);
 assert.deepEqual(a,{registrado:true,duplicado:false,referencia:turno});
 assert.deepEqual(b,{registrado:false,duplicado:true,referencia:turno});
 assert.equal(db.rows.size,1);
 assert.ok(db.calls.every(x=>/fin_romo_cierres_live_v1/.test(x.q)));
});
test('duplicado con distinto monto queda bloqueado, sin sobrescribir',async()=>{
 const db=mock(),config={db,dbRomo:romoReceipts(),identity,
  privateOwnerSessionVerified:true,resumen:sample()};
 await guardarCierreRomoDuenosQA(config);
 const cambio={...sample(),venta_total:10000,medios:{Efectivo:10000}};
 await assert.rejects(guardarCierreRomoDuenosQA({...config,resumen:cambio}),
  /constancia/);
 assert.equal(db.rows.size,1);
 assert.equal(db.rows.get(sample().fuente_unica).venta_total,9000);
});
test('ni trabajador ni persona sin sesión de dueños puede importar',async()=>{
 const db=mock();
 await assert.rejects(guardarCierreRomoDuenosQA({
  db,identity,privateOwnerSessionVerified:false,resumen:sample()}),/sesión privada/);
 await assert.rejects(guardarCierreRomoDuenosQA({
  db,identity:{...identity,role:'agendador'},
  privateOwnerSessionVerified:true,resumen:sample()}),/permiso/);
 assert.equal(db.calls.length,0);
});
test('la instalación no modifica tablas de Uki ni ejecuta migraciones',()=>{
 const s=readFileSync(new URL('../migrations/romo_finanzas_cierres_plan_qa.sql',import.meta.url),'utf8');
 assert.match(s,/CREATE TABLE IF NOT EXISTS public\.fin_romo_cierres_live_v1/);
 assert.doesNotMatch(s,/ALTER TABLE|DROP TABLE|TRUNCATE TABLE|DELETE FROM|fin_uki_cierres_live_v1\s*\(/);
});
