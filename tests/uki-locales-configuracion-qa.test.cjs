'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizarFichaLocal,storeIdConocido,MODULOS}=require('../lib/uki-locales-config-qa.cjs');
const b='123e4567-e89b-42d3-a456-426614174001',s='123e4567-e89b-42d3-a456-426614174002';
const ids={negocios:[{id:b}],sucursales:[{id:s,negocio_id:b}]};
const ficha={negocio_id:b,sucursal_id:s,nombre:"Romo's Sushi La Serena",
 direccion:'Balmaceda 1612, La Serena',whatsapp:'+56 9 9241 2147',
 instagram:'@Romo.s__sushi',horarios:'10:00 a 23:00',
 plantilla:'uki-motor',color:'#ad1c2d',logoUrl:'',portadaUrl:''};
test('mismo motor sin copiar pedidos, datos ni abrir venta',()=>{
 const x=normalizarFichaLocal(ficha,ids);
 assert.equal(x.motor,'uki-panel-unico');assert.equal(x.copiarDatos,false);
 assert.equal(x.whatsapp,'+56992412147');assert.equal(x.instagram,'@Romo.s__sushi');
 assert.deepEqual(x.modulos,MODULOS);
 assert(Object.values(x.modulos).every(x=>x===false));
});
test('nunca aceptar sucursales cruzadas ni activar permisos desde el navegador',()=>{
 assert.throws(()=>normalizarFichaLocal({...ficha,negocio_id:s},ids),/sucursal|negocio/);
 assert.throws(()=>normalizarFichaLocal({...ficha,plantilla:'inexistente'},ids),/Plantilla/);
 for(const unsafe of [{publicado:true},{copiarDatos:true},{pedidos:[1]},{modulos:{caja:true}},{store_id:'uki:serena'}])
  assert.throws(()=>normalizarFichaLocal({...ficha,...unsafe},ids),/activar/);
});
test('imagen segura, sin cuentas ni URL ajena y sin inventar foto',()=>{
 const x=normalizarFichaLocal({...ficha,logoUrl:'https://imagenes.ejemplo.cl/logo.png'},ids);
 assert.equal(x.logoUrl,'https://imagenes.ejemplo.cl/logo.png');
 for(const url of ['data:image/png;base64,AAAA','http://ejemplo.cl/logo.png',
  'https://user:clave@ejemplo.cl/logo.png'])
  assert.throws(()=>normalizarFichaLocal({...ficha,logoUrl:url},ids));
});
test('respeta identificadores originales Uki y Romo',()=>{
 assert.equal(storeIdConocido('Uki Sushi','Regimiento Arica'),'uki:arica');
 const srv=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 assert.doesNotMatch(srv,/const known=core\.storeIdConocido/);
 assert.match(srv,/storeId='local:'\+id/);
 assert.equal(storeIdConocido('Uki Sushi','La Serena'),'uki:serena');
 assert.equal(storeIdConocido("Romo's Sushi",'La Serena'),'romo:serena');
 assert.equal(storeIdConocido('Crepe Pop','La Serena'),null);
});
test('el panel de dueños conserva la ficha financiera y nuevo borrador separado',()=>{
 const owner=fs.readFileSync(path.join(__dirname,'../public/mi-administracion-duenos.html'),'utf8');
 assert.match(owner,/id="newBranch"/);assert.match(owner,/id="ownerLocalesOperativosQA"/);
 assert.match(owner,/uki-owner-locales-qa.mjs/);
 const api=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 assert.match(api,/UKI_LOCALES_OPERATIVOS_QA_ENABLED/);
 assert.match(api,/if\(!await authorized\(sql,req,who\)\)/);
 assert.match(api,/locales_operativos_guardar_qa/);
 assert.match(api,/locales_operativos_crear_qa/);
 const migration=fs.readFileSync(path.join(__dirname,'../migrations/2026-11-13-registro-locales-duenos-qa.sql'),'utf8');
 assert.match(migration,/UNIQUE REFERENCES public.fin_sucursales/);
 assert.match(migration,/estado='borrador'/);
});
