import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararVinculoLocalQA,validarVinculoRomoQA,MOTOR_LOCALES_QA_HABILITADO} from '../public/uki-locales-motor-qa.mjs';
import {prepararBorradorRomoDesdeSolicitudQA} from '../firebase/uki-romo-recepcion-formulario-qa.mjs';
const b='123e4567-e89b-42d3-a456-426614174001',s='123e4567-e89b-42d3-a456-426614174002',id='123e4567-e89b-42d3-a456-426614174003';
const modulos={carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false};
const configuracion={version:1,motor:'uki-panel-unico',copiarDatos:false,
 plantilla:'uki-motor',nombre:'Romo’s Sushi La Serena',direccion:'Balmaceda 1612, La Serena',
 whatsapp:'+56912345678',instagram:'@romos_sushi',horarios:'10:00–23:00',
 color:'#bd1822',logoUrl:'',portadaUrl:'',modulos};
const record=(store_id='romo:serena')=>({store_id,negocio_id:b,sucursal_id:s,
 estado:'borrador',revision:1,configuracion});
test('ficha Romo misma tienda en carta y panel, apagada',()=>{
 const v=prepararVinculoLocalQA(record());
 assert.equal(v.storeId,'romo:serena');
 assert.equal(v.carta.storeId,v.panel.storeId);
 assert.equal(v.carta.ruta,'/romo/');
 assert.equal(v.carta.fuenteCatalogo,'romo:serena');
 assert.equal(v.carta.identidad.direccion,'Balmaceda 1612, La Serena');
 assert.equal(v.panel.motor,'uki-panel-unico');
 assert.equal(v.panel.operacionesHabilitadas,false);
 assert.equal(validarVinculoRomoQA(v),true);
 assert.equal(MOTOR_LOCALES_QA_HABILITADO,false);
});
test('sucursal Uki o nueva no hereda la carta Romo ni su caja',()=>{
 for(const store of ['uki:serena','uki:arica','local:123e4567-e89b-42d3-a456-426614174004']){
  const v=prepararVinculoLocalQA(record(store));
  assert.equal(v.carta.fuenteCatalogo,null);
  assert.equal(v.carta.publicada,false);
  assert.equal(v.panel.baseConectada,false);
  assert.throws(()=>validarVinculoRomoQA(v));
 }
});
test('datos ajenos o ventas habilitadas bloqueadas',()=>{
 assert.throws(()=>prepararVinculoLocalQA({...record(),configuracion:{...configuracion,color:'rojo'}}));
 assert.throws(()=>prepararVinculoLocalQA({...record(),configuracion:{...configuracion,modulos:{...modulos,caja:true}}}));
 assert.throws(()=>validarVinculoRomoQA({...prepararVinculoLocalQA(record()),puedePublicar:true}));
});
test('configuración Romo recupera precio explícito sin inventar cobro',()=>{
 const v=prepararVinculoLocalQA(record());
 const mensaje=['*ROMO’S SUSHI*','N.º de pedido: 271',
 'Sucursal: Romo’s Sushi La Serena','*COCINA*',
 '*− 1 × Clásico 24 piezas*','Roll 1: Pollo / palta / panko',
 '*ENTREGA*','Retiro','*PAGO*','Total productos: $7.000','Pago: Efectivo'].join('\n');
 const pedido=prepararBorradorRomoDesdeSolicitudQA({
  id,branch:'serena',estado:'pendiente',codigo_pedido:'271',
  cliente:'Cliente de prueba',telefono:'+56912345678',mensaje,total_indicado:7000
 });
 assert.equal(v.panel.sucursal,pedido.sucursalCarta);
 assert.equal(pedido.items.length,1);
 assert.equal(pedido.items[0].precio,7000);
 assert.equal(pedido.pagado,false);
 assert.equal(pedido.cartaSolicitudRemotaId,id);
});
