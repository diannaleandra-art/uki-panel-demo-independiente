'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {prepararEdicionSeguraQA,guardarEdicionSeguraQA,ConflictoFichaQA}=
 require('../lib/uki-locales-edicion-segura-servidor-qa.cjs');
const b='123e4567-e89b-42d3-a456-426614174001',s='123e4567-e89b-42d3-a456-426614174002',id='123e4567-e89b-42d3-a456-426614174003';
const modules={carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false};
const oldConfig={version:1,motor:'uki-panel-unico',copiarDatos:false,plantilla:'uki-motor',
 nombre:'Romo’s Sushi La Serena',direccion:'Balmaceda 1612, La Serena',
 color:'#bc1725',logoUrl:'https://imagenes.ejemplo.cl/logo.webp',
 portadaUrl:'https://imagenes.ejemplo.cl/portada.webp',modulos:modules};
const existing={id,store_id:'romo:serena',estado:'borrador',revision:1,configuracion:oldConfig};
const edit={...oldConfig,nombre:'Romo La Serena',logoUrl:'',portadaUrl:''};
const start={existente:existing,configuracion:edit,negocioId:b,sucursalId:s,revision:1};
test('guardar texto en el servidor no borra logo ni portada existentes',async()=>{
 const p=prepararEdicionSeguraQA(start);
 const args=[];
 const db={query:async(sql,params)=>{
  args.push({sql,params});return [{id,store_id:'romo:serena',revision:2,estado:'borrador'}];
 }};
 const saved=await guardarEdicionSeguraQA({db,preparada:p,actor:'google-usuario-qa'});
 assert.equal(saved.revision,2);
 assert.equal(args[0].params[2],'romo:serena');
 const value=JSON.parse(args[0].params[3]);
 assert.equal(value.nombre,'Romo La Serena');
 assert.equal(value.logoUrl,oldConfig.logoUrl);
 assert.equal(value.portadaUrl,oldConfig.portadaUrl);
 assert.equal(value.modulos.caja,false);
 assert.equal(value.modulos.publicado,false);
 assert.match(args[0].sql,/AND store_id=\$3/);
 assert.match(args[0].sql,/AND revision=\$6 AND estado='borrador'/);
});
test('dos teléfonos con revisión 1: el segundo no sobrescribe al primero',async()=>{
 let revisionReal=1,escrituras=0;
 const db={query:async(sql,args)=>{
  assert.match(sql,/UPDATE public\.fin_locales_operativos_qa/);
  if(args[5]!==revisionReal)return [];
  revisionReal++;escrituras++;
  return [{id,store_id:'romo:serena',revision:revisionReal,estado:'borrador'}];
 }};
 const first=prepararEdicionSeguraQA(start);
 const second=prepararEdicionSeguraQA(start);
 const one=await guardarEdicionSeguraQA({db,preparada:first,actor:'google-a'});
 await assert.rejects(guardarEdicionSeguraQA({db,preparada:second,actor:'google-b'}),
  e=>e instanceof ConflictoFichaQA);
 assert.equal(one.revision,2);
 assert.equal(escrituras,1);
});
test('no permite cambiar fotos por URL sin flujo de imágenes autorizado',()=>{
 assert.throws(()=>prepararEdicionSeguraQA({...start,
  configuracion:{...edit,logoUrl:'https://otro.cl/logo.png'}}),/fotografías/);
 assert.throws(()=>prepararEdicionSeguraQA({...start,
  configuracion:{...edit,portadaUrl:'data:image/png;base64,A'}}),/inválido|inseguro/);
});
test('no modifica un local vencido, activo o con permisos de venta',()=>{
 assert.throws(()=>prepararEdicionSeguraQA({...start,revision:2}),ConflictoFichaQA);
 assert.throws(()=>prepararEdicionSeguraQA({...start,existente:{...existing,estado:'activo'}}));
 assert.throws(()=>prepararEdicionSeguraQA({...start,
  configuracion:{...edit,modulos:{...modules,pedidos:true}}}));
 assert.throws(()=>prepararEdicionSeguraQA({...start,
  existente:{...existing,configuracion:{...oldConfig,modulos:{...modules,caja:true}}}}));
});
test('el API usa guardado protegido, exige sesión de dueños y deja ventas cerradas',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 assert.match(api,/guardarEdicionSeguraQA/);
 assert.match(api,/prepararEdicionSeguraQA/);
 assert.match(api,/UKI_LOCALES_OPERATIVOS_QA_ENABLED/);
 const auth=api.indexOf("if(!await authorized(sql,req,who))");
 const update=api.indexOf("if(['locales_operativos_guardar_qa','locales_operativos_crear_qa'].includes(action))");
 assert(auth>=0&&update>auth);
});

test('edición y auditoría se guardan en una única sentencia',async()=>{
 const prepared=prepararEdicionSeguraQA(start);
 assert.match(prepared.sql,/WITH actualizado AS/);
 assert.match(prepared.sql,/INSERT INTO public\.fin_auditoria/);
 assert.match(prepared.sql,/FROM actualizado a RETURNING id/);
 const captured=[];
 const db={query:async(sql,args)=>{
  captured.push(args);
  return [{id,store_id:'romo:serena',revision:2,estado:'borrador'}];
 }};
 await guardarEdicionSeguraQA({db,preparada:prepared,actor:'google-owner-qa'});
 assert.equal(captured.length,1);
 assert.equal(captured[0].length,8);
 assert.deepEqual(JSON.parse(captured[0][6]),{
  revision:1,campos:{nombre:'Romo’s Sushi La Serena'}
 });
 assert.deepEqual(JSON.parse(captured[0][7]),{
  revision:2,storeId:'romo:serena',campos:{nombre:'Romo La Serena'}
 });
});
test('un error al escribir la auditoría no se presenta como guardado válido',async()=>{
 let called=0;
 const db={query:async()=>{called++;throw Error('Fallo auditoría');}};
 await assert.rejects(
  guardarEdicionSeguraQA({db,preparada:prepararEdicionSeguraQA(start),actor:'google-owner-qa'}),
  /Fallo auditoría/);
 assert.equal(called,1);
});
test('el controlador ya no graba una auditoría duplicada',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 const p=code.indexOf('cambiado=await seguro.guardarEdicionSeguraQA');
 assert(p>=0);
 const next=code.indexOf("if(revision!==0)",p);
 assert(next>p);
 assert.doesNotMatch(code.slice(p,next),/await audit\(sql,'local_qa'/);
});
