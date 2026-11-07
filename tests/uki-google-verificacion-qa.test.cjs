'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const qa=require('../api/uki-admin-verificacion-qa.js')._testing;
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const env={VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'feature/uki-disponibilidad-manual-live-2026-11-06',
 UKI_INVENTARIO_QA_ENABLED:'true'};
test('el verificador de Google NO funciona en producción ni en otras ramas',()=>{
 assert.equal(qa.qaEnabled(env),true);
 for(const patch of [
  {VERCEL_ENV:'production'},
  {VERCEL_GIT_COMMIT_REF:'main'},
  {UKI_INVENTARIO_QA_ENABLED:'false'}])
  assert.equal(qa.qaEnabled({...env,...patch}),false);
});
test('el verificador acepta fechas Chile y exige Google; no tiene escrituras en DB',()=>{
 for(const day of ['2026-11-07','2026-03-31'])assert.equal(qa.validDay(day),true);
 for(const day of ['2026-02-30','2026-11-45','07-11-2026',''])assert.equal(qa.validDay(day),false);
 const api=source('api/uki-admin-verificacion-qa.js');
 assert.ok(api.includes('googleAdmin(req)'));
 assert.match(api,/jwtVerify/);
 assert.match(api,/action==='diagnostico'/);
 assert.match(api,/action==='historial'/);
 assert.match(api,/\['diagnostico','historial','revision'\]/);
 assert.match(api,/uki_inventario_revisiones_qa/);
 assert.match(api,/qaDatabase\(\)/);
 assert.doesNotMatch(api,/INSERT INTO|UPDATE public\.|DELETE FROM|DROP TABLE|ALTER TABLE/i);
 assert.doesNotMatch(api,/uki_inventario_revisiones_live/);
 assert.doesNotMatch(api,/return \{uid:.*email/i);
});
test('la pantalla móvil permite autenticación y pruebas QA sin contraseñas ni tocar prod',()=>{
 const html=source('public/verificar-administracion.html');
 const app=source('public/uki-admin-verificacion-qa.mjs');
 assert.match(html,/Entrar con Google/);
 assert.match(html,/SOLO PRUEBAS/);
 for(const feature of ['Comprobar acceso','Probar producto y precio','Consultar historial de prueba',
  'Descargar Excel','Descargar PDF','Compartir WhatsApp']){
  assert.ok(html.includes(feature),feature);
 }
 for(const feature of ['signInWithPopup','onAuthStateChanged','auth\\/unauthorized-domain',
   "QA_HOST='uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app'",
  "call('/api/uki-admin-verificacion-qa'","call('/api/uki-carta-precios-live'",
  "call('/api/uki-disponibilidad-live'","prices('crear-producto'","prices('editar-precio'",
  "availability('marcar'","diag('revision'"]){
  assert.ok(app.includes(feature.replaceAll('\\/','/')),feature);
 }
 assert.ok(app.includes("if(restricted)"),'no usar dominio de producción');
 assert.ok(app.includes("auth.currentUser.getIdToken()"),'obtiene token Google real, no simulado');
 assert.ok(app.includes("SOLO PRUEBAS"),'mensajes diferencian QA');
 assert.doesNotMatch(app,/https:\/\/uki-sushi-pedidos\.vercel\.app\/api/);
 assert.ok(html.includes('./uki-inventario-exportar.js'));
 assert.equal(source('public/uki-inventario-exportar.js'),source('firebase/uki-inventario-exportar.js'));
});
