import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comprobarGoogleDuenosRomoQA}
  from '../firebase/uki-romo-vinculo-duenos-qa.mjs';

test('desactivado: no consulta sesión, no envía tokens ni realiza fetch',async()=>{
 let tokenCalls=0,fetchCalls=0;
 await assert.rejects(()=>comprobarGoogleDuenosRomoQA({
  getToken:async()=>{tokenCalls++;return 'un_token';},
  fetchFn:async()=>{fetchCalls++;throw Error('No debe conectarse')}
 }),/desactivada/);
 assert.equal(tokenCalls,0);
 assert.equal(fetchCalls,0);
});

test('no admite una URL pasada por navegador sin configurar la URL interna',async()=>{
 let fetchCalls=0;
 await assert.rejects(()=>comprobarGoogleDuenosRomoQA({
  endpoint:'https://sitio-falso.example/api',
  getToken:async()=>('x'.repeat(64)),
  fetchFn:async()=>{fetchCalls++}
 }),/desactivada/);
 assert.equal(fetchCalls,0);
});

test('la misma sesión de Uki se reutiliza sin nueva pantalla de Google',()=>{
 const source=readFileSync(new URL('../firebase/uki-romo-vinculo-duenos-qa.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(source,/window\.ukiInventarioToken\?\.\(\)/);
 assert.match(source,/const ROMO_DUENOS_CHECK_ENDPOINT='';/);
 assert.doesNotMatch(source,/signInWithPopup|signInWithRedirect|createUserWithEmailAndPassword/);
 assert.match(html,/uki-romo-vinculo-duenos-qa\.mjs/);
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/Falta conectar el almacenamiento exclusivo de Romo/);
});
