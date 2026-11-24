'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const demo=read('public/seguimiento-demo-qa.html');
const panel=read('public/romo-panel-qa/index.html');
test('demostración visual abierta sin Google ni pedidos reales',()=>{
 assert.match(demo,/Vista de revisión · Datos ficticios/);
 assert.match(demo,/sin conexión a pedidos ni a Santander/);
 assert.match(demo,/Uki Regimiento Arica/);
 assert.match(demo,/Uki La Serena/);
 assert.match(demo,/Romo Sushi La Serena/);
 assert.doesNotMatch(demo,/<script[^>]*src=|fetch\s*\(|XMLHttpRequest|indexedDB|localStorage|sessionStorage|firebase|Authorization:|Bearer\s|neon\(/i);
 assert.match(demo,/cliente avisó/i);
 const scripts=[...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new vm.Script(scripts[0][1],{filename:'seguimiento-demo-qa.html'}));
});
test('panel QA ofrece revisión sin iniciar sesión, sólo en preview temporal',()=>{
 assert.match(panel,/Ver cambios de seguimiento · sin ingresar/);
 assert.match(panel,/\/seguimiento-demo-qa\.html/);
 assert.match(panel,/romos-sushi-panel-\[a-z0-9\]\+-diannaleandra-7046\\\.vercel\\\.app/);
 assert.match(panel,/signInWithPopup\(auth,new GoogleAuthProvider\(\)\)/);
});
