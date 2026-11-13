import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmarCierreRomoEnNeonQA}
 from '../lib/romo-estado-operativo-qa.mjs';
import {crearPuenteRomoOperativoQA}
 from '../firebase/uki-romo-operativo-qa.mjs';
const SUC='Romo’s Sushi La Serena',turnoId='2026-11-13@1794574800000';
const identity={userId:'encargado_qa',brand:'romo',role:'agendador',branches:['serena']};
const snapshot={
 formato:'uki-v813-browser',version:1,sucursal:SUC,
 salt:'AAAAAAAAAAAAAAAAAAAAAA==',iv:'AAAAAAAAAAAAAAAA',
 cifrado:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
};
test('cierre Neon: exige rol con cash.close, solo almacena snapshot cifrado',async()=>{
 const sql=[];
 const db={query:async(query,args)=>{
  sql.push({query,args});return [{pendientes:0,revision:4}];
 }};
 const result=await confirmarCierreRomoEnNeonQA({
  db,identity,expectedRevision:3,snapshot,turnoId
 });
 assert.equal(result.revision,4);assert.equal(result.estado,'cierre_confirmado');
 assert.equal(sql.length,1);
 assert.match(sql[0].query,/COUNT\(\*\)::integer AS n/);
 assert.match(sql[0].query,/estado='pendiente'/);
 assert.match(sql[0].query,/WHERE store_id=\$1 AND revision=\$2 AND \(SELECT n FROM pendientes\)=0/);
 assert.match(sql[0].query,/UPDATE public\.romo_estado_operativo_v1/);
 assert.deepEqual(sql[0].args,[ 'romo:serena',3,JSON.stringify(snapshot),'encargado_qa' ]);
});
test('pendientes remotos: no confirma cierre ni incrementa revisión',async()=>{
 const db={query:async()=>[{pendientes:2,revision:null}]};
 await assert.rejects(confirmarCierreRomoEnNeonQA({
  db,identity,expectedRevision:3,snapshot,turnoId
 }),e=>e.code==='ROMO_CIERRE_PENDIENTES');
});
test('dos equipos con misma revisión no cierran dos veces',async()=>{
 let rev=1,writes=0;
 const db={query:async(sql,args)=>{
  if(args[1]!==rev)return [{pendientes:0,revision:null}];
  writes++;rev++;return [{pendientes:0,revision:rev}];
 }};
 const x={db,identity,expectedRevision:1,snapshot,turnoId};
 await confirmarCierreRomoEnNeonQA(x);
 await assert.rejects(confirmarCierreRomoEnNeonQA(x),
  e=>e.code==='REVISION_CONFLICTO');
 assert.equal(writes,1);
});
test('sin rol cash.close, sin turno válido o con snapshot en claro se rechaza',async()=>{
 let calls=0;
 const db={query:async()=>{calls++;return []}};
 await assert.rejects(confirmarCierreRomoEnNeonQA({
  db,identity:{...identity,role:'inventario'},expectedRevision:1,snapshot,turnoId
 }));
 await assert.rejects(confirmarCierreRomoEnNeonQA({
  db,identity,expectedRevision:1,snapshot,turnoId:'turno-1'
 }));
 await assert.rejects(confirmarCierreRomoEnNeonQA({
  db,identity,expectedRevision:1,snapshot:{...snapshot,cifrado:'texto cliente'},turnoId
 }));
 assert.equal(calls,0);
});
test('el navegador transmite solo resumen agregado, turno y cifrado; nunca claves ni clientes',async()=>{
 const sent=[];
 const bridge=crearPuenteRomoOperativoQA({
  habilitado:true,
  cifrar:async()=>{},descifrar:async()=>{},validarEstado:()=>true,
  getGoogleToken:async()=>('GoogleTokenQA'.repeat(6)),
  fetchFn:async(url,opt)=>{
   sent.push(JSON.parse(opt.body));
   return {ok:true,status:200,json:async()=>({
    ok:true,storeId:'romo:serena',revision:2,
    turnoId,estado:'cierre_confirmado'
   })};
  }
 });
 const resumen={
  origen:'romo',store_id:'romo:serena',sucursal:'serena',
  estado:'pendiente_confirmacion_neon',fecha_operativa:'2026-11-13',
  turno_ref:turnoId,fuente_unica:'romo:serena|'+turnoId,
  fecha_cierre_ms:1794578400000,venta_total:9000,pedidos:1,
  medios:{Efectivo:9000},gastos_cierre:0,delivery_por_pagar:0,
  propinas:0,retiros:0,efectivo_contado:9000,
  diferencia_efectivo:0,caja_chica_inicial:0,caja_chica_gastos:0
 };
 const result=await bridge.guardarCierreSobreCifrado({
  snapshot,revision:1,turnoId,resumen
 });
 assert.equal(result.revision,2);
 assert.deepEqual(Object.keys(sent[0]).sort(),
  ['expectedRevision','operation','resumen','snapshot','turnoId'].sort());
 assert(!('password' in sent[0]));
 assert.deepEqual(sent[0].resumen,resumen);
 assert.doesNotMatch(JSON.stringify(sent[0].resumen),/cliente|telefono|password|productos/i);
 assert.equal(sent[0].operation,'cierre_definitivo');
});
test('el servidor exige bandera de cierre adicional a la de Romo',()=>{
 const api=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
 assert.match(api,/ROMO_CIERRE_DEFINITIVO_LIVE_ENABLED!=='true'/);
 assert.match(api,/ROMO_CIERRE_RECIBO_LIVE_ENABLED!=='true'/);
 assert.match(api,/esCierre\?await store\.confirmarCierreConConstanciaRomoQA/);
 assert.match(api,/operation\|resumen\|snapshot\|turnoId/);
});
