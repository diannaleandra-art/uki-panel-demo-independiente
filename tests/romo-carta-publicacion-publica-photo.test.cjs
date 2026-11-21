'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const feed=fs.readFileSync(path.join(root,'api/romo-carta-cambios-publicos-qa.js'),'utf8');
const foto=fs.readFileSync(path.join(root,'api/romo-carta-foto-publica-qa.js'),'utf8');
test('solo orígenes Romo exactos consultan su feed comercial',()=>{
 for(const origin of [
  'https://romos-sushi-serena.vercel.app',
  'https://romos-sushi-carta-qa.vercel.app',
  'https://romos-sushi-carta-qa-diannaleandra-7046.vercel.app'
 ])assert.ok(feed.includes(origin)||origin==='https://romos-sushi-serena.vercel.app');
 assert.match(feed,/const cartaOrigenes=new Set/);
 assert.match(feed,/cartaOrigenes\.has\(origin\)/);
 assert.match(feed,/Access-Control-Allow-Origin',origin/);
 assert.doesNotMatch(feed,/Access-Control-Allow-Origin','\*'/);
});
test('fotografía pública solo GET, si publicada y versión exacta',()=>{
 assert.match(foto,/req\.method!=='GET'/);
 assert.match(foto,/\/\^monthly:romoq-/);
 assert.match(foto,/p->>'photoVersion'/);
 assert.match(foto,/p->>'available'/);
 assert.match(foto,/AND version=\$3/);
 assert.match(foto,/Content-Type','image\/jpeg/);
 assert.match(foto,/bytes\.length>300000/);
 for(const fragment of ['DELETE FROM','UPDATE public','INSERT INTO'])
  assert.ok(!foto.includes(fragment),'El endpoint de fotos no debe escribir');
 assert.doesNotMatch(foto,/Authorization/);
});
test('servidor de fotos y feed compilan con sintaxis válida',()=>{
 assert.doesNotThrow(()=>new vm.Script(foto,{filename:'romo-carta-foto-publica-qa.js'}));
 assert.doesNotThrow(()=>new vm.Script(feed,{filename:'romo-carta-cambios-publicos-qa.js'}));
});
