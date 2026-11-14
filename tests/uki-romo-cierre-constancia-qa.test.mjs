import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizarResumenCierreRomoQA,consultarConstanciaRomoQA,
 confirmarCierreConConstanciaRomoQA,RomoCierreConstanciaConflictoQA}
 from '../lib/romo-cierre-constancia-qa.mjs';
const I=1794574800000,DAY='2026-11-13',T=DAY+'@'+I;
const data=()=>({origen:'romo',store_id:'romo:serena',sucursal:'serena',
 estado:'pendiente_confirmacion_neon',fecha_operativa:DAY,turno_ref:T,
 fuente_unica:'romo:serena|'+T,fecha_cierre_ms:I+3600000,
 venta_total:9000,pedidos:1,medios:{Efectivo:9000},gastos_cierre:500,
 delivery_por_pagar:2000,propinas:100,retiros:0,caja_chica_inicial:25000,
 caja_chica_gastos:0,efectivo_contado:9000,diferencia_efectivo:0});
const snapshot=()=>({formato:'uki-v813-browser',version:1,
 sucursal:'Romo’s Sushi La Serena',salt:Buffer.alloc(16,1).toString('base64'),
 iv:Buffer.alloc(12,2).toString('base64'),cifrado:Buffer.alloc(35,4).toString('base64')});
const owner={userId:'owner-q',brand:'romo',role:'duenos',branches:['serena']};
test('normaliza cifras separadas sin datos de clientes',()=>{
 const v=normalizarResumenCierreRomoQA({...data(),cliente:'dato privado'},T);
 assert.equal(v.venta_total,9000);assert.equal(v.delivery_por_pagar,2000);
 assert.equal(v.cliente,undefined);
});
test('rechaza pagos incongruentes, local equivocado o turno distinto',()=>{
 for(const p of [{origen:'uki'},{venta_total:8000},{fecha_operativa:'2026-11-12'},
 {medios:{Efectivo:-1}},{turno_ref:'otro'}])
  assert.throws(()=>normalizarResumenCierreRomoQA({...data(),...p},T));
});
test('constancia se escribe en el mismo SQL CAS de cierre',async()=>{
 let called=false;
 const db={async query(sql,args){
  assert.match(sql,/WITH pendientes AS/);
  assert.match(sql,/INSERT INTO public\.romo_cierres_constancia_v1/);
  assert.match(sql,/FROM guardado/);
  assert.equal(args[4],'romo:serena|'+T);called=true;
  return [{pendientes:0,revision:3,recibo:'romo:serena|'+T}]}};
 const r=await confirmarCierreConConstanciaRomoQA({
  db,identity:owner,expectedRevision:2,snapshot:snapshot(),turnoId:T,resumen:data()});
 assert.equal(r.constancia,true);assert.equal(called,true);
});
test('no confirma sin recibo ni CAS correcto',async()=>{
 const db={async query(){return [{pendientes:0,revision:null,recibo:null}]}};
 await assert.rejects(confirmarCierreConConstanciaRomoQA({
  db,identity:owner,expectedRevision:2,snapshot:snapshot(),turnoId:T,resumen:data()}),
  e=>e instanceof RomoCierreConstanciaConflictoQA);
});
test('finanzas rechaza alteración de monto o revisión sin Neon',async()=>{
 const p=normalizarResumenCierreRomoQA(data(),T);
 const dbRomo={async query(_sql,args){assert.equal(args[0],'romo:serena');
  return [{store_id:'romo:serena',source_key:p.fuente_unica,turno_ref:T,
   revision_neon:3,resumen:p}]}};
 const good={...data(),revision_neon:3,
  estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos'};
 assert.equal((await consultarConstanciaRomoQA({dbRomo,resumen:good})).verificada,true);
 for(const bad of [{...good,revision_neon:4},
  {...good,venta_total:10000,medios:{Efectivo:10000}}])
   await assert.rejects(consultarConstanciaRomoQA({dbRomo,resumen:bad}));
});
test('una constancia PostgreSQL jsonb con medios reordenados sigue siendo equivalente',async()=>{
 const p=normalizarResumenCierreRomoQA({
  ...data(),venta_total:9000,
  medios:{Transferencia:4000,Efectivo:5000}
 },T);
 const stored={...p,medios:{Efectivo:5000,Transferencia:4000}};
 const dbRomo={async query(){
  return [{store_id:'romo:serena',source_key:p.fuente_unica,
   turno_ref:T,revision_neon:3,resumen:stored}];
 }};
 const payload={...p,estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',revision_neon:3};
 assert.equal((await consultarConstanciaRomoQA({dbRomo,resumen:payload})).verificada,true);
});
test('la operación sigue bloqueada sin flags en el API de Romo',()=>{
 const src=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
 assert.match(src,/ROMO_CIERRE_RECIBO_LIVE_ENABLED/);
 assert.match(src,/ROMO_CIERRE_DEFINITIVO_LIVE_ENABLED/);
});