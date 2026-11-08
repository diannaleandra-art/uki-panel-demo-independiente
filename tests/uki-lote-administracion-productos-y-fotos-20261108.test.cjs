'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const panel=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const prices=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
const ingredients=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
const apiP=require('../api/uki-carta-precios-live.js');
const apiI=require('../api/uki-ingredientes-armado-live.js');
const apiPhoto=require('../api/uki-carta-fotos-live.js');
test('Los nuevos APIs no alteran datos de pedidos ni caja, autenticación obligatoria',()=>{
 const files=['uki-carta-precios-live.js','uki-ingredientes-armado-live.js','uki-carta-fotos-live.js'];
 for(const file of files){
  const s=fs.readFileSync('api/'+file,'utf8');
  assert.match(s,/jwtVerify/);
  assert.doesNotMatch(s,/UPDATE\s+public\.uki_(?:pedidos|caja|cierres)|DELETE\s+FROM\s+public\.uki_(?:pedidos|caja|cierres)/i);
  assert.match(s,/branch/);
 }
 assert.match(prices,/Retirar de carta/);
 assert.match(prices,/restaurar-producto/);
 assert.match(ingredients,/Quitar ingrediente de la carta/);
 assert.match(ingredients,/restaurar/);
});
test('Retirar productos se puede revertir y no elimina ventas antiguas',()=>{
 const src=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.match(src,/action==='retirar-producto'\|\|action==='restaurar-producto'/);
 assert.match(src,/uki_carta_visibilidad_v1/);
 assert.match(src,/visibilityVersion/);
 assert.match(src,/const items=await listing\(sql,branch\)/);
 assert.doesNotMatch(src,/DELETE FROM\s+public\.uki_carta_productos_custom_v1/);
});
test('Retirar ingredientes no confunde stock y disponibilidad; conserva SKU',()=>{
 const src=fs.readFileSync('api/uki-ingredientes-armado-live.js','utf8');
 assert.match(src,/if\(action==='retirar'\|\|action==='restaurar'\)/);
 assert.match(src,/UPDATE public\.uki_armado_ingredientes_v1 SET available=/);
 assert.doesNotMatch(src,/DELETE FROM public\.uki_armado_ingredientes_v1/);
});
test('Foto comprimida JPEG, WebP o PNG; rechazo de datos ajenos',()=>{
 const {validPicture,validSku}=apiPhoto._test;
 const jpg=Buffer.alloc(160,1);jpg[0]=255;jpg[1]=216;jpg[2]=255;
 assert.equal(validPicture('image/jpeg',jpg.toString('base64')),true);
 assert.equal(validPicture('image/png',jpg.toString('base64')),false);
 assert.equal(validPicture('image/svg+xml',jpg.toString('base64')),false);
 assert.equal(validPicture('image/jpeg',Buffer.alloc(300000,1).toString('base64')),false);
 for(const sku of ['monthly:promo-24','classic:24','dish:burger-promo','pizza:cheese'])
  assert.equal(validSku(sku),true);
 for(const sku of ['ingredient:frutilla','', '../x','dish:<img>'])
  assert.equal(validSku(sku),false);
});
test('Fotos en servidor administradas por usuario, sucursal y versión; no actualizan precios',()=>{
 const src=fs.readFileSync('api/uki-carta-fotos-live.js','utf8');
 assert.match(src,/const enabled=env=>/);
 assert.match(src,/VERCEL_ENV==='preview'/);
 assert.match(src,/uid=await authorize\(req,env\)/);
 assert.match(src,/expected_version/);
 assert.match(src,/ON CONFLICT\(branch,sku\) DO UPDATE/);
 assert.match(src,/WHERE public\.uki_carta_fotos_v1\.version=\$5/);
 assert.match(src,/DELETE FROM public\.uki_carta_fotos_v1 WHERE branch=\$1 AND sku=\$2 AND version=\$3/);
 assert.match(src,/SELECT sku,version,mime/);
 assert.doesNotMatch(src,/UPDATE\s+public\.uki_carta_items_v1|UPDATE\s+public\.uki_carta_productos_custom_v1/);
});
test('La edición de fotografías se hace desde Carta y precios, disponible en iPhone',()=>{
 assert.match(prices,/photoControls\(price\)/);
 assert.match(prices,/reduceImage\(file\)/);
 assert.match(prices,/file\.type/);
 assert.match(prices,/state\.photos/);
 assert.match(prices,/subir/);
 assert.match(prices,/Quitar foto/);
});
test('Migración se mantiene aislada de inventario y caja',()=>{
 const sql=fs.readFileSync('sql/uki-carta-fotos-v1.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.uki_carta_fotos_v1/);
 assert.match(sql,/PRIMARY KEY \(branch,sku\)/);
 assert.doesNotMatch(sql,/\bDROP\s+TABLE\b|\bUPDATE\s+public\.|\bDELETE\s+FROM\b/i);
});

test('QA etapa 2: fotos y carta nunca apuntan a Neon producción en preview',()=>{
 const {url}=require('../lib/uki-inventario-db-live.cjs');
 const qaHost='ep-lingering-glade-b5m4hfhu.c-7.us-east-2.aws.neon.tech';
 const liveHost='ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech';
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/uki-carta-ordenada-y-reconciliacion-20261108',
  UKI_INVENTARIO_QA_ENABLED:'true',UKI_INVENTARIO_QA_DATABASE_URL:'postgres://usuario:prueba@'+qaHost+'/neondb'};
 assert.ok(url(env)?.includes(qaHost));
 assert.equal(url({...env,UKI_INVENTARIO_QA_DATABASE_URL:'postgres://usuario:prueba@'+liveHost+'/neondb'}),null);
 assert.equal(url({...env,VERCEL_GIT_COMMIT_REF:'main'}),null);
 assert.equal(url({...env,VERCEL_ENV:'production'}),null);
 assert.equal(apiPhoto._test.enabled(env),true);
 assert.equal(apiPhoto._test.enabled({...env,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(apiPhoto._test.enabled({...env,VERCEL_ENV:'production'}),false);
});
test('Sucursal no asumida: la selección de sesión prevalece sobre cualquier campo enviado',()=>{
 assert.match(prices,/function branch\(\)\{const active=/);
 assert.doesNotMatch(prices,/\?\.value\|\|'arica'/);
 assert.match(prices,/body:JSON\.stringify\(\{\.\.\.fields,action,branch:atBranch\}\)/);
});

test('QA: las rutas de carta, inventario y fotos utilizan exclusivamente su preview',()=>{
 const preview='https://uki-sushi-panel-ejemplo-diannaleandra-7046.vercel.app';
 assert.ok(prices.includes("const BACKEND=QA_HOST.test(location.hostname)?location.origin:"));
 assert.ok(prices.includes("const STOCK_API=BACKEND+'/api/inventario-turno-live';"));
 assert.ok(prices.includes("const PHOTO_API=BACKEND+'/api/uki-carta-fotos-live';"));
 const ing=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
 assert.ok(ing.includes('uki-sushi-inventario|uki-sushi-panel'));
 assert.ok(ing.includes('body:JSON.stringify({...fields,action,branch:chosen})'));
 const pricesApi=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.ok(pricesApi.includes('qaOrigin(origin)'));
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/uki-carta-ordenada-y-reconciliacion-20261108',UKI_INVENTARIO_QA_ENABLED:'true',VERCEL_URL:'uki-sushi-panel-ejemplo-diannaleandra-7046.vercel.app'};
 assert.equal(apiPhoto._test.originAllowed(preview,env),true);
 assert.equal(apiPhoto._test.originAllowed(preview,{...env,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(apiPhoto._test.originAllowed(preview,{...env,VERCEL_ENV:'production'}),false);
});
