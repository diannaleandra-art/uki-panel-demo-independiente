import test from 'node:test';
import assert from 'node:assert/strict';
import {iniciarLocalesOperativosQA} from '../public/uki-owner-locales-qa.mjs';

const negocio='123e4567-e89b-42d3-a456-426614174001';
const sucursal='123e4567-e89b-42d3-a456-426614174002';
const registro='123e4567-e89b-42d3-a456-426614174003';
const modulos={carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false};
const perfil={version:1,motor:'uki-panel-unico',copiarDatos:false,
 nombre:'Romo’s Sushi La Serena',direccion:'Balmaceda 1612, La Serena',
 whatsapp:'',instagram:'',horarios:'',plantilla:'uki-motor',
 color:'#bc1725',logoUrl:'',portadaUrl:'',modulos};
class Nodo{
 constructor(id='',esSelect=false){
  this.id=id;this.esSelect=esSelect;this.value='';this.options=[];
  this.children=[];this.listeners={};this.files=[];this.style={};
  this.hidden=false;this.disabled=false;this.open=false;this.textContent='';
 }
 replaceChildren(...items){
  this.children=items;
  if(this.esSelect){this.options=items;this.value=items[0]?.value||'';}
 }
 add(item){this.options.push(item);if(this.options.length===1)this.value=item.value;}
 append(...items){this.children.push(...items);}
 addEventListener(kind,handler){this.listeners[kind]=handler;}
 scrollIntoView(){}
}
function simularPantalla(){
 const select=new Set(['ownerLocBiz','ownerLocBranch','ownerLocExisting','ownerLocTemplate']);
 const elements=new Map();
 const by=id=>{
  if(!elements.has(id))elements.set(id,new Nodo(id,select.has(id)));
  return elements.get(id);
 };
 const prevDocument=globalThis.document,prevOption=globalThis.Option;
 globalThis.document={getElementById:by,createElement:tag=>new Nodo(tag)};
 globalThis.Option=class{constructor(nombre,value){this.nombre=nombre;this.value=value}};
 let actual={
  id:registro,negocio_id:negocio,sucursal_id:sucursal,store_id:'romo:serena',
  revision:1,estado:'borrador',configuracion:{...perfil}
 };
 const notifications=[],calls=[];
 const api=async(action,payload)=>{
  calls.push([action,payload]);
  if(action==='locales_operativos_diagnostico_qa')
   return {diagnostico:{lecturaBorradoresHabilitada:true,registroHabilitado:true}};
  if(action==='locales_operativos_listar_qa')return {locales:[structuredClone(actual)]};
  if(action==='locales_operativos_guardar_qa'){
   if(payload.expectedRevision!==actual.revision)
    throw Error('La ficha cambió desde otro teléfono; revisa antes de guardar.');
   const {negocio_id,sucursal_id,...config}=payload.ficha;
   assert.equal(negocio_id,negocio);
   assert.equal(sucursal_id,sucursal);
   actual={...actual,revision:actual.revision+1,
    configuracion:{...actual.configuracion,...config}};
   return {local:{store_id:'romo:serena',revision:actual.revision}};
  }
  throw Error('Ruta inesperada '+action);
 };
 const ui=iniciarLocalesOperativosQA({
  api,negocios:()=>[{id:negocio,nombre:"Romo's Sushi"}],
  sucursales:()=>[{id:sucursal,negocio_id:negocio,nombre:'La Serena'}],
  notificar:(m,type)=>notifications.push({m,type})
 });
 return {
  by,ui,calls,notifications,
  current:()=>actual,
  externalUpdate:patch=>{
   actual={...actual,revision:actual.revision+1,
    configuracion:{...actual.configuracion,...patch}};
  },
  cleanup:()=>{
   globalThis.document=prevDocument;globalThis.Option=prevOption;
  }
 };
}
test('panel completo: abrir, conservar cambios, guardar y resolver conflicto',async()=>{
 const env=simularPantalla();
 try{
  const {by,ui,calls,current,externalUpdate}=env;
  by('ownerLocBiz').value=negocio;
  ui.sync();
  by('ownerLocBranch').value=sucursal;
  await ui.consultar();
  assert.equal(by('ownerLocName').value,'Romo’s Sushi La Serena');
  assert.equal(by('ownerLocAddress').value,'Balmaceda 1612, La Serena');
  assert.equal(by('ownerLocSave').disabled,false);
  // El dueño escribe y una consulta automática NO debe borrar lo escrito.
  by('ownerLocName').value='Romo, nombre en preparación';
  await ui.consultar();
  assert.equal(by('ownerLocName').value,'Romo, nombre en preparación');
  assert.match(by('ownerLocStatus').textContent,/Conservamos los cambios/);
  await by('ownerLocSave').onclick();
  assert.equal(current().revision,2);
  assert.equal(current().configuracion.nombre,'Romo, nombre en preparación');
  assert.equal(by('ownerLocName').value,'Romo, nombre en preparación');
  const guardados=calls.filter(([name])=>name==='locales_operativos_guardar_qa');
  assert.equal(guardados[0][1].expectedRevision,1);
  // Una edición en otro teléfono cambia la revisión del servidor.
  externalUpdate({nombre:'Nombre actualizado desde otro teléfono'});
  by('ownerLocName').value='Mi versión sin guardar';
  await by('ownerLocSave').onclick();
  assert.equal(by('ownerLocName').value,'Mi versión sin guardar');
  assert.equal(by('ownerLocSave').disabled,true);
  assert.equal(by('ownerLocReloadConflict').hidden,false);
  await ui.consultar();
  assert.equal(by('ownerLocName').value,'Mi versión sin guardar');
  // Solo una pulsación explícita recarga la versión del segundo teléfono.
  await by('ownerLocReloadConflict').onclick();
  assert.equal(by('ownerLocName').value,'Nombre actualizado desde otro teléfono');
  assert.equal(by('ownerLocReloadConflict').hidden,true);
  assert.equal(by('ownerLocSave').disabled,false);
  assert.equal(current().revision,3);
  assert.equal(current().configuracion.modulos.publicado,false);
 }finally{env.cleanup()}
});
