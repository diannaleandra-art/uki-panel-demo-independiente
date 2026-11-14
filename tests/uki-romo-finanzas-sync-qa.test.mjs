import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizarResumenCierreRomoQA} from '../lib/romo-cierre-constancia-qa.mjs';
import {configurarSincronizacionRomoQA,sincronizarCierresRomoDuenosQA,
 ROMO_FIN_SYNC_QA_DEFAULT_ENABLED,configurarLecturaCierresRomoQA} from '../lib/romo-finanzas-sync-qa.mjs';
const start=1794574800000,day='2026-11-13',turno=day+'@'+start;
const owner={userId:'ownerQA',brand:'romo',role:'duenos',branches:['serena']};
const data=()=>({
 origen:'romo',store_id:'romo:serena',sucursal:'serena',
 estado:'pendiente_confirmacion_neon',fecha_operativa:day,
 turno_ref:turno,fuente_unica:'romo:serena|'+turno,fecha_cierre_ms:start+3600000,
 venta_total:9000,pedidos:1,medios:{Efectivo:9000},gastos_cierre:500,
 delivery_por_pagar:2000,propinas:100,retiros:0,
 caja_chica_inicial:25000,caja_chica_gastos:0,efectivo_contado:9000,
 diferencia_efectivo:0});
const row=()=>({store_id:'romo:serena',source_key:'romo:serena|'+turno,
 turno_ref:turno,fecha_operativa:day,revision_neon:4,
 resumen:normalizarResumenCierreRomoQA(data(),turno)});
const setup=()=>{
 const original=row(),finRows=new Map(),queries=[];
 const dbRomo={async query(q,args){
  queries.push({type:'romo',q,args});
  if(q.includes('BETWEEN'))return [original];
  if(q.includes('source_key=$2'))return [original];
  throw Error('Consulta Romo inesperada');
 }};
 const dbFin={async query(q,args){
  queries.push({type:'fin',q,args});
  assert.match(q,/fin_romo_cierres_live_v1/);
  if(q.includes('source_key=ANY($2::text[])'))
   return [...finRows.values()].filter(row=>args[1].includes(row.source_key));
  if(q.startsWith('INSERT ')){
   if(finRows.has(args[1]))return [];
   finRows.set(args[1],{
    store_id:args[0],source_key:args[1],turno_ref:args[2],
    fecha_operativa:args[3],fecha_cierre_ms:args[4],revision_neon:args[5],
    venta_total:args[6],pedidos:args[7],medios:JSON.parse(args[8]),
    gastos_cierre:args[9],delivery_por_pagar:args[10],propinas:args[11],
    retiros:args[12],caja_chica_inicial:args[13],caja_chica_gastos:args[14],
    efectivo_contado:args[15],diferencia_efectivo:args[16]});
   return [{source_key:args[1]}];
  }
  if(q.startsWith('SELECT '))return finRows.has(args[0])?[finRows.get(args[0])]:[];
  throw Error('Consulta finanzas inesperada');
 }};
 return {dbFin,dbRomo,queries,finRows,original};
};
const config=({dbFin,dbRomo})=>({dbFin,dbRomo,identity:owner,pinVerified:true,
 desde:day,hasta:day});
test('configuración solo admite dos ramas QA exactas, nunca bases productivas',()=>{
 assert.equal(ROMO_FIN_SYNC_QA_DEFAULT_ENABLED,false);
 const common={VERCEL_ENV:'production',ROMO_FIN_SYNC_QA_ENABLED:'true',
  ROMO_FIN_SYNC_QA_BRANCH:'qa/integracion-panel-unico-romo-serena-20261112',
  ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech/neondb',
  ROMO_CIERRES_QA_DATABASE_URL:'postgres://qa:fake@ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech/romos_sushi'};
 assert.ok(configurarSincronizacionRomoQA(common));
 for(const update of [{ROMO_FIN_SYNC_QA_ENABLED:'false'},
  {ROMO_FIN_QA_DATABASE_URL:'postgres://user:fake@ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech/neondb'},
  {ROMO_CIERRES_QA_DATABASE_URL:'postgres://user:fake@ep-damp-sun-beofcvis.c-9.us-east-2.aws.neon.tech/romos_sushi'},
  {ROMO_FIN_SYNC_QA_BRANCH:'main'},{VERCEL_ENV:'preview'}]){
  assert.equal(configurarSincronizacionRomoQA({...common,...update}),null);
 }
});
test('sincronización trae constancias de Neon y deja una venta una vez',async()=>{
 const w=setup(),a=await sincronizarCierresRomoDuenosQA(config(w));
 assert.deepEqual([a.importados,a.existentes,a.revisados],[1,0,1]);
 const b=await sincronizarCierresRomoDuenosQA(config(w));
 assert.deepEqual([b.importados,b.existentes,b.revisados],[0,1,1]);
 assert.equal(w.finRows.size,1);
 assert.ok(w.queries.every(x=>!x.q.includes('fin_movimientos')&&!x.q.includes('fin_uki_cierres_live_v1')));
});
test('sin PIN, sin rol dueños o con fecha fuera de rango no consulta nada',async()=>{
 const w=setup();
 for(const v of [{pinVerified:false},{identity:{...owner,role:'agendador'}},
  {desde:'2026-11-14',hasta:day},{desde:day,hasta:'2026-12-25'}]){
  await assert.rejects(sincronizarCierresRomoDuenosQA({...config(w),...v}));
 }
 assert.equal(w.queries.length,0);
});
test('una constancia que no coincide con el turno no entra a Mi Administración',async()=>{
 const w=setup();w.original.resumen={...w.original.resumen,
  turno_ref:'otro-turno'};
 await assert.rejects(sincronizarCierresRomoDuenosQA(config(w)));
 assert.equal(w.finRows.size,0);
});

