'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path');
const {LIST_SQL,sanitize,listQA}=require('../lib/uki-locales-lectura-qa.cjs');
const id='123e4567-e89b-42d3-a456-426614174001';
const off={carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false};
const row={id,negocio_id:id,sucursal_id:id,store_id:'romo:serena',revision:1,
 estado:'borrador',creado_por:'interno',
 configuracion:{version:1,motor:'uki-panel-unico',copiarDatos:false,
 nombre:'Romo’s Sushi La Serena',direccion:'Balmaceda 1612, La Serena',
 color:'#bc1725',whatsapp:'',instagram:'',horarios:'',
 plantilla:'uki-motor',logoUrl:'',portadaUrl:'',modulos:off}};
test('lectura de Romo conserva datos útiles sin actor ni sesiones',()=>{
 const r=sanitize(row);
 assert.equal(r.store_id,'romo:serena');
 assert.equal(r.revision,1);
 assert.equal(r.configuracion.direccion,'Balmaceda 1612, La Serena');
 assert.equal(r.creado_por,undefined);
 assert.equal(r.configuracion.modulos.caja,false);
});
test('un borrador con ventas activas o ajeno se rechaza',()=>{
 for(const x of [{...row,estado:'activo'}, {...row,store_id:'uki:unknown'},
 {...row,configuracion:{...row.configuracion,modulos:{...off,publicado:true}}},
 {...row,configuracion:{...row.configuracion,copiarDatos:true}}])
  assert.throws(()=>sanitize(x));
});
test('lectura solo SELECT y no depende de edición habilitada',async()=>{
 const db={query:async q=>{assert.equal(q,LIST_SQL);return [row]}};
 const list=await listQA(db);
 assert.equal(list.length,1);
 assert.match(LIST_SQL,/^SELECT /);
 assert.doesNotMatch(LIST_SQL,/\b(INSERT|UPDATE|DELETE)\b/i);
 const api=fs.readFileSync(path.join(__dirname,'../api/mi-administracion-live.js'),'utf8');
 const auth=api.indexOf("if(!await authorized(sql,req,who))");
 const listEndpoint=api.indexOf("if(action==='locales_operativos_listar_qa')");
 const write=api.indexOf("if(['locales_operativos_guardar_qa','locales_operativos_crear_qa'].includes(action))");
 assert(auth>=0&&listEndpoint>auth&&write>listEndpoint);
});
