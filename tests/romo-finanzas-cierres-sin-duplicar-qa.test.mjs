import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarResumenCierreRomoQA} from '../lib/romo-cierre-constancia-qa.mjs';
import {prepararRegistroCierreRomoDuenosQA} from '../lib/romo-cierres-duenos-repositorio-qa.mjs';
import {
 previsualizarSincronizacionCierresRomoQA,
 ROMO_FIN_SYNC_QA_DEFAULT_ENABLED
} from '../lib/romo-finanzas-sync-qa.mjs';

const FECHA='2026-11-19';
const inicio=Date.parse('2026-11-19T18:00:00-03:00');
const turno=FECHA+'@'+inicio;
const fuente='romo:serena|'+turno;
const base={
 origen:'romo',store_id:'romo:serena',sucursal:'serena',
 estado:'pendiente_confirmacion_neon',
 turno_ref:turno,fuente_unica:fuente,fecha_operativa:FECHA,
 fecha_cierre_ms:inicio+600000,venta_total:2500,pedidos:1,
 medios:{Transferencia:2500},
 gastos_cierre:0,delivery_por_pagar:0,propinas:0,retiros:0,
 caja_chica_inicial:0,caja_chica_gastos:0,efectivo_contado:0,
 diferencia_efectivo:0
};
const resumen=normalizarResumenCierreRomoQA(base,turno);
const confirmado={...resumen,estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',revision_neon:8};
const row={store_id:'romo:serena',source_key:fuente,turno_ref:turno,
 fecha_operativa:FECHA,revision_neon:8,resumen};
const identity={userId:'duena_qa',role:'duenos',brand:'romo',branches:['serena']};
const args={identity,pinVerified:true,desde:FECHA,hasta:FECHA};
function bancos({manuales=[],previos=[],constancias=[row],fallo=false}={}){
 const queries={romo:[],fin:[],writes:0};
 const dbRomo={query:async(sql,params)=>{
  queries.romo.push({sql,params});
  assert.match(sql,/SELECT store_id,source_key,turno_ref/);
  assert.deepEqual(params,['romo:serena',FECHA,FECHA]);
  return constancias;
 }};
 const dbFin={query:async(sql,params)=>{
  queries.fin.push({sql,params});
  if(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(sql)){
   queries.writes++;throw Error('La previsualización no puede escribir');
  }
  if(sql.includes('fin_romo_cierres_live_v1'))return previos;
  if(sql.includes('fin_movimientos')){
   assert.match(sql,/JOIN public.fin_negocios b/);
   assert.match(sql,/lower\(b.nombre\) LIKE '%romo%'/);
   assert.deepEqual(params,[FECHA,FECHA]);
   if(fallo)throw Error('Consulta financiera no disponible');
   return manuales;
  }
  throw Error('Consulta inesperada: '+sql);
 }};
 return {dbFin,dbRomo,queries};
}
test('Sincronización financiera QA sigue desactivada por defecto',()=>{
 assert.equal(ROMO_FIN_SYNC_QA_DEFAULT_ENABLED,false);
});
test('Un cierre confirmado se puede previsualizar sin sumar ventas ni registrar movimientos',async()=>{
 const b=bancos();
 const result=await previsualizarSincronizacionCierresRomoQA({...args,...b});
 assert.equal(result.soloLectura,true);
 assert.equal(result.pendientes,1);
 assert.equal(result.registrados,0);
 assert.equal(result.revisados,1);
 assert.equal(result.cierres[0].source_key,fuente);
 assert.equal(b.queries.writes,0);
 assert.equal(b.queries.fin.length,2);
});
test('Si existe venta manual Romo en el día del cierre se bloquea toda importación',async()=>{
 const b=bancos({manuales:[{fecha:FECHA,referencia:'cierre local',monto:2500}]});
 await assert.rejects(
  ()=>previsualizarSincronizacionCierresRomoQA({...args,...b}),
  /ventas manuales Romo en fecha de cierre/
 );
 assert.equal(b.queries.writes,0);
});
test('Ventas manuales de otra fecha no se atribuyen al cierre actual',async()=>{
 const b=bancos({manuales:[{fecha:'2026-11-18',referencia:'venta independiente',monto:2500}]});
 const result=await previsualizarSincronizacionCierresRomoQA({...args,...b});
 assert.equal(result.pendientes,1);
 assert.equal(b.queries.writes,0);
});
test('Cierre ya registrado con mismo source_key y cifras no se duplica',async()=>{
 const b=bancos({previos:[prepararRegistroCierreRomoDuenosQA(confirmado)]});
 const result=await previsualizarSincronizacionCierresRomoQA({...args,...b});
 assert.equal(result.registrados,1);
 assert.equal(result.pendientes,0);
 assert.equal(result.cierres[0].estado,'registrado_igual');
 assert.equal(b.queries.writes,0);
});
test('La ausencia de conciliación de ventas manuales no se interpreta como cero',async()=>{
 const b=bancos({fallo:true});
 await assert.rejects(
  ()=>previsualizarSincronizacionCierresRomoQA({...args,...b}),
  /Consulta financiera no disponible/
 );
 assert.equal(b.queries.writes,0);
});
test('Un registro de cierre con datos diferentes se detiene antes de cualquier escritura',async()=>{
 const registro={...prepararRegistroCierreRomoDuenosQA(confirmado),venta_total:4000};
 const b=bancos({previos:[registro]});
 await assert.rejects(
  ()=>previsualizarSincronizacionCierresRomoQA({...args,...b}),
  /mismo turno Romo ya existe con cifras diferentes/
 );
 assert.equal(b.queries.writes,0);
});
