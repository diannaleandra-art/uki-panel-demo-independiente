'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {STORES,MAX_SECONDS,issueLink,verifyLink,matchesPersistedLink}=require('../lib/seguimiento-enlaces-seguros-v1.cjs');
const secret='a'.repeat(64),otherSecret='b'.repeat(64);
const orderId='621bd292-2153-4160-9e85-375978e10352';
const otherOrderId='621bd292-2153-4160-9e85-375978e10353';
const now=1795500000;
const rowFor=link=>({storeId:link.storeId,orderId:link.orderId,tokenHash:link.tokenHash,
 expiresAtSeconds:link.expiresAtSeconds,status:'active',revokedAt:null});
for(const storeId of Object.keys(STORES)){
 test(storeId+' · token firmado y huella por pedido sin datos personales',()=>{
  const link=issueLink({storeId,orderId,issuedAtSeconds:now,ttlSeconds:3600},secret);
  assert.ok(link.token.startsWith('st1.'));
  assert.ok(!link.token.includes('Santander'));
  assert.ok(!link.token.includes('telefono'));
  const checked=verifyLink(link.token,secret,{atSeconds:now+100});
  assert.equal(checked.storeId,storeId);
  assert.equal(checked.orderId,orderId);
  assert.equal(checked.tokenHash,link.tokenHash);
  assert.equal(matchesPersistedLink(checked,rowFor(link),{atSeconds:now+100}),true);
  assert.equal(matchesPersistedLink(checked,{...rowFor(link),storeId:'otro'},{atSeconds:now+100}),false);
  assert.equal(matchesPersistedLink(checked,{...rowFor(link),orderId:otherOrderId},{atSeconds:now+100}),false);
  assert.equal(matchesPersistedLink(checked,{...rowFor(link),status:'revoked'},{atSeconds:now+100}),false);
  assert.equal(matchesPersistedLink(checked,{...rowFor(link),revokedAt:'2026-11-24T12:00:00Z'},{atSeconds:now+100}),false);
 });
}
test('firma, expiración y tienda no se pueden falsificar',()=>{
 const link=issueLink({storeId:'uki:arica',orderId,issuedAtSeconds:now,ttlSeconds:120},secret);
 assert.equal(verifyLink(link.token,secret,{atSeconds:now+119})?.storeId,'uki:arica');
 assert.equal(verifyLink(link.token,secret,{atSeconds:now+120}),null);
 assert.equal(verifyLink(link.token,otherSecret,{atSeconds:now}),null);
 assert.equal(verifyLink(link.token.replace('.ua.','.rs.'),secret,{atSeconds:now}),null);
 assert.equal(verifyLink(link.token.replace(orderId,otherOrderId),secret,{atSeconds:now}),null);
 assert.equal(verifyLink(link.token.slice(0,-1)+'!',secret,{atSeconds:now}),null);
 assert.equal(verifyLink(link.token,secret,{atSeconds:now-61}),null);
});
test('enlace nuevo sustituye huella anterior sin duplicar pedido',()=>{
 const a=issueLink({storeId:'romo:serena',orderId,issuedAtSeconds:now},secret);
 const b=issueLink({storeId:'romo:serena',orderId,issuedAtSeconds:now},secret);
 assert.notEqual(a.token,b.token);
 assert.notEqual(a.tokenHash,b.tokenHash);
 assert.equal(matchesPersistedLink(verifyLink(a.token,secret,{atSeconds:now}),rowFor(b),{atSeconds:now}),false);
 assert.equal(matchesPersistedLink(verifyLink(b.token,secret,{atSeconds:now}),rowFor(b),{atSeconds:now}),true);
});
test('enlaces no duran más de siete días ni aceptan secreto débil',()=>{
 assert.throws(()=>issueLink({storeId:'uki:serena',orderId,issuedAtSeconds:now,ttlSeconds:MAX_SECONDS+1},secret));
 assert.throws(()=>issueLink({storeId:'uki:serena',orderId,issuedAtSeconds:now},'clave'));
 assert.throws(()=>issueLink({storeId:'desconocida',orderId,issuedAtSeconds:now},secret));
 assert.equal(verifyLink('falso',secret,{atSeconds:now}),null);
 assert.equal(verifyLink('',secret,{atSeconds:now}),null);
});
