'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../lib/romo-seguimiento-chat-qa.cjs');
const secret='ab'.repeat(32),orderId='621bd292-2153-4160-9e85-375978e10352';
test('el chat se cifra sin texto plano; descifra sólo en su pedido y remitente',()=>{
 const message={storeId:'romo:serena',orderId,from:'cliente',body:'Hola, ¿cuánto falta?'};
 const enc=C.seal(message,secret);
 assert.ok(enc);
 assert.equal(enc.mensaje_cifrado.includes('Hola'),false);
 assert.equal(C.unseal({storeId:message.storeId,orderId,from:message.from,
  ciphertext:enc.mensaje_cifrado,nonce:enc.nonce},secret),'Hola, ¿cuánto falta?');
 assert.equal(C.unseal({storeId:message.storeId,orderId,from:'agendador',
  ciphertext:enc.mensaje_cifrado,nonce:enc.nonce},secret),null);
 assert.equal(C.unseal({storeId:message.storeId,orderId:'621bd292-2153-4160-9e85-375978e10353',
  from:message.from,ciphertext:enc.mensaje_cifrado,nonce:enc.nonce},secret),null);
});
test('no permite claves malas, spam grande ni otra sucursal',()=>{
 assert.equal(C.seal({storeId:'uki:serena',orderId,from:'cliente',body:'Hola'},secret),null);
 assert.equal(C.seal({storeId:'romo:serena',orderId,from:'cliente',body:'X'.repeat(801)},secret),null);
 assert.equal(C.seal({storeId:'romo:serena',orderId,from:'cliente',body:'Hola'},'mala'),null);
});