test('un cierre inválido al final bloquea TODO el lote antes de insertar',async()=>{
 const w=setup(),first=w.original;
 const later={...row(),
  source_key:'romo:serena|2026-11-13@1794582000000',
  turno_ref:'2026-11-13@1794582000000',
  resumen:{...row().resumen,
   turno_ref:'2026-11-13@1794582000000',
   fuente_unica:'romo:serena|2026-11-13@1794582000000',
   fecha_cierre_ms:start+10800000,
   medios:{Efectivo:7000},venta_total:9000}};
 const originalQuery=w.dbRomo.query;
 w.dbRomo.query=async(q,args)=>{
  if(q.includes('BETWEEN'))return [first,later];
  return originalQuery(q,args);
 };
 await assert.rejects(sincronizarCierresRomoDuenosQA(config(w)),
  /constancia|cuadran/i);
 assert.equal(w.finRows.size,0);
 assert.equal(w.queries.filter(x=>x.type==='fin'&&x.q.startsWith('INSERT')).length,0);
});
test('un cierre existente incompatible bloquea nuevas importaciones en el lote',async()=>{
 const w=setup();
 w.finRows.set(w.original.source_key,{
  store_id:'romo:serena',source_key:w.original.source_key,
  turno_ref:w.original.turno_ref,fecha_operativa:day,
  revision_neon:3,venta_total:8000,medios:{Efectivo:8000},
  fecha_cierre_ms:start+3600000,pedidos:1,gastos_cierre:500,
  delivery_por_pagar:2000,propinas:100,retiros:0,
  caja_chica_inicial:25000,caja_chica_gastos:0,efectivo_contado:9000,
  diferencia_efectivo:0
 });
 await assert.rejects(sincronizarCierresRomoDuenosQA(config(w)),
  /mismo turno Romo ya existe/i);
 assert.equal(w.finRows.get(w.original.source_key).venta_total,8000);
 assert.equal(w.queries.filter(x=>x.type==='fin'&&x.q.startsWith('INSERT')).length,0);
});
test('sincronización permanece apagada en servidor y panel',()=>{
 const api=readFileSync(new URL('../api/mi-administracion-live.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/mi-administracion-duenos.html',import.meta.url),'utf8');
 assert.match(api,/sincronizar_cierres_romo_qa/);
 assert.match(api,/configurarSincronizacionRomoQA/);
 assert.match(html,/ROMO_FIN_OWNER_SYNC_QA_ENABLED=false/);
});

test('la lectura del panel de dueños apunta solo a finanzas QA, nunca a Uki productivo',()=>{
 const env={VERCEL_ENV:'production',
  ROMO_FIN_CIERRES_LECTURA_QA_ENABLED:'true',
  ROMO_FIN_SYNC_QA_BRANCH:'qa/integracion-panel-unico-romo-serena-20261112',
  ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech/neondb',
  ROMO_CIERRES_QA_DATABASE_URL:'postgres://qa:fake@ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech/romos_sushi'};
 const ok=configurarLecturaCierresRomoQA(env);
 assert.ok(ok?.soloLectura);
 assert.match(ok.financeUrl,/ep-lucky-band-b5j3itkw/);
 assert.match(ok.romoUrl,/ep-gentle-paper-beusxztt/);
 for(const testEnv of [
  {ROMO_FIN_CIERRES_LECTURA_QA_ENABLED:'false'},
  {VERCEL_ENV:'preview'}, {ROMO_FIN_SYNC_QA_BRANCH:'main'},
  {ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech/neondb'},
  {ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech/other'},
  {ROMO_CIERRES_QA_DATABASE_URL:''},
  {ROMO_CIERRES_QA_DATABASE_URL:'postgres://qa:fake@ep-damp-sun-beofcvis.c-9.us-east-2.aws.neon.tech/romos_sushi'}
 ]){
  assert.equal(configurarLecturaCierresRomoQA({...env,...testEnv}),null);
 }
});
