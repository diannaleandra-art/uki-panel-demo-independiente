'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SCHEMA_CHECK_SQL,diagnosticarRegistroLocalesQA}=
 require('../lib/uki-locales-finanzas-diagnostico-qa.cjs');
test('diagnóstico privado consulta solo esquema y sin escritura',async()=>{
 const calls=[];
 const db={query:async(sql,args)=>{
  calls.push([sql,args]);return [{negocios:true,sucursales:true,sesiones:true,auditoria:true,registro:false}];
 }};
 const result=await diagnosticarRegistroLocalesQA({db,habilitado:false});
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],SCHEMA_CHECK_SQL);
 assert.match(calls[0][0],/^SELECT /);
 assert.doesNotMatch(calls[0][0],/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
 assert.equal(result.finanzasComprobadas,true);
 assert.equal(result.tablaBorradoresPreparada,false);
 assert.equal(result.registroHabilitado,false);
 assert.equal(result.operacionesHabilitadas,false);
 assert.equal(result.publicacionHabilitada,false);
});
test('ni un flag en frontend puede indicar listo sin tabla validada',async()=>{
 const db={query:async()=>[{negocios:true,sucursales:true,sesiones:true,auditoria:true,registro:false}]};
 const r=await diagnosticarRegistroLocalesQA({db,habilitado:true});
 assert.equal(r.registroHabilitado,false);
 assert.match(r.siguiente,/migración/);
});
test('con tabla presente y sin autorización permanece bloqueado',async()=>{
 const db={query:async()=>[{negocios:true,sucursales:true,sesiones:true,auditoria:true,registro:true}]};
 const r=await diagnosticarRegistroLocalesQA({db,habilitado:false});
 assert.equal(r.registroHabilitado,false);
 assert.equal(r.tablaBorradoresPreparada,true);
 assert.equal(r.publicacionHabilitada,false);
});
test('ni sin datos financieros ni con fallo de conexión declara listo',async()=>{
 const db={query:async()=>[{negocios:false,sucursales:true,sesiones:true,auditoria:true,registro:true}]};
 const r=await diagnosticarRegistroLocalesQA({db,habilitado:true});
 assert.equal(r.finanzasComprobadas,false);
 assert.equal(r.registroHabilitado,false);
 await assert.rejects(diagnosticarRegistroLocalesQA({db:{query:async()=>[]}}),/esquema/);
 await assert.rejects(diagnosticarRegistroLocalesQA(),/privada/);
});
test('ruta solo detrás de la sesión financiera Google y PIN, sin secretos públicos',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 const session=src.indexOf("if(!await authorized(sql,req,who))");
 const diag=src.indexOf("if(action==='locales_operativos_diagnostico_qa')");
 assert(session>=0&&diag>session);
 assert.match(src,/diagnosticarRegistroLocalesQA/);
 assert.match(src,/UKI_LOCALES_OPERATIVOS_QA_ENABLED/);
 const owner=fs.readFileSync(path.join(__dirname,'../public/uki-owner-locales-qa.mjs'),'utf8');
 assert.match(owner,/locales_operativos_diagnostico_qa/);
 assert.match(owner,/registroHabilitado/);
});
test('migración exige relación de sucursal con el mismo negocio',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../migrations/2026-11-13-registro-locales-duenos-qa.sql'),'utf8');
 assert.match(sql,/FOREIGN KEY \(sucursal_id,negocio_id\)/);
 assert.match(sql,/REFERENCES public\.fin_sucursales\(id,negocio_id\)/);
 assert.match(sql,/estado='borrador'/);
 assert.match(sql,/UNIQUE REFERENCES public\.fin_sucursales/);
});
