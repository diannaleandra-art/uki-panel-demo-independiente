import test from 'node:test';
import assert from 'node:assert/strict';
import {TIENDAS_EXISTENTES_QA,resolverLocalQA,listarLocalesSeparadosQA} from '../public/uki-locales-registro-qa.mjs';
const b='123e4567-e89b-42d3-a456-426614174001',s='123e4567-e89b-42d3-a456-426614174002';
const n='123e4567-e89b-42d3-a456-426614174003',t='123e4567-e89b-42d3-a456-426614174004';
const permisos={carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false};
const item=(store_id='romo:serena',sucursal_id=s)=>({
 store_id,sucursal_id,negocio_id:b,estado:'borrador',revision:1,
 configuracion:{version:1,motor:'uki-panel-unico',nombre:'Romo’s Sushi La Serena',
 plantilla:'uki-motor',color:'#dd0000',copiarDatos:false,logoUrl:'',portadaUrl:'',
 modulos:{...permisos}}
});
test('identidades de Uki y Romo inmutables',()=>{
 assert.deepEqual(TIENDAS_EXISTENTES_QA.map(x=>x.storeId),['uki:arica','uki:serena','romo:serena']);
});
test('Romo reutiliza motor, pero no abre pedidos ni publica',()=>{
 const r=resolverLocalQA(item());
 assert.equal(r.storeId,'romo:serena');
 assert.equal(r.tipo,'integracion');
 assert.equal(r.puedeRegistrarPedidos,false);
 assert.equal(r.puedePublicarCarta,false);
 assert.equal(r.copiarDatos,false);
});
test('nuevo local con mismo nombre obtiene identidad propia',()=>{
 const r=resolverLocalQA(item('local:'+n,t));
 assert.equal(r.tipo,'nuevo');
 assert.equal(r.storeId,'local:'+n);
 assert.throws(()=>resolverLocalQA(item('local:short',t)));
});
test('cualquier bandera de activación rechazada',()=>{
 assert.throws(()=>resolverLocalQA({...item(),estado:'activo'}));
 assert.throws(()=>resolverLocalQA({...item(),configuracion:{...item().configuracion,copiarDatos:true}}));
 for(const feature of Object.keys(permisos)){
  const i=item();i.configuracion.modulos[feature]=true;
  assert.throws(()=>resolverLocalQA(i),/activar/);
 }
});
test('borradores duplicados se rechazan por tienda o sucursal',()=>{
 assert.equal(listarLocalesSeparadosQA([item(),item('local:'+n,t)]).length,2);
 assert.throws(()=>listarLocalesSeparadosQA([item(),item('local:'+n,s)]),/registrada/);
 assert.throws(()=>listarLocalesSeparadosQA([item(),item('romo:serena',t)]),/registrada/);
});
