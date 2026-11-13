'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {prepararNuevaSucursalQA,NEW_LOCAL_SQL}=require('../lib/uki-locales-onboarding-qa.cjs');
const a='123e4567-e89b-42d3-a456-426614174001';
const id='123e4567-e89b-42d3-a456-426614174002';
const payload={ficha:{nombre:'Nuevo local',direccion:'Una dirección real',whatsapp:'',
 instagram:'',horarios:'',plantilla:'uki-motor',color:'#bc1725',
 logoUrl:'',portadaUrl:''},negocioId:a,nombreSucursal:'La Florida',
 registroId:id,actor:'uid-google-de-pruebas'};
test('una sola operación prepara identidad nueva sin otra caja ni otro pedido',()=>{
 const r=prepararNuevaSucursalQA(payload);
 assert.equal(r.storeId,'local:'+id);
 assert.equal(r.configuracion.motor,'uki-panel-unico');
 assert.equal(r.configuracion.copiarDatos,false);
 assert(Object.values(r.configuracion.modulos).every(v=>v===false));
 assert.equal(r.args[0],a);
 assert.equal(r.args[1],'La Florida');
});
test('rechaza habilitar ventas, publicar QR, copias y sucursal vacía',()=>{
 for(const extra of [{publicado:true},{copiarDatos:true},{store_id:'uki:serena'},{modulos:{caja:true}}])
  assert.throws(()=>prepararNuevaSucursalQA({...payload,ficha:{...payload.ficha,...extra}}));
 assert.throws(()=>prepararNuevaSucursalQA({...payload,nombreSucursal:' '}),/sucursal/);
});
test('consulta SQL atómica: insertar sucursal y ficha en borrador juntas',()=>{
 assert.match(NEW_LOCAL_SQL,/WITH nueva_sucursal AS/);
 assert.match(NEW_LOCAL_SQL,/creado AS/);
 assert.match(NEW_LOCAL_SQL,/ON CONFLICT DO NOTHING/);
 assert.match(NEW_LOCAL_SQL,/FROM nueva_sucursal LIMIT 1/);
 assert.doesNotMatch(NEW_LOCAL_SQL,/SELECT id FROM public\.fin_sucursales/);
 assert.doesNotMatch(NEW_LOCAL_SQL,/sucursal_valida/);
 assert.match(NEW_LOCAL_SQL,/RETURNING id,sucursal_id,store_id,estado,revision/);
 assert.doesNotMatch(NEW_LOCAL_SQL,/fin_movimientos|fin_uki_cierres|UPDATE public\.fin_locales/);
});
test('la interfaz ofrece nuevo local sin repetir en sección de informes',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/mi-administracion-duenos.html'),'utf8');
 assert.match(html,/id="ownerLocNewBranch"/);
 const module=fs.readFileSync(path.join(__dirname,'../public/uki-owner-locales-qa.mjs'),'utf8');
 assert.match(module,/locales_operativos_crear_qa/);
 const api=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 assert.match(api,/UKI_LOCALES_OPERATIVOS_QA_ENABLED/);
 assert.match(api,/action==='locales_operativos_crear_qa'/);
});
