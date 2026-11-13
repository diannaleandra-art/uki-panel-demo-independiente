import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {firmaFormularioLocalQA,permiteRecargaFormularioQA}
 from '../public/uki-locales-formulario-protegido-qa.mjs';

test('se detecta cambio sin guardar incluso tras seleccionar fotos en el iPhone',()=>{
 const campos=new Map();
 const get=id=>campos.get(id)||{value:'',files:[]};
 campos.set('ownerLocBiz',{value:'negocio 1'});
 campos.set('ownerLocName',{value:'Romo La Serena'});
 const guardada=firmaFormularioLocalQA(get);
 assert.equal(permiteRecargaFormularioQA({firmaActual:guardada,firmaCargada:guardada}),true);
 campos.set('ownerLocName',{value:'Romo La Serena nuevo'});
 const modificada=firmaFormularioLocalQA(get);
 assert.notEqual(modificada,guardada);
 assert.equal(permiteRecargaFormularioQA({firmaActual:modificada,firmaCargada:guardada}),false);
 campos.set('ownerLocLogo',{files:[{name:'foto-romo.jpg',size:13512,lastModified:31}]});
 assert.notEqual(firmaFormularioLocalQA(get),modificada);
});
test('un conflicto de dos teléfonos conserva los campos hasta recarga explícita',()=>{
 const s='firma-1';
 assert.equal(permiteRecargaFormularioQA({
  firmaActual:s,firmaCargada:s,conflictoPendiente:true
 }),false);
 assert.equal(permiteRecargaFormularioQA({
  firmaActual:'editando',firmaCargada:s,conflictoPendiente:true,forzar:true
 }),true);
});
test('el formulario QA recarga después de guardar, nunca en una consulta automática con cambios',()=>{
 const owner=readFileSync(new URL('../public/uki-owner-locales-qa.mjs',import.meta.url),'utf8');
 assert.match(owner,/firmaCargada=firmaActual\(\)/);
 assert.match(owner,/permiteRecargaFormularioQA/);
 assert.match(owner,/async function consultar\(\{forzar=false\}=\{\}\)/);
 assert.match(owner,/if\(branch.value&&debeCargar\)leerBorradorSeleccionado\(\)/);
 assert.match(owner,/await consultar\(\{forzar:true\}\)/);
 assert.match(owner,/Conservamos los cambios escritos sin guardar/);
});
