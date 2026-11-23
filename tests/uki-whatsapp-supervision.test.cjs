'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const wa = require('../lib/uki-whatsapp-supervision.cjs');
const secret = crypto.randomBytes(32).toString('base64');
const map = {'1234567890':'uki:arica'};
const packet = {
 object:'whatsapp_business_account',
 entry:[{changes:[{field:'messages',value:{
  messaging_product:'whatsapp',
  metadata:{phone_number_id:'1234567890'},
  messages:[{id:'wamid.test',from:'56912345678',timestamp:'1795456800',type:'text',text:{body:'60 piezas'}}]
 }}]}]
};
test('mensaje recibido y sucursal correcta',()=>{
 const rows=wa.extractMessages(packet,map);
 assert.equal(rows.length,1);
 assert.equal(rows[0].sucursal,'uki:arica');
 assert.equal(rows[0].direction,'cliente');
});
test('no atribuye error a un pedido sin asociación verificada',()=>{
 assert.equal(wa.comparePieces('60 piezas',{piezas:36}).status,'sin_vinculo');
 assert.equal(wa.comparePieces('60 piezas',{piezas:36,vinculo_verificado:true}).status,'revisar');
});
test('cifrado del contenido y detección de manipulación',()=>{
 const sealed=wa.seal('pedido de prueba',secret,'uki:arica|m1');
 assert.equal(wa.unseal(sealed,secret,'uki:arica|m1'),'pedido de prueba');
 assert.throws(()=>wa.unseal(sealed,secret,'uki:serena|m1'));
});
test('firma inválida no pasa',()=>{
 assert.equal(wa.verifiedSignature(Buffer.from('abc'),'sha256=abc','test'),false);
});
test('filtrado por sucursal',()=>{
 assert.equal(wa.extractMessages(packet,{'1234567890':'romo:serena'})[0].sucursal,'romo:serena');
 assert.equal(wa.extractMessages(packet,{})[0],undefined);
});
