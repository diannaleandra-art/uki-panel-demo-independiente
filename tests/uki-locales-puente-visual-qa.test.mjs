import test from 'node:test';
import assert from 'node:assert/strict';
import {crearMensajeVisualRomoQA,enviarVistaRomoQA,ROMO_VISUAL_PREVIEW_QA_ENABLED}
 from '../public/uki-locales-puente-visual-qa.mjs';
import {prepararVinculoLocalQA} from '../public/uki-locales-motor-qa.mjs';
const b='123e4567-e89b-42d3-a456-426614174001';
const s='123e4567-e89b-42d3-a456-426614174002';
const disabled={carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false};
const registro={store_id:'romo:serena',negocio_id:b,sucursal_id:s,estado:'borrador',revision:3,
 configuracion:{version:1,motor:'uki-panel-unico',copiarDatos:false,plantilla:'uki-motor',
  nombre:'Romo’s Sushi La Serena',direccion:'Balmaceda 1612, La Serena',
  color:'#c12126',logoUrl:'https://ejemplo.cl/logo.webp',portadaUrl:'',
  whatsapp:'+56911112222',instagram:'@romos_sushi',horarios:'10:00–23:00',modulos:disabled}};
test('descriptor del dueño contiene solamente identidad pública de Romo',()=>{
 const m=crearMensajeVisualRomoQA(prepararVinculoLocalQA(registro));
 assert.deepEqual(Object.keys(m).sort(),['identidad','protocolo','revision','soloVistaPrevia','storeId']);
 assert.equal(m.storeId,'romo:serena');assert.equal(m.revision,3);
 assert.equal(m.identidad.direccion,'Balmaceda 1612, La Serena');
 assert.equal(m.identidad.logoUrl,'https://ejemplo.cl/logo.webp');
 for(const forbidden of ['pin','token','pedido','cliente','estado','caja','fin','inventario','usuario','negocio_id','sucursal_id'])
  assert.equal(JSON.stringify(m).toLowerCase().includes('"'+forbidden+'"'),false);
});
test('no se envía nada a la carta al estar apagada',()=>{
 const m=crearMensajeVisualRomoQA(prepararVinculoLocalQA(registro));
 let called=0;const ventanaDestino={postMessage:()=>called++};
 assert.equal(ROMO_VISUAL_PREVIEW_QA_ENABLED,false);
 assert.throws(()=>enviarVistaRomoQA({mensaje:m,ventanaDestino}),/deshabilitada/);
 assert.equal(called,0);
});
test('solo un origen fijo y ningún dato adicional viaja a carta',()=>{
 const m=crearMensajeVisualRomoQA(prepararVinculoLocalQA(registro));
 const sent=[];const ventanaDestino={postMessage:(a,b)=>sent.push([a,b])};
 assert.throws(()=>enviarVistaRomoQA({mensaje:m,ventanaDestino,habilitada:true,origenDestino:'https://otro.cl'}),/Destino/);
 assert.throws(()=>enviarVistaRomoQA({mensaje:{...m,token:'secreto'},ventanaDestino,habilitada:true}),/inválido/);
 assert.equal(enviarVistaRomoQA({mensaje:m,ventanaDestino,habilitada:true}),true);
 assert.equal(sent.length,1);assert.equal(sent[0][1],'https://uki-sushi-pedidos.vercel.app');
});
test('no se puede pasar configuración de Uki ni habilitar caja',()=>{
 assert.throws(()=>crearMensajeVisualRomoQA(prepararVinculoLocalQA({...registro,store_id:'uki:serena'})));
 assert.throws(()=>crearMensajeVisualRomoQA(prepararVinculoLocalQA({...registro,
  configuracion:{...registro.configuracion,modulos:{...disabled,caja:true}}})));
});
